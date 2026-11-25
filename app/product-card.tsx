"use client";

import { useRef, useState, type PointerEvent } from "react";
import Image from "next/image";
import Link from "next/link";

type ProductCardItem = {
  id: string;
  name: string;
  price: number;
  compare_at_price: number | null;
  product_images?: { image_url: string; alt_text: string | null; sort_order: number | null }[];
};

export default function ProductCard({
  product,
  fallbackImage,
  sizes = "(max-width: 700px) 50vw, (max-width: 1100px) 33vw, 25vw",
}: {
  product: ProductCardItem;
  fallbackImage?: string;
  sizes?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const [mobileBack, setMobileBack] = useState(false);
  const [shouldLoadBack, setShouldLoadBack] = useState(false);
  const [backLoaded, setBackLoaded] = useState(false);
  const [backFailed, setBackFailed] = useState(false);
  const cardRef = useRef<HTMLElement>(null);

  const orderedImages = [...(product.product_images || [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );
  const frontImage = orderedImages[0]?.image_url || fallbackImage || "";
  const backImage = orderedImages[1]?.image_url || "";
  const hasBackImage = Boolean(backImage) && !backFailed;
  const showingBack = hasBackImage && backLoaded && (hovered || mobileBack);
  const href = `/product/${encodeURIComponent(product.id)}`;

  function handlePointerEnter(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === "touch") return;
    setHovered(true);
    if (hasBackImage) setShouldLoadBack(true);
  }

  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === "touch") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const horizontal = (event.clientX - bounds.left) / bounds.width - 0.5;
    const vertical = (event.clientY - bounds.top) / bounds.height - 0.5;
    const card = cardRef.current;
    if (card) {
      card.style.transform = `perspective(900px) rotateX(${-vertical * 12}deg) rotateY(${horizontal * 12}deg)`;
    }
  }

  function handlePointerLeave(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === "touch") return;
    setHovered(false);
    if (cardRef.current) {
      cardRef.current.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg)";
    }
  }

  return (
    <article
      ref={cardRef}
      className={`product-card mavex-product-card${hasBackImage ? " has-back-image" : ""}${hovered ? " is-hovered" : ""}${showingBack ? " is-back-visible" : ""}`}
      onPointerEnter={handlePointerEnter}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={{ transform: "perspective(900px) rotateX(0deg) rotateY(0deg)" }}
    >
      <div className="mavex-product-card-visual">
        <div className="mavex-product-card-media">
          <Link href={href} className="mavex-product-card-media-link" aria-label={product.name}>
            {frontImage ? (
              <Image
                className="mavex-product-card-image mavex-product-card-front"
                src={frontImage}
                alt={showingBack ? "" : orderedImages[0]?.alt_text || product.name}
                width={700}
                height={850}
                sizes={sizes}
                quality={90}
                loading="lazy"
                aria-hidden={showingBack}
              />
            ) : (
              <div className="mavex-product-card-placeholder" aria-hidden="true">MAVEX</div>
            )}
            {hasBackImage && shouldLoadBack && (
              <Image
                className="mavex-product-card-image mavex-product-card-back"
                src={backImage}
                alt={showingBack ? orderedImages[1]?.alt_text || `${product.name} back view` : ""}
                width={700}
                height={850}
                sizes={sizes}
                quality={90}
                loading="eager"
                onLoad={() => setBackLoaded(true)}
                onError={() => setBackFailed(true)}
                aria-hidden={!showingBack}
              />
            )}
          </Link>
          {hasBackImage && (
            <button
              type="button"
              className="mavex-product-card-view-toggle"
              aria-label={mobileBack ? "Show front view" : "Show back view"}
              aria-pressed={mobileBack}
              aria-busy={shouldLoadBack && !backLoaded}
              onClick={() => {
                setShouldLoadBack(true);
                setMobileBack((visible) => !visible);
              }}
            >
              {shouldLoadBack && !backLoaded ? "LOADING…" : mobileBack ? "FRONT" : "BACK"}
            </button>
          )}
        </div>
        <Link href={href} className="mavex-product-card-link">
          <h3>{product.name}</h3>
        </Link>
      </div>

      <p>
        EGP {Number(product.price).toLocaleString("en-EG")}
        {product.compare_at_price && product.compare_at_price > product.price && (
          <del style={{ marginInlineStart: 10, color: "#888", fontSize: 13 }}>
            EGP {Number(product.compare_at_price).toLocaleString("en-EG")}
          </del>
        )}
      </p>
      <Link className="add-button" href={href} style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
        CHOOSE COLOR &amp; SIZE
      </Link>
    </article>
  );
}
