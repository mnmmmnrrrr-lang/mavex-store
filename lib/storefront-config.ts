export type StorefrontSubCategory = {
  id: string;
  slug: string;
  name: string;
  image_url: string;
  sort_order: number;
  enabled?: boolean;
  navigation_mode?: "products" | "product";
  direct_product_id?: string | null;
};

export type StorefrontCollection = {
  id: string;
  slug: string;
  name: string;
  image_url: string;
  sort_order: number;
  subcategories: StorefrontSubCategory[];
  enabled?: boolean;
  navigation_mode?: "subcategories" | "products";
};

export const SITE_PAGE_DEFINITIONS = [
  { id: "home", label: "Homepage", path: "/", type: "page" },
  { id: "shop", label: "Shop all products", path: "/shop", type: "page" },
  { id: "about", label: "Homepage about section", path: "/#about", type: "section" },
  { id: "account", label: "My orders / account", path: "/account", type: "page" },
  { id: "cart", label: "Shopping bag", path: "/cart", type: "page" },
  { id: "returns", label: "Returns & exchanges chat", path: "/returns", type: "page" },
  { id: "checkout", label: "Checkout", path: "/checkout", type: "page" },
  { id: "collection", label: "Main collection pages", path: "/collection/[collectionSlug]", type: "page" },
  { id: "subcategory", label: "Sub-category / product listing pages", path: "/collection/[collectionSlug]/[subCategorySlug]", type: "page" },
  { id: "product", label: "Product detail pages", path: "/product/[id]", type: "page" },
  { id: "hero", label: "Homepage hero section", path: "/#home", type: "section" },
  { id: "collections_section", label: "Homepage collections section", path: "/#shop", type: "section" },
] as const;

export type SitePageId = typeof SITE_PAGE_DEFINITIONS[number]["id"];
export type SitePageState = { id: SitePageId; enabled: boolean; sort_order: number };
export type StorefrontConfig = { collections: StorefrontCollection[]; pageRoutes?: SitePageState[] };

export const DEFAULT_SITE_PAGE_STATES: SitePageState[] = SITE_PAGE_DEFINITIONS.map((page, sort_order) => ({ id: page.id, enabled: true, sort_order }));

export function validateProductPlacement(collectionId: string, subcategoryId: string, config: StorefrontConfig) {
  if (!config.collections.length && !collectionId && !subcategoryId) return { collection_id: null, subcategory_id: null };
  const collection = config.collections.find((item) => item.id === collectionId);
  if (!collection) throw new Error("Choose a valid main collection for this product.");
  if (subcategoryId && !collection.subcategories.some((item) => item.id === subcategoryId)) {
    throw new Error("Choose a sub-category inside the selected main collection.");
  }
  return { collection_id: collection.id, subcategory_id: subcategoryId || "" };
}

const garmentSubcategories = (image: string): StorefrontSubCategory[] => [
  { id: "hoodies", slug: "hoodies", name: "Hoodies", image_url: image, sort_order: 0 },
  { id: "joggers", slug: "joggers", name: "Joggers", image_url: "/mavex-products/navy-logo-joggers.webp", sort_order: 1 },
  { id: "crewnecks", slug: "crewnecks", name: "Crewnecks", image_url: "/mavex-products/grey-logo-hoodie.webp", sort_order: 2 },
];

export const DEFAULT_STOREFRONT_CONFIG: StorefrontConfig = {
  collections: [
    { id: "winter-27", slug: "winter-27", name: "WINTER 27 COLLECTION", image_url: "/mavex-products/navy-logo-hoodie.webp", sort_order: 0, enabled: true, navigation_mode: "subcategories", subcategories: garmentSubcategories("/mavex-products/navy-logo-hoodie.webp") },
    { id: "plain-basic", slug: "plain-basic", name: "PLAIN / BASIC COLLECTION", image_url: "/mavex-products/grey-logo-hoodie.webp", sort_order: 1, enabled: true, navigation_mode: "subcategories", subcategories: garmentSubcategories("/mavex-products/grey-logo-hoodie.webp") },
    { id: "lost-in-the-moment", slug: "lost-in-the-moment", name: "LOST IN THE MOMENT", image_url: "/mavex-products/burgundy-logo-hoodie.webp", sort_order: 2, enabled: true, navigation_mode: "subcategories", subcategories: garmentSubcategories("/mavex-products/burgundy-logo-hoodie.webp") },
    { id: "ciao-mavex", slug: "ciao-mavex", name: "CIAO MAVEX", image_url: "/mavex-products/navy-logo-joggers.webp", sort_order: 3, enabled: true, navigation_mode: "subcategories", subcategories: garmentSubcategories("/mavex-products/navy-logo-joggers.webp") },
  ],
  pageRoutes: DEFAULT_SITE_PAGE_STATES,
};

export function isSitePageEnabled(config: StorefrontConfig, id: SitePageId) {
  return config.pageRoutes?.find((page) => page.id === id)?.enabled ?? true;
}

export function getSitePagePath(config: StorefrontConfig, id: SitePageId) {
  const definition = SITE_PAGE_DEFINITIONS.find((page) => page.id === id)!;
  return definition.path;
}

export function getStorefrontFallback(config: StorefrontConfig, excluded?: SitePageId) {
  if (excluded !== "shop" && isSitePageEnabled(config, "shop")) return "/shop";
  if (excluded !== "home" && isSitePageEnabled(config, "home")) return "/";
  const collection = config.collections.find((item) => item.enabled !== false);
  if (collection && excluded !== "collection" && isSitePageEnabled(config, "collection")) return `/collection/${encodeURIComponent(collection.slug)}`;
  return "/";
}

export function getCollectionHref(config: StorefrontConfig, collection: StorefrontCollection) {
  if (collection.enabled === false) return getStorefrontFallback(config);
  if (collection.navigation_mode === "products" && isSitePageEnabled(config, "subcategory")) return `/collection/${encodeURIComponent(collection.slug)}/all-products`;
  if (!isSitePageEnabled(config, "collection")) return isSitePageEnabled(config, "subcategory")
    ? `/collection/${encodeURIComponent(collection.slug)}/all-products`
    : getStorefrontFallback(config, "collection");
  return `/collection/${encodeURIComponent(collection.slug)}`;
}

export function inferProductPlacement(
  product: { name?: string; slug?: string; product_type?: string; collection_id?: string | null; subcategory_id?: string | null },
  config: StorefrontConfig = DEFAULT_STOREFRONT_CONFIG,
) {
  const text = `${product.name || ""} ${product.slug || ""}`.toLowerCase();
  const explicitCollection = config.collections.find((item) => item.id === product.collection_id)
    || config.collections.find((item) => item.slug === product.collection_id)
    || null;
  const collection = explicitCollection
    || config.collections.find((item) => item.id === (text.includes("plain") || text.includes("basic") ? "plain-basic" : text.includes("lost") || text.includes("moment") ? "lost-in-the-moment" : text.includes("ciao") ? "ciao-mavex" : "winter-27"))
    || config.collections[0];

  if (!collection) return { collection_id: "", subcategory_id: "" };
  const explicitSubcategory = collection.subcategories.find((item) => item.id === product.subcategory_id || item.slug === product.subcategory_id);
  if (explicitCollection && product.subcategory_id !== undefined) {
    return { collection_id: collection.id, subcategory_id: explicitSubcategory?.id || "" };
  }
  const garment = `${product.product_type || ""} ${text}`.toLowerCase();
  const inferredSubcategory = /jogger|pants?|trouser|shorts?/.test(garment)
    ? collection.subcategories.find((item) => /jogger|pant|bottom/.test(`${item.id} ${item.slug} ${item.name}`.toLowerCase()))
    : /hoodie/.test(garment)
      ? collection.subcategories.find((item) => /hoodie|top/.test(`${item.id} ${item.slug} ${item.name}`.toLowerCase()))
      : /crewneck|sweatshirt/.test(garment)
        ? collection.subcategories.find((item) => /crewneck|sweatshirt/.test(`${item.id} ${item.slug} ${item.name}`.toLowerCase()))
        : undefined;

  return { collection_id: collection.id, subcategory_id: explicitSubcategory?.id || inferredSubcategory?.id || "" };
}
