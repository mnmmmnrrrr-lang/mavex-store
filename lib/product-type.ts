export type ProductGarmentType = "hoodie" | "bottoms" | "tshirt" | "sweatshirt" | "unknown";

export function getProductGarmentType(name: string): ProductGarmentType {
  const normalized = name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[_-]+/g, " ");

  if (/\bhood(?:ie|ed)\b/.test(normalized)) return "hoodie";
  if (/\b(joggers?|pants?|trousers?|shorts?|jeans?|leggings?)\b/.test(normalized)) return "bottoms";
  if (/\b(t\s?shirts?|tshirts?|tees?|shirts?)\b/.test(normalized)) return "tshirt";
  if (/\b(sweatshirts?|crewnecks?|sweaters?)\b/.test(normalized)) return "sweatshirt";

  return "unknown";
}

export function canLinkColorProduct(sourceName: string, candidateName: string): boolean {
  const sourceType = getProductGarmentType(sourceName);
  return sourceType === "unknown" || getProductGarmentType(candidateName) === sourceType;
}
