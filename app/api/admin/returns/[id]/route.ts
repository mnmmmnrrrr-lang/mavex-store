import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, isAdminSessionValid } from "../../../../../lib/admin-auth";
import { removeReturn } from "../../../../../lib/store-db";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdminSessionValid(request.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: "Please log in." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const returnId = id.trim().toUpperCase();
    if (!/^RET-[A-Z0-9-]{3,90}$/.test(returnId)) {
      return NextResponse.json({ error: "Enter a valid return request number." }, { status: 400 });
    }

    await removeReturn(returnId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete this return conversation.";
    const status = message === "Return request not found." ? 404 : 503;
    return NextResponse.json({ error: message }, { status });
  }
}
