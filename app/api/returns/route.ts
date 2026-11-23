import { NextRequest, NextResponse } from "next/server";
import { newOperationId, ReturnRequest } from "../../../lib/operations-store";
import { getOrder, saveReturn } from "../../../lib/store-db";
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const orderId = String(body?.orderId || "").trim().toUpperCase(); const phone = String(body?.phone || "").trim(); const issue = String(body?.issue || "").trim();
    if (!orderId || !/^01[0125][0-9]{8}$/.test(phone) || issue.length < 10 || issue.length > 1200) return NextResponse.json({ error: "Enter your order number, a valid phone number, and a description of at least 10 characters." }, { status: 400 });
    const order = await getOrder(orderId);
    if (order && order.customer.phone !== phone) return NextResponse.json({ error: "We could not find an order matching that order number and phone." }, { status: 404 });
    if (!order) return NextResponse.json({ error: "We could not find an order matching that order number and phone." }, { status: 404 });
    const item: ReturnRequest = { id: newOperationId("RET"), orderId: order.id, customerName: order.customer.name, phone, issue, date: new Date().toISOString(), status: "New" };
    await saveReturn(item); return NextResponse.json({ id: item.id }, { status: 201 });
  } catch { return NextResponse.json({ error: "Could not submit your return request." }, { status: 500 }); }
}
