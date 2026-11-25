import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, isAdminSessionValid } from "../../../../lib/admin-auth";
import {
  getPaymentProofLink,
  listComments,
  listOrders,
  listReturns,
  removeComment,
  removeOrder,
  saveComment,
  saveOrder,
  saveReturn,
} from "../../../../lib/store-db";

const orderStatuses = new Set([
  "Pending confirmation",
  "Awaiting payment review",
  "Confirmed",
  "Processing",
  "Shipped",
  "Delivered",
  "Cancelled",
  "Cancelled by customer",
]);
const returnStatuses = new Set(["New", "Reviewing", "Approved", "Rejected", "Resolved"]);

function authorized(request: NextRequest) {
  return isAdminSessionValid(request.cookies.get(ADMIN_COOKIE)?.value);
}

async function readBody(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 16 * 1024) return { error: "The request is too large.", status: 413 as const };
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "Invalid request.", status: 400 as const };
    return { body: body as Record<string, unknown> };
  } catch {
    return { error: "Invalid request.", status: 400 as const };
  }
}

function failure(message: string, error: unknown) {
  console.error(message, error);
  return NextResponse.json({ error: message }, { status: 503, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Please log in." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  try {
    const [orders, returns, comments] = await Promise.all([listOrders(), listReturns(), listComments()]);
    const withProofLinks = await Promise.all(orders.map(async (order) => ({
      ...order,
      proof: order.proof ? await getPaymentProofLink(order.proof) : "",
    })));
    const withEvidenceLinks = await Promise.all(returns.map(async (item) => ({
      ...item,
      evidence: undefined,
      evidenceUrl: item.evidence ? await getPaymentProofLink(item.evidence) : "",
      messages: item.messages?.length ? item.messages : [{ id: item.id, sender: "customer" as const, text: item.issue, date: item.date }],
    })));
    return NextResponse.json(
      { orders: withProofLinks, returns: withEvidenceLinks, comments },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure("Could not load store operations.", error);
  }
}

export async function PATCH(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Please log in." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const parsed = await readBody(request);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = parsed.body;
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id || id.length > 120) return NextResponse.json({ error: "Enter a valid item number." }, { status: 400 });

  try {
    if (body.type === "order") {
      const order = (await listOrders()).find((row) => row.id === id);
      if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
      if (typeof body.status === "string") {
        if (!orderStatuses.has(body.status)) return NextResponse.json({ error: "Choose a valid order status." }, { status: 400 });
        order.status = body.status;
      }
      if (body.trackingNumber !== undefined) {
        if (typeof body.trackingNumber !== "string" || body.trackingNumber.length > 100) return NextResponse.json({ error: "Tracking number must be 100 characters or fewer." }, { status: 400 });
        order.trackingNumber = body.trackingNumber.trim();
      }
      await saveOrder(order);
    } else if (body.type === "return") {
      const item = (await listReturns()).find((row) => row.id === id);
      if (!item) return NextResponse.json({ error: "Return request not found." }, { status: 404 });
      if (typeof body.status !== "string" || !returnStatuses.has(body.status)) return NextResponse.json({ error: "Choose a valid return status." }, { status: 400 });
      item.status = body.status;
      await saveReturn(item);
    } else if (body.type === "comment") {
      const item = (await listComments()).find((row) => row.id === id);
      if (!item) return NextResponse.json({ error: "Comment not found." }, { status: 404 });
      if (body.action === "delete") {
        await removeComment(item.id);
      } else {
        if (body.status !== "published" && body.status !== "hidden") return NextResponse.json({ error: "Choose a valid comment status." }, { status: 400 });
        if (body.reply !== undefined && (typeof body.reply !== "string" || body.reply.length > 800)) return NextResponse.json({ error: "Reply must be 800 characters or fewer." }, { status: 400 });
        item.status = body.status;
        if (typeof body.reply === "string") item.reply = body.reply.trim();
        await saveComment(item);
      }
    } else {
      return NextResponse.json({ error: "Unknown operation." }, { status: 400 });
    }
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure("Could not update this item.", error);
  }
}

export async function DELETE(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Please log in." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const parsed = await readBody(request);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const id = typeof parsed.body.id === "string" ? parsed.body.id.trim() : "";
  if (!id || id.length > 120) return NextResponse.json({ error: "Enter a valid order number." }, { status: 400 });
  try {
    const order = (await listOrders()).find((row) => row.id === id);
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    await removeOrder(id);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure("Could not delete this order.", error);
  }
}
