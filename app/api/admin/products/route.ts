import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, isAdminSessionValid } from "../../../../lib/admin-auth";
import {
  CatalogProduct,
  makeSlug,
  parseColorProductLinks,
} from "../../../../lib/admin-store";
import { getCatalogProducts } from "../../../../lib/catalog-server";
import { validateColorProductLinks } from "../../../../lib/color-product-links";
import { deleteProductImage, deleteProductVideo, getProductImagePublicUrl, getProductVideoPublicUrl, isProductImagePath, isProductVideoPath, saveCatalogProduct, saveProductImage } from "../../../../lib/store-db";

type VariantInput = {
  id?: string;
  color?: unknown;
  size?: unknown;
  stock_quantity?: unknown;
  price_override?: unknown;
  is_active?: unknown;
};

type SizeGuideInput = { size?: unknown; label?: unknown; width?: unknown; length?: unknown };

function parseProduct(form: FormData) {
  const name = String(form.get("name") || "").trim();
  const description = String(form.get("description") || "").trim();
  const price = Number(form.get("price"));
  const compareValue = String(form.get("compareAtPrice") || "").trim();
  const compareAtPrice = compareValue ? Number(compareValue) : null;

  if (!name || name.length > 120) throw new Error("Enter a product name of 120 characters or fewer.");
  if (description.length > 5000) throw new Error("Product description must be 5,000 characters or fewer.");
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

  const allowedSizes = ["XS", "S", "M", "L", "XL", "XXL"];
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
    .filter((row) => productSizes.includes(String(row.size)) && Number.isFinite(Number(row.width)) && Number(row.width) > 0 && Number(row.width) <= 500 && Number.isFinite(Number(row.length)) && Number(row.length) > 0 && Number(row.length) <= 500)
    .map((row) => ({ size: String(row.size), label: String(row.label || row.size).trim().slice(0, 30), width: Number(row.width), length: Number(row.length) }));
  if (sizeGuide.length !== productSizes.length) {
    throw new Error("Enter the width and length for each product size.");
  }

  const sizeGuideTitle = String(form.get("sizeGuideTitle") || "HOODIE").trim().slice(0, 40);
  const sizeGuideSizeLabel = String(form.get("sizeGuideSizeLabel") || "SIZE").trim().slice(0, 20);
  const sizeGuideWidthLabel = String(form.get("sizeGuideWidthLabel") || "WIDTH").trim().slice(0, 20);
  const sizeGuideLengthLabel = String(form.get("sizeGuideLengthLabel") || "LENGTH").trim().slice(0, 20);
  const colorProductLinks = parseColorProductLinks(form.get("colorProductLinks"));
  return { name, description, price, compareAtPrice, variants, colorProductLinks, sizeGuide, sizeGuideTitle, sizeGuideSizeLabel, sizeGuideWidthLabel, sizeGuideLengthLabel };
}

function isAuthorized(request: NextRequest) {
  return isAdminSessionValid(request.cookies.get(ADMIN_COOKIE)?.value);
}

function parseProductImagePaths(form: FormData) {
  try {
    const parsed: unknown = JSON.parse(String(form.get("productImagePaths") || "[]"));
    if (!Array.isArray(parsed) || parsed.some((path) => typeof path !== "string" || !isProductImagePath(path))) {
      throw new Error("Invalid product image upload.");
    }
    return parsed as string[];
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid product image upload.") throw error;
    throw new Error("Invalid product image upload.");
  }
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

export async function PATCH(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Please log in to the admin panel." }, { status: 401 });
  }

  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || !Array.isArray((body as { productIds?: unknown }).productIds)) {
      throw new Error("Send the complete product order.");
    }

    const productIds = (body as { productIds: unknown[] }).productIds;
    const products = await getCatalogProducts(true);
    const byId = new Map(products.map((product) => [product.id, product]));
    if (
      productIds.length !== products.length ||
      productIds.length > 500 ||
      productIds.some((id) => typeof id !== "string" || !byId.has(id)) ||
      new Set(productIds).size !== productIds.length
    ) {
      throw new Error("The product order is invalid. Refresh the page and try again.");
    }

    await Promise.all(productIds.map((id, sort_order) => {
      const product = byId.get(id as string)!;
      return saveCatalogProduct({ ...product, sort_order });
    }));
    revalidatePath("/", "page");
    return NextResponse.json({ products: await getCatalogProducts(true) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not reorder products." }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Please log in to the admin panel." }, { status: 401 });
  }

  let uploadedVideoPath = "";
  let uploadedImagePaths: string[] = [];
  let uploadedLegacyImageUrls: string[] = [];
  try {
    const form = await request.formData();
    const fields = parseProduct(form);
    const existingProducts = await getCatalogProducts(true);
    const requestedOrderValue = String(form.get("sortOrder") ?? "").trim();
    const requestedOrder = requestedOrderValue ? Number(requestedOrderValue) : Number.NaN;
    const sortOrder = Number.isSafeInteger(requestedOrder) && requestedOrder >= 0 && requestedOrder <= existingProducts.length
      ? requestedOrder
      : existingProducts.length;
    uploadedImagePaths = parseProductImagePaths(form);
    uploadedVideoPath = String(form.get("productVideoPath") || "");
    if (uploadedVideoPath && !isProductVideoPath(uploadedVideoPath)) throw new Error("Invalid product video upload.");
    const images = form.getAll("images").filter((value): value is File => value instanceof File && value.size > 0);
    if (uploadedImagePaths.length + images.length === 0 || uploadedImagePaths.length + images.length > 8) {
      throw new Error("Choose 1 to 8 product photos.");
    }

    const id = makeSlug(fields.name) + "-" + randomBytes(3).toString("hex");
    await validateColorProductLinks(id, fields.name, fields.colorProductLinks);
    const legacyImages = await Promise.all(images.map(async (image, index) => {
      const imageUrl = await saveProductImage(id, image);
      uploadedLegacyImageUrls.push(imageUrl);
      return { image_url: imageUrl, alt_text: fields.name, sort_order: uploadedImagePaths.length + index };
    }));
    const productImages = [
      ...uploadedImagePaths.map((path, index) => ({ image_url: getProductImagePublicUrl(path), alt_text: fields.name, sort_order: index })),
      ...legacyImages,
    ];
    const product: CatalogProduct = {
      id,
      slug: id,
      name: fields.name,
      description: fields.description,
      price: fields.price,
      compare_at_price: fields.compareAtPrice,
      sort_order: sortOrder,
      size_guide: fields.sizeGuide,
      size_guide_title: fields.sizeGuideTitle,
      size_guide_size_label: fields.sizeGuideSizeLabel,
      size_guide_width_label: fields.sizeGuideWidthLabel,
      size_guide_length_label: fields.sizeGuideLengthLabel,
      product_video_url: uploadedVideoPath ? getProductVideoPublicUrl(uploadedVideoPath) : null,
      color_product_links: fields.colorProductLinks,
      product_images: productImages,
      product_variants: fields.variants,
    };

    await saveCatalogProduct(product);
    revalidatePath("/", "page");
    revalidatePath("/product/[id]", "page");
    uploadedVideoPath = "";
    uploadedImagePaths = [];
    uploadedLegacyImageUrls = [];
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    if (uploadedVideoPath) await deleteProductVideo(uploadedVideoPath).catch((cleanupError) => console.error("Could not clean up an unsaved product video:", cleanupError));
    await Promise.all(uploadedImagePaths.map((path) => deleteProductImage(path).catch((cleanupError) => console.error("Could not clean up an unsaved product image:", cleanupError))));
    await Promise.all(uploadedLegacyImageUrls.map((path) => deleteProductImage(path).catch((cleanupError) => console.error("Could not clean up an unsaved product image:", cleanupError))));
    const message = error instanceof Error ? error.message : "Could not save the product.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
