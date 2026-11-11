
"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Variant = {
  id: string;
  color: string;
  size: string;
  stock_quantity: number;
  price_override: number | null;
  is_active: boolean | null;
};

type Product = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  product_images: {
    image_url: string;
    alt_text: string | null;
    sort_order: number | null;
  }[];
  product_variants: Variant[];
};

const colorCodes: Record<string, string> = {
  Black: "#111111",
  White: "#f5f5f5",
  Pink: "#F890C8",
  Grey: "#999999",
  Gray: "#999999",
  Red: "#d32f2f",
  Blue: "#2455a4",
  Beige: "#d8c3a5",
  Green: "#39734b",
  Brown: "#795548",
};

export default function ProductPage() {
  const params = useParams();
  const productId = String(params.id);

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  const [imageIndex, setImageIndex] = useState(0);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadProduct() {
      setLoading(true);
      setError("");

      const uuidPattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      let query = supabase
        .from("products")
        .select(`
          id,
          name,
          slug,
          description,
          price,
          compare_at_price,
          product_images (
            image_url,
            alt_text,
            sort_order
          ),
          product_variants (
            id,
            color,
            size,
            stock_quantity,
            price_override,
            is_active
          )
        `)
        .eq("status", "active");

      if (uuidPattern.test(productId)) {
        query = query.eq("id", productId);
      } else {
        query = query.eq("slug", productId);
      }

      const { data, error } = await query.maybeSingle();

      if (error) {
        console.error(error);
        setError("Could not load this product. Please try again.");
        setLoading(false);
        return;
      }

      if (!data) {
        setError("Product not found.");
        setLoading(false);
        return;
      }

      const item = data as unknown as Product;

      item.product_images = [...(item.product_images || [])].sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
      );

      item.product_variants = (item.product_variants || []).filter(
        (v) => v.is_active !== false
      );

      setProduct(item);

      const firstColor = [
        ...new Set(item.product_variants.map((v) => v.color)),
      ][0] || "";

      setColor(firstColor);

      const firstSize =
        item.product_variants.find(
          (v) => v.color === firstColor && v.stock_quantity > 0
        )?.size || "";

      setSize(firstSize);
      setLoading(false);
    }

    loadProduct();
  }, [productId]);

  if (loading) {
    return (
      <main style={{ padding: 40, textAlign: "center" }}>
        LOADING MAVEX PRODUCT...
      </main>
    );
  }

  if (error || !product) {
    return (
      <main style={{ padding: 40, textAlign: "center" }}>
        <h2>{error || "Product not found."}</h2>
        <a href="/">BACK TO MAVEX</a>
      </main>
    );
  }

  const variants = product.product_variants;
  const colors = [...new Set(variants.map((v) => v.color))];

  const sizes = [
    ...new Set(
      variants.filter((v) => v.color === color).map((v) => v.size)
    ),
  ];

  const selectedVariant = variants.find(
    (v) => v.color === color && v.size === size
  );

  const available = (selectedVariant?.stock_quantity ?? 0) > 0;

  const images = product.product_images.map((img) => img.image_url);

  const currentPrice =
    selectedVariant?.price_override ?? product.price;

  function changeColor(newColor: string) {
    setColor(newColor);

    const firstAvailable = variants.find(
      (v) => v.color === newColor && v.stock_quantity > 0
    );

    setSize(firstAvailable?.size || "");
    setImageIndex(0);
    setMessage("");
  }

  function addToCart() {
    if (!product || !available || !selectedVariant) return;

    const cart = JSON.parse(
      localStorage.getItem("mavex-cart") || "[]"
    );

    const existing = cart.find(
      (item: any) =>
        item.productId === product.id &&
        item.size === size &&
        item.color === color
    );

    if (existing) {
      existing.quantity += 1;
    } else {
      cart.push({
        productId: product.id,
        name: product.name,
        price: currentPrice,
        size,
        color,
        quantity: 1,
        image: images[0] || "",
      });
    }

    localStorage.setItem("mavex-cart", JSON.stringify(cart));
    setMessage("ADDED TO YOUR BAG ✓");
  }

  return (
    <main
      style={{
        background: "#fff",
        color: "#111",
        minHeight: "100vh",
        padding: "18px 4%",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <a
        href="/"
        style={{
          color: "#111",
          textDecoration: "none",
          fontSize: 13,
          letterSpacing: 1,
        }}
      >
        ← MAVEX / SHOP
      </a>

      <div
        className="product-layout"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 0.8fr)",
          gap: 35,
          maxWidth: 1150,
          margin: "25px auto",
        }}
      >
        <section>
          <div
            onTouchStart={(e) => {
              (window as any).touchStartX = e.touches[0].clientX;
            }}
            onTouchEnd={(e) => {
              const start = (window as any).touchStartX;
              const difference = e.changedTouches[0].clientX - start;

              if (Math.abs(difference) > 45 && images.length > 1) {
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
              overflow: "hidden",
            }}
          >
            {images.length > 0 ? (
              <img
                src={images[imageIndex]}
                alt={product.name}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            ) : (
              <div
                style={{
                  height: "100%",
                  display: "grid",
                  placeItems: "center",
                  color: "#888",
                }}
              >
                MAVEX
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              gap: 9,
              overflowX: "auto",
              marginTop: 12,
            }}
          >
            {images.map((image, index) => (
              <button
                key={index}
                onClick={() => setImageIndex(index)}
                style={{
                  border:
                    imageIndex === index
                      ? "2px solid #F890C8"
                      : "1px solid #ddd",
                  padding: 0,
                  minWidth: 65,
                  width: 65,
                  height: 80,
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                <img
                  src={image}
                  alt={`Product view ${index + 1}`}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
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
            EGP {Number(currentPrice).toLocaleString("en-EG")}
          </p>

          {product.compare_at_price &&
            product.compare_at_price > currentPrice && (
              <p
                style={{
                  color: "#999",
                  textDecoration: "line-through",
                  fontSize: 15,
                }}
              >
                EGP {Number(product.compare_at_price).toLocaleString("en-EG")}
              </p>
            )}

          <p style={{ color: "#666", lineHeight: 1.7, fontSize: 14 }}>
            {product.description}
          </p>

          <hr
            style={{
              border: 0,
              borderTop: "1px solid #eee",
              margin: "24px 0",
            }}
          />

          <p style={{ fontSize: 13, fontWeight: "bold" }}>
            COLOR: {color.toUpperCase() || "UNAVAILABLE"}
          </p>

          <div
            style={{
              display: "flex",
              gap: 13,
              margin: "12px 0 25px",
              flexWrap: "wrap",
            }}
          >
            {colors.map((item) => (
              <button
                key={item}
                aria-label={item}
                title={item}
                onClick={() => changeColor(item)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  background: colorCodes[item] || "#ccc",
                  border:
                    color === item
                      ? "3px solid #F890C8"
                      : "1px solid #ccc",
                  outline: color === item ? "1px solid #111" : "none",
                  cursor: "pointer",
                }}
              />
            ))}
          </div>

          <p style={{ fontSize: 13, fontWeight: "bold" }}>
            SELECT SIZE
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
              gap: 7,
              margin: "12px 0",
            }}
          >
            {sizes.map((item) => {
              const variant = variants.find(
                (v) => v.color === color && v.size === item
              );

              const inStock = (variant?.stock_quantity ?? 0) > 0;

              return (
                <button
                  key={item}
                  disabled={!inStock}
                  onClick={() => {
                    setSize(item);
                    setMessage("");
                  }}
                  style={{
                    padding: "13px 3px",
                    background: size === item ? "#111" : "#fff",
                    color: size === item ? "#fff" : "#111",
                    border: "1px solid #ddd",
                    opacity: inStock ? 1 : 0.35,
                    textDecoration: inStock ? "none" : "line-through",
                    cursor: inStock ? "pointer" : "not-allowed",
                    fontSize: 12,
                  }}
                >
                  {item}
                  {!inStock && (
                    <span style={{ display: "block", fontSize: 8 }}>
                      SOLD OUT
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <p
            style={{
              fontSize: 12,
              color: available ? "#27834b" : "#c00",
            }}
          >
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
              cursor: available ? "pointer" : "not-allowed",
            }}
          >
            ADD TO BAG
          </button>

          {message && (
            <p style={{ color: "#27834b", fontSize: 13 }}>
              {message}
            </p>
          )}

          <div
            style={{
              marginTop: 25,
              padding: 16,
              background: "#f8f8f8",
              fontSize: 13,
              lineHeight: 1.8,
            }}
          >
            <p><strong>PRODUCT DETAILS</strong></p>
            <p>Fit: Oversized</p>
            <p>Brand: MAVEX®</p>
          </div>
        </section>
      </div>

      <style jsx>{`
        @media (max-width: 700px) {
          .product-layout {
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
