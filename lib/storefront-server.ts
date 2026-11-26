import { DEFAULT_STOREFRONT_CONFIG, type StorefrontConfig, type StorefrontCollection, type StorefrontSubCategory } from "@/lib/storefront-config";
import { getSupabaseAdmin, hasSupabaseAdmin } from "@/lib/supabase-admin";

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
    return config && Array.isArray(config.collections) ? config : DEFAULT_STOREFRONT_CONFIG;
  } catch (error) {
    console.error("Could not load storefront collections; using defaults:", error);
    return DEFAULT_STOREFRONT_CONFIG;
  }
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

export function validateStorefrontConfig(input: unknown): StorefrontConfig {
  if (!input || typeof input !== "object" || !Array.isArray((input as { collections?: unknown }).collections)) throw new Error("Send a valid collection setup.");
  const source = (input as { collections: unknown[] }).collections;
  if (source.length > 60) throw new Error("The store can have up to 60 main collections.");
  const ids = new Set<string>();
  const slugs = new Set<string>();
  const collections = source.map((raw, index) => {
    const candidate = raw as StorefrontCollection;
    const item = validateEntry(candidate, index, "collection");
    if (ids.has(item.id) || slugs.has(item.slug)) throw new Error("Collection identifiers and URLs must be unique.");
    ids.add(item.id);
    slugs.add(item.slug);
    if (!Array.isArray(candidate.subcategories) || candidate.subcategories.length > 40) throw new Error("Each collection can have up to 40 sub-categories.");
    const subIds = new Set<string>();
    const subSlugs = new Set<string>();
    const subcategories = candidate.subcategories.map((rawSub, subIndex) => {
      const sub = validateEntry(rawSub, subIndex, "sub-category");
      if (subIds.has(sub.id) || subSlugs.has(sub.slug)) throw new Error("Sub-category identifiers and URLs must be unique within their collection.");
      subIds.add(sub.id);
      subSlugs.add(sub.slug);
      return sub;
    });
    return { ...item, subcategories };
  });
  return { collections };
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
  const retained = new Set(next.collections.flatMap((collection) => [collection.image_url, ...collection.subcategories.map((item) => item.image_url)]));
  const removedPaths = [...new Set(previous.collections.flatMap((collection) => [collection.image_url, ...collection.subcategories.map((item) => item.image_url)]))]
    .filter((imageUrl) => imageUrl && !retained.has(imageUrl))
    .map((imageUrl) => {
      try {
        const url = new URL(imageUrl);
        const marker = "/storage/v1/object/public/mavex-product-images/collection-uploads/";
        const index = url.pathname.indexOf(marker);
        return index >= 0 ? url.pathname.slice(index + marker.length) : "";
      } catch { return ""; }
    })
    .filter((path) => /^[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(path));
  if (removedPaths.length) {
    const { error } = await getSupabaseAdmin().storage.from("mavex-product-images").remove(removedPaths);
    if (error) console.error("Could not remove replaced collection covers:", error.message);
  }
}
