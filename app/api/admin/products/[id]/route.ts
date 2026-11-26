import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { ADMIN_COOKIE, isAdminSessionValid } from "../../../../../lib/admin-auth";
import { CatalogProduct, parseColorProductLinks } from "../../../../../lib/admin-store";
import { getCatalogProduct, getCatalogProducts } from "../../../../../lib/catalog-server";
import { validateColorProductLinks } from "../../../../../lib/color-product-links";
import { PRODUCT_GARMENT_TYPES, getProductType, type ProductGarmentType } from "../../../../../lib/product-type";
import { deleteCatalogProduct, deleteProductImage, deleteProductVideo, getProductImagePublicUrl, getProductVideoPublicUrl, isProductImagePath, isProductVideoPath, saveCatalogProduct, saveProductImage } from "../../../../../lib/store-db";

type VariantInput = { id?: string; color?: unknown; size?: unknown; stock_quantity?: unknown; price_override?: unknown; is_active?: unknown };
type GuideInput = { size?: unknown; label?: unknown; width?: unknown; length?: unknown };

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

async function deleteSupersededMedia(productId: string, imageUrls: string[], videoUrl: string | null) {
  let products: CatalogProduct[];
  try {
    products = await getCatalogProducts(true);
  } catch (error) {
    console.error("Could not verify whether replaced product media is shared; keeping old files:", error);
    return;
  }

  const otherProducts = products.filter((product) => product.id !== productId);
  const referencedImages = new Set(otherProducts.flatMap((product) => product.product_images.map((image) => image.image_url)));
  const referencedVideos = new Set(otherProducts.map((product) => product.product_video_url).filter((url): url is string => Boolean(url)));
  await Promise.all(imageUrls.filter((url) => !referencedImages.has(url)).map((url) =>
    deleteProductImage(url).catch((error) => console.error("Could not remove a replaced product photo:", error)),
  ));
  if (videoUrl && !referencedVideos.has(videoUrl)) {
    await deleteProductVideo(videoUrl).catch((error) => console.error("Could not remove the replaced product video:", error));
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Please log in to the admin panel." }, { status: 401 });
  const { id } = await params;

  try {
    const current = await getCatalogProduct(id, true);
    if (!current) return NextResponse.json({ error: "Product not found." }, { status: 404 });

    const body: unknown = await request.json();
    if (!body || typeof body !== "object") throw new Error("Enter a valid price and stock update.");
    const draft = body as { price?: unknown; variants?: unknown };
    const price = Number(draft.price);
    if (!Number.isFinite(price) || price <= 0) throw new Error("Enter a valid price greater than zero.");
    if (!Array.isArray(draft.variants) || draft.variants.length !== current.product_variants.length) {
      throw new Error("The stock update does not match this product's sizes.");
    }

    const stocks = new Map<string, number>();
    for (const value of draft.variants) {
      if (!value || typeof value !== "object") throw new Error("Enter a valid stock count for every size.");
      const variant = value as { id?: unknown; stock_quantity?: unknown };
      if (typeof variant.id !== "string" || stocks.has(variant.id)) throw new Error("The stock update contains an invalid size.");
      if (typeof variant.stock_quantity === "string" && !variant.stock_quantity.trim()) throw new Error("Enter a stock count for every size.");
      const stock = Number(variant.stock_quantity);
      if (!Number.isInteger(stock) || stock < 0) throw new Error("Stock must be a whole number of zero or more.");
      stocks.set(variant.id, stock);
    }

    const currentVariantIds = new Set(current.product_variants.map((variant) => variant.id));
    if (stocks.size !== currentVariantIds.size || [...stocks.keys()].some((variantId) => !currentVariantIds.has(variantId))) {
      throw new Error("The stock update contains a size that does not belong to this product.");
    }

    const updated: CatalogProduct = {
      ...current,
      price,
      compare_at_price: current.compare_at_price !== null && current.compare_at_price <= price
        ? null
        : current.compare_at_price,
      product_variants: current.product_variants.map((variant) => ({
        ...variant,
        stock_quantity: stocks.get(variant.id)!,
      })),
    };

    await saveCatalogProduct(updated);
    revalidatePath("/", "page");
    revalidatePath("/product/[id]", "page");
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save price and stock." }, { status: 400 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Please log in to the admin panel." }, { status: 401 });
  const { id } = await params;
  let uploadedVideoPath = "";
  let uploadedImagePaths: string[] = [];
  let uploadedLegacyImageUrls: string[] = [];

  try {
    const form = await request.formData();
    uploadedImagePaths = parseProductImagePaths(form);
    let current = await getCatalogProduct(id, true);
    if (!current) {
      try {
        const candidate = JSON.parse(String(form.get("baseProduct") || "null"));
        if (candidate && candidate.id === id) current = candidate as CatalogProduct;
      } catch { }
    }
    if (!current) return NextResponse.json({ error: "Product not found." }, { status: 404 });
    const name = String(form.get("name") || "").trim();
    const typeValue = String(form.get("productType") || current.product_type || "");
    const productType = (PRODUCT_GARMENT_TYPES as readonly string[]).includes(typeValue)
      ? typeValue as ProductGarmentType
      : getProductType(current.name, current.product_type);
    const description = String(form.get("description") || "").trim();
    const price = Number(form.get("price"));
    const compareValue = String(form.get("compareAtPrice") || "").trim();
    const compareAtPrice = compareValue ? Number(compareValue) : null;
    if (!name || name.length > 120) throw new Error("Enter a product name of 120 characters or fewer.");
    if (description.length > 5000) throw new Error("Product description must be 5,000 characters or fewer.");
    if (!Number.isFinite(price) || price <= 0) throw new Error("Enter a valid price.");
    if (compareAtPrice !== null && (!Number.isFinite(compareAtPrice) || compareAtPrice < price)) throw new Error("The original price must be higher than the selling price.");
    const colorProductLinks = form.has("colorProductLinks")
      ? parseColorProductLinks(form.get("colorProductLinks"))
      : current.color_product_links || [];
    if (colorProductLinks.some((link) => link.product_id === id)) throw new Error("A product cannot link to itself as another color.");
    await validateColorProductLinks(id, { name, product_type: productType }, colorProductLinks);

    let inputVariants: VariantInput[];
    try {
      const parsed: unknown = JSON.parse(String(form.get("variants") || "[]"));
      inputVariants = Array.isArray(parsed) ? parsed as VariantInput[] : [];
    } catch { inputVariants = []; }
    if (inputVariants.length === 0 || inputVariants.length > 60) throw new Error("Add at least one size and color variant.");

    const allowedSizes = ["XS", "S", "M", "L", "XL", "XXL"];
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
      .filter((row) => productSizes.includes(String(row.size)) && Number.isFinite(Number(row.width)) && Number(row.width) > 0 && Number(row.width) <= 500 && Number.isFinite(Number(row.length)) && Number(row.length) > 0 && Number(row.length) <= 500)
      .map((row) => ({ size: String(row.size), label: String(row.label || row.size).trim().slice(0, 30), width: Number(row.width), length: Number(row.length) }));
    if (sizeGuide.length !== productSizes.length) throw new Error("Enter the width and length for each product size.");

    const pantsGuide = /pant|jogger|trouser/i.test(name);
    const sizeGuideTitle = String(form.get("sizeGuideTitle") || (pantsGuide ? "PANTS" : "HOODIE")).trim().slice(0, 40);
    const sizeGuideSizeLabel = String(form.get("sizeGuideSizeLabel") || "SIZE").trim().slice(0, 20);
    const sizeGuideWidthLabel = String(form.get("sizeGuideWidthLabel") || (pantsGuide ? "WAIST" : "WIDTH")).trim().slice(0, 20);
    const sizeGuideLengthLabel = String(form.get("sizeGuideLengthLabel") || "LENGTH").trim().slice(0, 20);

    const nextProduct: CatalogProduct = {
      ...current,
      name,
      product_type: productType,
      description,
      price,
      compare_at_price: compareAtPrice,
      size_guide: sizeGuide,
      size_guide_title: sizeGuideTitle,
      size_guide_size_label: sizeGuideSizeLabel,
      size_guide_width_label: sizeGuideWidthLabel,
      size_guide_length_label: sizeGuideLengthLabel,
      product_video_url: current.product_video_url || null,
      color_product_links: colorProductLinks,
      product_images: current.product_images,
      product_variants: variants,
    };

    uploadedVideoPath = String(form.get("productVideoPath") || "");
    if (uploadedVideoPath && !isProductVideoPath(uploadedVideoPath)) throw new Error("Invalid product video upload.");
    if (uploadedVideoPath) nextProduct.product_video_url = getProductVideoPublicUrl(uploadedVideoPath);
    else if (form.get("removeVideo") === "true") nextProduct.product_video_url = null;

    const images = form.getAll("images").filter((value): value is File => value instanceof File && value.size > 0);
    const addedImageCount = uploadedImagePaths.length + images.length;
    const replaceProductImages = form.get("replaceProductImages") === "true";
    let retainedImages = current.product_images;
    if (form.has("retainedProductImages")) {
      let requestedRetained: unknown;
      try { requestedRetained = JSON.parse(String(form.get("retainedProductImages") || "[]")); }
      catch { throw new Error("The selected product photos are invalid. Refresh and try again."); }
      if (!Array.isArray(requestedRetained) || requestedRetained.some((url) => typeof url !== "string") || new Set(requestedRetained).size !== requestedRetained.length) {
        throw new Error("The selected product photos are invalid. Refresh and try again.");
      }
      const requestedSet = new Set(requestedRetained as string[]);
      if ((requestedRetained as string[]).some((url) => !current.product_images.some((photo) => photo.image_url === url))) {
        throw new Error("A selected photo does not belong to this product.");
      }
      retainedImages = current.product_images.filter((photo) => requestedSet.has(photo.image_url));
    } else if (replaceProductImages) {
      retainedImages = [];
    }
    if (replaceProductImages && addedImageCount === 0) throw new Error("Choose original photos before replacing the current photos.");
    if (retainedImages.length + addedImageCount === 0) throw new Error("Keep or add at least one product photo.");
    if (retainedImages.length + addedImageCount > 8) throw new Error("A product can have up to 8 photos. Remove some before adding more.");

    const startingOrder = retainedImages.length;
    const uploadedImages = uploadedImagePaths.map((path, index) => ({ image_url: getProductImagePublicUrl(path), alt_text: name, sort_order: startingOrder + index }));
    const legacyImages = await Promise.all(images.map(async (image, index) => {
      const imageUrl = await saveProductImage(id, image);
      uploadedLegacyImageUrls.push(imageUrl);
      return { image_url: imageUrl, alt_text: name, sort_order: startingOrder + uploadedImagePaths.length + index };
    }));
    nextProduct.product_images = [...retainedImages, ...uploadedImages, ...legacyImages]
      .map((photo, index) => ({ ...photo, sort_order: index }));

    await saveCatalogProduct(nextProduct);
    revalidatePath("/", "page");
    revalidatePath("/product/[id]", "page");
    const nextImageUrls = new Set(nextProduct.product_images.map((image) => image.image_url));
    const oldImages = current.product_images.filter((image) => !nextImageUrls.has(image.image_url)).map((image) => image.image_url);
    const oldVideo = current.product_video_url && current.product_video_url !== nextProduct.product_video_url
      ? current.product_video_url
      : null;
    if (oldImages.length || oldVideo) await deleteSupersededMedia(id, oldImages, oldVideo);
    uploadedVideoPath = "";
    uploadedImagePaths = [];
    uploadedLegacyImageUrls = [];
    return NextResponse.json(nextProduct);
  } catch (error) {
    if (uploadedVideoPath) await deleteProductVideo(uploadedVideoPath).catch((cleanupError) => console.error("Could not clean up an unsaved product video:", cleanupError));
    await Promise.all(uploadedImagePaths.map((path) => deleteProductImage(path).catch((cleanupError) => console.error("Could not clean up an unsaved product image:", cleanupError))));
    await Promise.all(uploadedLegacyImageUrls.map((path) => deleteProductImage(path).catch((cleanupError) => console.error("Could not clean up an unsaved product image:", cleanupError))));
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
