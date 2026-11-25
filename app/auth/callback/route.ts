import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const requestedPath = requestUrl.searchParams.get("next") || "/account";
  let safePath = "/account";
  if (requestedPath.startsWith("/") && !requestedPath.startsWith("//") && !requestedPath.includes("\\")) {
    try {
      const target = new URL(requestedPath, requestUrl.origin);
      if (target.origin === requestUrl.origin) safePath = `${target.pathname}${target.search}${target.hash}`;
    } catch {
      // Fall back to the account page for malformed callback destinations.
    }
  }

  if (!code) {
    return NextResponse.redirect(new URL("/account?authError=google", requestUrl.origin));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/account?authError=google", requestUrl.origin));
  }

  return NextResponse.redirect(new URL(safePath, requestUrl.origin));
}
