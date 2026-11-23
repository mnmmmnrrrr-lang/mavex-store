import { NextRequest, NextResponse } from "next/server";
import { getOrder, saveOrder } from "../../../../../lib/store-db";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!accessToken) return NextResponse.json({ error: "Sign in to manage your order." }, { status: 401 });

  try {
    const { data, error } = await getSupabaseAdmin().auth.getUser(accessToken);
    const email = data.user?.email?.trim().toLowerCase();
    if (error || !email) return NextResponse.json({ error: "Your email sign-in has expired. Please sign in again." }, { status: 401 });

    const { id } = await params;
    const order = await getOrder(id);
    if (!order || order.customer.email?.trim().toLowerCase() !== email) {
      return NextResponse.json({ error: "We could not find this order for your account." }, { status: 404 });
    }
    if (/shipped|delivered|cancelled/i.test(order.status)) {
      return NextResponse.json({ error: "This order can no longer be cancelled online. Please contact MAVEX for help." }, { status: 409 });
    }

    order.status = "Cancelled by customer";
    await saveOrder(order);
    return NextResponse.json({ ok: true, status: order.status });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not cancel this order." }, { status: 503 });
  }
}
