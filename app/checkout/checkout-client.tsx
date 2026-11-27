 
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { getSupabaseBrowserSession } from "@/lib/supabase-browser";
import { normalizeCartItems, type CartItem } from "@/lib/cart";

const governorates = [
  "Cairo", "Giza", "Alexandria", "Qalyubia", "Gharbia",
  "Monufia", "Dakahlia", "Damietta", "Kafr El Sheikh",
  "Beheira", "Sharqia", "Ismailia", "Port Said", "Suez",
  "Fayoum", "Beni Suef", "Minya", "Assiut", "Sohag",
  "Qena", "Luxor", "Aswan", "Red Sea", "New Valley",
  "Matrouh", "North Sinai", "South Sinai"
];

const PAYMENT = {
  vodafoneNumber: "01279521986",
  instaPayAddress: "minanabil29@instapay",
  instaPayLink: "https://ipn.eg/S/minanabil29/instapay/5JsRg4",
};

const PAYMENT_LABELS: Record<string, string> = {
  cod: "Cash on Delivery",
  vodafone: "Vodafone Cash",
  instapay: "InstaPay",
};

type OrderConfirmation = {
  id: string;
  customerName: string;
  payment: string;
  total: number;
};

export default function CheckoutPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [payment, setPayment] = useState("cod");
  const [governorate, setGovernorate] = useState("");
  const [proof, setProof] = useState("");
  const [readingProof, setReadingProof] = useState(false);
  const [transaction, setTransaction] = useState("");
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [savingOrder, setSavingOrder] = useState(false);
  const [confirmation, setConfirmation] = useState<OrderConfirmation | null>(null);
  const [orderNumberCopied, setOrderNumberCopied] = useState(false);
  const [copyError, setCopyError] = useState("");

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    phone2: "",
    city: "",
    village: "",
    street: "",
    building: "",
    notes: "",
  });

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      let savedEmail = "";
      try {
        const isBuyNow = new URLSearchParams(window.location.search).get("buyNow") === "1";
        const saved = localStorage.getItem(isBuyNow ? "mavex-buy-now" : "mavex-cart");
        if (saved) setCart(normalizeCartItems(JSON.parse(saved)));
        savedEmail = localStorage.getItem("mavex-last-order-email") || "";
        if (savedEmail) setForm((current) => ({ ...current, email: current.email || savedEmail }));
      } catch {
        setCart([]);
        setMessage("Your browser could not read the saved bag. Please return to the product and try again.");
      }

      void getSupabaseBrowserSession().then((session) => {
        if (!active || !session?.user) return;
        const metadata = session.user.user_metadata || {};
        const fullName = String(metadata.full_name || metadata.name || [metadata.given_name, metadata.family_name].filter(Boolean).join(" ") || "");
        setForm((current) => ({
          ...current,
          name: current.name || fullName,
          email: session.user.email && current.email === savedEmail
            ? session.user.email
            : current.email || session.user.email || "",
        }));
      }).catch(() => {
        // Checkout remains usable when auth state cannot be restored.
      });
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, []);

  const subtotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const shipping = 120;
  const total = subtotal + shipping;

  function updateField(field: string, value: string) {
    setForm((old) => ({ ...old, [field]: value }));
    setFieldErrors((old) => ({ ...old, [field]: "" }));
  }

  function handleProof(file?: File) {
    if (!file) return;

    setProof("");
    setReadingProof(false);

    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setFieldErrors((old) => ({ ...old, proof: "Choose a JPG, PNG, or WebP image for your payment screenshot." }));
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      setFieldErrors((old) => ({ ...old, proof: "The image must be smaller than 3 MB." }));
      return;
    }

    setFieldErrors((old) => ({ ...old, proof: "" }));
    setReadingProof(true);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string" || !reader.result.startsWith("data:image/")) {
        setFieldErrors((old) => ({ ...old, proof: "We couldn't read this image. Please choose it again." }));
        setReadingProof(false);
        return;
      }
      setProof(reader.result);
      setReadingProof(false);
    };
    reader.onerror = () => {
      setFieldErrors((old) => ({ ...old, proof: "We couldn't read this image. Please choose it again." }));
      setReadingProof(false);
    };
    reader.readAsDataURL(file);
  }

  async function submitOrder() {
    if (cart.length === 0) {
      setMessage("Your shopping bag is empty.");
      return;
    }

    const nextErrors: Record<string, string> = {};
    if (!form.name.trim()) nextErrors.name = "Enter your full name.";
    if (!form.phone.trim()) nextErrors.phone = "Enter your mobile number.";
    else if (!/^01[0125][0-9]{8}$/.test(form.phone.trim())) nextErrors.phone = "Enter a valid Egyptian mobile number, such as 01012345678.";
    if (!form.email.trim()) nextErrors.email = "Enter your email address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) nextErrors.email = "Enter a valid email address.";
    if (!governorate) nextErrors.governorate = "Choose your governorate.";
    if (!form.city.trim()) nextErrors.city = "Enter your city or district.";
    if (!form.village.trim()) nextErrors.village = "Enter your village or area.";
    if (!form.street.trim()) nextErrors.street = "Enter your street address.";
    if (payment !== "cod" && readingProof) nextErrors.proof = "Please wait for the payment screenshot to finish loading.";
    else if (payment !== "cod" && !proof) nextErrors.proof = "Upload your payment transfer screenshot.";
    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors);
      setMessage("");
      return;
    }
    setFieldErrors({});
    setSavingOrder(true);

    const order = {
      customer: form,
      governorate,
      items: cart,
      payment,
      transaction,
      proof,
    };

    try {
      const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(order) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save your order.");
      try {
        const isBuyNow = new URLSearchParams(window.location.search).get("buyNow") === "1";
        localStorage.removeItem(isBuyNow ? "mavex-buy-now" : "mavex-cart");
        localStorage.setItem("mavex-last-order-email", form.email.trim().toLowerCase());
      } catch {
        // The order is already saved on the server; storage cleanup must not
        // make checkout look failed or invite the customer to submit twice.
      }

      setCart([]);
      setConfirmation({
        id: String(result.id),
        customerName: form.name.trim(),
        payment: typeof result.payment === "string" ? result.payment : payment,
        total: Number.isFinite(Number(result.total)) ? Number(result.total) : total,
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save your order.");
    } finally {
      setSavingOrder(false);
    }
  }

  async function copyOrderNumber() {
    if (!confirmation) return;
    setCopyError("");
    try {
      await navigator.clipboard.writeText(confirmation.id);
    } catch {
      const copyField = document.createElement("textarea");
      copyField.value = confirmation.id;
      copyField.setAttribute("readonly", "");
      copyField.style.position = "fixed";
      copyField.style.opacity = "0";
      document.body.appendChild(copyField);
      copyField.select();
      const copied = document.execCommand("copy");
      copyField.remove();
      if (!copied) {
        setCopyError("Copy was unavailable. You can select the order number above.");
        return;
      }
    }
    setOrderNumberCopied(true);
  }

  const inputStyle = {
    width: "100%",
    padding: 14,
    border: "1px solid #ddd",
    borderRadius: 5,
    fontSize: 14,
    marginTop: 7,
    background: "#fff",
    color: "#111",
  };
  const errorStyle = { color: "#b42318", fontSize: 12, display: "block" as const, marginTop: 6 };
  const fieldStyle = (field: string) => ({ ...inputStyle, borderColor: fieldErrors[field] ? "#b42318" : "#ddd" });

  if (confirmation) {
    return (
      <main className="order-confirmation-page">
        <header className="order-confirmation-header">
          <Link href="/" aria-label="MAVEX home">MAVEX®</Link>
        </header>
        <section className="order-confirmation-card" role="status" aria-live="polite">
          <div className="order-confirmation-check" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="34" height="34" fill="none">
              <path d="m5 12.5 4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="order-confirmation-eyebrow">MAVEX ORDER UPDATE</p>
          <h1>ORDER CONFIRMED!</h1>
          <p className="order-confirmation-intro">Thank you. Your order has been received successfully.</p>
          {confirmation.payment !== "cod" && (
            <p className="order-confirmation-payment-note">
              Your {PAYMENT_LABELS[confirmation.payment] || "online payment"} transfer will be reviewed before your order is processed.
            </p>
          )}

          <div className="order-confirmation-reference">
            <div className="order-confirmation-number-copy">
              <span>ORDER NUMBER</span>
              <strong>{confirmation.id}</strong>
            </div>
            <button type="button" onClick={() => void copyOrderNumber()}>
              {orderNumberCopied ? "COPIED!" : "COPY ORDER NUMBER"}
            </button>
          </div>
          {copyError && <p className="order-confirmation-copy-error" role="status">{copyError}</p>}

          <div className="order-confirmation-summary">
            <div><span>Customer</span><strong>{confirmation.customerName}</strong></div>
            <div><span>Payment method</span><strong>{PAYMENT_LABELS[confirmation.payment] || confirmation.payment}</strong></div>
            <div><span>Total</span><strong>EGP {confirmation.total.toLocaleString("en-EG")}</strong></div>
          </div>

          <div className="order-confirmation-actions">
            <Link href="/account" className="order-confirmation-primary">TRACK MY ORDER</Link>
            <Link href="/" className="order-confirmation-secondary">CONTINUE SHOPPING</Link>
          </div>
          <p className="order-confirmation-tracking-note">Sign in to My Orders with the same email address used at checkout to view updates.</p>
        </section>
      </main>
    );
  }

  return (
    <main style={{
      minHeight: "100vh",
      background: "#f8f8f8",
      color: "#111",
      padding: "20px 5%",
      fontFamily: "Arial, sans-serif"
    }}>
      <header style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 0 25px"
      }}>
        <Link href="/" style={{
          fontSize: 29,
          fontWeight: 900,
          color: "#111",
          textDecoration: "none"
        }}>MAVEX®</Link>

        <Link href="/cart" style={{ color: "#111", fontSize: 12 }}>
          BACK TO BAG
        </Link>
        <Link href="/account" style={{ color: "#111", fontSize: 12 }}>MY ORDERS</Link>
      </header>

      <h1 style={{ fontSize: 32, marginBottom: 8 }}>
        CHECKOUT<span style={{ color: "#f890c8" }}>.</span>
      </h1>

      <p style={{ color: "#777", fontSize: 13, marginBottom: 25 }}>
        Complete your details to place your order.
      </p>

      <div style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, .7fr)",
        gap: 25,
        maxWidth: 1100,
        margin: "auto"
      }}>
        <section style={{
          background: "#fff",
          padding: 20,
          borderRadius: 8
        }}>
          <h2 style={{ fontSize: 19, marginBottom: 18 }}>
            01. CUSTOMER INFORMATION
          </h2>

          <label>Full name *</label>
          <input style={fieldStyle("name")} value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder="Your full name" />
          {fieldErrors.name && <small style={errorStyle}>{fieldErrors.name}</small>}

          <label style={{ display: "block", marginTop: 15 }}>
            Mobile number *
          </label>
          <input style={fieldStyle("phone")} type="tel" value={form.phone}
            onChange={(e) => updateField("phone", e.target.value)}
            placeholder="01XXXXXXXXX" />
          {fieldErrors.phone && <small style={errorStyle}>{fieldErrors.phone}</small>}

          <label style={{ display: "block", marginTop: 15 }}>
            Email address *
          </label>
          <input style={fieldStyle("email")} type="email" autoComplete="email" value={form.email}
            onChange={(e) => updateField("email", e.target.value)}
            placeholder="you@example.com" />
          {fieldErrors.email && <small style={errorStyle}>{fieldErrors.email}</small>}

          <label style={{ display: "block", marginTop: 15 }}>
            Additional phone (optional)
          </label>
          <input style={inputStyle} type="tel" value={form.phone2}
            onChange={(e) => updateField("phone2", e.target.value)}
            placeholder="Additional number" />

          <hr style={{ margin: "25px 0", border: 0, borderTop: "1px solid #eee" }} />

          <h2 style={{ fontSize: 19, marginBottom: 18 }}>
            02. DELIVERY ADDRESS
          </h2>

          <label>Country</label>
          <input style={{ ...inputStyle, background: "#f3f3f3" }}
            value="Egypt" readOnly />

          <label style={{ display: "block", marginTop: 15 }}>
            Governorate *
          </label>
          <select style={fieldStyle("governorate")} value={governorate}
            onChange={(e) => { setGovernorate(e.target.value); setFieldErrors(old => ({ ...old, governorate: "" })); }}>
            <option value="">Select governorate</option>
            {governorates.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
          {fieldErrors.governorate && <small style={errorStyle}>{fieldErrors.governorate}</small>}

          <label style={{ display: "block", marginTop: 15 }}>
            City / District / Markaz *
          </label>
          <input style={fieldStyle("city")} value={form.city}
            onChange={(e) => updateField("city", e.target.value)}
            placeholder="Enter city or district" />
          {fieldErrors.city && <small style={errorStyle}>{fieldErrors.city}</small>}

          <label style={{ display: "block", marginTop: 15 }}>
            Village / Area *
          </label>
          <input style={fieldStyle("village")} value={form.village}
            onChange={(e) => updateField("village", e.target.value)}
            placeholder="Enter village or area" />
          {fieldErrors.village && <small style={errorStyle}>{fieldErrors.village}</small>}

          <label style={{ display: "block", marginTop: 15 }}>
            Street / Address *
          </label>
          <input style={fieldStyle("street")} value={form.street}
            onChange={(e) => updateField("street", e.target.value)}
            placeholder="Street name and details" />
          {fieldErrors.street && <small style={errorStyle}>{fieldErrors.street}</small>}

          <label style={{ display: "block", marginTop: 15 }}>
            Building / Apartment
          </label>
          <input style={inputStyle} value={form.building}
            onChange={(e) => updateField("building", e.target.value)}
            placeholder="Building number, floor, apartment" />

          <label style={{ display: "block", marginTop: 15 }}>
            Additional notes
          </label>
          <textarea style={{ ...inputStyle, minHeight: 80 }}
            value={form.notes}
            onChange={(e) => updateField("notes", e.target.value)}
            placeholder="Landmark or delivery instructions" />

          <hr style={{ margin: "25px 0", border: 0, borderTop: "1px solid #eee" }} />

          <h2 style={{ fontSize: 19, marginBottom: 18 }}>
            03. PAYMENT METHOD
          </h2>

          {[
            { id: "vodafone", label: "Vodafone Cash" },
            { id: "instapay", label: "InstaPay" },
            { id: "cod", label: "Cash on Delivery" },
          ].map((method) => (
            <label key={method.id} style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              border: payment === method.id ? "2px solid #f890c8" : "1px solid #ddd",
              padding: 15,
              borderRadius: 6,
              marginBottom: 10,
              cursor: "pointer"
            }}>
              <input type="radio" name="payment"
                checked={payment === method.id}
                onChange={() => {
                  setPayment(method.id);
                  setMessage("");
                }} />
              <strong>{method.label}</strong>
            </label>
          ))}

          {payment !== "cod" && (
            <div style={{
              background: "#fff5fa",
              border: "1px solid #f890c8",
              padding: 16,
              borderRadius: 6,
              marginTop: 15
            }}>
              <h3 style={{ marginBottom: 12 }}>
                Transfer payment
              </h3>

              {payment === "vodafone" ? (
                <p style={{ lineHeight: 1.8 }}>
                  Vodafone Cash number:
                  <br />
                  <strong>{PAYMENT.vodafoneNumber}</strong>
                </p>
              ) : (
                <>
                  <p style={{ lineHeight: 1.8 }}>
                    Send the order payment to <strong>{PAYMENT.instaPayAddress}</strong> using InstaPay:
                  </p>
                  <a href={PAYMENT.instaPayLink} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 44, marginTop: 10, padding: "10px 16px", background: "#111", color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 700 }}>
                    OPEN INSTAPAY PAYMENT LINK
                  </a>
                </>
              )}

              <p style={{ fontSize: 12, margin: "12px 0" }}>
                Transfer the order total, then upload your transfer screenshot.
                Your order will remain pending until payment is verified.
              </p>

              <label style={{ display: "block", fontWeight: "bold", fontSize: 13 }}>
                Payment screenshot *
              </label>
              <input style={{ ...inputStyle, padding: 10 }}
                type="file" accept="image/jpeg,image/png,image/webp"
                onChange={(e) => handleProof(e.target.files?.[0])} />

              {readingProof && <small style={{ display: "block", marginTop: 6, color: "#555" }}>Reading screenshot…</small>}

              {proof && (
                <Image src={proof} alt="Payment proof" width={130} height={130} unoptimized
                  style={{ width: 130, height: "auto", marginTop: 12, borderRadius: 6 }} />
              )}
              {fieldErrors.proof && <small style={errorStyle}>{fieldErrors.proof}</small>}

              <label style={{ display: "block", marginTop: 15 }}>
                Transaction reference (optional)
              </label>
              <input style={inputStyle} value={transaction}
                onChange={(e) => setTransaction(e.target.value)}
                placeholder="Transaction number" />
            </div>
          )}

          <button onClick={submitOrder} disabled={savingOrder} style={{
            width: "100%",
            background: "#111",
            color: "#fff",
            padding: 18,
            border: 0,
            marginTop: 25,
            fontWeight: "bold",
            fontSize: 14,
            cursor: savingOrder ? "wait" : "pointer",
            opacity: savingOrder ? 0.65 : 1
          }}>
            {savingOrder ? "SAVING YOUR ORDER..." : "PLACE ORDER"}
          </button>

          {message && (
            <p style={{
              marginTop: 15,
              fontSize: 13,
              color: message.includes("successfully") ? "green" : "#c00",
              lineHeight: 1.6
            }}>
              {message}
            </p>
          )}
        </section>

        <aside style={{
          background: "#fff",
          padding: 20,
          borderRadius: 8,
          height: "fit-content"
        }}>
          <h2 style={{ fontSize: 19, marginBottom: 18 }}>
            YOUR ORDER
          </h2>

          {cart.map((item, index) => (
            <div key={index} style={{
              display: "flex",
              gap: 12,
              marginBottom: 16
            }}>
              {item.image ? (
                <Image src={item.image} alt={item.name} width={65} height={75} sizes="65px" quality={80}
                  style={{ width: 65, height: 75, objectFit: "cover" }} />
              ) : <div aria-hidden="true" style={{ width: 65, height: 75, background: "#f2f2f2" }} />}

              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: 12 }}>{item.name}</strong>
                <p style={{ fontSize: 11, color: "#777", marginTop: 5 }}>
                  {item.color || ""} / {item.size} / Qty: {item.quantity}
                </p>
                <p style={{ fontSize: 12, marginTop: 5 }}>
                  EGP {(item.price * item.quantity).toLocaleString("en-EG")}
                </p>
              </div>
            </div>
          ))}

          <hr style={{ border: 0, borderTop: "1px solid #eee", margin: "15px 0" }} />

          <p style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <span>Subtotal</span>
            <strong>EGP {subtotal.toLocaleString("en-EG")}</strong>
          </p>

          <p style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <span>Shipping</span>
            <strong>EGP 120</strong>
          </p>

          <hr style={{ border: 0, borderTop: "1px solid #eee", margin: "15px 0" }} />

          <h2 style={{ display: "flex", justifyContent: "space-between", fontSize: 17 }}>
            <span>Total</span>
            <span>EGP {total.toLocaleString("en-EG")}</span>
          </h2>
        </aside>
      </div>

      <footer style={{ textAlign: "center", padding: "40px 0 15px" }}>
        <strong style={{ fontSize: 22 }}>MAVEX®</strong>
        <p style={{ fontSize: 11, color: "#777", marginTop: 10 }}>
          STREET CULTURE. OWN YOUR STYLE.
        </p>
        <Link href="/returns" style={{ display: "inline-block", marginTop: 12, color: "#555", fontSize: 12 }}>RETURNS &amp; EXCHANGES</Link>
      </footer>

      <style jsx>{`
        @media (max-width: 700px) {
          main > div {
            display: flex !important;
            flex-direction: column !important;
          }
        }
      `}</style>
    </main>
  );
}
