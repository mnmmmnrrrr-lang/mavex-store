import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import ProductClient, { type Product } from "./product-client";
import { getCatalogProduct, getCatalogProducts, getRelatedStorefrontProducts } from "@/lib/catalog-server";
import { localProducts } from "@/lib/catalog";

export const revalidate = 60;

type ProductPageProps = {
  params: Promise<{ id: string }>;
};

const readProduct = cache(async (id: string) => {
  try {
    return await getCatalogProduct(id);
  } catch (error) {
    console.error("Could not load the hosted MAVEX product:", error);
    return localProducts.find((product) => product.id === id || product.slug === id) ?? null;
  }
});

export async function generateStaticParams() {
  try {
    const products = await getCatalogProducts();
    return products.map((product) => ({ id: product.id }));
  } catch (error) {
    console.error("Could not load product ids for static generation:", error);
    return localProducts.map((product) => ({ id: product.id }));
  }
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { id } = await params;
  const product = await readProduct(id);
  if (!product) return { title: "Product not found | MAVEX" };

  return {
    title: `${product.name} | MAVEX`,
    description: product.description || `Shop ${product.name} at the official MAVEX store.`,
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  const product = await readProduct(id);
  if (!product) notFound();

  const normalizedProduct = {
    ...product,
    product_images: [...(product.product_images || [])].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    ),
    product_variants: (product.product_variants || []).filter(
      (variant) => variant.is_active !== false,
    ),
  } as Product;

  const group = /\b(pants?|joggers?|trousers?|shorts?)\b/i.test(product.name) ? "bottoms" : "tops";
  const relatedProducts = await getRelatedStorefrontProducts(product.id, group).catch((error) => {
    console.error("Could not load related MAVEX products:", error);
    return [];
  });

  return <ProductClient key={normalizedProduct.id} initialProduct={normalizedProduct} initialRelatedProducts={relatedProducts} />;
}
