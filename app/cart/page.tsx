
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { normalizeCartItems, type CartItem } from "@/lib/cart";

export default function CartPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartWarning, setCartWarning] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const savedCart = localStorage.getItem("mavex-cart");
        if (savedCart) {
          setCart(normalizeCartItems(JSON.parse(savedCart)));
        }
      } catch {
        setCart([]);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function updateCart(newCart: CartItem[]) {
    setCart(newCart);
    try {
      localStorage.setItem("mavex-cart", JSON.stringify(newCart));
      setCartWarning("");
    } catch {
      setCartWarning("Your browser could not save this bag. Keep this page open until checkout.");
    }
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
            {cartWarning && <p role="status" style={{ color: "#a22", marginBottom: 16 }}>{cartWarning}</p>}
            {cart.map((item, index) => (
              <div className="cart-item" key={index}>
                {item.image ? (
                  <Image
                    src={item.image}
                    alt={item.name}
                    className="cart-item-image"
                    width={100}
                    height={130}
                    sizes="(max-width: 700px) 85px, 100px"
                    quality={80}
                  />
                ) : <div className="cart-item-image" aria-hidden="true" />}

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
                      disabled={item.stock_quantity <= 0 || item.quantity >= Math.min(item.stock_quantity, 10)}
                      onClick={() =>
                        updateCart(
                          cart.map((product, i) =>
                            i === index
                              ? {
                                  ...product,
                                  quantity: Math.min(product.quantity + 1, product.stock_quantity, 10)
                                }
                              : product
                          )
                        )
                      }
                      style={{ opacity: item.stock_quantity <= 0 || item.quantity >= Math.min(item.stock_quantity, 10) ? 0.45 : 1, cursor: item.stock_quantity <= 0 || item.quantity >= Math.min(item.stock_quantity, 10) ? "not-allowed" : "pointer" }}
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
