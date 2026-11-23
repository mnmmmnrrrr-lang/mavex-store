"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type CustomerOrder = {
  id: string; status: string; date: string; total: number; trackingNumber: string;
  items: { name: string; size: string; color?: string; quantity: number; image?: string }[];
};

export default function AccountPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [signedIn, setSignedIn] = useState(false);

  const loadOrders = useCallback(async (token: string) => {
    const response = await fetch("/api/customer/orders", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not load your orders.");
    setOrders(result.orders as CustomerOrder[]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const previousEmail = localStorage.getItem("mavex-last-order-email");
    if (previousEmail) setEmail(previousEmail);
    supabase.auth.getSession().then(async ({ data }) => {
      const session = data.session;
      if (!session) return;
      try {
        await loadOrders(session.access_token);
        if (!cancelled) { setEmail(session.user.email || ""); setSignedIn(true); }
      } catch { await supabase.auth.signOut(); }
    });
    return () => { cancelled = true; };
  }, [loadOrders]);

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("");
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) { setMessage("Enter a valid email address."); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email: normalizedEmail, options: { shouldCreateUser: true } });
      if (error) throw error;
      setEmail(normalizedEmail); setCodeSent(true); setMessage("We sent a verification code to your email.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not send the verification code."); }
    finally { setBusy(false); }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const { data, error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: "email" });
      if (error) throw error;
      if (!data.session) throw new Error("The code was accepted, but no session was created. Try again.");
      await loadOrders(data.session.access_token); setSignedIn(true); setMessage("");
    } catch (error) { setMessage(error instanceof Error ? error.message : "That code could not be verified."); }
    finally { setBusy(false); }
  }

  async function signOut() {
    await supabase.auth.signOut(); setSignedIn(false); setOrders([]); setCodeSent(false); setCode(""); setMessage("");
  }

  const inputStyle = { width: "100%", padding: 13, marginTop: 7, border: "1px solid #ddd", borderRadius: 7, color: "#111", background: "#fff", fontSize: 15 };
  const statusSteps = ["Pending confirmation", "Confirmed", "Processing", "Shipped", "Delivered"];

  return (
    <main style={{ minHeight: "100vh", background: "#f6f6f6", color: "#111", padding: "24px 5% 60px", fontFamily: "Arial, sans-serif" }}>
      <header style={{ maxWidth: 980, margin: "0 auto 30px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link href="/" style={{ color: "#17213c", textDecoration: "none", fontSize: 26, fontWeight: 900 }}>MAVEX®</Link>
        <Link href="/" style={{ color: "#333", fontSize: 13 }}>BACK TO STORE</Link>
      </header>
      <section style={{ maxWidth: 980, margin: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 12, flexWrap: "wrap", marginBottom: 22 }}>
          <div><p style={{ color: "#a54d7e", fontSize: 11, fontWeight: 800, letterSpacing: 2 }}>CUSTOMER ACCOUNT</p><h1 style={{ marginTop: 7, fontSize: 32 }}>My Orders</h1><p style={{ color: "#666", marginTop: 7 }}>Sign in with the email address you used at checkout to see saved orders and delivery status.</p></div>
          {signedIn && <button type="button" onClick={signOut} style={{ border: "1px solid #ddd", padding: "10px 14px", background: "white", borderRadius: 6, cursor: "pointer" }}>SIGN OUT</button>}
        </div>

        {!signedIn && <form onSubmit={codeSent ? verifyCode : requestCode} style={{ maxWidth: 520, background: "white", padding: 24, borderRadius: 12, boxShadow: "0 8px 30px #0000000d" }}>
          {!codeSent ? <><label htmlFor="account-email">Email address</label><input id="account-email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle} /><button disabled={busy} className="add-button" style={{ marginTop: 15, width: "100%" }}>{busy ? "SENDING CODE..." : "SEND SIGN-IN CODE"}</button></> : <><label htmlFor="account-code">Verification code</label><input id="account-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={e => setCode(e.target.value)} placeholder="Enter the email code" style={inputStyle} /><button disabled={busy} className="add-button" style={{ marginTop: 15, width: "100%" }}>{busy ? "VERIFYING..." : "VERIFY AND VIEW ORDERS"}</button><button type="button" onClick={() => { setCodeSent(false); setCode(""); setMessage(""); }} style={{ marginTop: 12, border: 0, background: "transparent", textDecoration: "underline", cursor: "pointer" }}>Change email address</button></>}
          {message && <p role="status" style={{ color: message.startsWith("We sent") ? "#16804a" : "#b42318", marginTop: 12, lineHeight: 1.6 }}>{message}</p>}
        </form>}

        {signedIn && orders.length === 0 && <div style={{ background: "white", padding: 28, borderRadius: 12 }}><h2>No orders found for this email address.</h2><p style={{ color: "#666", marginTop: 8 }}>Use the same email address you entered at checkout. New orders will appear here after checkout.</p><Link href="/#shop" className="add-button" style={{ display: "inline-block", marginTop: 18, textDecoration: "none" }}>SHOP THE COLLECTION</Link></div>}

        {signedIn && orders.length > 0 && <div style={{ display: "grid", gap: 16 }}>{orders.map(order => {
          const currentStep = order.status === "Awaiting payment review" ? 0 : statusSteps.indexOf(order.status);
          return <article key={order.id} style={{ background: "white", padding: 22, borderRadius: 12, boxShadow: "0 8px 30px #0000000d" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><div><p style={{ color: "#777", fontSize: 12 }}>ORDER {order.id}</p><h2 style={{ marginTop: 5, fontSize: 20 }}>{order.status}</h2><p style={{ color: "#777", marginTop: 5, fontSize: 12 }}>{new Date(order.date).toLocaleString("en-EG")}</p></div><strong>EGP {order.total.toLocaleString("en-EG")}</strong></div>
            {!/cancelled/i.test(order.status) && <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 5, margin: "22px 0" }}>{statusSteps.map((step, index) => { const active = index <= currentStep && currentStep >= 0; return <div key={step} style={{ textAlign: "center", color: active ? "#17213c" : "#aaa", fontSize: 10 }}><div style={{ height: 4, background: active ? "#f890c8" : "#e7e7e7", borderRadius: 4, marginBottom: 7 }} />{step}</div>; })}</div>}
            {order.trackingNumber && <p style={{ padding: 12, background: "#f8f3f6", borderRadius: 7, marginBottom: 14 }}>Courier tracking number: <strong>{order.trackingNumber}</strong></p>}
            <div style={{ borderTop: "1px solid #eee", paddingTop: 12 }}>{order.items.map((item, index) => <p key={`${order.id}-${index}`} style={{ padding: 3, fontSize: 13 }}>{item.name} · {item.color} / {item.size} × {item.quantity}</p>)}</div>
          </article>;
        })}</div>}
      </section>
    </main>
  );
}
