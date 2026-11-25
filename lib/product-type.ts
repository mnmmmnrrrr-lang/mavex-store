export type ProductGarmentType = "hoodie" | "bottoms" | "tshirt" | "shirt" | "crewneck" | "sweatshirt" | "sweater" | "unknown";

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
