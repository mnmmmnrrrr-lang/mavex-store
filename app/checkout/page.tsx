 
"use client";

import { useEffect, useState } from "react";

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
  instaPayAddress: "demo@instapay",
};

type Item = {
  productId?: string;
  name: string;
  price: number;
  size: string;
  color?: string;
  quantity: number;
  image: string;
};

export default function CheckoutPage() {
  const [cart, setCart] = useState<Item[]>([]);
  const [payment, setPayment] = useState("cod");
  const [governorate, setGovernorate] = useState("");
  const [proof, setProof] = useState("");
  const [transaction, setTransaction] = useState("");
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [savingOrder, setSavingOrder] = useState(false);
  const [recentOrderId, setRecentOrderId] = useState("");

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
    const saved = localStorage.getItem("mavex-cart");
    if (saved) {
      try {
        setCart(JSON.parse(saved));
      } catch {
        setCart([]);
      }
    }
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

    if (!file.type.startsWith("image/")) {
      setFieldErrors((old) => ({ ...old, proof: "Choose an image file for your payment screenshot." }));
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      setFieldErrors((old) => ({ ...old, proof: "The image must be smaller than 3 MB." }));
      return;
    }

    setFieldErrors((old) => ({ ...old, proof: "" }));
    const reader = new FileReader();
    reader.onload = () => setProof(String(reader.result));
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
    if (payment !== "cod" && !proof) nextErrors.proof = "Upload your payment transfer screenshot.";
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
      localStorage.removeItem("mavex-cart");
      localStorage.setItem("mavex-last-order-phone", form.phone);

      setCart([]);
      setRecentOrderId(result.id);
      setMessage("Your order was received successfully. Order: " + result.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save your order.");
    } finally {
      setSavingOrder(false);
    }
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
        <a href="/" style={{
          fontSize: 29,
          fontWeight: 900,
          color: "#111",
          textDecoration: "none"
        }}>MAVEX®</a>

        <a href="/cart" style={{ color: "#111", fontSize: 12 }}>
          BACK TO BAG
        </a>
        <a href="/account" style={{ color: "#111", fontSize: 12 }}>MY ORDERS</a>
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
                <p style={{ lineHeight: 1.8 }}>
                  InstaPay address:
                  <br />
                  <strong>{PAYMENT.instaPayAddress}</strong>
                </p>
              )}

              <p style={{ fontSize: 12, margin: "12px 0" }}>
                Transfer the order total, then upload your transfer screenshot.
                Your order will remain pending until payment is verified.
              </p>

              <label style={{ display: "block", fontWeight: "bold", fontSize: 13 }}>
                Payment screenshot *
              </label>
              <input style={{ ...inputStyle, padding: 10 }}
                type="file" accept="image/*"
                onChange={(e) => handleProof(e.target.files?.[0])} />

              {proof && (
                <img src={proof} alt="Payment proof"
                  style={{
                    width: 130,
                    marginTop: 12,
                    borderRadius: 6
                  }} />
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
          {recentOrderId && <p style={{ marginTop: 12, fontSize: 13 }}><a href="/account" style={{ color: "#5e2a49", fontWeight: 700 }}>Sign in to My Orders to track this order</a></p>}
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
              <img src={item.image} alt={item.name}
                style={{
                  width: 65,
                  height: 75,
                  objectFit: "cover"
                }} />

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
        <a href="/returns" style={{ display: "inline-block", marginTop: 12, color: "#555", fontSize: 12 }}>RETURNS &amp; EXCHANGES</a>
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
