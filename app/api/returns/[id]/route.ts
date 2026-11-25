import { NextRequest, NextResponse } from "next/server";
import { newOperationId, type ReturnMessage } from "../../../../lib/operations-store";
import { getPaymentProofLink, listReturns, saveReturn } from "../../../../lib/store-db";

type RouteContext = { params: Promise<{ id: string }> };
function normalizeEmail(value: string) { return value.trim().toLowerCase(); }
function validEmail(value: string) { return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }

async function findCustomerReturn(id: string, emailValue: string) {
  const email = normalizeEmail(emailValue);
  if (!validEmail(email)) return null;
  const item = (await listReturns()).find((entry) => entry.id.toUpperCase() === id.trim().toUpperCase());
  if (!item || normalizeEmail(item.email || "") !== email) return null;
  return item;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const item = await findCustomerReturn(id, request.nextUrl.searchParams.get("email") || "");
    if (!item) return NextResponse.json({ error: "We could not find a return request matching that reference and email." }, { status: 404 });
    const evidenceUrl = item.evidence ? await getPaymentProofLink(item.evidence) : "";
    const messages = item.messages?.length ? item.messages : [{ id: item.id, sender: "customer" as const, text: item.issue, date: item.date }];
    return NextResponse.json({ ...item, evidence: undefined, evidenceUrl, messages }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not load a return conversation:", error);
    return NextResponse.json({ error: "Could not load this return request." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 16 * 1024) return NextResponse.json({ error: "The message is too large." }, { status: 413 });
    const { id } = await params;
    let body: unknown;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: "Invalid message request." }, { status: 400 }); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid message request." }, { status: 400 });
    const value = body as Record<string, unknown>;
    const email = normalizeEmail(typeof value.email === "string" ? value.email : "");
    const text = typeof value.text === "string" ? value.text.trim() : "";
    if (text.length < 1 || text.length > 1200) return NextResponse.json({ error: "Write a message of up to 1200 characters." }, { status: 400 });
    const item = await findCustomerReturn(id, email);
    if (!item) return NextResponse.json({ error: "We could not find a return request matching that reference and email." }, { status: 404 });
    const message: ReturnMessage = { id: newOperationId("MSG"), sender: "customer", text, date: new Date().toISOString() };
    item.messages = [...(item.messages || []), message];
    await saveReturn(item);
    return NextResponse.json({ message }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not send a customer return message:", error);
    return NextResponse.json({ error: "Could not send your message." }, { status: 503 });
  }
}
