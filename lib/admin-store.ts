import { randomBytes } from "node:crypto";

export type CatalogProduct = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  sort_order?: number;
  status?: string;
  product_type?: string;
  collection_id?: string | null;
  subcategory_id?: string | null;
  is_featured?: boolean;
  size_guide?: { size: string; label?: string; width: number; length: number }[];
  size_guide_title?: string;
  size_guide_size_label?: string;
  size_guide_width_label?: string;
  size_guide_length_label?: string;
  product_video_url?: string | null;
  color_product_links?: { color: string; product_id: string }[];
  product_images: {
    image_url: string;
    alt_text: string | null;
    sort_order: number | null;
    color?: string | null;
  }[];
  product_variants: {
    id: string;
    color: string;
    size: string;
    stock_quantity: number;
    price_override: number | null;
    is_active: boolean | null;
  }[];
};

function parseVariantImageColor(value: unknown, variantColors: Map<string, string>) {
  if (value === "" || value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error("Choose a valid color for every product photo.");
  const name = value.trim();
  if (!name || name.length > 40) throw new Error("Choose a valid color for every product photo.");
  const canonical = variantColors.get(name.toLocaleLowerCase());
  if (!canonical) throw new Error(`The photo color “${name}” must match a product color variant.`);
  return canonical;
}

export function parseUploadedImageColors(value: FormDataEntryValue | null, imageCount: number, variants: { color: string }[]) {
  if (value === null || value === "") return Array.from({ length: imageCount }, () => null as string | null);
  let parsed: unknown;
  try { parsed = JSON.parse(String(value)); }
  catch { throw new Error("The product photo color assignments are invalid."); }
  if (!Array.isArray(parsed) || parsed.length !== imageCount) throw new Error("Choose a color for each uploaded product photo.");
  const variantColors = new Map(variants.map((variant) => [variant.color.toLocaleLowerCase(), variant.color]));
  return parsed.map((color) => parseVariantImageColor(color, variantColors));
}

export function parseRetainedImageColors(value: FormDataEntryValue | null, retainedUrls: string[], variants: { color: string }[]) {
  if (value === null || value === "") return null;
  let parsed: unknown;
  try { parsed = JSON.parse(String(value)); }
  catch { throw new Error("The retained photo color assignments are invalid."); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("The retained photo color assignments are invalid.");
  const assignments = parsed as Record<string, unknown>;
  if (Object.keys(assignments).some((url) => !retainedUrls.includes(url))) throw new Error("A photo color assignment does not match this product.");
  const variantColors = new Map(variants.map((variant) => [variant.color.toLocaleLowerCase(), variant.color]));
  return Object.fromEntries(retainedUrls.map((url) => [url, parseVariantImageColor(assignments[url], variantColors)]));
}

export function parseColorProductLinks(value: FormDataEntryValue | null) {
  if (value === null || value === "") return [] as { color: string; product_id: string }[];

  let parsed: unknown;
  try {
    parsed = JSON.parse(String(value));
  } catch {
    throw new Error("Choose valid color product links.");
  }
  if (!Array.isArray(parsed) || parsed.length > 8) {
    throw new Error("A product can have up to 8 linked colors.");
  }

  const seenColors = new Set<string>();
  const seenProducts = new Set<string>();
  return (parsed as unknown[]).map((item) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new Error("Choose valid color product links.");
    }
    const link = item as Record<string, unknown>;
    const color = typeof link.color === "string" ? link.color.trim() : "";
    const productId = typeof link.product_id === "string" ? link.product_id.trim() : "";
    const colorKey = color.toLowerCase();
    if (!color || color.length > 40 || !productId || productId.length > 160) {
      throw new Error("Enter a color and choose its linked product.");
    }
    if (seenColors.has(colorKey) || seenProducts.has(productId)) {
      throw new Error("Each linked color and product can only be used once.");
    }
    seenColors.add(colorKey);
    seenProducts.add(productId);
    return { color, product_id: productId };
  });
}

export function makeSlug(value: string) {
  const slug = value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "product-" + randomBytes(4).toString("hex");
}
