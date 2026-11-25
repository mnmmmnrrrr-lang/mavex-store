import { hasSupabasePublic, supabase } from "@/lib/supabase";
import { localProducts } from "@/lib/catalog";
import { CatalogProduct } from "@/lib/admin-store";
import { getCatalogOverlay } from "@/lib/store-db";
import { getSupabaseAdmin, hasSupabaseAdmin } from "@/lib/supabase-admin";

export type StorefrontProduct = Pick<CatalogProduct, "id" | "name" | "description" | "price" | "compare_at_price" | "product_images" | "sort_order">;

function orderByDisplayPosition<T extends { sort_order?: number }>(products: T[]): (T & { sort_order: number })[] {
  const highestSavedOrder = products.reduce(
    (maximum, product) => Number.isSafeInteger(product.sort_order) ? Math.max(maximum, product.sort_order!) : maximum,
    -1,
  );
  return products
    .map((product, index) => ({
      product,
      index,
      order: Number.isSafeInteger(product.sort_order) ? product.sort_order! : highestSavedOrder + index + 1,
    }))
    .sort((a, b) => a.order - b.order || a.index - b.index)
    .map(({ product }, index) => ({ ...product, sort_order: index }));
}

function toStorefrontProduct(product: Partial<CatalogProduct> & Pick<CatalogProduct, "id" | "name" | "price">): StorefrontProduct {
  return {
    id: product.id,
    name: product.name,
    description: product.description ?? null,
    price: product.price,
    compare_at_price: product.compare_at_price ?? null,
    sort_order: product.sort_order,
    product_images: product.product_images || [],
  };
}

export async function getStorefrontProducts(): Promise<StorefrontProduct[]> {
  const databaseQuery = hasSupabasePublic()
    ? supabase
      .from("products")
      .select("id, name, description, price, compare_at_price, product_images(image_url, alt_text, sort_order)")
      .eq("status", "active")
    : null;
  const [state, databaseResult] = await Promise.all([getCatalogOverlay(), databaseQuery]);
  if (databaseResult?.error) console.error("Could not load database products:", databaseResult.error.message);

  const deleted = new Set(state.deletedIds);
  const merged = new Map<string, StorefrontProduct>();
  for (const product of [...localProducts, ...state.products, ...((databaseResult?.data || []) as unknown as CatalogProduct[])]) {
    if (deleted.has(product.id)) continue;
    merged.set(product.id, toStorefrontProduct({ ...product, ...state.overrides[product.id] }));
  }
  for (const product of state.products) {
    if (!deleted.has(product.id)) merged.set(product.id, toStorefrontProduct(product));
  }
  return orderByDisplayPosition([...merged.values()]);
}

export async function getRelatedStorefrontProducts(
  excludedId: string,
  group: "tops" | "bottoms",
  limit = 4
): Promise<StorefrontProduct[]> {
  const databaseQuery = hasSupabasePublic()
    ? supabase
      .from("products")
      .select("id, slug, name, price, compare_at_price, product_images(image_url, alt_text, sort_order)")
      .eq("status", "active")
      .limit(24)
    : null;
  const [state, databaseResult] = await Promise.all([getCatalogOverlay(), databaseQuery]);
  if (databaseResult?.error) console.error("Could not load related database products:", databaseResult.error.message);

  const deleted = new Set(state.deletedIds);
  const merged = new Map<string, CatalogProduct>();
  for (const product of [...localProducts, ...state.products, ...((databaseResult?.data || []) as unknown as CatalogProduct[])]) {
    if (deleted.has(product.id)) continue;
    const override = state.overrides[product.id];
    merged.set(product.id, override ? { ...product, ...override } : product);
  }

  const candidates = orderByDisplayPosition([...merged.values()]).filter(
    (product) => product.id !== excludedId && product.slug !== excludedId
  );
  const isBottoms = (product: CatalogProduct) => /\b(pants?|joggers?|trousers?|shorts?)\b/i.test(`${product.name} ${product.slug}`);
  const sameGroup = candidates.filter((product) => isBottoms(product) === (group === "bottoms"));
  const otherGroup = candidates.filter((product) => isBottoms(product) !== (group === "bottoms"));

  return [...sameGroup, ...otherGroup]
    .slice(0, limit)
    .map((product) => toStorefrontProduct(product));
}

export async function getCatalogProducts(includeInactive = false): Promise<CatalogProduct[]> {
  const state = await getCatalogOverlay();
  let databaseProducts: CatalogProduct[] = [];

  if (hasSupabasePublic()) {
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
  return orderByDisplayPosition([...merged.values()]);
}

export async function getCatalogProduct(id: string, includeInactive = false) {
  const localProduct = localProducts.find((product) => product.id === id || product.slug === id) as CatalogProduct | undefined;
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let databaseProduct: CatalogProduct | null = null;
  if (hasSupabasePublic()) {
    let query = supabase
      .from("products")
      .select("id, name, slug, description, price, compare_at_price, status, product_images(image_url, alt_text, sort_order), product_variants(id, color, size, stock_quantity, price_override, is_active)");
    query = uuidPattern.test(id) ? query.eq("id", id) : query.eq("slug", id);
    if (!includeInactive) query = query.eq("status", "active");
    const { data, error } = await query.maybeSingle();
    if (error) console.error("Could not load database product:", error.message);
    else databaseProduct = data as unknown as CatalogProduct | null;
  }
  const productId = databaseProduct?.id || localProduct?.id || id;

  if (hasSupabaseAdmin()) {
    const { data: row, error: overlayError } = await getSupabaseAdmin()
      .from("mavex_catalog")
      .select("payload,is_deleted")
      .eq("product_id", productId)
      .maybeSingle();
    if (overlayError) throw new Error(`Could not load the hosted catalog: ${overlayError.message}`);
    if (row?.is_deleted) return null;
    if (row?.payload) return row.payload as CatalogProduct;
  }

  return databaseProduct || localProduct || null;
}
