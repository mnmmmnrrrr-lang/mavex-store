import { NextRequest, NextResponse } from "next/server";
import type { StoreOrder } from "@/lib/operations-store";

function escapeHtml(value: unknown, maxLength = 120) {
  return String(value ?? "").trim().slice(0, maxLength).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] || character);
}

function isOrder(value: unknown): value is StoreOrder {
  if (!value || typeof value !== "object") return false;
  const order = value as Partial<StoreOrder>;
  return Boolean(
    typeof order.id === "string" && order.customer &&
    typeof order.customer.name === "string" && typeof order.customer.phone === "string" &&
    typeof order.customer.city === "string" && typeof order.customer.village === "string" &&
    typeof order.customer.street === "string" && typeof order.governorate === "string" &&
    Array.isArray(order.items) && order.items.length > 0 && order.items.length <= 30 &&
    order.items.every(item => item && typeof item.name === "string" && typeof item.size === "string" &&
      Number.isInteger(item.quantity) && item.quantity > 0 && Number.isFinite(item.price)) &&
    Number.isFinite(order.total)
  );
}

export async function POST(request: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!botToken || !chatId) {
    return NextResponse.json({ error: "Telegram notifications are not configured." }, { status: 503 });
  }

  if (request.headers.get("authorization") !== `Bearer ${botToken}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let order: unknown;
  try {
    order = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid order payload." }, { status: 400 });
  }
  if (!isOrder(order)) {
    return NextResponse.json({ error: "Order details are incomplete." }, { status: 400 });
  }

  const address = [order.customer.street, order.customer.building, order.customer.village, order.customer.city, order.governorate]
    .filter(Boolean)
    .join(", ");
  const header = [
    "🛍️ <b>New MAVEX order</b>",
    `<b>Order:</b> ${escapeHtml(order.id)}`,
    `<b>Customer:</b> ${escapeHtml(order.customer.name)}`,
    `<b>Phone:</b> ${escapeHtml(order.customer.phone, 30)}`,
    ...(order.customer.email ? [`<b>Email:</b> ${escapeHtml(order.customer.email, 100)}`] : []),
    `<b>Address:</b> ${escapeHtml(address, 240)}`,
    `<b>Payment:</b> ${escapeHtml(order.payment || "Not specified", 40)}`,
    "<b>Items:</b>",
  ].join("\n") + "\n";
  const orderId = escapeHtml(order.id);
  const itemLines = order.items.map(item =>
    `• <b>${escapeHtml(item.name, 80)}</b> — ${escapeHtml(item.size, 24)} / ${escapeHtml(item.color || "", 40)} × ${item.quantity} — EGP ${(item.price * item.quantity).toLocaleString("en-EG")}`
  );
  const footer = `\n<b>Total:</b> EGP ${order.total.toLocaleString("en-EG")}`;
  const messages: string[] = [];
  let currentMessage = header;

  for (const line of itemLines) {
    if (currentMessage.length + line.length + footer.length > 3900) {
      messages.push(currentMessage.trimEnd());
      currentMessage = `🛍️ <b>Order ${orderId} — items continued</b>\n`;
    }
    currentMessage += `${line}\n`;
  }
  messages.push(currentMessage + footer);

  try {
    for (const text of messages) {
      const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      const result = await telegramResponse.json().catch(() => null);
      if (!telegramResponse.ok || !result?.ok) {
        console.error("Telegram rejected an order notification.", telegramResponse.status);
        return NextResponse.json({ error: "Telegram could not accept the notification." }, { status: 502 });
      }
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Telegram order notification failed due to a network or API error.");
    return NextResponse.json({ error: "Telegram notification could not be sent." }, { status: 502 });
  }
}
