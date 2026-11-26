import { after, NextRequest, NextResponse } from "next/server";
import { getCatalogProduct } from "../../../lib/catalog-server";
import { newOperationId, StoreOrder } from "../../../lib/operations-store";
import { deletePaymentProof, saveOrder, savePaymentProof } from "../../../lib/store-db";

// Vercel's request payload ceiling is below the previous 5 MiB guard. A 3 MiB
// image expands to about 4 MiB when sent as base64, plus the checkout fields.
const MAX_ORDER_BODY_BYTES = Math.floor(4.4 * 1024 * 1024);
type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] || character);
}

function formatTelegramOrder(order: StoreOrder) {
  const address = [order.customer.street, order.customer.building, order.customer.village, order.customer.city, order.governorate]
    .filter(Boolean)
    .join(", ");
  const items = order.items.map(item =>
    `• <b>${escapeHtml(item.name.slice(0, 100))}</b> — ${escapeHtml(item.size.slice(0, 30))} / ${escapeHtml((item.color || "").slice(0, 50))} × ${item.quantity} — EGP ${(item.price * item.quantity).toLocaleString("en-EG")}`
  );
  const header = [
    "🛍️ <b>New MAVEX order</b>",
    `<b>Order:</b> ${escapeHtml(order.id)}`,
    `<b>Customer:</b> ${escapeHtml(order.customer.name)}`,
    `<b>Phone:</b> ${escapeHtml(order.customer.phone)}`,
    ...(order.customer.email ? [`<b>Email:</b> ${escapeHtml(order.customer.email)}`] : []),
    `<b>Address:</b> ${escapeHtml(address.slice(0, 240))}`,
    `<b>Payment:</b> ${escapeHtml(order.payment)}`,
    "<b>Items:</b>",
  ].join("\n") + "\n";
  const total = `\n<b>Total:</b> EGP ${order.total.toLocaleString("en-EG")}`;
  const messages: string[] = [];
  let current = header;

  for (const item of items) {
    if (current.length + item.length + total.length > 3900) {
      messages.push(current.trimEnd());
      current = `🛍️ <b>Order ${escapeHtml(order.id)} — items continued</b>\n`;
    }
    current += `${item}\n`;
  }

  messages.push(current + total);
  return messages;
}

async function notifyAdmin(order: StoreOrder) {
  const apiKey = process.env.RESEND_API_KEY;
  const adminEmail = process.env.MAVEX_ADMIN_EMAIL;
  const from = process.env.MAVEX_EMAIL_FROM;
  if (!apiKey || !adminEmail || !from) return false;

  const itemRows = order.items.map(item => `<li>${escapeHtml(item.name)} — ${escapeHtml(item.color || "")} / ${escapeHtml(item.size)} × ${item.quantity} — EGP ${(item.price * item.quantity).toLocaleString("en-EG")}</li>`).join("");
  const html = `<h1>New MAVEX order</h1><p><strong>Order:</strong> ${escapeHtml(order.id)}</p><p><strong>Customer:</strong> ${escapeHtml(order.customer.name)}</p><p><strong>Phone:</strong> ${escapeHtml(order.customer.phone)}</p><p><strong>Email:</strong> ${escapeHtml(order.customer.email || "")}</p><p><strong>Address:</strong> ${escapeHtml(`${order.customer.city}, ${order.governorate}, ${order.customer.village}, ${order.customer.street} ${order.customer.building || ""}`)}</p><p><strong>Payment:</strong> ${escapeHtml(order.payment)}</p><ul>${itemRows}</ul><p><strong>Total:</strong> EGP ${order.total.toLocaleString("en-EG")}</p>`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `mavex-order-${order.id}` },
    body: JSON.stringify({ from, to: [adminEmail], subject: `New MAVEX order ${order.id}`, html }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Resend returned ${response.status}`);
  return true;
}

async function notifyTelegram(order: StoreOrder) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  console.log("Telegram token exists:", !!token);
  console.log("Telegram chat ID exists:", !!chatId);

  if (!token || !chatId) {
    console.error("Telegram notification skipped: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing.");
    return;
  }

  for (const text of formatTelegramOrder(order)) {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
      signal: AbortSignal.timeout(8000),
    });
    const payload = await response.json().catch(() => null);
    const result = {
      ok: payload?.ok === true,
      status: response.status,
      error_code: payload?.error_code,
      description: typeof payload?.description === "string" ? payload.description : undefined,
      message_id: typeof payload?.result?.message_id === "number" ? payload.result.message_id : undefined,
    };
    console.log("Telegram API response:", result);
    if (!response.ok || !result.ok) throw new Error("Telegram did not accept the order notification.");
  }
}

export async function POST(request: NextRequest) {
  let uploadedProof = "";
  let savedOrderId = "";
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > MAX_ORDER_BODY_BYTES) {
      return NextResponse.json({ error: "The payment screenshot makes this order too large. Please upload an image smaller than 3 MB." }, { status: 413 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid order request." }, { status: 400 });
    }
    if (!isRecord(body) || !isRecord(body.customer)) {
      return NextResponse.json({ error: "Complete your delivery details and check your phone number." }, { status: 400 });
    }

    const customer = body.customer;
    const name = typeof customer.name === "string" ? customer.name.trim() : "";
    const phone = typeof customer.phone === "string" ? customer.phone.trim() : "";
    const email = typeof customer.email === "string" ? customer.email.trim() : "";
    const city = typeof customer.city === "string" ? customer.city.trim() : "";
    const village = typeof customer.village === "string" ? customer.village.trim() : "";
    const street = typeof customer.street === "string" ? customer.street.trim() : "";
    const governorate = typeof body.governorate === "string" ? body.governorate.trim() : "";
    const incomingItems = body.items;
    if (!name || name.length > 120 || !/^01[0125][0-9]{8}$/.test(phone) || !governorate || governorate.length > 80 ||
      !city || city.length > 120 || !village || village.length > 120 || !street || street.length > 240 ||
      !Array.isArray(incomingItems) || !incomingItems.length || incomingItems.length > 30) {
      return NextResponse.json({ error: "Complete your delivery details and check your phone number." }, { status: 400 });
    }
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    const payment = typeof body.payment === "string" ? body.payment : "cod";
    if (!["cod", "vodafone", "instapay"].includes(payment)) return NextResponse.json({ error: "Choose a valid payment method." }, { status: 400 });

    const requestedVariants = new Map<string, { productId: string; size: string; color: string; quantity: number }>();
    for (const candidate of incomingItems) {
      if (!isRecord(candidate)) return NextResponse.json({ error: "Check the selected products, sizes, and quantities." }, { status: 400 });
      const productId = typeof candidate.productId === "string" ? candidate.productId.trim() : "";
      const size = typeof candidate.size === "string" ? candidate.size.trim().toUpperCase() : "";
      const color = typeof candidate.color === "string" ? candidate.color.trim() : "";
      const quantity = candidate.quantity;
      if (!productId || productId.length > 160 || !size || size.length > 20 || !color || color.length > 40 || !Number.isInteger(quantity) || Number(quantity) < 1 || Number(quantity) > 10) {
        return NextResponse.json({ error: "Check the selected products, sizes, and quantities." }, { status: 400 });
      }
      const key = JSON.stringify([productId, color, size]);
      const existing = requestedVariants.get(key);
      const combinedQuantity = Number(quantity) + (existing?.quantity || 0);
      if (combinedQuantity > 10) return NextResponse.json({ error: "A product size can have at most 10 items per order." }, { status: 400 });
      requestedVariants.set(key, { productId, size, color, quantity: combinedQuantity });
    }

    const items: StoreOrder["items"] = [];
    for (const item of requestedVariants.values()) {
      const { quantity } = item;
      const product = await getCatalogProduct(item.productId);
      const variant = product?.product_variants?.find(row => row.color === item.color && row.size === item.size && row.is_active !== false);
      if (!product || !variant) return NextResponse.json({ error: "A selected product or size is no longer available. Please refresh your bag." }, { status: 409 });
      const availableStock = Number(variant.stock_quantity);
      const unitPrice = Number(variant.price_override ?? product.price);
      if (!Number.isSafeInteger(availableStock) || availableStock < 0 || !Number.isFinite(unitPrice) || unitPrice <= 0) {
        console.error("Order rejected because catalog inventory or price is invalid.", { productId: product.id, size: item.size });
        return NextResponse.json({ error: "This product is temporarily unavailable. Please contact MAVEX." }, { status: 503 });
      }
      if (availableStock < quantity) return NextResponse.json({ error: `${product.name} (${item.size}) does not have enough stock.` }, { status: 409 });
      items.push({ productId: product.id, name: product.name, price: unitPrice, size: variant.size, color: variant.color, quantity, image: product.product_images?.[0]?.image_url || "" });
    }

    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    if (!Number.isFinite(subtotal)) return NextResponse.json({ error: "The order total is invalid. Please refresh your bag." }, { status: 400 });
    const id = newOperationId("MVX");
    let proof = "";
    if (payment !== "cod") {
      if (typeof body.proof !== "string" || !body.proof || body.proof.length > 4 * 1024 * 1024 + 100) return NextResponse.json({ error: "Upload a JPG, PNG, or WebP payment screenshot up to 3 MB." }, { status: 400 });
      proof = await savePaymentProof(body.proof, id);
      uploadedProof = proof;
    }
    const order: StoreOrder = {
      id,
      customer: {
        name, phone, email: email.toLowerCase(), phone2: typeof customer.phone2 === "string" ? customer.phone2.trim().slice(0, 30) : "",
        city, village, street,
        building: typeof customer.building === "string" ? customer.building.trim().slice(0, 120) : "", notes: typeof customer.notes === "string" ? customer.notes.trim().slice(0, 500) : "",
      },
      governorate, items, subtotal, shipping: 120, total: subtotal + 120, payment,
      transaction: typeof body.transaction === "string" ? body.transaction.trim().slice(0, 100) : "", proof,
      status: payment === "cod" ? "Pending confirmation" : "Awaiting payment review", date: new Date().toISOString(),
    };
    await saveOrder(order);
    uploadedProof = "";
    savedOrderId = order.id;

    try { after(async () => {
      try {
        await notifyTelegram(order);
      } catch (error) {
        console.error("Order saved, but Telegram notification failed:", error instanceof Error ? error.message : "Unknown Telegram error");
      }
      try {
        const sent = await notifyAdmin(order);
        if (!sent) console.warn("Order saved; admin email notification is not configured.");
      } catch (error) {
        console.error("Order saved, but admin email notification failed:", error instanceof Error ? error.message : "Unknown email error");
      }
    }); } catch (error) {
      console.error("Order saved, but background notifications could not be scheduled:", error);
    }

    return NextResponse.json({ id: order.id }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (uploadedProof) await deletePaymentProof(uploadedProof).catch((cleanupError) => console.error("Could not remove an unsaved payment proof:", cleanupError));
    console.error("Could not create a MAVEX order:", error);
    if (savedOrderId) return NextResponse.json({ id: savedOrderId }, { status: 201, headers: { "Cache-Control": "no-store" } });
    const detail = error instanceof Error ? error.message : "";
    const safeError = detail.startsWith("Could not upload the payment proof:") || detail.startsWith("The payment proof")
      ? detail
      : "Could not save your order. Please try again.";
    return NextResponse.json({ error: safeError }, { status: 503 });
  }
}
