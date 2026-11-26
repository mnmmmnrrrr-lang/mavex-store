export type StorefrontSubCategory = {
  id: string;
  slug: string;
  name: string;
  image_url: string;
  sort_order: number;
};

export type StorefrontCollection = {
  id: string;
  slug: string;
  name: string;
  image_url: string;
  sort_order: number;
  subcategories: StorefrontSubCategory[];
};

export type StorefrontConfig = { collections: StorefrontCollection[] };

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
    { id: "winter-27", slug: "winter-27", name: "WINTER 27 COLLECTION", image_url: "/mavex-products/navy-logo-hoodie.webp", sort_order: 0, subcategories: garmentSubcategories("/mavex-products/navy-logo-hoodie.webp") },
    { id: "plain-basic", slug: "plain-basic", name: "PLAIN / BASIC COLLECTION", image_url: "/mavex-products/grey-logo-hoodie.webp", sort_order: 1, subcategories: garmentSubcategories("/mavex-products/grey-logo-hoodie.webp") },
    { id: "lost-in-the-moment", slug: "lost-in-the-moment", name: "LOST IN THE MOMENT", image_url: "/mavex-products/burgundy-logo-hoodie.webp", sort_order: 2, subcategories: garmentSubcategories("/mavex-products/burgundy-logo-hoodie.webp") },
    { id: "ciao-mavex", slug: "ciao-mavex", name: "CIAO MAVEX", image_url: "/mavex-products/navy-logo-joggers.webp", sort_order: 3, subcategories: garmentSubcategories("/mavex-products/navy-logo-joggers.webp") },
  ],
};

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
