import Image from "next/image";
import Link from "next/link";
import { getStorefrontProducts, type StorefrontProduct } from "@/lib/catalog-server";
import { localProducts } from "@/lib/catalog";
import HomeSearch from "./home-search";

export const revalidate = 60;

const fallbackImages = [
  "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=700",
  "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=700",
  "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=700",
  "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=700",
];

export default async function Home() {
  let loadError = false;
  let products: StorefrontProduct[];

  try {
    products = await getStorefrontProducts();
  } catch (error) {
    console.error("Could not load the MAVEX collection:", error);
    products = localProducts;
    loadError = true;
  }

  products = products.map((product) => ({
    ...product,
    product_images: [...(product.product_images || [])].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    ),
  }));

  return (
    <main>
      <div className="announcement">MAVEX STREETWEAR — NEW COLLECTION 2026</div>

      <header className="navbar">
        <h1 className="logo">MAVEX®</h1>
        <nav>
          <Link href="#home">HOME</Link>
          <Link href="#shop">SHOP</Link>
          <Link href="#about">ABOUT</Link>
          <Link href="/account">MY ORDERS</Link>
        </nav>
        <HomeSearch products={products} />
        <Link href="/cart" className="navbar-bag" aria-label="Shopping bag">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 8.5h14l1 12H4l1-12Z" />
            <path d="M8.5 8.5V6.8a3.5 3.5 0 0 1 7 0v1.7" />
          </svg>
          <span>BAG</span>
        </Link>
      </header>

      <section className="hero" id="home">
        <div className="hero-content">
          <p>PREMIUM STREETWEAR</p>
          <h2>NOT JUST<br />CLOTHING<span>.</span><br /><em>YOUR IDENTITY.</em></h2>
          <p>EXPRESS YOURSELF. WEAR MAVEX.</p>
          <div className="hero-actions">
            <Link href="#shop" className="shop-button">SHOPPING NOW</Link>
          </div>
        </div>
      </section>

      <section className="products" id="shop">
        <p>DISCOVER MAVEX</p>
        <h2>WINTER 27 COLLECTION<span>.</span></h2>
        {loadError && <p>THE LOCAL COLLECTION IS SHOWN. SOME PRODUCTS MAY BE UNAVAILABLE.</p>}
        {products.length === 0 && <p>NO PRODUCTS AVAILABLE RIGHT NOW.</p>}

        <div className="product-grid">
          {products.map((product, index) => {
            const image = product.product_images[0]?.image_url || fallbackImages[index % fallbackImages.length];
            return (
              <article className="product-card" key={product.id}>
                <Link href={`/product/${encodeURIComponent(product.id)}`} style={{ color: "inherit", textDecoration: "none" }}>
                  <Image
                    className="product-image"
                    src={image}
                    alt={product.product_images[0]?.alt_text || product.name}
                    width={700}
                    height={850}
                    sizes="(max-width: 700px) 50vw, (max-width: 1100px) 33vw, 25vw"
                    quality={80}
                    loading="lazy"
                  />
                  <h3>{product.name}</h3>
                </Link>
                <p>
                  EGP {Number(product.price).toLocaleString("en-EG")}
                  {product.compare_at_price && product.compare_at_price > product.price && (
                    <del style={{ marginInlineStart: 10, color: "#888", fontSize: 13 }}>
                      EGP {Number(product.compare_at_price).toLocaleString("en-EG")}
                    </del>
                  )}
                </p>
                <Link
                  className="add-button"
                  href={`/product/${encodeURIComponent(product.id)}`}
                  style={{ display: "block", textAlign: "center", textDecoration: "none" }}
                >
                  CHOOSE COLOR &amp; SIZE
                </Link>
              </article>
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
        <p style={{ marginTop: 16, display: "flex", justifyContent: "center", gap: 18 }}>
          <Link href="/account" style={{ color: "#555", fontSize: 11 }}>MY ORDERS</Link>
          <Link href="/returns" style={{ color: "#555", fontSize: 11 }}>RETURNS &amp; EXCHANGES</Link>
          <Link href="/admin" style={{ color: "#888", fontSize: 10 }}>ADMIN</Link>
        </p>
      </footer>
    </main>
  );
}
