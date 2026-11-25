import { NextResponse } from "next/server";
import { getCatalogProduct } from "@/lib/catalog-server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const product = await getCatalogProduct(id);
    if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });

    return NextResponse.json(
      {
        ...product,
        product_images: [...(product.product_images || [])].sort(
          (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
        ),
        product_variants: (product.product_variants || []).filter(
          (variant) => variant.is_active !== false,
        ),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Could not load linked MAVEX color product:", error);
    return NextResponse.json({ error: "Could not load this color." }, { status: 503 });
  }
}
