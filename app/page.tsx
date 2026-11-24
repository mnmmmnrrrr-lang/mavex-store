"use client";

import { useEffect, useState } from "react";
import { localProducts } from "@/lib/catalog";

type Product = {
  id: string;
  name: string;
  price: number;
  compare_at_price: number | null;
  product_images: {
    image_url: string;
    alt_text: string | null;
    sort_order: number | null;
  }[];
};

const fallbackImages = [
  "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=700",
  "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=700",
  "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=700",
  "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=700",
];

export default function Home() {
  const [products, setProducts] = useState<Product[]>(localProducts);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const searchQuery = searchTerm.trim().toLocaleLowerCase();
  const searchResults = searchQuery
    ? products.filter((product) => product.name.toLocaleLowerCase().includes(searchQuery)).slice(0, 5)
    : [];

  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      try {
        const catalogResponse = await fetch("/api/catalog");
        if (!catalogResponse.ok) throw new Error("Could not load the collection.");
        const catalog = await catalogResponse.json() as Product[];
        if (!cancelled) {
          setProducts(catalog);
          setLoadError(false);
        }
      } catch {
        if (!cancelled) {
          setProducts(localProducts);
          setLoadError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadProducts();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main>
      <div className="announcement">MAVEX STREETWEAR — NEW COLLECTION 2026</div>

      <header className="navbar">
        <h1 className="logo">MAVEX®</h1>
        <nav>
          <a href="#home">HOME</a>
          <a href="#shop">SHOP</a>
          <a href="#about">ABOUT</a>
          <a href="/account">MY ORDERS</a>
        </nav>
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
              {searchResults.length > 0 ? searchResults.map((product) => {
                const productImage = product.product_images[0]?.image_url || fallbackImages[products.indexOf(product) % fallbackImages.length];
                return (
                  <a href={`/product/${product.id}`} className="navbar-search-result" role="option" aria-selected="false" key={product.id}>
                    <img src={productImage} alt="" loading="lazy" decoding="async" />
                    <span className="navbar-search-result-copy">
                      <strong>{product.name}</strong>
                      <small>DETAILS</small>
                    </span>
                  </a>
                );
              }) : (
                <p className="navbar-search-empty">{loading ? "Loading products…" : "No products found"}</p>
              )}
            </div>
          )}
        </div>
        <a href="/cart" className="navbar-bag" aria-label="Shopping bag">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 8.5h14l1 12H4l1-12Z" />
            <path d="M8.5 8.5V6.8a3.5 3.5 0 0 1 7 0v1.7" />
          </svg>
          <span>BAG</span>
        </a>
      </header>

      <section className="hero" id="home">
        <div className="hero-content">
          <p>PREMIUM STREETWEAR</p>
          <h2>NOT JUST<br />CLOTHING<span>.</span><br /><em>YOUR IDENTITY.</em></h2>
          <p>EXPRESS YOURSELF. WEAR MAVEX.</p>
          <div className="hero-actions">
            <a href="#shop" className="shop-button">SHOPPING NOW</a>
          </div>
        </div>
      </section>

      <section className="products" id="shop">
        <p>DISCOVER MAVEX</p>
        <h2>WINTER 27 COLLECTION<span>.</span></h2>

        {loading && <p>LOADING COLLECTION...</p>}
        {!loading && loadError && <p>THE LOCAL COLLECTION IS SHOWN. SOME PRODUCTS MAY BE UNAVAILABLE.</p>}
        {!loading && !loadError && products.length === 0 && <p>NO PRODUCTS AVAILABLE RIGHT NOW.</p>}

        <div className="product-grid">
          {products.map((product, index) => {
            const image = product.product_images[0]?.image_url || fallbackImages[index % fallbackImages.length];
            return (
              <div className="product-card" key={product.id}>
                <a href={"/product/" + product.id} style={{ color: "inherit", textDecoration: "none" }}>
                  <img className="product-image" src={image} alt={product.product_images[0]?.alt_text || product.name} loading="lazy" decoding="async" />
                  <h3>{product.name}</h3>
                </a>
                <p>
                  EGP {Number(product.price).toLocaleString("en-EG")}
                  {product.compare_at_price && product.compare_at_price > product.price && (
                    <del style={{ marginInlineStart: 10, color: "#888", fontSize: 13 }}>
                      EGP {Number(product.compare_at_price).toLocaleString("en-EG")}
                    </del>
                  )}
                </p>
                <a
                  className="add-button"
                  href={"/product/" + product.id}
                  style={{ display: "block", textAlign: "center", textDecoration: "none" }}
                >
                  CHOOSE COLOR &amp; SIZE
                </a>
              </div>
            );
          })}
        </div>
      </section>

      <section className="about" id="about">
        <p>THIS IS MORE THAN FASHION.</p>
        <h2>WEAR YOUR<br /><span>IDENTITY.</span></h2>
      </section>

      <footer>
        <h2>MAVEX®</h2>
        <p>STREET CULTURE. OWN YOUR STYLE.</p>
        <small>© 2026 MAVEX. ALL RIGHTS RESERVED.</small>
        <p style={{ marginTop: 16, display: "flex", justifyContent: "center", gap: 18 }}><a href="/account" style={{ color: "#555", fontSize: 11 }}>MY ORDERS</a><a href="/returns" style={{ color: "#555", fontSize: 11 }}>RETURNS &amp; EXCHANGES</a><a href="/admin" style={{ color: "#888", fontSize: 10 }}>ADMIN</a></p>
      </footer>
    </main>
  );
}
