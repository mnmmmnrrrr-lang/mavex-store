import { notFound } from "next/navigation";
import Link from "next/link";
import { getStorefrontProducts } from "@/lib/catalog-server";
import { localProducts } from "@/lib/catalog";
import { inferProductPlacement, type StorefrontConfig } from "@/lib/storefront-config";
import { getPublicStorefrontConfig } from "@/lib/storefront-server";
import CollectionCard from "../../collection-card";

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
  if (!collection) notFound();

  const products = loadedProducts || localProducts.map((product) => ({
    ...product,
    ...inferProductPlacement(product, config as StorefrontConfig),
    is_featured: false,
  }));
  const collectionProducts = products.filter((product) => product.collection_id === collection.id);
  const hasDirectProducts = collectionProducts.some((product) => !product.subcategory_id);
  const cards = collection.subcategories.map((subcategory) => ({
    name: subcategory.name,
    image: subcategory.image_url || collection.image_url,
    href: `/collection/${encodeURIComponent(collection.slug)}/${encodeURIComponent(subcategory.slug)}`,
  }));
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
