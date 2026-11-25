import { after, NextRequest, NextResponse } from "next/server";
import { getCatalogProduct } from "../../../lib/catalog-server";
import { newOperationId, StoreOrder } from "../../../lib/operations-store";
import { saveOrder, savePaymentProof } from "../../../lib/store-db";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] || character);
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const customer = body?.customer;
    const incomingItems = body?.items;
    if (!customer?.name || !/^01[0125][0-9]{8}$/.test(String(customer.phone || "")) || !body?.governorate || !customer.city || !customer.village || !customer.street || !Array.isArray(incomingItems) || !incomingItems.length || incomingItems.length > 30) {
      return NextResponse.json({ error: "Complete your delivery details and check your phone number." }, { status: 400 });
    }
    if (typeof customer.email !== "string" || customer.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim())) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    const payment = String(body.payment || "cod");
    if (!["cod", "vodafone", "instapay"].includes(payment)) return NextResponse.json({ error: "Choose a valid payment method." }, { status: 400 });

    const items: StoreOrder["items"] = [];
    for (const item of incomingItems as { productId?: string; size?: string; color?: string; quantity?: number }[]) {
      const quantity = Number(item.quantity);
      if (!item.productId || !item.size || !item.color || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) return NextResponse.json({ error: "Check the selected products, sizes, and quantities." }, { status: 400 });
      const product = await getCatalogProduct(item.productId);
      const variant = product?.product_variants.find(row => row.color === item.color && row.size === item.size && row.is_active !== false);
      if (!product || !variant) return NextResponse.json({ error: "A selected product or size is no longer available. Please refresh your bag." }, { status: 409 });
      if (variant.stock_quantity < quantity) return NextResponse.json({ error: `${product.name} (${item.size}) does not have enough stock.` }, { status: 409 });
      items.push({ productId: product.id, name: product.name, price: Number(variant.price_override ?? product.price), size: variant.size, color: variant.color, quantity, image: product.product_images[0]?.image_url || "" });
    }

    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const id = newOperationId("MVX");
    let proof = "";
    if (payment !== "cod") {
      if (typeof body.proof !== "string" || !body.proof) return NextResponse.json({ error: "Upload your payment transfer screenshot." }, { status: 400 });
      proof = await savePaymentProof(body.proof, id);
    }
    const order: StoreOrder = {
      id,
      customer: {
        name: String(customer.name).trim().slice(0, 120), phone: String(customer.phone), email: String(customer.email).trim().toLowerCase(), phone2: String(customer.phone2 || "").slice(0, 30),
        city: String(customer.city).trim().slice(0, 120), village: String(customer.village).trim().slice(0, 120), street: String(customer.street).trim().slice(0, 240),
        building: String(customer.building || "").slice(0, 120), notes: String(customer.notes || "").slice(0, 500),
      },
      governorate: String(body.governorate).slice(0, 80), items, subtotal, shipping: 120, total: subtotal + 120, payment,
      transaction: String(body.transaction || "").trim().slice(0, 100), proof,
      status: payment === "cod" ? "Pending confirmation" : "Awaiting payment review", date: new Date().toISOString(),
    };
    await saveOrder(order);

    const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
    const telegramRouteUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, "")}/api/telegram-notify`
      : new URL("/api/telegram-notify", process.env.NEXT_PUBLIC_SITE_URL || `http://localhost:${process.env.PORT || "3000"}`).toString();

    after(async () => {
      const emailNotification = notifyAdmin(order)
        .then(sent => { if (!sent) console.warn("Order saved; admin email notification is not configured."); })
        .catch(error => console.error("Order saved, but admin email notification failed:", error instanceof Error ? error.message : "Unknown email error"));

      const telegramNotification = (async () => {
        if (!telegramBotToken || !process.env.TELEGRAM_CHAT_ID?.trim()) {
          console.warn("Order saved; Telegram notification is not configured.");
          return;
        }
        try {
          const response = await fetch(telegramRouteUrl, {
            method: "POST",
            headers: { Authorization: `Bearer ${telegramBotToken}`, "Content-Type": "application/json" },
            body: JSON.stringify(order),
            cache: "no-store",
            signal: AbortSignal.timeout(10_000),
          });
          if (!response.ok) console.error("Order saved, but Telegram notification endpoint returned:", response.status);
        } catch (error) {
          console.error("Order saved, but Telegram notification failed:", error instanceof Error ? error.message : "Unknown Telegram error");
        }
      })();

      await Promise.all([emailNotification, telegramNotification]);
    });

    return NextResponse.json({ id: order.id }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save your order. Please try again." }, { status: 503 });
  }
}
