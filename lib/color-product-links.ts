import { getCatalogProduct } from "@/lib/catalog-server";
import type { CatalogProduct } from "@/lib/admin-store";
import { canLinkProducts } from "@/lib/product-type";

type ColorProductLink = { color: string; product_id: string };

export async function validateColorProductLinks(
  sourceId: string,
  source: { name: string; product_type?: string | null },
  links: ColorProductLink[],
) {
  const targets = await Promise.all(links.map(async (link) => {
    if (link.product_id === sourceId) return null;
    return getCatalogProduct(link.product_id, true);
  }));

  if (targets.some((target) => !target)) {
    throw new Error("Choose an existing product for every linked color.");
  }
  if (targets.some((target) => !canLinkProducts(source, target as CatalogProduct))) {
    throw new Error("Linked color products must be the same product type.");
  }
}
