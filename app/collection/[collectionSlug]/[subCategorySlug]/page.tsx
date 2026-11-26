import { notFound } from "next/navigation";
import Link from "next/link";
import { getStorefrontProducts, type StorefrontProduct } from "@/lib/catalog-server";
import { localProducts } from "@/lib/catalog";
import { inferProductPlacement } from "@/lib/storefront-config";
import { getPublicStorefrontConfig } from "@/lib/storefront-server";
import ProductCard from "../../../product-card";

export const revalidate = 60;

export async function generateStaticParams() {
  const [config, products] = await Promise.all([
    getPublicStorefrontConfig(),
    getStorefrontProducts().catch(() => []),
  ]);
  return config.collections.flatMap((collection) => {
    const subcategoryParams = collection.subcategories.map((subcategory) => ({
      collectionSlug: collection.slug,
      subCategorySlug: subcategory.slug,
    }));
    const hasDirectProducts = products.some((product) => product.collection_id === collection.id && !product.subcategory_id);
    return hasDirectProducts
      ? [...subcategoryParams, { collectionSlug: collection.slug, subCategorySlug: "direct-products" }]
      : subcategoryParams;
  });
}

export default async function CollectionProductsPage({ params }: { params: Promise<{ collectionSlug: string; subCategorySlug: string }> }) {
  const { collectionSlug, subCategorySlug } = await params;
  const [config, loadedProducts] = await Promise.all([
    getPublicStorefrontConfig(),
    getStorefrontProducts().catch(() => null),
  ]);
  const collection = config.collections.find((item) => item.slug === collectionSlug);
  if (!collection) notFound();

  const directListing = subCategorySlug === "direct-products";
  const subcategory = collection.subcategories.find((item) => item.slug === subCategorySlug);
  if (!directListing && !subcategory) notFound();

  const products: StorefrontProduct[] = loadedProducts || localProducts.map((product) => ({
    ...product,
    ...inferProductPlacement(product, config),
    is_featured: false,
  }));
  const listing = products
    .filter((product) => product.collection_id === collection.id)
    .filter((product) => directListing ? !product.subcategory_id : product.subcategory_id === subcategory?.id)
    .sort((a, b) => Number(b.is_featured) - Number(a.is_featured) || (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const heading = directListing ? collection.name : subcategory!.name;

  return (
    <main className="products collection-page">
      <p className="collection-breadcrumb"><Link href="/">MAVEX</Link> / <Link href={`/collection/${encodeURIComponent(collection.slug)}`}>{collection.name}</Link></p>
      <h1>{heading}<span>.</span></h1>
      {listing.length ? <div className="product-grid">
        {listing.map((product, index) => <ProductCard key={product.id} product={product} priority={index === 0} />)}
      </div> : <p className="collection-empty">No products are assigned here yet.</p>}
    </main>
  );
}
