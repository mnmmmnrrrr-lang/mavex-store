import Link from "next/link";
import ProductCard from "../product-card";
import { getStorefrontProducts, type StorefrontProduct } from "@/lib/catalog-server";
import { localProducts } from "@/lib/catalog";

export const revalidate = 60;

export default async function ShopPage() {
  const products: StorefrontProduct[] = (await getStorefrontProducts().catch(() => localProducts.map((product, index) => ({
    ...product, collection_id: null, subcategory_id: null, is_featured: false, sort_order: index,
  }))))
    .sort((a, b) => Number(b.is_featured === true) - Number(a.is_featured === true) || (a.sort_order ?? 0) - (b.sort_order ?? 0));
  return (
    <main className="products collection-page">
      <p><Link href="/">MAVEX / HOME</Link></p>
      <h1>SHOP ALL<span>.</span></h1>
      {products.length ? <div className="product-grid">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <p className="collection-empty">No products are available right now.</p>}
    </main>
  );
}
