 
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

  const [form, setForm] = useState({
    name: "",
    phone: "",
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
  }

  function handleProof(file?: File) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage("Please upload an image.");
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      setMessage("Image must be smaller than 3 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setProof(String(reader.result));
    reader.readAsDataURL(file);
  }

  function submitOrder() {
    if (cart.length === 0) {
      setMessage("Your shopping bag is empty.");
      return;
    }

    if (
      !form.name.trim() ||
      !form.phone.trim() ||
      !governorate ||
      !form.city.trim() ||
      !form.village.trim() ||
      !form.street.trim()
    ) {
      setMessage("Please complete all required information.");
      return;
    }

    if (!/^01[0125][0-9]{8}$/.test(form.phone)) {
      setMessage("Please enter a valid Egyptian mobile number.");
      return;
    }

    if (payment !== "cod" && !proof) {
      setMessage("Please upload your payment transfer screenshot.");
      return;
    }

    const order = {
      id: "MAVEX-" + Date.now(),
      customer: form,
      governorate,
      items: cart,
      subtotal,
      shipping,
      total,
      payment,
      transaction,
      proof,
      status: payment === "cod" ? "Pending confirmation" : "Awaiting payment review",
      date: new Date().toISOString(),
    };

    try {
      const oldOrders = JSON.parse(
        localStorage.getItem("mavex-orders") || "[]"
      );

      oldOrders.push(order);

      localStorage.setItem("mavex-orders", JSON.stringify(oldOrders));
      localStorage.removeItem("mavex-cart");

      setCart([]);
      setMessage("Your demo order was saved successfully. Order: " + order.id);
    } catch {
      setMessage("Storage is full. Please use a smaller payment image.");
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
          <input style={inputStyle} value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder="Your full name" />

          <label style={{ display: "block", marginTop: 15 }}>
            Mobile number *
          </label>
          <input style={inputStyle} type="tel" value={form.phone}
            onChange={(e) => updateField("phone", e.target.value)}
            placeholder="01XXXXXXXXX" />

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
          <select style={inputStyle} value={governorate}
            onChange={(e) => setGovernorate(e.target.value)}>
            <option value="">Select governorate</option>
            {governorates.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>

          <label style={{ display: "block", marginTop: 15 }}>
            City / District / Markaz *
          </label>
          <input style={inputStyle} value={form.city}
            onChange={(e) => updateField("city", e.target.value)}
            placeholder="Enter city or district" />

          <label style={{ display: "block", marginTop: 15 }}>
            Village / Area *
          </label>
          <input style={inputStyle} value={form.village}
            onChange={(e) => updateField("village", e.target.value)}
            placeholder="Enter village or area" />

          <label style={{ display: "block", marginTop: 15 }}>
            Street / Address *
          </label>
          <input style={inputStyle} value={form.street}
            onChange={(e) => updateField("street", e.target.value)}
            placeholder="Street name and details" />

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

              <label style={{ display: "block", marginTop: 15 }}>
                Transaction reference (optional)
              </label>
              <input style={inputStyle} value={transaction}
                onChange={(e) => setTransaction(e.target.value)}
                placeholder="Transaction number" />
            </div>
          )}

          <button onClick={submitOrder} style={{
            width: "100%",
            background: "#111",
            color: "#fff",
            padding: 18,
            border: 0,
            marginTop: 25,
            fontWeight: "bold",
            fontSize: 14,
            cursor: "pointer"
          }}>
            PLACE ORDER
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
