import { NextRequest, NextResponse } from "next/server";
import { getCatalogProduct } from "../../../../lib/catalog-server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const product = await getCatalogProduct(id);

    if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });

    return NextResponse.json(product, {
      headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=120" },
    });
  } catch (error) {
    console.error("Could not load a public catalog product:", error);
    return NextResponse.json({ error: "Could not load this product." }, { status: 503 });
  }
}
