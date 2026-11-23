import { supabase } from "@/lib/supabase";
import { localProducts } from "@/lib/catalog";
import { CatalogProduct } from "@/lib/admin-store";
import { getCatalogOverlay } from "@/lib/store-db";

export async function getCatalogProducts(includeInactive = false): Promise<CatalogProduct[]> {
  const state = await getCatalogOverlay();
  let databaseProducts: CatalogProduct[] = [];

  let query = supabase
    .from("products")
    .select(`
      id,
      name,
      slug,
      description,
      price,
      compare_at_price,
      status,
      is_featured,
      product_images(image_url, alt_text, sort_order),
      product_variants(id, color, size, stock_quantity, price_override, is_active)
    `);
  if (!includeInactive) query = query.eq("status", "active");

  const { data, error } = await query;
  if (error) {
    console.error("Could not load database products:", error.message);
  } else {
    databaseProducts = (data ?? []) as unknown as CatalogProduct[];
  }

  const deleted = new Set(state.deletedIds);
  const merged = new Map<string, CatalogProduct>();
  for (const product of [...localProducts, ...state.products, ...databaseProducts]) {
    if (deleted.has(product.id)) continue;
    const override = state.overrides[product.id];
    merged.set(product.id, override ? { ...product, ...override } : product);
  }

  for (const product of state.products) {
    if (!deleted.has(product.id)) merged.set(product.id, product);
  }
  return [...merged.values()];
}

export async function getCatalogProduct(id: string, includeInactive = false) {
  return (await getCatalogProducts(includeInactive))
    .find((product) => product.id === id || product.slug === id) || null;
}
