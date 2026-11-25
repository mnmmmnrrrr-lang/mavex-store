import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  checkAdminPassword,
  createAdminSession,
} from "../../../../lib/admin-auth";

export async function POST(request: NextRequest) {
  if (!process.env.MAVEX_ADMIN_PASSWORD) {
    return NextResponse.json(
      { error: "Admin password is not configured. Add it to .env.local and restart the site." },
      { status: 503 }
    );
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 4 * 1024) {
    return NextResponse.json({ error: "Invalid request." }, { status: 413 });
  }

  let body: { password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (typeof body.password !== "string" || !checkAdminPassword(body.password)) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, createAdminSession(), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return response;
}
