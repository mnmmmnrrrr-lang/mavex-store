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
