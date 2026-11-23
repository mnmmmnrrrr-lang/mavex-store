"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

type VariantDraft = {
  id: string;
  color: string;
  size: string;
  stock_quantity: string;
  price_override: string;
  is_active: boolean;
};

type AdminProduct = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  size_guide?: { size: string; width: number; length: number }[];
  product_images: { image_url: string; alt_text: string | null; sort_order: number | null }[];
  product_variants: { id: string; color: string; size: string; stock_quantity: number; price_override: number | null; is_active: boolean | null }[];
};
type OperationsData = {
  orders: { id: string; customer: { name: string; phone: string; email?: string; phone2?: string; city: string; village: string; street: string; building?: string; notes?: string }; governorate: string; items: { name: string; size: string; color?: string; quantity: number; price: number }[]; subtotal: number; shipping: number; total: number; payment: string; transaction?: string; proof?: string; status: string; date: string; trackingNumber?: string }[];
  returns: { id: string; orderId: string; customerName: string; email?: string; phone?: string; issue: string; date: string; status: string }[];
  comments: { id: string; productId: string; productName: string; name: string; rating: number; message: string; date: string; status: string; reply?: string }[];
};

const sizes = ["XS", "S", "M", "L", "XL", "XXL"];
const standardMeasurements: Record<string, { width: string; length: string }> = {
  XS: { width: "54", length: "70" },
  S: { width: "104", length: "68" },
  M: { width: "108", length: "70" },
  L: { width: "112", length: "72" },
  XL: { width: "116", length: "74" },
  XXL: { width: "120", length: "76" },
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
  const [sizeMeasurements, setSizeMeasurements] = useState(standardMeasurements);
  const [images, setImages] = useState<File[]>([]);
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
    setSizeMeasurements(standardMeasurements);
    setImages([]);
    const fileInput = document.querySelector<HTMLInputElement>("#product-images");
    if (fileInput) fileInput.value = "";
  }

  function editProduct(product: AdminProduct) {
    setEditingId(product.id);
    setEditingProduct(product);
    setName(product.name);
    setDescription(product.description || "");
    setPrice(String(product.price));
    setCompareAtPrice(product.compare_at_price === null ? "" : String(product.compare_at_price));
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
      guide[item.size] = { width: String(item.width), length: String(item.length) };
    }
    setSizeMeasurements(guide);
    setImages([]);
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateVariant(index: number, field: keyof VariantDraft, value: string | boolean) {
    setVariants((current) => current.map((variant, itemIndex) =>
      itemIndex === index ? { ...variant, [field]: value } : variant
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
    setBusy(true);
    setMessage("");
    const form = new FormData();
    form.set("name", name);
    form.set("description", description);
    form.set("price", price);
    form.set("compareAtPrice", compareAtPrice);
    form.set("variants", JSON.stringify(variants));
    if (editingProduct) form.set("baseProduct", JSON.stringify(editingProduct));
    const productSizes = [...new Set(variants.map((variant) => variant.size))];
    form.set("sizeGuide", JSON.stringify(productSizes.map((size) => ({
      size,
      width: sizeMeasurements[size]?.width,
      length: sizeMeasurements[size]?.length,
    }))));
    for (const image of images) form.append("images", image);

    try {
      const url = editingId ? "/api/admin/products/" + encodeURIComponent(editingId) : "/api/admin/products";
      const response = await fetch(url, { method: editingId ? "PUT" : "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save the product.");
      setProducts((current) => {
        const index = current.findIndex((product) => product.id === result.id);
        if (index < 0) return [result, ...current];
        return current.map((product) => product.id === result.id ? result : product);
      });
      setMessage(editingId ? "Product updated." : "Product added to the store.");
      resetForm();
    } catch (error) {
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

              <div style={{ marginTop: 18 }}>
                <p style={labelStyle}>Width and length per size (cm)</p>
                <div style={{ display: "grid", gap: 8 }}>
                  {productSizes.map((size) => (
                    <div key={size} style={{ display: "grid", gridTemplateColumns: "50px 1fr 1fr", gap: 8, alignItems: "center" }}>
                      <strong style={{ fontSize: 13 }}>{size}</strong>
                      <label style={{ fontSize: 11, color: "#666" }}>Width<input aria-label={size + " width"} type="number" min="1" step="0.1" required value={sizeMeasurements[size]?.width || ""} onChange={(event) => setSizeMeasurements((current) => ({ ...current, [size]: { ...current[size], width: event.target.value } }))} style={{ ...inputStyle, marginTop: 4 }} /></label>
                      <label style={{ fontSize: 11, color: "#666" }}>Length<input aria-label={size + " length"} type="number" min="1" step="0.1" required value={sizeMeasurements[size]?.length || ""} onChange={(event) => setSizeMeasurements((current) => ({ ...current, [size]: { ...current[size], length: event.target.value } }))} style={{ ...inputStyle, marginTop: 4 }} /></label>
                    </div>
                  ))}
                </div>
              </div>

              <label htmlFor="product-images" style={{ ...labelStyle, marginTop: 18 }}>Product photos (up to 8 images, 5 MB each)</label>
              {editingProduct?.product_images?.length ? <div style={{ display: "flex", gap: 7, overflowX: "auto", margin: "8px 0" }}>{editingProduct.product_images.map((photo, index) => <img key={photo.image_url} src={photo.image_url} alt={`${editingProduct.name} ${index + 1}`} style={{ width: 58, height: 66, objectFit: "cover", borderRadius: 5 }} />)}</div> : null}
              <input id="product-images" type="file" multiple accept="image/png,image/jpeg,image/webp" required={!editingId} onChange={(event) => setImages(Array.from(event.target.files || []))} style={{ ...inputStyle, padding: 9 }} />
              {images.length > 0 && <p style={{ color: "#555", fontSize: 11, marginTop: 6 }}>{images.length} photo(s) selected. They will be added to the existing product photos.</p>}

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
                <img src={product.product_images[0]?.image_url || ""} alt={product.name} style={{ width: 58, height: 68, objectFit: "cover", background: "#f2f2f2" }} />
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
          {activeTab === "orders" && <section style={{ background: "#fff", padding: 22, borderRadius: 12 }}><h1 style={{ marginBottom: 18 }}>Orders <small style={{ color: "#888", fontSize: 14 }}>({operations.orders.length})</small></h1>{operations.orders.length === 0 ? <p>No orders yet.</p> : operations.orders.map(order => <article key={order.id} style={{ border: "1px solid #eee", borderRadius: 10, padding: 18, marginTop: 12 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><div><strong>{order.id} · {order.customer.name}</strong><p style={{ marginTop: 6, color: "#666" }}>{order.customer.phone} · {order.customer.email || "No email provided"} · {order.governorate} · {order.customer.city}</p><p style={{ marginTop: 5, fontSize: 12, color: "#777" }}>{new Date(order.date).toLocaleString("en-EG")} · {order.payment}</p></div><select aria-label={`Status for ${order.id}`} value={order.status} onChange={e => void updateOperation("order", order.id, { status: e.target.value })} style={{ ...inputStyle, width: 210, alignSelf: "start" }}>{["Pending confirmation", "Awaiting payment review", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled"].map(s => <option key={s}>{s}</option>)}</select></div><div style={{ background: "#f8f8f8", borderRadius: 7, padding: 12, marginTop: 12 }}>{order.items.map((item, i) => <p key={i} style={{ fontSize: 13, padding: 3 }}>{item.name} · {item.color} / {item.size} × {item.quantity} · EGP {(item.price * item.quantity).toLocaleString("en-EG")}</p>)}<strong style={{ display: "block", marginTop: 8 }}>Total: EGP {order.total.toLocaleString("en-EG")}</strong></div><label style={{ display: "block", marginTop: 12, fontSize: 12 }}>Courier tracking number<input defaultValue={order.trackingNumber || ""} onBlur={(e) => { const trackingNumber = e.currentTarget.value.trim(); if (trackingNumber !== (order.trackingNumber || "")) void updateOperation("order", order.id, { trackingNumber }); }} placeholder="Enter courier tracking number" style={{ ...inputStyle, maxWidth: 360, marginTop: 6 }} /></label><p style={{ marginTop: 10, fontSize: 12, color: "#555" }}>Address: {order.customer.village}, {order.customer.street} {order.customer.building || ""} {order.customer.notes ? `· ${order.customer.notes}` : ""} {order.transaction ? `· Transfer reference: ${order.transaction}` : ""}</p>{order.proof && <a href={order.proof} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 8, color: "#774061" }}>View payment proof</a>}</article>)}</section>}
          {activeTab === "returns" && <section style={{ background: "#fff", padding: 22, borderRadius: 12 }}><h1 style={{ marginBottom: 18 }}>Return Requests <small style={{ color: "#888", fontSize: 14 }}>({operations.returns.length})</small></h1><p style={{ marginBottom: 16, color: "#666" }}>Customer form: <Link href="/returns" style={{ color: "#7d3760" }}>/returns</Link></p>{operations.returns.length === 0 ? <p>No return requests yet.</p> : operations.returns.map(item => <article key={item.id} style={{ border: "1px solid #eee", borderRadius: 10, padding: 18, marginTop: 12 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><strong>{item.id} · Order {item.orderId}</strong><select aria-label={`Status for ${item.id}`} value={item.status} onChange={e => void updateOperation("return", item.id, { status: e.target.value })} style={{ ...inputStyle, width: 190 }}>{["New", "Reviewing", "Approved", "Rejected", "Resolved"].map(s => <option key={s}>{s}</option>)}</select></div><p style={{ marginTop: 8 }}>{item.customerName} · {item.email || item.phone || "No contact email"} · {new Date(item.date).toLocaleString("en-EG")}</p><p style={{ marginTop: 12, background: "#fff7fb", padding: 13, borderRadius: 7, lineHeight: 1.7 }}>{item.issue}</p></article>)}</section>}
          {activeTab === "comments" && <section style={{ background: "#fff", padding: 22, borderRadius: 12 }}><h1 style={{ marginBottom: 18 }}>Product Comments <small style={{ color: "#888", fontSize: 14 }}>({operations.comments.length})</small></h1>{operations.comments.length === 0 ? <p>No comments yet.</p> : operations.comments.map(item => <article key={item.id} style={{ border: "1px solid #eee", borderRadius: 10, padding: 18, marginTop: 12 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><div><strong>{item.productName}</strong><p style={{ marginTop: 5 }}>{item.name} · <span style={{ color: "#ca7b00" }}>{"★".repeat(item.rating)}{"☆".repeat(5-item.rating)}</span> · {new Date(item.date).toLocaleString("en-EG")}</p></div><span style={{ fontSize: 12, color: item.status === "pending" ? "#b56b00" : "#777" }}>{item.status}</span></div><p style={{ margin: "12px 0", lineHeight: 1.7 }}>{item.message}</p>{item.reply && <p style={{ color: "#555", fontSize: 12 }}>Admin reply: {item.reply}</p>}<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button type="button" onClick={() => void updateOperation("comment", item.id, { status: item.status === "published" ? "hidden" : "published" })} style={{ border: 0, borderRadius: 6, background: "#17213c", color: "#fff", padding: "9px 13px", cursor: "pointer" }}>{item.status === "published" ? "Hide" : "Publish comment"}</button><button type="button" onClick={() => { const reply = window.prompt("Reply to this comment", item.reply || ""); if (reply !== null) void updateOperation("comment", item.id, { status: item.status === "published" ? "published" : "hidden", reply }); }} style={{ border: "1px solid #ddd", background: "#fff", borderRadius: 6, padding: "9px 13px", cursor: "pointer" }}>Reply</button><button type="button" onClick={() => { if (window.confirm("Permanently delete this comment?")) void updateOperation("comment", item.id, { action: "delete" }); }} style={{ border: "1px solid #efcaca", color: "#a22", background: "#fff", borderRadius: 6, padding: "9px 13px", cursor: "pointer" }}>Delete</button></div></article>)}</section>}
        </div>}
        </>
      )}
    </main>
  );
}
