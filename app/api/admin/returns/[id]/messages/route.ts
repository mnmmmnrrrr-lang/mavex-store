import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, isAdminSessionValid } from "../../../../../../lib/admin-auth";
import { newOperationId, type ReturnMessage } from "../../../../../../lib/operations-store";
import { listReturns, saveReturn } from "../../../../../../lib/store-db";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdminSessionValid(request.cookies.get(ADMIN_COOKIE)?.value)) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 16 * 1024) return NextResponse.json({ error: "The message is too large." }, { status: 413 });
  try {
    const { id } = await params;
    let body: unknown;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: "Invalid message request." }, { status: 400 }); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid message request." }, { status: 400 });
    const text = typeof (body as { text?: unknown }).text === "string" ? (body as { text: string }).text.trim() : "";
    if (text.length < 1 || text.length > 1200) return NextResponse.json({ error: "Write a message of up to 1200 characters." }, { status: 400 });
    const item = (await listReturns()).find((entry) => entry.id.toUpperCase() === id.trim().toUpperCase());
    if (!item) return NextResponse.json({ error: "Return request not found." }, { status: 404 });
    const message: ReturnMessage = { id: newOperationId("MSG"), sender: "admin", text, date: new Date().toISOString() };
    item.messages = [...(item.messages || []), message];
    await saveReturn(item);
    return NextResponse.json({ message }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not send admin return message:", error);
    return NextResponse.json({ error: "Could not send your message." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
