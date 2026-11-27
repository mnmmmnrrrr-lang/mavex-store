import { unstable_cache } from "next/cache";
import { DEFAULT_SITE_PAGE_STATES, DEFAULT_STOREFRONT_CONFIG, SITE_PAGE_DEFINITIONS, type SitePageState, type StorefrontConfig, type StorefrontCollection, type StorefrontSubCategory } from "@/lib/storefront-config";
import { STOREFRONT_CACHE_TAG } from "@/lib/storefront-cache";
import { getSupabaseAdmin, hasSupabaseAdmin } from "@/lib/supabase-admin";
import { deleteProductImage, getManagedProductImageStoragePath } from "@/lib/store-db";

const CONFIG_ID = "main";

export async function getStorefrontConfig(): Promise<StorefrontConfig> {
  if (!hasSupabaseAdmin()) return DEFAULT_STOREFRONT_CONFIG;
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("mavex_storefront_settings")
      .select("data")
      .eq("id", CONFIG_ID)
      .maybeSingle();
    if (error) {
      if (error.code === "42P01" || error.code === "PGRST205") return DEFAULT_STOREFRONT_CONFIG;
      console.error("Could not load storefront collections; using defaults:", error.message);
      return DEFAULT_STOREFRONT_CONFIG;
    }
    const config = data?.data as StorefrontConfig | undefined;
    return config && Array.isArray(config.collections) ? normalizeStorefrontConfig(config) : DEFAULT_STOREFRONT_CONFIG;
  } catch (error) {
    console.error("Could not load storefront collections; using defaults:", error);
    return DEFAULT_STOREFRONT_CONFIG;
  }
}

const readCachedStorefrontConfig = unstable_cache(
  async () => getStorefrontConfig(),
  ["mavex-public-storefront-config"],
  { revalidate: 60, tags: [STOREFRONT_CACHE_TAG] },
);

export async function getPublicStorefrontConfig(): Promise<StorefrontConfig> {
  return readCachedStorefrontConfig();
}

function validateImageUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 2000) throw new Error("Choose a valid collection cover image.");
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && url.hostname.endsWith(".supabase.co") && url.pathname.includes("/storage/v1/object/public/mavex-product-images/collection-uploads/")) return value;
  } catch { /* Invalid URL below. */ }
  throw new Error("Collection covers must use a MAVEX asset or an uploaded store image.");
}

function validateEntry<T extends StorefrontCollection | StorefrontSubCategory>(item: T, index: number, kind: string): T {
  if (!item || typeof item !== "object") throw new Error(`Invalid ${kind}.`);
  if (!/^[a-z0-9-]{1,80}$/.test(item.id) || !/^[a-z0-9-]{1,80}$/.test(item.slug)) throw new Error(`Each ${kind} needs a valid identifier and URL name.`);
  if (typeof item.name !== "string" || !item.name.trim() || item.name.trim().length > 80) throw new Error(`Enter a ${kind} name of 1 to 80 characters.`);
  return { ...item, name: item.name.trim(), image_url: validateImageUrl(item.image_url), sort_order: index };
}

function normalizeStorefrontConfig(input: StorefrontConfig): StorefrontConfig {
  const pageRoutes = DEFAULT_SITE_PAGE_STATES.map((fallback) => {
    const saved = input.pageRoutes?.find((page) => page.id === fallback.id);
    return { ...fallback, enabled: typeof saved?.enabled === "boolean" ? saved.enabled : true, sort_order: Number.isSafeInteger(saved?.sort_order) ? saved!.sort_order : fallback.sort_order };
  }).sort((a, b) => a.sort_order - b.sort_order).map((page, sort_order) => ({ ...page, sort_order }));
  return {
    pageRoutes,
    collections: input.collections.map((collection, sort_order) => ({
      ...collection,
      enabled: collection.enabled !== false,
      navigation_mode: collection.navigation_mode === "products" ? "products" : "subcategories",
      sort_order,
      subcategories: (collection.subcategories || []).map((subcategory, subOrder) => ({
        ...subcategory,
        enabled: subcategory.enabled !== false,
        navigation_mode: subcategory.navigation_mode === "product" ? "product" : "products",
        direct_product_id: typeof subcategory.direct_product_id === "string" ? subcategory.direct_product_id : null,
        sort_order: subOrder,
      })),
    })),
  };
}

export function validateStorefrontConfig(input: unknown): StorefrontConfig {
  if (!input || typeof input !== "object" || !Array.isArray((input as { collections?: unknown }).collections)) throw new Error("Send a valid collection setup.");
  const source = (input as { collections: unknown[] }).collections;
  if (source.length > 60) throw new Error("The store can have up to 60 main collections.");
  const ids = new Set<string>();
  const slugs = new Set<string>();
  const collections = source.map((raw, index) => {
    const candidate = raw as StorefrontCollection;
    if (candidate.enabled !== undefined && typeof candidate.enabled !== "boolean") throw new Error("Choose ON or OFF for every main collection.");
    const item = validateEntry(candidate, index, "collection");
    if (ids.has(item.id) || slugs.has(item.slug)) throw new Error("Collection identifiers and URLs must be unique.");
    ids.add(item.id);
    slugs.add(item.slug);
    if (!Array.isArray(candidate.subcategories) || candidate.subcategories.length > 40) throw new Error("Each collection can have up to 40 sub-categories.");
    const subIds = new Set<string>();
    const subSlugs = new Set<string>();
    const subcategories = candidate.subcategories.map((rawSub, subIndex) => {
      const sub = validateEntry(rawSub, subIndex, "sub-category");
      if (rawSub.enabled !== undefined && typeof rawSub.enabled !== "boolean") throw new Error("Choose ON or OFF for every sub-category.");
      if (subIds.has(sub.id) || subSlugs.has(sub.slug)) throw new Error("Sub-category identifiers and URLs must be unique within their collection.");
      subIds.add(sub.id);
      subSlugs.add(sub.slug);
      const rawMode = rawSub.navigation_mode;
      const directProductId = rawSub.direct_product_id;
      if (rawMode !== undefined && rawMode !== "products" && rawMode !== "product") throw new Error("Choose a valid sub-category destination.");
      if (directProductId !== undefined && directProductId !== null && (typeof directProductId !== "string" || directProductId.length > 120)) throw new Error("Choose a valid product for the sub-category destination.");
      return { ...sub, enabled: rawSub.enabled !== false, navigation_mode: rawMode === "product" ? "product" as const : "products" as const, direct_product_id: typeof directProductId === "string" ? directProductId : null };
    });
    const rawMode = candidate.navigation_mode;
    if (rawMode !== undefined && rawMode !== "subcategories" && rawMode !== "products") throw new Error("Choose a valid collection destination.");
    return { ...item, enabled: candidate.enabled !== false, navigation_mode: rawMode === "products" ? "products" as const : "subcategories" as const, subcategories };
  });

  const pageInput = (input as { pageRoutes?: unknown }).pageRoutes;
  const pageSource = pageInput === undefined ? DEFAULT_SITE_PAGE_STATES : pageInput;
  if (!Array.isArray(pageSource) || pageSource.length > SITE_PAGE_DEFINITIONS.length) throw new Error("Send valid site page settings.");
  const pageById = new Map<string, boolean>();
  for (const rawPage of pageSource) {
    if (!rawPage || typeof rawPage !== "object" || Array.isArray(rawPage)) throw new Error("Send valid site page settings.");
    const candidate = rawPage as { id?: unknown; enabled?: unknown };
    if (typeof candidate.id !== "string" || !SITE_PAGE_DEFINITIONS.some((page) => page.id === candidate.id) || pageById.has(candidate.id)) throw new Error("A site page setting is invalid or repeated.");
    if (typeof candidate.enabled !== "boolean") throw new Error("Choose ON or OFF for every site page.");
    pageById.set(candidate.id, candidate.enabled);
  }
  const pageRoutes: SitePageState[] = [...pageById.entries()].map(([id, enabled]) => ({ id: id as SitePageState["id"], enabled, sort_order: 0 }));
  for (const fallback of DEFAULT_SITE_PAGE_STATES) {
    if (!pageById.has(fallback.id)) pageRoutes.push({ ...fallback });
  }
  pageRoutes.forEach((page, index) => { page.sort_order = index; });
  if (!pageRoutes.some((page) => page.enabled && (page.id === "home" || page.id === "shop"))) {
    throw new Error("Keep either Homepage or Shop enabled so customers always have a safe destination.");
  }
  return { collections, pageRoutes };
}

export async function saveStorefrontConfig(config: StorefrontConfig) {
  const { error } = await getSupabaseAdmin().from("mavex_storefront_settings").upsert({
    id: CONFIG_ID,
    data: config,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") {
      throw new Error("Run supabase/migrations/202611260001_storefront_collections.sql in the MAVEX Supabase SQL Editor, then save again.");
    }
    throw new Error(`Could not save storefront collections: ${error.message}`);
  }
}

export async function deleteRemovedCollectionImages(previous: StorefrontConfig, next: StorefrontConfig) {
  const imageUrls = (config: StorefrontConfig) => config.collections.flatMap((collection) => [
    collection.image_url,
    ...collection.subcategories.map((item) => item.image_url),
  ]);
  const retainedPaths = new Set(imageUrls(next)
    .map(getManagedProductImageStoragePath)
    .filter((path): path is string => Boolean(path)));
  const removedPaths = [...new Set(imageUrls(previous)
    .map(getManagedProductImageStoragePath)
    .filter((path): path is string => Boolean(path)))].filter((path) => !retainedPaths.has(path));

  await Promise.all(removedPaths.map((path) => deleteProductImage(path).catch((error) => {
    console.error("Could not remove an unused collection cover:", error);
  })));
}
