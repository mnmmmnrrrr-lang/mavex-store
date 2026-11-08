
"use client";

import { useState } from "react";

const products = [
  { name: "BLACK OVERSIZED TEE", price: 899, image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=700" },
  { name: "WHITE STREET TEE", price: 899, image: "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=700" },
  { name: "GRAPHIC PINK TEE", price: 999, image: "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=700" },
  { name: "OVERSIZED HOODIE", price: 1499, image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=700" },
];

type CartItem = {
  name: string;
  price: number;
  size: string;
  quantity: number;
};

export default function Home() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [sizes, setSizes] = useState(["M", "M", "M", "M"]);

  function addToCart(index: number) {
  const product = products[index];
  const size = sizes[index];

  const existing = cart.find(
    (item) => item.name === product.name && item.size === size
  );

  let updatedCart;

  if (existing) {
    updatedCart = cart.map((item) =>
      item.name === product.name && item.size === size
        ? { ...item, quantity: item.quantity + 1 }
        : item
    );
  } else {
    updatedCart = [
      ...cart,
      { ...product, size, quantity: 1 },
    ];
  }

  setCart(updatedCart);

  localStorage.setItem(
    "mavex-cart",
    JSON.stringify(updatedCart)
  );
}

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <main>
      <div className="announcement">
        MAVEX STREETWEAR — NEW COLLECTION 2026
      </div>

      <header className="navbar">
        <h1 className="logo">MAVEX®</h1>
        <nav>
          <a href="#home">HOME</a>
          <a href="#shop">SHOP</a>
          <a href="#about">ABOUT</a>
        </nav>
        <a href="/cart">BAG ({cartCount})</a>
      </header>

      <section className="hero" id="home">
        <div className="hero-content">
          <p>PREMIUM STREETWEAR</p>
          <h2>NOT JUST<br />CLOTHING<span>.</span><br /><em>YOUR IDENTITY.</em></h2>
          <p>EXPRESS YOURSELF. WEAR MAVEX.</p>
          <a href="#shop" className="shop-button">EXPLORE COLLECTION ↗</a>
        </div>
      </section>

      <section className="products" id="shop">
        <p>DISCOVER MAVEX</p>
        <h2>NEW ARRIVALS<span>.</span></h2>

        <div className="product-grid">
          {products.map((product, index) => (
            <div className="product-card" key={product.name}>
              <a
  href={`/product/${index}`}
  style={{ color: "inherit", textDecoration: "none" }}
>
  <img
    className="product-image"
    src={product.image}
    alt={product.name}
  />
  <h3>{product.name}</h3>
</a>
              <p>EGP {product.price}</p>

              <select
                value={sizes[index]}
                onChange={(e) => {
                  const newSizes = [...sizes];
                  newSizes[index] = e.target.value;
                  setSizes(newSizes);
                }}
              >
                <option value="S">SIZE: S</option>
                <option value="M">SIZE: M</option>
                <option value="L">SIZE: L</option>
                <option value="XL">SIZE: XL</option>
              </select>

              <button className="add-button" onClick={() => addToCart(index)}>
                ADD TO CART
              </button>
            </div>
          ))}
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
      </footer>
    </main>
  );
}
