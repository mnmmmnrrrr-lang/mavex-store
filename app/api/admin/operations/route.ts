import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, isAdminSessionValid } from "../../../../lib/admin-auth";
import { listComments, listOrders, listReturns, removeComment, removeOrder, saveComment, saveOrder, saveReturn, getPaymentProofLink } from "../../../../lib/store-db";

function authorized(request: NextRequest) { return isAdminSessionValid(request.cookies.get(ADMIN_COOKIE)?.value); }

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  try {
    const [orders, returns, comments] = await Promise.all([listOrders(), listReturns(), listComments()]);
    const withProofLinks = await Promise.all(orders.map(async order => ({ ...order, proof: order.proof ? await getPaymentProofLink(order.proof) : "" })));
    const withEvidenceLinks = await Promise.all(returns.map(async item => ({
      ...item,
      evidence: undefined,
      evidenceUrl: item.evidence ? await getPaymentProofLink(item.evidence) : "",
      messages: item.messages?.length ? item.messages : [{ id: item.id, sender: "customer" as const, text: item.issue, date: item.date }],
    })));
    return NextResponse.json({ orders: withProofLinks, returns: withEvidenceLinks, comments }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load store operations." }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  try {
    const body = await request.json();
    if (body.type === "order") {
      const order = (await listOrders()).find(row => row.id === body.id);
      if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
      if (typeof body.status === "string") order.status = body.status.slice(0, 50);
      if (typeof body.trackingNumber === "string") order.trackingNumber = body.trackingNumber.trim().slice(0, 100);
      await saveOrder(order);
    } else if (body.type === "return") {
      const item = (await listReturns()).find(row => row.id === body.id);
      if (!item) return NextResponse.json({ error: "Return request not found." }, { status: 404 });
      item.status = String(body.status || "").slice(0, 50); await saveReturn(item);
    } else if (body.type === "comment") {
      const item = (await listComments()).find(row => row.id === body.id);
      if (!item) return NextResponse.json({ error: "Comment not found." }, { status: 404 });
      if (body.action === "delete") await removeComment(item.id);
      else {
        item.status = body.status === "published" ? "published" : "hidden";
        if (typeof body.reply === "string") item.reply = body.reply.trim().slice(0, 800);
        await saveComment(item);
      }
    } else return NextResponse.json({ error: "Unknown operation." }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update this item." }, { status: 503 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  try {
    const body = await request.json();
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id || id.length > 100) return NextResponse.json({ error: "Enter a valid order number." }, { status: 400 });
    const order = (await listOrders()).find((row) => row.id === id);
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    await removeOrder(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not delete this order." }, { status: 503 });
  }
}
