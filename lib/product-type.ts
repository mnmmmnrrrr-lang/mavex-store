export const PRODUCT_GARMENT_TYPES = ["hoodie", "bottoms", "tshirt", "shirt", "crewneck", "sweatshirt", "sweater", "other"] as const;
export type ProductGarmentType = typeof PRODUCT_GARMENT_TYPES[number] | "unknown";

export function getProductGarmentType(name: string): ProductGarmentType {
  const normalized = name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[_-]+/g, " ");

  if (/\bhood(?:ie|ed)\b/.test(normalized)) return "hoodie";
  if (/\b(joggers?|pants?|trousers?|shorts?|jeans?|leggings?)\b/.test(normalized)) return "bottoms";
  if (/\b(t\s?shirts?|tshirts?|tees?)\b/.test(normalized)) return "tshirt";
  if (/\bshirts?\b/.test(normalized)) return "shirt";
  if (/\bcrew\s?necks?\b/.test(normalized)) return "crewneck";
  if (/\bsweatshirts?\b/.test(normalized)) return "sweatshirt";
  if (/\bsweaters?\b/.test(normalized)) return "sweater";

  return "unknown";
}

export function canLinkColorProduct(sourceName: string, candidateName: string): boolean {
  const sourceType = getProductGarmentType(sourceName);
  return sourceType !== "unknown" && getProductGarmentType(candidateName) === sourceType;
}

export function getProductType(name: string, savedType?: string | null): ProductGarmentType {
  if (savedType && (PRODUCT_GARMENT_TYPES as readonly string[]).includes(savedType)) return savedType as ProductGarmentType;
  const inferred = getProductGarmentType(name);
  return inferred === "unknown" ? "other" : inferred;
}

export function canLinkProducts(source: { name: string; product_type?: string | null }, candidate: { name: string; product_type?: string | null }) {
  const sourceType = getProductType(source.name, source.product_type);
  return sourceType === getProductType(candidate.name, candidate.product_type);
}
