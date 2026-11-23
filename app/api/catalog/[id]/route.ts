import { NextRequest, NextResponse } from "next/server";
import { getCatalogProduct } from "../../../../lib/catalog-server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const product = await getCatalogProduct(id);

  if (!product) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  return NextResponse.json(product, {
    headers: { "Cache-Control": "no-store" },
  });
}
