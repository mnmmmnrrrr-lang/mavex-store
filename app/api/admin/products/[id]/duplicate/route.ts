import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, isAdminSessionValid } from "../../../../../../lib/admin-auth";
import { makeSlug, type CatalogProduct } from "../../../../../../lib/admin-store";
import { getCatalogProduct, getCatalogProducts } from "../../../../../../lib/catalog-server";
import { saveCatalogProduct } from "../../../../../../lib/store-db";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdminSessionValid(request.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: "Please log in to the admin panel." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const source = await getCatalogProduct(id, true);
    if (!source) return NextResponse.json({ error: "Product not found." }, { status: 404 });

    const products = await getCatalogProducts(true);
    const name = `${source.name.slice(0, 115).trimEnd()} Copy`;
    const newId = `${makeSlug(name)}-${randomBytes(3).toString("hex")}`;
    const sortOrder = products.reduce((maximum, product) => Math.max(maximum, product.sort_order ?? -1), -1) + 1;
    const duplicate: CatalogProduct = {
      ...source,
      id: newId,
      slug: newId,
      name,
      sort_order: sortOrder,
      product_video_url: null,
      color_product_links: [],
      product_images: source.product_images.map((image) => ({ ...image, alt_text: name })),
      product_variants: source.product_variants.map((variant, index) => ({
        ...variant,
        id: `${newId}-${index + 1}`,
      })),
    };

    await saveCatalogProduct(duplicate);
    revalidatePath("/", "page");
    revalidatePath("/product/[id]", "page");
    return NextResponse.json(duplicate, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not duplicate the product." }, { status: 400 });
  }
}
