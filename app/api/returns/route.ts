import { NextRequest, NextResponse } from "next/server";
import { newOperationId, type ReturnRequest } from "../../../lib/operations-store";
import { deleteReturnEvidence, getOrder, saveReturn, saveReturnEvidence } from "../../../lib/store-db";

const validEmail = (value: string) => value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export async function POST(request: NextRequest) {
  let evidencePath = "";
  try {
    const form = await request.formData();
    const orderId = String(form.get("orderId") || "").trim().toUpperCase();
    const email = String(form.get("email") || "").trim().toLowerCase();
    const issue = String(form.get("issue") || "").trim();
    const photo = form.get("photo");
    if (!orderId || !validEmail(email) || issue.length < 10 || issue.length > 1200) {
      return NextResponse.json({ error: "Enter your order number, the email used for the order, and an issue description of 10–1200 characters." }, { status: 400 });
    }
    if (!(photo instanceof File) || !photo.size) return NextResponse.json({ error: "Attach a photo showing the issue." }, { status: 400 });
    if (!/^image\/(jpeg|png|webp)$/.test(photo.type)) return NextResponse.json({ error: "Choose a JPG, PNG, or WebP photo." }, { status: 400 });
    if (photo.size > 3 * 1024 * 1024) return NextResponse.json({ error: "The issue photo must be 3 MB or smaller." }, { status: 400 });

    const order = await getOrder(orderId);
    if (!order || order.customer.email?.trim().toLowerCase() !== email) {
      return NextResponse.json({ error: "We could not find an order matching that order number and email." }, { status: 404 });
    }

    const id = newOperationId("RET");
    evidencePath = await saveReturnEvidence(photo, id);
    const item: ReturnRequest = {
      id,
      orderId: order.id,
      customerName: order.customer.name,
      email,
      issue,
      evidence: evidencePath,
      messages: [{ id: newOperationId("MSG"), sender: "customer", text: issue, date: new Date().toISOString() }],
      date: new Date().toISOString(),
      status: "New",
    };
    await saveReturn(item);
    return NextResponse.json({ id: item.id }, { status: 201 });
  } catch (error) {
    if (evidencePath) await deleteReturnEvidence(evidencePath).catch(() => undefined);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not submit your return request." }, { status: 500 });
  }
}
