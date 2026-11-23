import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, isAdminSessionValid } from "../../../../../lib/admin-auth";
import { CatalogProduct } from "../../../../../lib/admin-store";
import { getCatalogProduct } from "../../../../../lib/catalog-server";
import { deleteCatalogProduct, saveCatalogProduct, saveProductImage } from "../../../../../lib/store-db";

type VariantInput = { id?: string; color?: unknown; size?: unknown; stock_quantity?: unknown; price_override?: unknown; is_active?: unknown };
type GuideInput = { size?: unknown; width?: unknown; length?: unknown };

function isAuthorized(request: NextRequest) {
  return isAdminSessionValid(request.cookies.get(ADMIN_COOKIE)?.value);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Please log in to the admin panel." }, { status: 401 });
  const { id } = await params;

  try {
    const form = await request.formData();
    let current = await getCatalogProduct(id, true);
    if (!current) {
      try {
        const candidate = JSON.parse(String(form.get("baseProduct") || "null"));
        if (candidate && candidate.id === id) current = candidate as CatalogProduct;
      } catch { }
    }
    if (!current) return NextResponse.json({ error: "Product not found." }, { status: 404 });
    const name = String(form.get("name") || "").trim();
    const description = String(form.get("description") || "").trim();
    const price = Number(form.get("price"));
    const compareValue = String(form.get("compareAtPrice") || "").trim();
    const compareAtPrice = compareValue ? Number(compareValue) : null;
    if (!name || name.length > 120) throw new Error("Enter a product name of 120 characters or fewer.");
    if (!Number.isFinite(price) || price <= 0) throw new Error("Enter a valid price.");
    if (compareAtPrice !== null && (!Number.isFinite(compareAtPrice) || compareAtPrice < price)) throw new Error("The original price must be higher than the selling price.");

    let inputVariants: VariantInput[];
    try {
      const parsed: unknown = JSON.parse(String(form.get("variants") || "[]"));
      inputVariants = Array.isArray(parsed) ? parsed as VariantInput[] : [];
    } catch { inputVariants = []; }
    if (inputVariants.length === 0 || inputVariants.length > 60) throw new Error("Add at least one size and color variant.");

    const allowedSizes = ["S", "M", "L", "XL", "XXL"];
    const seen = new Set<string>();
    const variants = inputVariants.map((variant, index) => {
      const color = String(variant.color || "").trim();
      const size = String(variant.size || "").trim().toUpperCase();
      const stock = Number(variant.stock_quantity);
      const overrideValue = variant.price_override === null || variant.price_override === "" || variant.price_override === undefined ? null : Number(variant.price_override);
      const key = color.toLowerCase() + ":" + size;
      if (!color || color.length > 40) throw new Error("Enter a color for every variant.");
      if (!allowedSizes.includes(size)) throw new Error("Choose a valid size for every variant.");
      if (!Number.isInteger(stock) || stock < 0) throw new Error("Stock must be a whole number of zero or more.");
      if (overrideValue !== null && (!Number.isFinite(overrideValue) || overrideValue <= 0)) throw new Error("Variant price must be a positive number.");
      if (seen.has(key)) throw new Error("Each color and size combination can only appear once.");
      seen.add(key);
      return {
        id: typeof variant.id === "string" && variant.id ? variant.id : id + "-" + index,
        color,
        size,
        stock_quantity: stock,
        price_override: overrideValue,
        is_active: variant.is_active !== false,
      };
    });

    let inputGuide: GuideInput[];
    try {
      const parsed: unknown = JSON.parse(String(form.get("sizeGuide") || "[]"));
      inputGuide = Array.isArray(parsed) ? parsed as GuideInput[] : [];
    } catch { inputGuide = []; }
    const productSizes = [...new Set(variants.map((variant) => variant.size))];
    const sizeGuide = inputGuide
      .filter((row) => productSizes.includes(String(row.size)) && Number(row.width) > 0 && Number(row.length) > 0)
      .map((row) => ({ size: String(row.size), width: Number(row.width), length: Number(row.length) }));
    if (sizeGuide.length !== productSizes.length) throw new Error("Enter the width and length for each product size.");

    const nextProduct: CatalogProduct = {
      ...current,
      name,
      description,
      price,
      compare_at_price: compareAtPrice,
      size_guide: sizeGuide,
      product_images: current.product_images,
      product_variants: variants,
    };

    const images = form.getAll("images").filter((value): value is File => value instanceof File && value.size > 0);
    if (images.length > 8 || current.product_images.length + images.length > 8) throw new Error("A product can have up to 8 photos. Remove some before adding more.");
    if (images.length) {
      const added = await Promise.all(images.map(async (image, index) => ({ image_url: await saveProductImage(id, image), alt_text: name, sort_order: current!.product_images.length + index })));
      nextProduct.product_images = [...current.product_images, ...added];
    }

    await saveCatalogProduct(nextProduct);
    return NextResponse.json(nextProduct);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update the product.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Please log in to the admin panel." }, { status: 401 });
  const { id } = await params;

  try {
    await deleteCatalogProduct(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not delete the product." }, { status: 503 });
  }
}
