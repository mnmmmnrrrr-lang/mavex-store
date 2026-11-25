export type CartItem = {
  productId: string;
  name: string;
  price: number;
  size: string;
  color: string;
  quantity: number;
  image: string;
  stock_quantity: number;
};

const MAX_LINE_QUANTITY = 10;

function isSafeCartImage(value: unknown): value is string {
  if (typeof value !== "string" || !value || value.length > 2048) return false;
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") && !value.split("/").includes("..")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".supabase.co") &&
      url.pathname.startsWith("/storage/v1/object/public/mavex-product-images/");
  } catch {
    return false;
  }
}

export function normalizeCartItems(value: unknown): CartItem[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((candidate): CartItem[] => {
    if (!candidate || typeof candidate !== "object") return [];
    const item = candidate as Record<string, unknown>;
    if (
      typeof item.productId !== "string" || !item.productId || item.productId.length > 160 ||
      typeof item.name !== "string" || !item.name || item.name.length > 120 ||
      typeof item.size !== "string" || !item.size || item.size.length > 20 ||
      typeof item.color !== "string" || !item.color || item.color.length > 40 ||
      !Number.isFinite(item.price) || Number(item.price) < 0 ||
      !Number.isInteger(item.quantity) || Number(item.quantity) < 1
    ) return [];

    const stock = Number.isInteger(item.stock_quantity) && Number(item.stock_quantity) >= 0
      ? Number(item.stock_quantity)
      : MAX_LINE_QUANTITY;
    return [{
      productId: item.productId,
      name: item.name,
      price: Number(item.price),
      size: item.size,
      color: item.color,
      quantity: stock > 0
        ? Math.min(Number(item.quantity), MAX_LINE_QUANTITY, stock)
        : Math.min(Number(item.quantity), MAX_LINE_QUANTITY),
      image: isSafeCartImage(item.image) ? item.image : "",
      stock_quantity: stock,
    }];
  });
}
