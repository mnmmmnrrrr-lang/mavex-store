import { randomBytes } from "node:crypto";

export type CatalogProduct = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  size_guide?: { size: string; width: number; length: number }[];
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

export function makeSlug(value: string) {
  const slug = value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "product-" + randomBytes(4).toString("hex");
}
