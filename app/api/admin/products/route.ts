import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, isAdminSessionValid } from "../../../../lib/admin-auth";
import {
  CatalogProduct,
  makeSlug,
} from "../../../../lib/admin-store";
import { getCatalogProducts } from "../../../../lib/catalog-server";
import { saveCatalogProduct, saveProductImage } from "../../../../lib/store-db";

type VariantInput = {
  id?: string;
  color?: unknown;
  size?: unknown;
  stock_quantity?: unknown;
  price_override?: unknown;
  is_active?: unknown;
};

type SizeGuideInput = { size?: unknown; width?: unknown; length?: unknown };

function parseProduct(form: FormData) {
  const name = String(form.get("name") || "").trim();
  const description = String(form.get("description") || "").trim();
  const price = Number(form.get("price"));
  const compareValue = String(form.get("compareAtPrice") || "").trim();
  const compareAtPrice = compareValue ? Number(compareValue) : null;

  if (!name || name.length > 120) throw new Error("Enter a product name of 120 characters or fewer.");
  if (!Number.isFinite(price) || price <= 0) throw new Error("Enter a valid price.");
  if (compareAtPrice !== null && (!Number.isFinite(compareAtPrice) || compareAtPrice < price)) {
    throw new Error("The original price must be higher than the selling price.");
  }

  let inputVariants: VariantInput[];
  try {
    const parsed: unknown = JSON.parse(String(form.get("variants") || "[]"));
    inputVariants = Array.isArray(parsed) ? parsed as VariantInput[] : [];
  } catch {
    inputVariants = [];
  }
  if (inputVariants.length === 0 || inputVariants.length > 60) {
    throw new Error("Add at least one size and color variant.");
  }

  const allowedSizes = ["S", "M", "L", "XL", "XXL"];
  const seen = new Set<string>();
  const variants = inputVariants.map((variant, index) => {
    const color = String(variant.color || "").trim();
    const size = String(variant.size || "").trim().toUpperCase();
    const stock = Number(variant.stock_quantity);
    const overrideValue = variant.price_override === null || variant.price_override === "" || variant.price_override === undefined
      ? null
      : Number(variant.price_override);
    const key = color.toLowerCase() + ":" + size;

    if (!color || color.length > 40) throw new Error("Enter a color for every variant.");
    if (!allowedSizes.includes(size)) throw new Error("Choose a valid size for every variant.");
    if (!Number.isInteger(stock) || stock < 0) throw new Error("Stock must be a whole number of zero or more.");
    if (overrideValue !== null && (!Number.isFinite(overrideValue) || overrideValue <= 0)) {
      throw new Error("Variant price must be a positive number.");
    }
    if (seen.has(key)) throw new Error("Each color and size combination can only appear once.");
    seen.add(key);

    return {
      id: typeof variant.id === "string" && variant.id ? variant.id : "variant-" + index + "-" + randomBytes(3).toString("hex"),
      color,
      size,
      stock_quantity: stock,
      price_override: overrideValue,
      is_active: variant.is_active !== false,
    };
  });

  let guideInput: SizeGuideInput[];
  try {
    const parsed: unknown = JSON.parse(String(form.get("sizeGuide") || "[]"));
    guideInput = Array.isArray(parsed) ? parsed as SizeGuideInput[] : [];
  } catch {
    guideInput = [];
  }
  const productSizes = [...new Set(variants.map((variant) => variant.size))];
  const sizeGuide = guideInput
    .filter((row) => productSizes.includes(String(row.size)) && Number(row.width) > 0 && Number(row.length) > 0)
    .map((row) => ({ size: String(row.size), width: Number(row.width), length: Number(row.length) }));
  if (sizeGuide.length !== productSizes.length) {
    throw new Error("Enter the width and length for each product size.");
  }

  return { name, description, price, compareAtPrice, variants, sizeGuide };
}

function isAuthorized(request: NextRequest) {
  return isAdminSessionValid(request.cookies.get(ADMIN_COOKIE)?.value);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Please log in to the admin panel." }, { status: 401 });
  }

  try {
    return NextResponse.json({ products: await getCatalogProducts(true) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load products." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Please log in to the admin panel." }, { status: 401 });
  }

  try {
    const form = await request.formData();
    const fields = parseProduct(form);
    const images = form.getAll("images").filter((value): value is File => value instanceof File && value.size > 0);
    if (images.length === 0 || images.length > 8) {
      return NextResponse.json({ error: "Choose 1 to 8 product photos." }, { status: 400 });
    }

    const id = makeSlug(fields.name) + "-" + randomBytes(3).toString("hex");
    const productImages = await Promise.all(images.map(async (image, index) => ({
      image_url: await saveProductImage(id, image), alt_text: fields.name, sort_order: index,
    })));
    const product: CatalogProduct = {
      id,
      slug: id,
      name: fields.name,
      description: fields.description,
      price: fields.price,
      compare_at_price: fields.compareAtPrice,
      size_guide: fields.sizeGuide,
      product_images: productImages,
      product_variants: fields.variants,
    };

    await saveCatalogProduct(product);
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the product.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
