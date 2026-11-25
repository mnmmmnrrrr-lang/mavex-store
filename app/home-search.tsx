"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { StorefrontProduct } from "@/lib/catalog-server";

const fallbackImages = [
  "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=700",
  "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=700",
  "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=700",
  "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=700",
];

export default function HomeSearch({ products }: { products: StorefrontProduct[] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const searchQuery = searchTerm.trim().toLocaleLowerCase();
  const searchResults = searchQuery
    ? products
        .filter((product) => `${product.name} ${product.description || ""}`.toLocaleLowerCase().includes(searchQuery))
        .slice(0, 5)
    : [];

  return (
    <div className="navbar-search">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <circle cx="10.8" cy="10.8" r="6.8" />
        <path d="m16 16 4.2 4.2" />
      </svg>
      <input
        type="search"
        value={searchTerm}
        onChange={(event) => setSearchTerm(event.target.value)}
        placeholder="Search products"
        aria-label="Search products"
        aria-expanded={Boolean(searchQuery)}
        aria-controls="navbar-search-results"
      />
      {searchQuery && (
        <div className="navbar-search-results" id="navbar-search-results" role="listbox" aria-label="Product search results">
          {searchResults.length > 0 ? searchResults.map((product, index) => {
            const image = product.product_images[0]?.image_url || fallbackImages[index % fallbackImages.length];
            const detail = product.description || product.product_images[0]?.alt_text;
            return (
              <Link
                href={`/product/${encodeURIComponent(product.id)}`}
                className="navbar-search-result"
                role="option"
                aria-selected="false"
                key={product.id}
              >
                <Image src={image} alt="" width={64} height={64} sizes="64px" quality={80} />
                <span className="navbar-search-result-copy">
                  <strong>{product.name}</strong>
                  {detail && <small>{detail}</small>}
                </span>
              </Link>
            );
          }) : (
            <p className="navbar-search-empty">No products found</p>
          )}
        </div>
      )}
    </div>
  );
}
