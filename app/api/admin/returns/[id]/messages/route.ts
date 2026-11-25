import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, isAdminSessionValid } from "../../../../../../lib/admin-auth";
import { newOperationId, type ReturnMessage } from "../../../../../../lib/operations-store";
import { listReturns, saveReturn } from "../../../../../../lib/store-db";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdminSessionValid(request.cookies.get(ADMIN_COOKIE)?.value)) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  try {
    const { id } = await params;
    const body = await request.json();
    const text = String(body?.text || "").trim();
    if (text.length < 1 || text.length > 1200) return NextResponse.json({ error: "Write a message of up to 1200 characters." }, { status: 400 });
    const item = (await listReturns()).find((entry) => entry.id.toUpperCase() === id.trim().toUpperCase());
    if (!item) return NextResponse.json({ error: "Return request not found." }, { status: 404 });
    const message: ReturnMessage = { id: newOperationId("MSG"), sender: "admin", text, date: new Date().toISOString() };
    item.messages = [...(item.messages || []), message];
    await saveReturn(item);
    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not send your message." }, { status: 503 });
  }
}
