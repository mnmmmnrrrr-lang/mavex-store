"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type VariantDraft = {
  id: string;
  color: string;
  size: string;
  stock_quantity: string;
  price_override: string;
  is_active: boolean;
};
type ColorProductLinkDraft = { color: string; product_id: string };

type AdminProduct = {
  id: string;
  slug: string;
  status?: string;
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
  color_product_links?: ColorProductLinkDraft[];
  product_images: { image_url: string; alt_text: string | null; sort_order: number | null }[];
  product_variants: { id: string; color: string; size: string; stock_quantity: number; price_override: number | null; is_active: boolean | null }[];
};
type OperationsData = {
  orders: { id: string; customer: { name: string; phone: string; email?: string; phone2?: string; city: string; village: string; street: string; building?: string; notes?: string }; governorate: string; items: { name: string; size: string; color?: string; quantity: number; price: number; image?: string }[]; subtotal: number; shipping: number; total: number; payment: string; transaction?: string; proof?: string; status: string; date: string; trackingNumber?: string }[];
  returns: { id: string; orderId: string; customerName: string; email?: string; phone?: string; issue: string; date: string; status: string }[];
  comments: { id: string; productId: string; productName: string; name: string; rating: number; message: string; date: string; status: string; reply?: string }[];
};
type ProductMediaKind = "image" | "video";
type UploadedProductMedia = { kind: ProductMediaKind; path: string };

async function optimizeProductImage(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.86));
    if (!blob) return file;
    const baseName = file.name.replace(/\.[^.]+$/, "") || "product-image";
    return new File([blob], `${baseName}.webp`, { type: "image/webp", lastModified: file.lastModified });
  } catch {
    return file;
  }
}

const sizes = ["XS", "S", "M", "L", "XL", "XXL"];
const standardMeasurements: Record<string, { label: string; width: string; length: string }> = {
  XS: { label: "XS", width: "54", length: "70" },
  S: { label: "S", width: "104", length: "68" },
  M: { label: "M", width: "108", length: "70" },
  L: { label: "L", width: "112", length: "72" },
  XL: { label: "XL", width: "116", length: "74" },
  XXL: { label: "XXL", width: "120", length: "76" },
};
const inputStyle = {
  width: "100%",
  padding: "11px 12px",
  border: "1px solid #d9d9d9",
  borderRadius: 5,
  background: "#fff",
  color: "#111",
  fontSize: 13,
};

function defaultVariants(): VariantDraft[] {
  return sizes.map((size) => ({
    id: "",
    color: "Black",
    size,
    stock_quantity: "10",
    price_override: "",
    is_active: true,
  }));
}

async function fetchAdminCatalog(): Promise<AdminProduct[] | null> {
  const response = await fetch("/api/admin/products", { cache: "no-store" });
  if (!response.ok) return null;
  const result = await response.json() as { products: AdminProduct[] };
  return result.products || [];
}

async function uploadProductMedia(file: File, kind: ProductMediaKind): Promise<UploadedProductMedia> {
  const uploadFile = kind === "image" ? await optimizeProductImage(file) : file;
  const signingResponse = await fetch("/api/admin/product-media-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, contentType: uploadFile.type }),
  });
  const signingResult = await signingResponse.json() as { path?: string; token?: string; error?: string };
  if (!signingResponse.ok || !signingResult.path || !signingResult.token) {
    throw new Error(signingResult.error || "Could not prepare the media upload.");
  }

  const bucket = kind === "image" ? "mavex-product-images" : "mavex-product-videos";
  const { error } = await supabase.storage.from(bucket).uploadToSignedUrl(
    signingResult.path,
    signingResult.token,
    uploadFile,
    { contentType: uploadFile.type, upsert: false },
  );
  if (error) throw new Error(`Could not upload the product ${kind}: ${error.message}`);
  return { kind, path: signingResult.path };
}
export default function AdminPage() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [password, setPassword] = useState("");
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("600");
  const [compareAtPrice, setCompareAtPrice] = useState("1000");
  const [variants, setVariants] = useState<VariantDraft[]>(defaultVariants);
  const [colorProductLinks, setColorProductLinks] = useState<ColorProductLinkDraft[]>([]);
  const [sizeMeasurements, setSizeMeasurements] = useState(standardMeasurements);
  const [sizeGuideTitle, setSizeGuideTitle] = useState("HOODIE");
  const [sizeGuideSizeLabel, setSizeGuideSizeLabel] = useState("SIZE");
  const [sizeGuideWidthLabel, setSizeGuideWidthLabel] = useState("WIDTH");
  const [sizeGuideLengthLabel, setSizeGuideLengthLabel] = useState("LENGTH");
  const [images, setImages] = useState<File[]>([]);
  const [video, setVideo] = useState<File | null>(null);
  const [removeVideo, setRemoveVideo] = useState(false);
  const [activeTab, setActiveTab] = useState<"products" | "orders" | "returns" | "comments">("products");
  const [operations, setOperations] = useState<OperationsData>({ orders: [], returns: [], comments: [] });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadProducts() {
    const savedProducts = await fetchAdminCatalog();
    if (!savedProducts) return false;
    setProducts(savedProducts);
    setLoggedIn(true);
    await loadOperations();
    return true;
  }

  async function loadOperations() {
    const response = await fetch("/api/admin/operations", { cache: "no-store" });
    if (response.ok) setOperations(await response.json() as OperationsData);
  }

  useEffect(() => {
    let cancelled = false;
    fetchAdminCatalog()
      .then((savedProducts) => {
        if (cancelled || !savedProducts) return;
        setProducts(savedProducts);
        setLoggedIn(true);
        void loadOperations();
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setCheckingSession(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not sign in.");
      setLoggedIn(true);
      setPassword("");
      await loadProducts();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  function resetForm() {
    setEditingId(null);
    setEditingProduct(null);
    setName("");
    setDescription("");
    setPrice("600");
    setCompareAtPrice("1000");
    setVariants(defaultVariants());
    setColorProductLinks([]);
    setSizeMeasurements(standardMeasurements);
    setSizeGuideTitle("HOODIE");
    setSizeGuideSizeLabel("SIZE");
    setSizeGuideWidthLabel("WIDTH");
    setSizeGuideLengthLabel("LENGTH");
    setImages([]);
    setVideo(null);
    setRemoveVideo(false);
    const fileInput = document.querySelector<HTMLInputElement>("#product-images");
    if (fileInput) fileInput.value = "";
    const videoInput = document.querySelector<HTMLInputElement>("#product-video");
    if (videoInput) videoInput.value = "";
  }

  function editProduct(product: AdminProduct) {
    setEditingId(product.id);
    setEditingProduct(product);
    setName(product.name);
    setDescription(product.description || "");
    const pantsGuide = /pant|jogger|trouser/i.test(product.name);
    setSizeGuideTitle(product.size_guide_title || (pantsGuide ? "PANTS" : "HOODIE"));
    setSizeGuideSizeLabel(product.size_guide_size_label || "SIZE");
    setSizeGuideWidthLabel(product.size_guide_width_label || (pantsGuide ? "WAIST" : "WIDTH"));
    setSizeGuideLengthLabel(product.size_guide_length_label || "LENGTH");
    setPrice(String(product.price));
    setCompareAtPrice(product.compare_at_price === null ? "" : String(product.compare_at_price));
    setColorProductLinks((product.color_product_links || []).map((link) => ({
      color: String(link.color || ""),
      product_id: String(link.product_id || ""),
    })));
    setVariants(product.product_variants.map((variant) => ({
      id: variant.id,
      color: variant.color,
      size: variant.size,
      stock_quantity: String(variant.stock_quantity),
      price_override: variant.price_override === null ? "" : String(variant.price_override),
      is_active: variant.is_active !== false,
    })));
    const guide = { ...standardMeasurements };
    for (const item of product.size_guide || []) {
      guide[item.size] = { label: item.label || item.size, width: String(item.width), length: String(item.length) };
    }
    setSizeMeasurements(guide);
    setImages([]);
    setVideo(null);
    setRemoveVideo(false);
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateVariant(index: number, field: keyof VariantDraft, value: string | boolean) {
    setVariants((current) => current.map((variant, itemIndex) =>
      itemIndex === index ? { ...variant, [field]: value } : variant
    ));
  }

  function updateColorProductLink(index: number, field: keyof ColorProductLinkDraft, value: string) {
    setColorProductLinks((current) => current.map((link, itemIndex) =>
      itemIndex === index ? { ...link, [field]: value } : link
    ));
  }

  function addVariant() {
    const used = new Set(variants.map((variant) => variant.size));
    const size = sizes.find((item) => !used.has(item)) || "S";
    setVariants((current) => [...current, {
      id: "",
      color: current[0]?.color || "Black",
      size,
      stock_quantity: "10",
      price_override: "",
      is_active: true,
    }]);
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId && images.length === 0) {
      setMessage("Choose at least one product photo.");
      return;
    }
    if (images.length > 8 || (editingProduct && editingProduct.product_images.length + images.length > 8)) {
      setMessage("A product can have up to 8 photos.");
      return;
    }
    if (images.some((image) => image.size > 5 * 1024 * 1024)) {
      setMessage("Each product photo must be 5 MB or smaller.");
      return;
    }
    if (images.some((image) => !["image/jpeg", "image/png", "image/webp"].includes(image.type))) {
      setMessage("Choose JPG, PNG, or WebP product photos.");
      return;
    }
    if (video && video.size > 30 * 1024 * 1024) {
      setMessage("The product video must be 30 MB or smaller.");
      return;
    }
    if (video && !["video/mp4", "video/webm", "video/quicktime"].includes(video.type)) {
      setMessage("Choose an MP4, WebM, or MOV video.");
      return;
    }
    setBusy(true);
    setMessage("");
    const form = new FormData();
    form.set("name", name);
    form.set("description", description);
    form.set("price", price);
    form.set("compareAtPrice", compareAtPrice);
    form.set("variants", JSON.stringify(variants));
    form.set("colorProductLinks", JSON.stringify(colorProductLinks));
    form.set("sizeGuideTitle", sizeGuideTitle);
    form.set("sizeGuideSizeLabel", sizeGuideSizeLabel);
    form.set("sizeGuideWidthLabel", sizeGuideWidthLabel);
    form.set("sizeGuideLengthLabel", sizeGuideLengthLabel);
    if (editingProduct) form.set("baseProduct", JSON.stringify(editingProduct));
    const productSizes = [...new Set(variants.map((variant) => variant.size))];
    form.set("sizeGuide", JSON.stringify(productSizes.map((size) => ({
      size,
      label: sizeMeasurements[size]?.label || size,
      width: sizeMeasurements[size]?.width,
      length: sizeMeasurements[size]?.length,
    }))));
    form.set("removeVideo", removeVideo ? "true" : "false");

    const uploadedMedia: UploadedProductMedia[] = [];
    try {
      const imagePaths: string[] = [];
      for (const image of images) {
        const uploaded = await uploadProductMedia(image, "image");
        uploadedMedia.push(uploaded);
        imagePaths.push(uploaded.path);
      }
      form.set("productImagePaths", JSON.stringify(imagePaths));

      if (video) {
        const uploaded = await uploadProductMedia(video, "video");
        uploadedMedia.push(uploaded);
        form.set("productVideoPath", uploaded.path);
      }

      const url = editingId ? "/api/admin/products/" + encodeURIComponent(editingId) : "/api/admin/products";
      const response = await fetch(url, { method: editingId ? "PUT" : "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save the product.");
      uploadedMedia.length = 0;
      setProducts((current) => {
        const index = current.findIndex((product) => product.id === result.id);
        if (index < 0) return [result, ...current];
        return current.map((product) => product.id === result.id ? result : product);
      });
      setMessage(editingId ? "Product updated." : "Product added to the store.");
      resetForm();
    } catch (error) {
      for (const media of uploadedMedia) {
        await fetch("/api/admin/product-media-upload", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(media),
        }).catch(() => undefined);
      }
      setMessage(error instanceof Error ? error.message : "Could not save the product.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteProduct(product: AdminProduct) {
    if (!window.confirm("Delete " + product.name + " from the store?")) return;
    setMessage("");
    try {
      const response = await fetch("/api/admin/products/" + encodeURIComponent(product.id), { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not delete the product.");
      setProducts((current) => current.filter((item) => item.id !== product.id));
      if (editingId === product.id) resetForm();
      setMessage("Product deleted from the store.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete the product.");
    }
  }


  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setLoggedIn(false);
    setProducts([]);
  }

  async function updateOperation(type: "order" | "return" | "comment", id: string, fields: Record<string, string>) {
    const response = await fetch("/api/admin/operations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, id, ...fields }) });
    if (!response.ok) { setMessage("Could not save the change."); return; }
    await loadOperations();
  }

  async function deleteOrder(order: OperationsData["orders"][number]) {
    if (!window.confirm(`Permanently delete order ${order.id}? This cannot be undone.`)) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/operations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: order.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not delete this order.");
      setOperations((current) => ({ ...current, orders: current.orders.filter((item) => item.id !== order.id) }));
      setMessage(`Order ${order.id} deleted.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete this order.");
    } finally {
      setBusy(false);
    }
  }

  const labelStyle = { display: "block", marginBottom: 7, fontSize: 12, fontWeight: 700 };
  const productSizes = [...new Set(variants.map((variant) => variant.size))];

  return (
    <main style={{ minHeight: "100vh", background: "#f6f6f6", color: "#111", padding: "24px 5% 60px", fontFamily: "Arial, sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: 1180, margin: "0 auto 30px" }}>
        <Link href="/" style={{ color: "#111", textDecoration: "none", fontSize: 25, fontWeight: 900 }}>MAVEX® ADMIN</Link>
        <Link href="/" style={{ color: "#333", fontSize: 13 }}>BACK TO STORE</Link>
      </header>

      {checkingSession ? (
        <p style={{ textAlign: "center", padding: 50 }}>LOADING ADMIN PANEL...</p>
      ) : !loggedIn ? (
        <form onSubmit={login} style={{ maxWidth: 420, margin: "10vh auto", background: "#fff", padding: 28, borderRadius: 9, boxShadow: "0 8px 30px #0000000d" }}>
          <p style={{ color: "#f890c8", letterSpacing: 2, fontSize: 11, fontWeight: 800 }}>PRIVATE ACCESS</p>
          <h1 style={{ margin: "10px 0 22px", fontSize: 28 }}>Admin login</h1>
          <label htmlFor="admin-password" style={labelStyle}>Admin password</label>
          <input id="admin-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} style={inputStyle} />
          <button disabled={busy} className="add-button" style={{ width: "100%", marginTop: 16 }}>{busy ? "SIGNING IN..." : "SIGN IN"}</button>
          {message && <p role="alert" style={{ color: "#b42318", marginTop: 14, fontSize: 13 }}>{message}</p>}
        </form>
      ) : (
        <>
        <nav aria-label="Admin sections" style={{ maxWidth: 1180, margin: "0 auto 20px", display: "flex", gap: 8, overflowX: "auto", background: "#fff", padding: 9, borderRadius: 12, boxShadow: "0 8px 30px #0000000d" }}>
          {([ ["products", "Products", products.length], ["orders", "Orders", operations.orders.length], ["returns", "Returns", operations.returns.length], ["comments", "Comments", operations.comments.filter(c => c.status === "pending").length] ] as const).map(([key, label, count]) => <button key={key} type="button" onClick={() => { setActiveTab(key); if (key !== "products") void loadOperations(); }} style={{ flex: 1, minWidth: 120, border: 0, borderRadius: 8, padding: "13px 16px", cursor: "pointer", fontWeight: 800, background: activeTab === key ? "#17213c" : "#f4f4f6", color: activeTab === key ? "#fff" : "#272727" }}>{label}<span style={{ display: "inline-grid", placeItems: "center", minWidth: 23, height: 23, marginInlineStart: 8, borderRadius: 20, background: activeTab === key ? "#f890c8" : "#fff", color: "#111", fontSize: 11 }}>{count}</span></button>)}
          <button type="button" onClick={logout} style={{ border: "1px solid #eee", borderRadius: 8, padding: "0 15px", background: "#fff", cursor: "pointer" }}>LOG OUT</button>
        </nav>
        {activeTab === "products" ? (
        <div className="admin-products-layout" style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(360px, 1fr)", gap: 24, alignItems: "start" }}>
          <section style={{ background: "#fff", padding: 24, borderRadius: 9, boxShadow: "0 8px 30px #0000000d" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
              <div>
                <p style={{ color: "#f890c8", letterSpacing: 2, fontSize: 11, fontWeight: 800 }}>STORE CATALOG</p>
                <h1 style={{ marginTop: 8, fontSize: 26 }}>{editingId ? "Edit product" : "Add a product"}</h1>
              </div>
              <button type="button" onClick={logout} style={{ border: 0, background: "transparent", textDecoration: "underline", cursor: "pointer", color: "#555" }}>LOG OUT</button>
            </div>

            <form onSubmit={saveProduct}>
              <label htmlFor="product-name" style={labelStyle}>Product name</label>
              <input id="product-name" required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} style={inputStyle} />

              <label htmlFor="product-description" style={{ ...labelStyle, marginTop: 14 }}>Description</label>
              <textarea id="product-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
                <div><label htmlFor="product-price" style={labelStyle}>Price (EGP)</label><input id="product-price" type="number" min="1" step="1" required value={price} onChange={(event) => setPrice(event.target.value)} style={inputStyle} /></div>
                <div><label htmlFor="product-compare" style={labelStyle}>Compare at price</label><input id="product-compare" type="number" min="0" step="1" value={compareAtPrice} onChange={(event) => setCompareAtPrice(event.target.value)} style={inputStyle} /></div>
              </div>

              <div style={{ marginTop: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <p style={labelStyle}>Color and size variants</p>
                  <button type="button" onClick={addVariant} style={{ border: "1px solid #ddd", background: "#fff", padding: "6px 10px", cursor: "pointer", borderRadius: 4 }}>+ ADD SIZE</button>
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {variants.map((variant, index) => (
                    <div key={variant.id || "new-" + index} className="admin-variant-row" style={{ display: "grid", gridTemplateColumns: "1.2fr .7fr .8fr .8fr .7fr 34px", gap: 6, alignItems: "center", padding: "8px 0", borderTop: "1px solid #eee" }}>
                      <input aria-label={"Color for variant " + (index + 1)} required value={variant.color} onChange={(event) => updateVariant(index, "color", event.target.value)} placeholder="Color" style={inputStyle} />
                      <select aria-label={"Size for variant " + (index + 1)} value={variant.size} onChange={(event) => updateVariant(index, "size", event.target.value)} style={inputStyle}>{sizes.map((size) => <option key={size}>{size}</option>)}</select>
                      <input aria-label={"Stock for variant " + (index + 1)} required type="number" min="0" step="1" value={variant.stock_quantity} onChange={(event) => updateVariant(index, "stock_quantity", event.target.value)} title="Stock" style={inputStyle} />
                      <input aria-label={"Price override for variant " + (index + 1)} type="number" min="1" step="1" value={variant.price_override} onChange={(event) => updateVariant(index, "price_override", event.target.value)} placeholder="Price" title="Optional price override" style={inputStyle} />
                      <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10 }}><input type="checkbox" checked={variant.is_active} onChange={(event) => updateVariant(index, "is_active", event.target.checked)} />Live</label>
                      <button type="button" aria-label="Remove variant" onClick={() => setVariants((current) => current.filter((_, itemIndex) => itemIndex !== index))} style={{ border: 0, background: "transparent", color: "#b42318", fontSize: 20, cursor: "pointer" }}>×</button>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 18, padding: 14, border: "1px solid #eee", borderRadius: 7 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <div>
                    <p style={labelStyle}>Other color products</p>
                    <p style={{ color: "#777", fontSize: 11, marginTop: 4 }}>Choose which product opens when a customer taps each color swatch.</p>
                  </div>
                  <button type="button" onClick={() => setColorProductLinks((current) => [...current, { color: "", product_id: "" }])} style={{ border: "1px solid #ddd", background: "#fff", padding: "7px 10px", cursor: "pointer", borderRadius: 4, whiteSpace: "nowrap" }}>+ ADD COLOR</button>
                </div>
                {colorProductLinks.length > 0 && <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                  {colorProductLinks.map((link, index) => (
                    <div key={`linked-color-${index}`} style={{ display: "grid", gridTemplateColumns: "minmax(90px, .8fr) minmax(0, 1.5fr) 32px", gap: 7, alignItems: "center" }}>
                      <input aria-label={`Linked color name ${index + 1}`} required maxLength={40} value={link.color} onChange={(event) => updateColorProductLink(index, "color", event.target.value)} placeholder="Color (e.g. Burgundy)" style={inputStyle} />
                      <select aria-label={`Product for linked color ${index + 1}`} required value={link.product_id} onChange={(event) => updateColorProductLink(index, "product_id", event.target.value)} style={inputStyle}>
                        <option value="">Choose product</option>
                        {products.filter((product) => product.id !== editingId && (!product.status || product.status === "active")).map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                      </select>
                      <button type="button" aria-label="Remove linked color" onClick={() => setColorProductLinks((current) => current.filter((_, itemIndex) => itemIndex !== index))} style={{ border: 0, background: "transparent", color: "#b42318", fontSize: 20, cursor: "pointer" }}>×</button>
                    </div>
                  ))}
                </div>}
              </div>

              <div style={{ marginTop: 18 }}>
                <p style={labelStyle}>Customer size chart</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginBottom: 12 }}>
                  <label style={{ fontSize: 11, color: "#666" }}>Chart title<input aria-label="Size chart title" maxLength={40} value={sizeGuideTitle} onChange={(event) => setSizeGuideTitle(event.target.value)} placeholder="HOODIE or PANTS" style={{ ...inputStyle, marginTop: 4 }} /></label>
                  <label style={{ fontSize: 11, color: "#666" }}>Size column heading<input aria-label="Size column heading" maxLength={20} value={sizeGuideSizeLabel} onChange={(event) => setSizeGuideSizeLabel(event.target.value)} style={{ ...inputStyle, marginTop: 4 }} /></label>
                  <label style={{ fontSize: 11, color: "#666" }}>Length column heading<input aria-label="Length column heading" maxLength={20} value={sizeGuideLengthLabel} onChange={(event) => setSizeGuideLengthLabel(event.target.value)} placeholder="LENGTH" style={{ ...inputStyle, marginTop: 4 }} /></label>
                  <label style={{ fontSize: 11, color: "#666" }}>Width / waist heading<input aria-label="Width or waist column heading" maxLength={20} value={sizeGuideWidthLabel} onChange={(event) => setSizeGuideWidthLabel(event.target.value)} placeholder="WIDTH or WAIST" style={{ ...inputStyle, marginTop: 4 }} /></label>
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {productSizes.map((size) => (
                    <div key={size} style={{ display: "grid", gridTemplateColumns: "50px 1fr 1fr", gap: 8, alignItems: "center" }}>
                      <label style={{ fontSize: 10, color: "#666" }}>Variant<strong style={{ display: "block", marginTop: 10, fontSize: 13, color: "#111" }}>{size}</strong></label>
                      <label style={{ fontSize: 11, color: "#666" }}>Chart size label<input aria-label={size + " chart label"} maxLength={30} required value={sizeMeasurements[size]?.label || size} onChange={(event) => setSizeMeasurements((current) => ({ ...current, [size]: { ...current[size], label: event.target.value } }))} placeholder={size} style={{ ...inputStyle, marginTop: 4 }} /></label>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                        <label style={{ fontSize: 10, color: "#666" }}>{sizeGuideLengthLabel || "Length"}<input aria-label={size + " length"} type="number" min="1" step="0.1" required value={sizeMeasurements[size]?.length || ""} onChange={(event) => setSizeMeasurements((current) => ({ ...current, [size]: { ...current[size], length: event.target.value } }))} style={{ ...inputStyle, marginTop: 4 }} /></label>
                        <label style={{ fontSize: 10, color: "#666" }}>{sizeGuideWidthLabel || "Width"}<input aria-label={size + " width"} type="number" min="1" step="0.1" required value={sizeMeasurements[size]?.width || ""} onChange={(event) => setSizeMeasurements((current) => ({ ...current, [size]: { ...current[size], width: event.target.value } }))} style={{ ...inputStyle, marginTop: 4 }} /></label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <label htmlFor="product-images" style={{ ...labelStyle, marginTop: 18 }}>Product photos (up to 8 images, 5 MB each)</label>
              {editingProduct?.product_images?.length ? <div style={{ display: "flex", gap: 7, overflowX: "auto", margin: "8px 0" }}>{editingProduct.product_images.map((photo, index) => <Image key={photo.image_url} src={photo.image_url} alt={`${editingProduct.name} ${index + 1}`} width={58} height={66} sizes="58px" quality={80} style={{ width: 58, height: 66, objectFit: "cover", borderRadius: 5 }} />)}</div> : null}
              <input id="product-images" type="file" multiple accept="image/png,image/jpeg,image/webp" required={!editingId} onChange={(event) => setImages(Array.from(event.target.files || []))} style={{ ...inputStyle, padding: 9 }} />
              {images.length > 0 && <p style={{ color: "#555", fontSize: 11, marginTop: 6 }}>{images.length} photo(s) selected. They will be added to the existing product photos.</p>}

              <label htmlFor="product-video" style={{ ...labelStyle, marginTop: 18 }}>Product video (optional, MP4/WebM/MOV, up to 30 MB)</label>
              {editingProduct?.product_video_url && <div style={{ margin: "8px 0" }}>{!removeVideo && <video src={editingProduct.product_video_url} controls playsInline preload="metadata" style={{ display: "block", width: "min(100%, 360px)", maxHeight: 240, background: "#111", borderRadius: 6 }} />}<label style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 8, fontSize: 12 }}><input type="checkbox" checked={removeVideo} onChange={(event) => setRemoveVideo(event.target.checked)} />Remove current video</label></div>}
              {editingProduct?.product_video_url && removeVideo && <p style={{ color: "#777", fontSize: 11, marginTop: 6 }}>The current video will be removed when you save.</p>}
              <input id="product-video" type="file" accept="video/mp4,video/webm,video/quicktime" onChange={(event) => { setVideo(event.target.files?.[0] || null); if (event.target.files?.[0]) setRemoveVideo(false); }} style={{ ...inputStyle, padding: 9 }} />
              {video && <p style={{ color: "#555", fontSize: 11, marginTop: 6 }}>{video.name} selected ({(video.size / (1024 * 1024)).toFixed(1)} MB).</p>}

              <div style={{ display: "grid", gridTemplateColumns: editingId ? "1fr 1fr" : "1fr", gap: 10, marginTop: 20 }}>
                {editingId && <button type="button" onClick={resetForm} style={{ background: "#fff", border: "1px solid #ccc", padding: 15, cursor: "pointer" }}>CANCEL EDIT</button>}
                <button type="submit" className="add-button" disabled={busy} style={{ width: "100%" }}>{busy ? "SAVING..." : editingId ? "SAVE CHANGES" : "ADD PRODUCT TO STORE"}</button>
              </div>
              {message && <p role="status" style={{ marginTop: 14, color: /saved|updated|deleted|added/i.test(message) ? "#20834b" : "#b42318", fontSize: 13 }}>{message}</p>}
            </form>
          </section>

          <aside style={{ background: "#fff", padding: 24, borderRadius: 9, boxShadow: "0 8px 30px #0000000d" }}>
            <p style={{ color: "#f890c8", letterSpacing: 2, fontSize: 11, fontWeight: 800 }}>ALL STORE PRODUCTS</p>
            <h2 style={{ margin: "8px 0 18px", fontSize: 22 }}>Products ({products.length})</h2>
            {products.length === 0 ? <p style={{ color: "#777", fontSize: 13 }}>No products found.</p> : products.map((product) => (
              <article key={product.id} style={{ display: "grid", gridTemplateColumns: "58px 1fr auto", gap: 10, alignItems: "center", padding: "12px 0", borderTop: "1px solid #eee" }}>
                {product.product_images[0]?.image_url ? <Image src={product.product_images[0].image_url} alt={product.name} width={58} height={68} sizes="58px" quality={80} style={{ width: 58, height: 68, objectFit: "cover", background: "#f2f2f2" }} /> : <div style={{ width: 58, height: 68, background: "#f2f2f2" }} />}
                <div>
                  <strong style={{ fontSize: 12 }}>{product.name}</strong>
                  <p style={{ marginTop: 4, fontSize: 11, color: "#555" }}>EGP {product.price.toLocaleString("en-EG")}{product.compare_at_price ? " · was EGP " + product.compare_at_price.toLocaleString("en-EG") : ""}</p>
                  <p style={{ marginTop: 4, fontSize: 10, color: "#777" }}>{product.product_variants.map((variant) => variant.color + " " + variant.size + ": " + variant.stock_quantity).join(" · ")}</p>
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <button type="button" onClick={() => editProduct(product)} style={{ border: "1px solid #ddd", background: "#fff", padding: "6px 9px", cursor: "pointer", fontSize: 10 }}>EDIT</button>
                  <button type="button" onClick={() => deleteProduct(product)} style={{ border: "1px solid #f3c6c6", background: "#fff", color: "#b42318", padding: "6px 9px", cursor: "pointer", fontSize: 10 }}>DELETE</button>
                </div>
              </article>
            ))}
          </aside>
        </div>
        ) : <div style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gap: 16 }}>
          {activeTab === "orders" && (
            <section style={{ background: "#fff", padding: 22, borderRadius: 12 }}>
              <h1 style={{ marginBottom: 18 }}>Orders <small style={{ color: "#888", fontSize: 14 }}>({operations.orders.length})</small></h1>
              {operations.orders.length === 0 ? <p>No orders yet.</p> : operations.orders.map((order) => {
                const paymentName = order.payment === "instapay" ? "InstaPay" : order.payment === "vodafone" ? "Vodafone Cash" : "Cash on delivery";
                const isTransfer = order.payment === "instapay" || order.payment === "vodafone";
                return (
                  <article key={order.id} style={{ border: "1px solid #eee", borderRadius: 10, padding: 18, marginTop: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div>
                        <strong>{order.id} · {order.customer.name}</strong>
                        <p style={{ marginTop: 6, color: "#666" }}>{new Date(order.date).toLocaleString("en-EG")}</p>
                      </div>
                      <label style={{ display: "grid", gap: 5, fontSize: 12, minWidth: 210 }}>Order status
                        <select aria-label={`Status for ${order.id}`} value={order.status} onChange={e => void updateOperation("order", order.id, { status: e.target.value })} style={inputStyle}>
                          {["Pending confirmation", "Awaiting payment review", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled", "Cancelled by customer"].map(s => <option key={s}>{s}</option>)}
                        </select>
                      </label>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 16 }}>
                      <div style={{ background: "#fafafa", borderRadius: 8, padding: 14 }}>
                        <strong>Customer details</strong>
                        <p style={{ marginTop: 8, fontSize: 13, lineHeight: 1.8 }}>Name: {order.customer.name}<br />Phone: {order.customer.phone}<br />{order.customer.phone2 ? <>Second phone: {order.customer.phone2}<br /></> : null}Email: {order.customer.email || "Not provided"}</p>
                      </div>
                      <div style={{ background: "#fafafa", borderRadius: 8, padding: 14 }}>
                        <strong>Delivery address</strong>
                        <p style={{ marginTop: 8, fontSize: 13, lineHeight: 1.8 }}>Governorate: {order.governorate}<br />City: {order.customer.city}<br />Village/area: {order.customer.village}<br />Street: {order.customer.street}<br />Building: {order.customer.building || "Not provided"}</p>
                        {order.customer.notes && <p style={{ marginTop: 8, fontSize: 13, lineHeight: 1.6 }}>Customer notes: {order.customer.notes}</p>}
                      </div>
                    </div>

                    <div style={{ background: "#f8f8f8", borderRadius: 8, padding: 14, marginTop: 12 }}>
                      <strong>Items ({order.items.length})</strong>
                      <div style={{ display: "grid", gap: 9, marginTop: 10 }}>
                        {order.items.map((item, index) => (
                          <div key={`${order.id}-${index}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px solid #e8e8e8" }}>
                            {item.image && <Image src={item.image} alt={item.name} width={54} height={64} sizes="54px" quality={80} style={{ width: 54, height: 64, objectFit: "cover", borderRadius: 4, background: "#eee" }} />}
                            <p style={{ fontSize: 13, lineHeight: 1.7 }}>{item.name}<br />Color: {item.color || "—"} · Size: {item.size} · Quantity: {item.quantity}<br />Unit price: EGP {item.price.toLocaleString("en-EG")} · Line total: EGP {(item.price * item.quantity).toLocaleString("en-EG")}</p>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: "grid", gap: 5, maxWidth: 320, margin: "14px 0 0 auto", fontSize: 13 }}>
                        <p style={{ display: "flex", justifyContent: "space-between" }}><span>Subtotal</span><span>EGP {order.subtotal.toLocaleString("en-EG")}</span></p>
                        <p style={{ display: "flex", justifyContent: "space-between" }}><span>Shipping</span><span>EGP {order.shipping.toLocaleString("en-EG")}</span></p>
                        <strong style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #ddd", paddingTop: 8 }}><span>Total</span><span>EGP {order.total.toLocaleString("en-EG")}</span></strong>
                      </div>
                    </div>

                    <div style={{ background: "#fff7fb", border: "1px solid #f4c6df", borderRadius: 8, padding: 14, marginTop: 12 }}>
                      <strong>Payment: {paymentName}</strong>
                      {isTransfer && <p style={{ marginTop: 7, fontSize: 13 }}>Transfer reference: {order.transaction || "Not provided"}</p>}
                      {isTransfer && order.proof && (
                        <a href={order.proof} target="_blank" rel="noreferrer" style={{ display: "block", width: "fit-content", maxWidth: "100%", marginTop: 10 }}>
                          <img src={order.proof} alt={`${paymentName} payment proof for ${order.id}`} style={{ display: "block", width: "min(100%, 480px)", maxHeight: 640, objectFit: "contain", border: "1px solid #ddd", borderRadius: 6, background: "#fff" }} />
                          <span style={{ display: "block", marginTop: 6, color: "#774061", fontSize: 12 }}>Open full-size payment proof</span>
                        </a>
                      )}
                      {isTransfer && !order.proof && <p style={{ marginTop: 7, color: "#b42318", fontSize: 13 }}>No payment image was uploaded.</p>}
                    </div>

                    <label style={{ display: "block", marginTop: 14, fontSize: 12 }}>Courier tracking number
                      <input defaultValue={order.trackingNumber || ""} onBlur={(e) => { const trackingNumber = e.currentTarget.value.trim(); if (trackingNumber !== (order.trackingNumber || "")) void updateOperation("order", order.id, { trackingNumber }); }} placeholder="Enter courier tracking number" style={{ ...inputStyle, maxWidth: 360, marginTop: 6 }} />
                    </label>
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
                      <button type="button" disabled={busy} onClick={() => void deleteOrder(order)} style={{ border: "1px solid #efcaca", borderRadius: 6, background: "#fff", color: "#a22", padding: "10px 14px", fontWeight: 700, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1 }}>DELETE ORDER</button>
                    </div>
                  </article>
                );
              })}
            </section>
          )}
          {activeTab === "returns" && <section style={{ background: "#fff", padding: 22, borderRadius: 12 }}><h1 style={{ marginBottom: 18 }}>Return Requests <small style={{ color: "#888", fontSize: 14 }}>({operations.returns.length})</small></h1><p style={{ marginBottom: 16, color: "#666" }}>Customer form: <Link href="/returns" style={{ color: "#7d3760" }}>/returns</Link></p>{operations.returns.length === 0 ? <p>No return requests yet.</p> : operations.returns.map(item => <article key={item.id} style={{ border: "1px solid #eee", borderRadius: 10, padding: 18, marginTop: 12 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><strong>{item.id} · Order {item.orderId}</strong><select aria-label={`Status for ${item.id}`} value={item.status} onChange={e => void updateOperation("return", item.id, { status: e.target.value })} style={{ ...inputStyle, width: 190 }}>{["New", "Reviewing", "Approved", "Rejected", "Resolved"].map(s => <option key={s}>{s}</option>)}</select></div><p style={{ marginTop: 8 }}>{item.customerName} · {item.email || item.phone || "No contact email"} · {new Date(item.date).toLocaleString("en-EG")}</p><p style={{ marginTop: 12, background: "#fff7fb", padding: 13, borderRadius: 7, lineHeight: 1.7 }}>{item.issue}</p></article>)}</section>}
          {activeTab === "comments" && <section style={{ background: "#fff", padding: 22, borderRadius: 12 }}><h1 style={{ marginBottom: 18 }}>Product Comments <small style={{ color: "#888", fontSize: 14 }}>({operations.comments.length})</small></h1>{operations.comments.length === 0 ? <p>No comments yet.</p> : operations.comments.map(item => <article key={item.id} style={{ border: "1px solid #eee", borderRadius: 10, padding: 18, marginTop: 12 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><div><strong>{item.productName}</strong><p style={{ marginTop: 5 }}>{item.name} · <span style={{ color: "#ca7b00" }}>{"★".repeat(item.rating)}{"☆".repeat(5-item.rating)}</span> · {new Date(item.date).toLocaleString("en-EG")}</p></div><span style={{ fontSize: 12, color: item.status === "pending" ? "#b56b00" : "#777" }}>{item.status}</span></div><p style={{ margin: "12px 0", lineHeight: 1.7 }}>{item.message}</p>{item.reply && <p style={{ color: "#555", fontSize: 12 }}>Admin reply: {item.reply}</p>}<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button type="button" onClick={() => void updateOperation("comment", item.id, { status: item.status === "published" ? "hidden" : "published" })} style={{ border: 0, borderRadius: 6, background: "#17213c", color: "#fff", padding: "9px 13px", cursor: "pointer" }}>{item.status === "published" ? "Hide" : "Publish comment"}</button><button type="button" onClick={() => { const reply = window.prompt("Reply to this comment", item.reply || ""); if (reply !== null) void updateOperation("comment", item.id, { status: item.status === "published" ? "published" : "hidden", reply }); }} style={{ border: "1px solid #ddd", background: "#fff", borderRadius: 6, padding: "9px 13px", cursor: "pointer" }}>Reply</button><button type="button" onClick={() => { if (window.confirm("Permanently delete this comment?")) void updateOperation("comment", item.id, { action: "delete" }); }} style={{ border: "1px solid #efcaca", color: "#a22", background: "#fff", borderRadius: 6, padding: "9px 13px", cursor: "pointer" }}>Delete</button></div></article>)}</section>}
        </div>}
        </>
      )}
    </main>
  );
}
