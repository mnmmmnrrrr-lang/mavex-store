"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
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
  description: string | null;
  price: number;
  compare_at_price: number | null;
  size_guide?: { size: string; label?: string; width: number; length: number }[];
  size_guide_title?: string;
  size_guide_size_label?: string;
  size_guide_width_label?: string;
  size_guide_length_label?: string;
  product_video_url?: string | null;
  product_images: {
    image_url: string;
    alt_text: string | null;
    sort_order: number | null;
  }[];
  product_variants: Variant[];
};

type CartItem = {
  productId: string;
  name: string;
  price: number;
  size: string;
  color: string;
  quantity: number;
  image: string;
};
type ProductComment = { id: string; name: string; rating: number; message: string; date: string; reply?: string };

const colorCodes: Record<string, string> = {
  Black: "#111111",
  White: "#f5f5f5",
  Navy: "#1a2542",
  Pink: "#F890C8",
  Grey: "#999999",
  Gray: "#999999",
  Red: "#d32f2f",
  Blue: "#2455a4",
  Beige: "#d8c3a5",
  Green: "#39734b",
  Brown: "#795548",
  Burgundy: "#6b1632",
};

const sizeGuide = [
  { size: "XS", label: "XS", width: "54", length: "70" },
  { size: "S", label: "S", width: "104", length: "68" },
  { size: "M", label: "M", width: "108", length: "70" },
  { size: "L", label: "L", width: "112", length: "72" },
  { size: "XL", label: "XL", width: "116", length: "74" },
  { size: "XXL", label: "XXL", width: "120", length: "76" },
];

function ProductContent() {
  const params = useParams();
  const router = useRouter();
  const productId = String(params.id);

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);
  const [message, setMessage] = useState("");
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const [tab, setTab] = useState<"description" | "details" | "shipping">(
    "description"
  );
  const [comments, setComments] = useState<ProductComment[]>([]);
  const [commentName, setCommentName] = useState("");
  const [commentText, setCommentText] = useState("");
  const [commentRating, setCommentRating] = useState(5);
  const [commentNotice, setCommentNotice] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadProduct() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch('/api/catalog/' + encodeURIComponent(productId), { cache: 'no-store' });
        let item: Product | null = response.ok ? await response.json() as Product : null;

        if (!item) {
          const stateResponse = await fetch('/api/catalog/state', { cache: 'no-store' });
          const state = stateResponse.ok ? await stateResponse.json() as { deletedIds: string[]; overrides: Record<string, Product> } : { deletedIds: [], overrides: {} };
          if (state.deletedIds.includes(productId)) {
            setError('Product not found.');
            setLoading(false);
            return;
          }

          const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          let query = supabase.from('products').select('id, name, slug, description, price, compare_at_price, product_images(image_url, alt_text, sort_order), product_variants(id, color, size, stock_quantity, price_override, is_active)').eq('status', 'active');
          query = uuidPattern.test(productId) ? query.eq('id', productId) : query.eq('slug', productId);
          const { data, error: queryError } = await query.maybeSingle();
          if (queryError) {
            setError('Could not load this product. Please try again.');
            setLoading(false);
            return;
          }
          if (data) {
            const databaseProduct = data as unknown as Product;
            item = state.overrides?.[databaseProduct.id] ? { ...databaseProduct, ...state.overrides[databaseProduct.id] } : databaseProduct;
          }
        }

        if (!item) {
          setError('Product not found.');
          setLoading(false);
          return;
        }

        if (cancelled) return;
        item.product_images = [...(item.product_images || [])].sort(
          (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
        );
        item.product_variants = (item.product_variants || []).filter(
          (variant) => variant.is_active !== false
        );
        setProduct(item);
        const firstColor =
          [...new Set(
            item.product_variants
              .filter((variant) => variant.stock_quantity > 0)
              .map((variant) => variant.color)
          )][0] || item.product_variants[0]?.color || '';
        setColor(firstColor);
        setSize('');
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.error("Unexpected error while loading product:", err);
        setError("Could not load this product. Please try again.");
        setLoading(false);
      }
    }

    loadProduct();

    return () => {
      cancelled = true;
    };
  }, [productId]);

  useEffect(() => {
    if (!product) return;
    fetch("/api/products/" + encodeURIComponent(product.id) + "/comments", { cache: "no-store" })
      .then(response => response.ok ? response.json() as Promise<ProductComment[]> : [])
      .then(setComments).catch(() => setComments([]));
  }, [product]);

  async function submitComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setCommentBusy(true); setCommentNotice("");
    try {
      const response = await fetch("/api/products/" + encodeURIComponent(productId) + "/comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: commentName, message: commentText, rating: commentRating }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      setCommentNotice("Thank you! Your comment was sent to the team for review."); setCommentName(""); setCommentText("");
    } catch (error) { setCommentNotice(error instanceof Error ? error.message : "Could not submit your comment."); }
    finally { setCommentBusy(false); }
  }

  const mediaCount = (product?.product_images.length ?? 0) + (product?.product_video_url ? 1 : 0);

  // Keyboard arrows to flip between images
  useEffect(() => {
    if (mediaCount < 2) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") {
        setImageIndex((c) => (c + 1) % mediaCount);
      } else if (e.key === "ArrowLeft") {
        setImageIndex((c) => (c - 1 + mediaCount) % mediaCount);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mediaCount]);

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
        <Link href="/">BACK TO MAVEX</Link>
      </main>
    );
  }

  const variants = product.product_variants;
  const measurements = product.size_guide?.length ? product.size_guide : sizeGuide;
  const pantsGuide = /pant|jogger|trouser/i.test(product.name);
  const sizeGuideTitle = product.size_guide_title || (pantsGuide ? "PANTS" : "HOODIE");
  const sizeGuideSizeLabel = product.size_guide_size_label || "SIZE";
  const sizeGuideWidthLabel = product.size_guide_width_label || (pantsGuide ? "WAIST" : "WIDTH");
  const sizeGuideLengthLabel = product.size_guide_length_label || "LENGTH";
  const colors = [...new Set(variants.map((v) => v.color))];

  const sizes = [
    ...new Set(variants.filter((v) => v.color === color).map((v) => v.size)),
  ];

  const selectedVariant = variants.find(
    (v) => v.color === color && v.size === size
  );

  const stock = selectedVariant?.stock_quantity ?? 0;
  const available = stock > 0;
  const hasAvailableSizes = variants.some(
    (v) => v.color === color && v.stock_quantity > 0
  );
  const maxQty = Math.max(1, Math.min(stock, 10));

  const images = product.product_images.map((img) => img.image_url);
  const galleryMedia: ({ type: "image"; src: string } | { type: "video"; src: string })[] = [
    ...images.map((src) => ({ type: "image" as const, src })),
    ...(product.product_video_url ? [{ type: "video" as const, src: product.product_video_url }] : []),
  ];
  const activeMedia = galleryMedia[imageIndex];

  const currentPrice = Number(selectedVariant?.price_override ?? product.price);

  function goPrev() {
    setImageIndex((c) => (c - 1 + galleryMedia.length) % galleryMedia.length);
  }

  function goNext() {
    setImageIndex((c) => (c + 1) % galleryMedia.length);
  }

  function changeColor(newColor: string) {
    setColor(newColor);
    setSize("");
    setQuantity(1);
    setMessage("");
  }

  function changeSize(newSize: string) {
    setSize(newSize);
    setQuantity(1);
    setMessage("");
  }

  function getSelectedCartItem(): CartItem | null {
    if (!product) return null;
    if (!size) {
      setMessage("PLEASE SELECT A SIZE.");
      return null;
    }
    if (!available || !selectedVariant) {
      setMessage("THIS SIZE IS SOLD OUT.");
      return null;
    }
    return {
      productId: product.id,
      name: product.name,
      price: currentPrice,
      size,
      color,
      quantity,
      image: images[0] || "",
    };
  }

  function addToCart() {
    const selectedItem = getSelectedCartItem();
    if (!selectedItem) return false;

    let cart: CartItem[] = [];

    try {
      const saved = JSON.parse(localStorage.getItem("mavex-cart") || "[]");
      cart = Array.isArray(saved) ? saved : [];
    } catch {
      cart = [];
    }

    const existing = cart.find(
      (item) =>
        item.productId === selectedItem.productId &&
        item.size === selectedItem.size &&
        item.color === selectedItem.color
    );

    if (existing) {
      existing.quantity = Math.min(existing.quantity + selectedItem.quantity, stock);
    } else {
      cart.push(selectedItem);
    }

    localStorage.setItem("mavex-cart", JSON.stringify(cart));
    setMessage("ADDED TO YOUR BAG ✓");
    return true;
  }

  function buyNow() {
    const selectedItem = getSelectedCartItem();
    if (!selectedItem) return;
    localStorage.setItem("mavex-buy-now", JSON.stringify([selectedItem]));
    router.push("/checkout?buyNow=1");
  }

  const arrowStyle: React.CSSProperties = {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    width: 40,
    height: 40,
    borderRadius: "50%",
    border: 0,
    background: "rgba(255,255,255,0.85)",
    color: "#111",
    fontSize: 22,
    cursor: "pointer",
    display: "grid",
    placeItems: "center",
    lineHeight: 1,
  };

  const tabButton = (
    key: "description" | "details" | "shipping",
    label: string
  ): React.CSSProperties => ({
    flex: 1,
    padding: "12px 4px",
    background: "none",
    border: 0,
    borderBottom: tab === key ? "2px solid #111" : "1px solid #ddd",
    fontWeight: tab === key ? "bold" : "normal",
    fontSize: 12,
    letterSpacing: 1,
    cursor: "pointer",
    color: "#111",
  });

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
      <Link
        href="/"
        style={{
          color: "#111",
          textDecoration: "none",
          fontSize: 13,
          letterSpacing: 1,
        }}
      >
        ← MAVEX / SHOP
      </Link>

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
            onTouchStart={(e) => setTouchStartX(e.touches[0].clientX)}
            onTouchEnd={(e) => {
              if (touchStartX === null) return;

              const difference = e.changedTouches[0].clientX - touchStartX;
              setTouchStartX(null);

              if (Math.abs(difference) > 45 && galleryMedia.length > 1) {
                if (difference < 0) goNext();
                else goPrev();
              }
            }}
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: "4 / 5",
              background: "#f5f5f5",
              overflow: "hidden",
            }}
          >
            {activeMedia ? (
              activeMedia.type === "video" ? (
                <video
                  key={activeMedia.src}
                  src={activeMedia.src}
                  controls
                  playsInline
                  preload="metadata"
                  aria-label={`${product.name} product video`}
                  style={{ width: "100%", height: "100%", objectFit: "contain", background: "#111" }}
                />
              ) : (
                <img
                  src={activeMedia.src}
                  alt={product.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              )
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

            {galleryMedia.length > 1 && (
              <>
                <button
                  aria-label="Previous product media"
                  onClick={goPrev}
                  style={{ ...arrowStyle, left: 10 }}
                >
                  ‹
                </button>
                <button
                  aria-label="Next product media"
                  onClick={goNext}
                  style={{ ...arrowStyle, right: 10 }}
                >
                  ›
                </button>
                <span
                  style={{
                    position: "absolute",
                    bottom: 10,
                    right: 10,
                    background: "rgba(0,0,0,0.65)",
                    color: "#fff",
                    fontSize: 12,
                    padding: "4px 9px",
                    letterSpacing: 1,
                  }}
                >
                  {imageIndex + 1} / {galleryMedia.length}
                </span>
              </>
            )}
          </div>

          {galleryMedia.length > 1 && (
            <div
              style={{
                display: "flex",
                gap: 9,
                overflowX: "auto",
                marginTop: 12,
              }}
            >
              {galleryMedia.map((media, index) => (
                <button
                  key={media.src}
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
                  {media.type === "video" ? (
                    <span style={{ display: "grid", placeItems: "center", width: "100%", height: "100%", background: "#111", color: "#fff", fontSize: 11, fontWeight: 700 }}>▶ VIDEO</span>
                  ) : (
                    <img
                      src={media.src}
                      alt={`Product view ${index + 1}`}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  )}
                </button>
              ))}
            </div>
          )}
        </section>

        <section>
          <p style={{ color: "#999", fontSize: 12, letterSpacing: 2 }}>
            MAVEX® / STREETWEAR
          </p>

          <h1 style={{ fontSize: 27, lineHeight: 1.2 }}>{product.name}</h1>

          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <p style={{ fontSize: 22, fontWeight: "bold", margin: 0 }}>
              EGP {currentPrice.toLocaleString("en-EG")}
            </p>

            {product.compare_at_price &&
              product.compare_at_price > currentPrice && (
                <p
                  style={{
                    color: "#999",
                    textDecoration: "line-through",
                    fontSize: 15,
                    margin: 0,
                  }}
                >
                  EGP {Number(product.compare_at_price).toLocaleString("en-EG")}
                </p>
              )}
          </div>

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
                    color === item ? "3px solid #F890C8" : "1px solid #ccc",
                  outline: color === item ? "1px solid #111" : "none",
                  cursor: "pointer",
                }}
              />
            ))}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <p style={{ fontSize: 13, fontWeight: "bold", margin: 0 }}>
              SELECT SIZE
            </p>
            <button
              onClick={() => setShowSizeGuide((s) => !s)}
              style={{
                background: "none",
                border: 0,
                fontSize: 12,
                textDecoration: "underline",
                cursor: "pointer",
                color: "#111",
              }}
            >
              {showSizeGuide ? "HIDE SIZE GUIDE" : "SIZE GUIDE"}
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${Math.max(sizes.length, 1)}, minmax(0, 1fr))`,
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
                  onClick={() => changeSize(item)}
                  style={{
                    padding: "10px 3px",
                    minHeight: 64,
                    background: size === item ? "#111" : "#f890c8",
                    color: size === item ? "#f890c8" : "#111",
                    border: "2px solid #111",
                    opacity: inStock ? 1 : 0.35,
                    textDecoration: inStock ? "none" : "line-through",
                    cursor: inStock ? "pointer" : "not-allowed",
                    fontSize: 12,
                  }}
                >
                  <span style={{ display: "block", fontWeight: "bold" }}>{item}</span>
                  {measurements.find((row) => row.size === item) && (
                    <span style={{ display: "block", marginTop: 4, fontSize: 8, lineHeight: 1.35 }}>
                      {measurements.find((row) => row.size === item)?.width} × {measurements.find((row) => row.size === item)?.length} cm
                    </span>
                  )}
                  {!inStock && (
                    <span style={{ display: "block", fontSize: 8 }}>
                      SOLD OUT
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {showSizeGuide && (
            <div className="mavex-size-chart-wrap">
              <h3 className="mavex-size-chart-heading">SIZE CHART</h3>
              <p className="mavex-size-chart-subheading">“{sizeGuideTitle}”</p>
              <table className="mavex-size-chart">
                <thead>
                  <tr>
                    <th>{sizeGuideSizeLabel}</th>
                    <th>{sizeGuideLengthLabel} (cm)</th>
                    <th>{sizeGuideWidthLabel} (cm)</th>
                  </tr>
                </thead>
                <tbody>
                  {measurements.map((row) => (
                    <tr key={row.size}>
                      <td>{row.label || row.size}</td>
                      <td>{row.length}</td>
                      <td>{row.width}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p
            style={{
              fontSize: 12,
              color: available ? "#27834b" : "#c00",
            }}
          >
            {!hasAvailableSizes
              ? "SOLD OUT"
              : !size
                ? "PLEASE SELECT A SIZE"
                : available
              ? stock <= 5
                ? `ONLY ${stock} LEFT`
                : "IN STOCK"
              : "SOLD OUT"}
          </p>

          <p style={{ fontSize: 13, fontWeight: "bold", marginBottom: 8 }}>
            QUANTITY
          </p>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              border: "1px solid #ddd",
              flexShrink: 0,
            }}
          >
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={!available}
              style={{
                width: 40,
                height: 40,
                background: "#fff",
                border: 0,
                fontSize: 18,
                cursor: available ? "pointer" : "not-allowed",
              }}
            >
              −
            </button>
            <span style={{ width: 40, textAlign: "center", fontSize: 14 }}>
              {quantity}
            </span>
            <button
              onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
              disabled={!available}
              style={{
                width: 40,
                height: 40,
                background: "#fff",
                border: 0,
                fontSize: 18,
                cursor: available ? "pointer" : "not-allowed",
              }}
            >
              +
            </button>
            </div>
            <button
            type="button"
            onClick={buyNow}
            disabled={!hasAvailableSizes}
            style={{
              flex: 1,
              minHeight: 42,
              padding: "10px 14px",
              background: "#f890c8",
              color: "#111",
              border: "2px solid #111",
              fontWeight: 900,
              letterSpacing: 1,
              cursor: hasAvailableSizes ? "pointer" : "not-allowed",
              opacity: hasAvailableSizes ? 1 : 0.6,
            }}
          >
            BUY NOW
            </button>
          </div>

          <button
            onClick={addToCart}
            disabled={!hasAvailableSizes}
            style={{
              width: "100%",
              padding: 17,
              marginTop: 16,
              background: available ? "#111" : "#999",
              color: "#fff",
              border: 0,
              fontWeight: "bold",
              letterSpacing: 1,
              cursor: available ? "pointer" : "not-allowed",
            }}
          >
            {!hasAvailableSizes ? "SOLD OUT" : !size ? "SELECT A SIZE" : "ADD TO BAG"}
          </button>

          {message && (
            message.includes("ADDED TO YOUR BAG") ? (
              <div role="status" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginTop: 12, padding: 12, border: "1px solid #9bc9a9", borderRadius: 6, background: "#f1fbf4" }}>
                <span style={{ color: "#20743b", fontSize: 13, fontWeight: 700 }}>{message}</span>
                <Link href="/checkout" style={{ display: "inline-block", padding: "10px 13px", background: "#111", color: "#fff", textDecoration: "none", fontSize: 11, fontWeight: 800, letterSpacing: 0.5 }}>GO TO CHECKOUT →</Link>
              </div>
            ) : (
              <p role="status" style={{ color: "#c00", fontSize: 13, marginTop: 12 }}>{message}</p>
            )
          )}

          <div style={{ marginTop: 28 }}>
            <div style={{ display: "flex" }}>
              <button
                onClick={() => setTab("description")}
                style={tabButton("description", "DESCRIPTION")}
              >
                DESCRIPTION
              </button>
              <button
                onClick={() => setTab("details")}
                style={tabButton("details", "DETAILS")}
              >
                DETAILS
              </button>
              <button
                onClick={() => setTab("shipping")}
                style={tabButton("shipping", "SHIPPING")}
              >
                SHIPPING
              </button>
            </div>

            <div
              style={{
                padding: 16,
                background: "#f8f8f8",
                fontSize: 13,
                lineHeight: 1.8,
                color: "#444",
              }}
            >
              {tab === "description" && (
                <p style={{ margin: 0 }}>
                  {product.description || "No description available."}
                </p>
              )}

              {tab === "details" && (
                <>
                  <p style={{ margin: 0 }}>Fit: Oversized</p>
                  <p style={{ margin: 0 }}>Brand: MAVEX®</p>
                  <p style={{ margin: 0 }}>Care: Machine wash cold</p>
                </>
              )}

              {tab === "shipping" && (
                <>
                  <p style={{ margin: 0 }}>Delivery across Egypt.</p>
                  <p style={{ margin: 0 }}>
                    Exchange or return within 14 days, unworn with tags.
                  </p>
                </>
              )}
            </div>
          </div>
        </section>
      </div>

      <section dir="rtl" style={{ maxWidth: 1150, margin: "30px auto", padding: "25px 0", borderTop: "1px solid #eee" }}>
        <h2 style={{ fontSize: 22, marginBottom: 18 }}>Customer Reviews ({comments.length})</h2>
        {comments.length === 0 ? <p style={{ color: "#777", marginBottom: 20 }}>No reviews yet. Share your thoughts about this product.</p> : <div style={{ display: "grid", gap: 10, marginBottom: 24 }}>{comments.map(comment => <article key={comment.id} style={{ background: "#f8f8f8", padding: 15, borderRadius: 8 }}><strong>{comment.name}</strong><span style={{ color: "#c78521", marginInlineStart: 10 }}>{"★".repeat(comment.rating)}{"☆".repeat(5-comment.rating)}</span><p style={{ marginTop: 8, lineHeight: 1.7 }}>{comment.message}</p>{comment.reply && <p style={{ marginTop: 8, color: "#555", fontSize: 12 }}>MAVEX reply: {comment.reply}</p>}</article>)}</div>}
        <form onSubmit={submitComment} style={{ display: "grid", gap: 10, maxWidth: 620 }}>
          <label>Your name<input required maxLength={60} value={commentName} onChange={e => setCommentName(e.target.value)} style={{ display: "block", width: "100%", marginTop: 6, padding: 12, border: "1px solid #ddd", borderRadius: 6 }} /></label>
          <label>Your rating<select value={commentRating} onChange={e => setCommentRating(Number(e.target.value))} style={{ display: "block", marginTop: 6, padding: 11, border: "1px solid #ddd", borderRadius: 6 }}>{[5,4,3,2,1].map(n => <option key={n} value={n}>{"★".repeat(n)} ({n}/5)</option>)}</select></label>
          <label>Your review<textarea required minLength={5} maxLength={800} rows={4} value={commentText} onChange={e => setCommentText(e.target.value)} style={{ display: "block", width: "100%", marginTop: 6, padding: 12, border: "1px solid #ddd", borderRadius: 6, resize: "vertical" }} /></label>
          <button disabled={commentBusy} className="add-button" style={{ justifySelf: "start", borderRadius: 6 }}>{commentBusy ? "SUBMITTING..." : "SUBMIT REVIEW"}</button>
          {commentNotice && <p role="status" style={{ color: commentNotice.includes("Thank you") ? "#16804a" : "#b42318" }}>{commentNotice}</p>}
        </form>
      </section>

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

export default function ProductPage() {
  return (
    <Suspense
      fallback={
        <main style={{ padding: 40, textAlign: "center" }}>
          LOADING MAVEX PRODUCT...
        </main>
      }
    >
      <ProductContent />
    </Suspense>
  );
}
