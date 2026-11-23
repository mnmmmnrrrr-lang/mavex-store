import { NextRequest, NextResponse } from "next/server";
import { getCatalogProduct } from "../../../lib/catalog-server";
import { newOperationId, StoreOrder } from "../../../lib/operations-store";
import { saveOrder, savePaymentProof } from "../../../lib/store-db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const customer = body?.customer;
    const incomingItems = body?.items;
    if (!customer?.name || !/^01[0125][0-9]{8}$/.test(String(customer.phone || "")) || !body?.governorate || !customer.city || !customer.village || !customer.street || !Array.isArray(incomingItems) || !incomingItems.length || incomingItems.length > 30) {
      return NextResponse.json({ error: "Complete your delivery details and check your phone number." }, { status: 400 });
    }
    const payment = String(body.payment || "cod");
    if (!["cod", "vodafone", "instapay"].includes(payment)) return NextResponse.json({ error: "Choose a valid payment method." }, { status: 400 });

    const items: StoreOrder["items"] = [];
    for (const item of incomingItems as { productId?: string; size?: string; color?: string; quantity?: number }[]) {
      const quantity = Number(item.quantity);
      if (!item.productId || !item.size || !item.color || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) return NextResponse.json({ error: "Check the selected products, sizes, and quantities." }, { status: 400 });
      const product = await getCatalogProduct(item.productId);
      const variant = product?.product_variants.find(row => row.color === item.color && row.size === item.size && row.is_active !== false);
      if (!product || !variant) return NextResponse.json({ error: "A selected product or size is no longer available. Please refresh your bag." }, { status: 409 });
      if (variant.stock_quantity < quantity) return NextResponse.json({ error: `${product.name} (${item.size}) does not have enough stock.` }, { status: 409 });
      items.push({ productId: product.id, name: product.name, price: Number(variant.price_override ?? product.price), size: variant.size, color: variant.color, quantity, image: product.product_images[0]?.image_url || "" });
    }

    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const id = newOperationId("MVX");
    let proof = "";
    if (payment !== "cod") {
      if (typeof body.proof !== "string" || !body.proof) return NextResponse.json({ error: "Upload your payment transfer screenshot." }, { status: 400 });
      proof = await savePaymentProof(body.proof, id);
    }
    const order: StoreOrder = {
      id,
      customer: {
        name: String(customer.name).trim().slice(0, 120), phone: String(customer.phone), phone2: String(customer.phone2 || "").slice(0, 30),
        city: String(customer.city).trim().slice(0, 120), village: String(customer.village).trim().slice(0, 120), street: String(customer.street).trim().slice(0, 240),
        building: String(customer.building || "").slice(0, 120), notes: String(customer.notes || "").slice(0, 500),
      },
      governorate: String(body.governorate).slice(0, 80), items, subtotal, shipping: 120, total: subtotal + 120, payment,
      transaction: String(body.transaction || "").trim().slice(0, 100), proof,
      status: payment === "cod" ? "Pending confirmation" : "Awaiting payment review", date: new Date().toISOString(),
    };
    await saveOrder(order);
    return NextResponse.json({ id: order.id }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save your order. Please try again." }, { status: 503 });
  }
}
