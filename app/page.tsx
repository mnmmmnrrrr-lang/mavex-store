import Image from "next/image";
import Link from "next/link";
import { getStorefrontProducts, type StorefrontProduct } from "@/lib/catalog-server";
import { localProducts } from "@/lib/catalog";
import { getPublicStorefrontConfig } from "@/lib/storefront-server";
import { inferProductPlacement } from "@/lib/storefront-config";
import HomeSearch from "./home-search";
import AccountNav from "./account-nav";
import CollectionCard from "./collection-card";
import { getCollectionHref, getStorefrontFallback, isSitePageEnabled } from "@/lib/storefront-config";
import { redirect } from "next/navigation";

export const revalidate = 60;

export default async function Home() {
  let loadError = false;
  const storefrontConfig = await getPublicStorefrontConfig();
  if (!isSitePageEnabled(storefrontConfig, "home")) redirect(getStorefrontFallback(storefrontConfig, "home"));
  const collections = [...storefrontConfig.collections].filter((collection) => collection.enabled !== false).sort((a, b) => a.sort_order - b.sort_order);
  let products: StorefrontProduct[];

  try {
    products = await getStorefrontProducts();
  } catch (error) {
    console.error("Could not load the MAVEX collection:", error);
    products = localProducts.map((product) => ({
      ...product,
      ...inferProductPlacement(product, storefrontConfig),
      is_featured: false,
    }));
    loadError = true;
  }

  products = products.map((product) => ({
    ...product,
    product_images: [...(product.product_images || [])].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    ),
  }));
  const menuPages = [...(storefrontConfig.pageRoutes || [])].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <main>
      <div className="announcement">MAVEX STREETWEAR — NEW COLLECTION 2026</div>

      <header className="navbar">
        <h1 className="logo">
          <Link href="/" aria-label="MAVEX home">
            <Image src="/mavex-logo.png" alt="MAVEX®" width={436} height={302} sizes="(max-width: 700px) 110px, 130px" quality={95} priority />
          </Link>
        </h1>
        <nav>
          {menuPages.filter((page) => page.enabled && ["home", "shop", "about", "account"].includes(page.id)).map((page) => page.id === "home"
            ? <Link key={page.id} href="#home">HOME</Link>
            : page.id === "shop"
              ? <Link key={page.id} href="/shop">SHOP</Link>
              : page.id === "about"
                ? <Link key={page.id} href="#about">ABOUT</Link>
                : <AccountNav key={page.id} />)}
        </nav>
        {isSitePageEnabled(storefrontConfig, "shop") && <HomeSearch products={products} />}
        {isSitePageEnabled(storefrontConfig, "cart") && <Link href="/cart" className="navbar-bag" aria-label="Shopping bag">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 8.5h14l1 12H4l1-12Z" />
            <path d="M8.5 8.5V6.8a3.5 3.5 0 0 1 7 0v1.7" />
          </svg>
          <span>BAG</span>
        </Link>}
      </header>

      {isSitePageEnabled(storefrontConfig, "hero") && <section className="hero" id="home">
        <div className="hero-content">
          <p>PREMIUM STREETWEAR</p>
          <h2>NOT JUST<br />CLOTHING<span>.</span><br /><em>YOUR IDENTITY.</em></h2>
          <p>EXPRESS YOURSELF. WEAR MAVEX.</p>
          <div className="hero-actions">
            <Link href={isSitePageEnabled(storefrontConfig, "collections_section") ? "#shop" : "/shop"} className="shop-button">SHOPPING NOW</Link>
          </div>
        </div>
      </section>}

      {isSitePageEnabled(storefrontConfig, "collections_section") && <section className="products" id="shop">
        <p>DISCOVER MAVEX</p>
        <h2>WINTER 27 COLLECTION<span>.</span></h2>
        {loadError && <p>THE STARTER COLLECTION IS SHOWN WHILE THE CATALOG RECONNECTS.</p>}
        {collections.length === 0 ? <p>NO COLLECTIONS AVAILABLE RIGHT NOW.</p> : <div className="collection-grid">
          {collections.map((collection) => <CollectionCard key={collection.id} name={collection.name} image={collection.image_url} href={getCollectionHref(storefrontConfig, collection)} />)}
        </div>}
      </section>}

      {isSitePageEnabled(storefrontConfig, "about") && <section className="about" id="about">
        <p>THIS IS MORE THAN FASHION.</p>
        <h2>WEAR YOUR<br /><span>IDENTITY.</span></h2>
      </section>}

      <footer>
        <h2>MAVEX®</h2>
        <p>STREET CULTURE. OWN YOUR STYLE.</p>
        <small>© 2026 MAVEX. ALL RIGHTS RESERVED.</small>
        <p style={{ marginTop: 16, display: "flex", justifyContent: "center", gap: 18 }}>
          {isSitePageEnabled(storefrontConfig, "account") && <Link href="/account" style={{ color: "#555", fontSize: 11 }}>MY ORDERS</Link>}
          {isSitePageEnabled(storefrontConfig, "returns") && <Link href="/returns" style={{ color: "#555", fontSize: 11 }}>RETURNS &amp; EXCHANGES</Link>}
          <Link href="/admin" style={{ color: "#888", fontSize: 10 }}>ADMIN</Link>
        </p>
      </footer>
    </main>
  );
}
