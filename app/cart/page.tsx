
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type CartItem = {
  name: string;
  price: number;
  size: string;
  color?: string;
  quantity: number;
  image: string;
};

export default function CartPage() {
  const [cart, setCart] = useState<CartItem[]>([]);

  useEffect(() => {
    try {
      const savedCart = localStorage.getItem("mavex-cart");
      if (savedCart) {
        setCart(JSON.parse(savedCart));
      }
    } catch {
      setCart([]);
    }
  }, []);

  function updateCart(newCart: CartItem[]) {
    setCart(newCart);
    localStorage.setItem("mavex-cart", JSON.stringify(newCart));
  }

  const total = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  return (
    <main className="cart-page">
      <header className="navbar">
        <Link href="/" className="logo">
          MAVEX®
        </Link>

        <Link href="/#shop">
          CONTINUE SHOPPING
        </Link>
      </header>

      <section className="cart-container">
        <p style={{
          color: "#f890c8",
          letterSpacing: 3,
          fontWeight: "bold",
          fontSize: 12
        }}>
          YOUR SELECTION
        </p>

        <h1 style={{
          fontSize: "clamp(38px, 7vw, 65px)",
          margin: "15px 0 40px",
          fontWeight: 900
        }}>
          SHOPPING BAG<span style={{ color: "#f890c8" }}>.</span>
        </h1>

        {cart.length === 0 ? (
          <div style={{
            padding: "45px 0",
            borderTop: "1px solid #ddd"
          }}>
            <h2>Your bag is empty.</h2>

            <Link
              href="/#shop"
              className="shop-button"
              style={{ marginTop: 25 }}
            >
              EXPLORE PRODUCTS ↗
            </Link>
          </div>
        ) : (
          <>
            {cart.map((item, index) => (
              <div className="cart-item" key={index}>
                <img
                  src={item.image}
                  alt={item.name}
                  className="cart-item-image"
                  loading="lazy"
                  decoding="async"
                />

                <div className="cart-item-info">
                  <h3>{item.name}</h3>

                  <p>COLOR: {item.color || "Default"}</p>
                  <p>SIZE: {item.size}</p>
                  <p>EGP {item.price.toLocaleString("en-EG")}</p>

                  <div className="quantity-controls">
                    <button
                      aria-label="Decrease quantity"
                      onClick={() =>
                        updateCart(
                          cart.map((product, i) =>
                            i === index
                              ? {
                                  ...product,
                                  quantity: Math.max(1, product.quantity - 1)
                                }
                              : product
                          )
                        )
                      }
                    >
                      −
                    </button>

                    <span>{item.quantity}</span>

                    <button
                      aria-label="Increase quantity"
                      onClick={() =>
                        updateCart(
                          cart.map((product, i) =>
                            i === index
                              ? {
                                  ...product,
                                  quantity: product.quantity + 1
                                }
                              : product
                          )
                        )
                      }
                    >
                      +
                    </button>
                  </div>

                  <button
                    className="remove-button"
                    onClick={() =>
                      updateCart(cart.filter((_, i) => i !== index))
                    }
                  >
                    REMOVE ITEM
                  </button>
                </div>

                <strong className="cart-item-price">
                  EGP {(item.price * item.quantity).toLocaleString("en-EG")}
                </strong>
              </div>
            ))}

            <div className="cart-total">
              <p style={{ fontSize: 12, color: "#777", marginBottom: 10 }}>
                ORDER SUBTOTAL
              </p>

              <h2>
                TOTAL: EGP {total.toLocaleString("en-EG")}
              </h2>

              <Link
                href="/checkout"
                className="add-button"
                style={{
                  display: "inline-block",
                  marginTop: 20,
                  textDecoration: "none",
                  textAlign: "center",
                }}
              >
                PROCEED TO CHECKOUT
              </Link>
            </div>
          </>
        )}
      </section>

      <footer>
        <h2>MAVEX®</h2>
        <p>STREET CULTURE. OWN YOUR STYLE.</p>
        <small>© 2026 MAVEX. ALL RIGHTS RESERVED.</small>
      </footer>
    </main>
  );
}
