import { NextRequest, NextResponse } from "next/server";
import { listOrders } from "../../../../lib/store-db";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

export async function GET(request: NextRequest) {
  const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!accessToken) return NextResponse.json({ error: "Sign in to view your orders." }, { status: 401 });
  try {
    const { data, error } = await getSupabaseAdmin().auth.getUser(accessToken);
    if (error || !data.user?.email) return NextResponse.json({ error: "Your sign-in has expired. Please sign in again." }, { status: 401 });
    const verifiedEmail = data.user.email.trim().toLowerCase();
    const orders = (await listOrders())
      .filter(order => order.customer.email?.trim().toLowerCase() === verifiedEmail)
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
    console.error("Could not load customer orders:", error);
    return NextResponse.json({ error: "Could not load your orders." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
