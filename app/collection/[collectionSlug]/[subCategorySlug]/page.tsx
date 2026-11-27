import { redirect } from "next/navigation";
import Link from "next/link";
import { getStorefrontProducts, type StorefrontProduct } from "@/lib/catalog-server";
import { localProducts } from "@/lib/catalog";
import { getStorefrontFallback, inferProductPlacement, isSitePageEnabled } from "@/lib/storefront-config";
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
    return [
      ...subcategoryParams,
      { collectionSlug: collection.slug, subCategorySlug: "all-products" },
      ...(hasDirectProducts ? [{ collectionSlug: collection.slug, subCategorySlug: "direct-products" }] : []),
    ];
  });
}

export default async function CollectionProductsPage({ params }: { params: Promise<{ collectionSlug: string; subCategorySlug: string }> }) {
  const { collectionSlug, subCategorySlug } = await params;
  const [config, loadedProducts] = await Promise.all([
    getPublicStorefrontConfig(),
    getStorefrontProducts().catch(() => null),
  ]);
  const collection = config.collections.find((item) => item.slug === collectionSlug);
  if (!collection) redirect(getStorefrontFallback(config, "subcategory"));
  if (collection.enabled === false) redirect(getStorefrontFallback(config, "subcategory"));

  if (!isSitePageEnabled(config, "subcategory")) {
    if (isSitePageEnabled(config, "collection")) redirect(`/collection/${encodeURIComponent(collection.slug)}`);
    redirect(getStorefrontFallback(config, "subcategory"));
  }

  const directListing = subCategorySlug === "direct-products";
  const allCollectionProducts = subCategorySlug === "all-products";
  const subcategory = collection.subcategories.find((item) => item.slug === subCategorySlug);
  if (!directListing && !allCollectionProducts && !subcategory) {
    if (isSitePageEnabled(config, "collection")) redirect(`/collection/${encodeURIComponent(collection.slug)}`);
    redirect(getStorefrontFallback(config, "subcategory"));
  }
  if (subcategory?.enabled === false) {
    if (isSitePageEnabled(config, "collection")) redirect(`/collection/${encodeURIComponent(collection.slug)}`);
    redirect(getStorefrontFallback(config, "subcategory"));
  }

  const products: StorefrontProduct[] = loadedProducts || localProducts.map((product) => ({
    ...product,
    ...inferProductPlacement(product, config),
    is_featured: false,
  }));
  const selectedProduct = subcategory?.direct_product_id ? products.find((product) => product.id === subcategory.direct_product_id && product.collection_id === collection.id && product.subcategory_id === subcategory.id) : null;
  if (subcategory?.navigation_mode === "product" && selectedProduct && isSitePageEnabled(config, "product")) redirect(`/product/${encodeURIComponent(selectedProduct.id)}`);

  const listing = products
    .filter((product) => product.collection_id === collection.id)
    .filter((product) => allCollectionProducts ? true : directListing ? !product.subcategory_id : product.subcategory_id === subcategory?.id)
    .sort((a, b) => Number(b.is_featured) - Number(a.is_featured) || (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const heading = allCollectionProducts || directListing ? collection.name : subcategory!.name;

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
