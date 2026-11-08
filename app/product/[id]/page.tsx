
"use client";

import { useParams } from "next/navigation";
import { useState } from "react";

const products = [
  {
    name: "BLACK OVERSIZED TEE",
    price: 899,
    description: "Premium oversized streetwear. Designed for everyday expression.",
    material: "100% Cotton",
    colors: [
      {
        name: "Black",
        hex: "#111111",
        images: [
          "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=900",
          "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=900",
          "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=900",
        ],
        stock: { S: 5, M: 10, L: 8, XL: 0, XXL: 2 },
      },
      {
        name: "White",
        hex: "#f5f5f5",
        images: [
          "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=900",
          "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=900",
        ],
        stock: { S: 4, M: 7, L: 0, XL: 3, XXL: 1 },
      },
      {
        name: "Pink",
        hex: "#F890C8",
        images: [
          "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=900",
          "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=900",
        ],
        stock: { S: 0, M: 4, L: 5, XL: 2, XXL: 0 },
      },
    ],
  },
  {
    name: "WHITE STREET TEE",
    price: 899,
    description: "Clean design. Premium streetwear essentials.",
    material: "100% Cotton",
    colors: [
      {
        name: "White",
        hex: "#f5f5f5",
        images: [
          "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=900",
          "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=900",
        ],
        stock: { S: 5, M: 8, L: 6, XL: 3, XXL: 1 },
      },
      {
        name: "Black",
        hex: "#111111",
        images: [
          "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=900",
          "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=900",
        ],
        stock: { S: 3, M: 5, L: 4, XL: 0, XXL: 2 },
      },
    ],
  },
  {
    name: "GRAPHIC PINK TEE",
    price: 999,
    description: "Express your identity with MAVEX graphic style.",
    material: "Cotton Blend",
    colors: [
      {
        name: "Pink",
        hex: "#F890C8",
        images: [
          "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=900",
          "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=900",
        ],
        stock: { S: 4, M: 5, L: 3, XL: 2, XXL: 0 },
      },
      {
        name: "Black",
        hex: "#111111",
        images: [
          "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=900",
          "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=900",
        ],
        stock: { S: 2, M: 4, L: 5, XL: 3, XXL: 1 },
      },
    ],
  },
  {
    name: "OVERSIZED HOODIE",
    price: 1499,
    description: "A relaxed oversized fit for everyday streetwear.",
    material: "Heavyweight Cotton Blend",
    colors: [
      {
        name: "Black",
        hex: "#111111",
        images: [
          "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=900",
          "https://images.unsplash.com/photo-1578681994506-b8f463449011?w=900",
        ],
        stock: { S: 3, M: 5, L: 4, XL: 2, XXL: 1 },
      },
      {
        name: "Grey",
        hex: "#999999",
        images: [
          "https://images.unsplash.com/photo-1578681994506-b8f463449011?w=900",
          "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=900",
        ],
        stock: { S: 2, M: 4, L: 3, XL: 2, XXL: 0 },
      },
    ],
  },
];

const sizes = ["S", "M", "L", "XL", "XXL"];

export default function ProductPage() {
  const params = useParams();
  const id = Number(params.id);
  const product = products[id];

  const [colorIndex, setColorIndex] = useState(0);
  const [imageIndex, setImageIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState("M");
  const [message, setMessage] = useState("");

  if (!product) {
    return <main style={{ padding: 30 }}>Product not found.</main>;
  }

  const color = product.colors[colorIndex];
  const images = color.images;
  const available = color.stock[selectedSize as keyof typeof color.stock] > 0;

  function changeColor(index: number) {
    setColorIndex(index);
    setImageIndex(0);
    setSelectedSize("M");
    setMessage("");
  }

  function addToCart() {
    if (!available) return;

    const cart = JSON.parse(localStorage.getItem("mavex-cart") || "[]");

    const existing = cart.find(
      (item: any) =>
        item.name === product.name &&
        item.size === selectedSize &&
        item.color === color.name
    );

    if (existing) {
      existing.quantity += 1;
    } else {
      cart.push({
        name: product.name,
        price: product.price,
        size: selectedSize,
        color: color.name,
        quantity: 1,
        image: images[0],
      });
    }

    localStorage.setItem("mavex-cart", JSON.stringify(cart));
    setMessage("ADDED TO YOUR BAG ✓");
  }

  return (
    <main style={{
      background: "#fff",
      color: "#111",
      minHeight: "100vh",
      padding: "18px 4%",
      fontFamily: "Arial, sans-serif"
    }}>
      <a href="/" style={{
        color: "#111",
        textDecoration: "none",
        fontSize: 13,
        letterSpacing: 1
      }}>
        ← MAVEX / SHOP
      </a>

      <div style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 0.8fr)",
        gap: 35,
        maxWidth: 1150,
        margin: "25px auto"
      }}>
        <section>
          <div
            onTouchStart={(e) => {
              (window as any).touchStartX = e.touches[0].clientX;
            }}
            onTouchEnd={(e) => {
              const start = (window as any).touchStartX;
              const difference = e.changedTouches[0].clientX - start;
              if (Math.abs(difference) > 45) {
                setImageIndex((current) =>
                  difference < 0
                    ? (current + 1) % images.length
                    : (current - 1 + images.length) % images.length
                );
              }
            }}
            style={{
              width: "100%",
              aspectRatio: "4 / 5",
              background: "#f5f5f5",
              overflow: "hidden"
            }}
          >
            <img
              src={images[imageIndex]}
              alt={product.name}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover"
              }}
            />
          </div>

          <div style={{
            display: "flex",
            gap: 9,
            overflowX: "auto",
            marginTop: 12
          }}>
            {images.map((image, index) => (
              <button
                key={index}
                onClick={() => setImageIndex(index)}
                style={{
                  border: imageIndex === index ? "2px solid #F890C8" : "1px solid #ddd",
                  padding: 0,
                  minWidth: 65,
                  width: 65,
                  height: 80,
                  background: "#fff",
                  cursor: "pointer"
                }}
              >
                <img
                  src={image}
                  alt={`Product view ${index + 1}`}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </button>
            ))}
          </div>
        </section>

        <section>
          <p style={{ color: "#999", fontSize: 12, letterSpacing: 2 }}>
            MAVEX® / STREETWEAR
          </p>

          <h1 style={{ fontSize: 27, lineHeight: 1.2 }}>
            {product.name}
          </h1>

          <p style={{ fontSize: 22, fontWeight: "bold" }}>
            EGP {product.price.toLocaleString("en-EG")}
          </p>

          <p style={{ color: "#666", lineHeight: 1.7, fontSize: 14 }}>
            {product.description}
          </p>

          <hr style={{ border: 0, borderTop: "1px solid #eee", margin: "24px 0" }} />

          <p style={{ fontSize: 13, fontWeight: "bold" }}>
            COLOR: {color.name.toUpperCase()}
          </p>

          <div style={{ display: "flex", gap: 13, margin: "12px 0 25px" }}>
            {product.colors.map((item, index) => (
              <button
                key={item.name}
                aria-label={item.name}
                title={item.name}
                onClick={() => changeColor(index)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  background: item.hex,
                  border: colorIndex === index
                    ? "3px solid #F890C8"
                    : "1px solid #ccc",
                  outline: colorIndex === index ? "1px solid #111" : "none",
                  cursor: "pointer"
                }}
              />
            ))}
          </div>

          <p style={{ fontSize: 13, fontWeight: "bold" }}>
            SELECT SIZE
          </p>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
            gap: 7,
            margin: "12px 0"
          }}>
            {sizes.map((size) => {
              const inStock =
                color.stock[size as keyof typeof color.stock] > 0;

              return (
                <button
                  key={size}
                  disabled={!inStock}
                  onClick={() => {
                    setSelectedSize(size);
                    setMessage("");
                  }}
                  style={{
                    padding: "13px 3px",
                    background: selectedSize === size ? "#111" : "#fff",
                    color: selectedSize === size ? "#fff" : "#111",
                    border: "1px solid #ddd",
                    opacity: inStock ? 1 : 0.35,
                    textDecoration: inStock ? "none" : "line-through",
                    cursor: inStock ? "pointer" : "not-allowed",
                    fontSize: 12
                  }}
                >
                  {size}
                  {!inStock && (
                    <span style={{ display: "block", fontSize: 8 }}>
                      SOLD OUT
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <p style={{ fontSize: 12, color: available ? "#27834b" : "#c00" }}>
            {available ? "IN STOCK" : "SOLD OUT"}
          </p>

          <button
            onClick={addToCart}
            disabled={!available}
            style={{
              width: "100%",
              padding: 17,
              marginTop: 10,
              background: available ? "#111" : "#999",
              color: "#fff",
              border: 0,
              fontWeight: "bold",
              letterSpacing: 1,
              cursor: available ? "pointer" : "not-allowed"
            }}
          >
            ADD TO BAG
          </button>

          {message && (
            <p style={{ color: "#27834b", fontSize: 13 }}>{message}</p>
          )}

          <div style={{
            marginTop: 25,
            padding: 16,
            background: "#f8f8f8",
            fontSize: 13,
            lineHeight: 1.8
          }}>
            <p><strong>PRODUCT DETAILS</strong></p>
            <p>Material: {product.material}</p>
            <p>Fit: Oversized</p>
            <p>Brand: MAVEX®</p>
          </div>
        </section>
      </div>

      <style jsx>{`
        @media (max-width: 700px) {
          main > div {
            display: flex !important;
            flex-direction: column !important;
            gap: 22px !important;
          }
          h1 {
            font-size: 23px !important;
          }
        }
      `}</style>
    </main>
  );
}

