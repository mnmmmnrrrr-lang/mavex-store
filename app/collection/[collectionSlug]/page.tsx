import { redirect } from "next/navigation";
import Link from "next/link";
import { getStorefrontProducts, type StorefrontProduct } from "@/lib/catalog-server";
import { localProducts } from "@/lib/catalog";
import { getCollectionHref, getStorefrontFallback, inferProductPlacement, isSitePageEnabled, type StorefrontConfig } from "@/lib/storefront-config";
import { getPublicStorefrontConfig } from "@/lib/storefront-server";
import CollectionCard from "../../collection-card";
import ProductCard from "../../product-card";

export const revalidate = 60;

export async function generateStaticParams() {
  const config = await getPublicStorefrontConfig();
  return config.collections.map((collection) => ({ collectionSlug: collection.slug }));
}

export default async function CollectionPage({ params }: { params: Promise<{ collectionSlug: string }> }) {
  const { collectionSlug } = await params;
  const [config, loadedProducts] = await Promise.all([
    getPublicStorefrontConfig(),
    getStorefrontProducts().catch(() => null),
  ]);
  const collection = config.collections.find((item) => item.slug === collectionSlug);
  if (!collection) redirect(getStorefrontFallback(config, "collection"));
  if (collection.enabled === false) redirect(getStorefrontFallback(config, "collection"));
  if (!isSitePageEnabled(config, "collection")) redirect(getCollectionHref(config, collection));

  const products: StorefrontProduct[] = loadedProducts || localProducts.map((product) => ({
    ...product,
    ...inferProductPlacement(product, config as StorefrontConfig),
    is_featured: false,
  })) as StorefrontProduct[];
  const collectionProducts = products.filter((product) => product.collection_id === collection.id);
  if (collection.navigation_mode === "products" || !isSitePageEnabled(config, "subcategory")) {
    const listing = [...collectionProducts].sort((a, b) => Number(b.is_featured) - Number(a.is_featured) || (a.sort_order ?? 0) - (b.sort_order ?? 0));
    return <main className="products collection-page">
      <p><Link href="/">MAVEX / COLLECTIONS</Link></p><h1>{collection.name}<span>.</span></h1>
      {listing.length ? <div className="product-grid">{listing.map((product, index) => <ProductCard key={product.id} product={product} priority={index === 0} />)}</div> : <p className="collection-empty">No products are assigned to this collection yet.</p>}
    </main>;
  }
  const hasDirectProducts = collectionProducts.some((product) => !product.subcategory_id);
  const cards = collection.subcategories.filter((item) => item.enabled !== false).map((subcategory) => {
    const directProduct = products.find((product) => product.id === subcategory.direct_product_id && product.collection_id === collection.id && product.subcategory_id === subcategory.id);
    const href = subcategory.navigation_mode === "product" && directProduct && isSitePageEnabled(config, "product")
      ? `/product/${encodeURIComponent(directProduct.id)}`
      : `/collection/${encodeURIComponent(collection.slug)}/${encodeURIComponent(subcategory.slug)}`;
    return { name: subcategory.name, image: subcategory.image_url || collection.image_url, href };
  });
  if (hasDirectProducts) cards.push({
    name: `SHOP ${collection.name}`,
    image: collection.image_url,
    href: `/collection/${encodeURIComponent(collection.slug)}/direct-products`,
  });

  return (
    <main className="products collection-page">
      <p><Link href="/">MAVEX / COLLECTIONS</Link></p>
      <h1>{collection.name}<span>.</span></h1>
      {cards.length ? <div className="collection-grid">
        {cards.map((card, index) => <CollectionCard key={card.href} name={card.name} image={card.image} href={card.href} buttonLabel="VIEW PRODUCTS" priority={index === 0} />)}
      </div> : <p className="collection-empty">No product categories are available in this collection yet.</p>}
    </main>
  );
}
