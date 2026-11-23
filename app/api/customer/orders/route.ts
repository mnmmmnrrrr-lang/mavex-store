import { NextRequest, NextResponse } from "next/server";
import { listOrders } from "../../../../lib/store-db";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

function localEgyptPhone(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("0020")) digits = digits.slice(4);
  else if (digits.startsWith("20") && digits.length === 12) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith("1")) digits = "0" + digits;
  return digits;
}

export async function GET(request: NextRequest) {
  const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!accessToken) return NextResponse.json({ error: "Sign in with your phone number to view your orders." }, { status: 401 });
  try {
    const { data, error } = await getSupabaseAdmin().auth.getUser(accessToken);
    if (error || !data.user?.phone) return NextResponse.json({ error: "Your phone sign-in has expired. Please sign in again." }, { status: 401 });
    const verifiedPhone = localEgyptPhone(data.user.phone);
    const orders = (await listOrders())
      .filter(order => localEgyptPhone(order.customer.phone) === verifiedPhone)
      .map(order => ({
        id: order.id,
        status: order.status,
        date: order.date,
        total: order.total,
        items: order.items.map(item => ({ name: item.name, size: item.size, color: item.color, quantity: item.quantity, image: item.image })),
        trackingNumber: order.trackingNumber || "",
      }));
    return NextResponse.json({ orders }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load your orders." }, { status: 503 });
  }
}
