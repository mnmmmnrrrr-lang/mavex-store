"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserSession, supabaseBrowser } from "@/lib/supabase-browser";

type CustomerOrder = {
  id: string; status: string; date: string; total: number; trackingNumber: string;
  items: { name: string; size: string; color?: string; quantity: number; image?: string }[];
};

export default function AccountPage() {
  const [email, setEmail] = useState("");
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [displayName, setDisplayName] = useState("");

  const loadOrders = useCallback(async (token: string) => {
    const response = await fetch("/api/customer/orders", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not load your orders.");
    setOrders(result.orders as CustomerOrder[]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (new URLSearchParams(window.location.search).get("authError") === "google") {
      setMessage("Google sign-in could not be completed. Please try again.");
    }
    void getSupabaseBrowserSession().then(async (session) => {
      if (!session) return;
      try {
        await loadOrders(session.access_token);
        if (!cancelled) {
          setEmail(session.user.email || "");
          const metadata = session.user.user_metadata || {};
          setDisplayName(String(metadata.full_name || metadata.name || ""));
          setSignedIn(true);
        }
      } catch { await supabaseBrowser.auth.signOut(); }
    });
    return () => { cancelled = true; };
  }, [loadOrders]);

  async function signInWithGoogle() {
    setBusy(true);
    setMessage("");
    try {
      const { error } = await supabaseBrowser.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start Google sign-in.");
      setBusy(false);
    }
  }

  async function signOut() {
    await supabaseBrowser.auth.signOut(); setSignedIn(false); setDisplayName(""); setEmail(""); setOrders([]); setMessage("");
  }

  async function cancelOrder(order: CustomerOrder) {
    if (!window.confirm(`Cancel order ${order.id}?`)) return;
    setBusy(true);
    setMessage("");
    try {
      const session = await getSupabaseBrowserSession();
      const token = session?.access_token;
      if (!token) throw new Error("Please sign in again to cancel your order.");
      const response = await fetch(`/api/customer/orders/${encodeURIComponent(order.id)}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not cancel this order.");
      setOrders((current) => current.map((item) => item.id === order.id ? { ...item, status: result.status } : item));
      setMessage(`Order ${order.id} was cancelled.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not cancel this order.");
    } finally {
      setBusy(false);
    }
  }

  const statusSteps = ["Pending confirmation", "Confirmed", "Processing", "Shipped", "Delivered"];

  return (
    <main style={{ minHeight: "100vh", background: "#f6f6f6", color: "#111", padding: "24px 5% 60px", fontFamily: "Arial, sans-serif" }}>
      <header style={{ maxWidth: 980, margin: "0 auto 30px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link href="/" style={{ color: "#17213c", textDecoration: "none", fontSize: 26, fontWeight: 900 }}>MAVEX®</Link>
        <Link href="/" style={{ color: "#333", fontSize: 13 }}>BACK TO STORE</Link>
      </header>
      <section style={{ maxWidth: 980, margin: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 12, flexWrap: "wrap", marginBottom: 22 }}>
          <div><p style={{ color: "#a54d7e", fontSize: 11, fontWeight: 800, letterSpacing: 2 }}>CUSTOMER ACCOUNT</p><h1 style={{ marginTop: 7, fontSize: 32 }}>My Orders</h1><p style={{ color: "#666", marginTop: 7 }}>Sign in with Google to see your saved orders and delivery status.</p></div>
          {signedIn && <div style={{ display: "grid", justifyItems: "end", gap: 6 }}><span style={{ color: "#666", fontSize: 12 }}>{displayName || email}</span><button type="button" onClick={signOut} style={{ border: "1px solid #ddd", padding: "10px 14px", background: "white", borderRadius: 6, cursor: "pointer" }}>SIGN OUT</button></div>}
        </div>

        {!signedIn && <div style={{ maxWidth: 520, background: "white", padding: 24, borderRadius: 12, boxShadow: "0 8px 30px #0000000d" }}>
            <button type="button" disabled={busy} onClick={() => void signInWithGoogle()} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 11, width: "100%", minHeight: 48, border: "1px solid #d7d7d7", borderRadius: 7, background: "#fff", color: "#222", fontSize: 14, fontWeight: 700, cursor: busy ? "wait" : "pointer" }}>
              <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" transform="translate(0 5)"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.91c-.58 2.96-2.26 5.48-4.76 7.18l7.73 6C44.39 38.03 46.98 31.91 46.98 24.55Z" transform="translate(0 0) scale(.9) translate(3 3)"/><path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.52 2.56 10.78l7.97-6.19Z" transform="translate(2 0) scale(.9) translate(2.5 3)"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.8l-7.73-6c-2.14 1.45-4.88 2.3-8.17 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" transform="translate(0 -3) scale(.9) translate(2.6 4.8)"/></svg>
              {busy ? "CONNECTING TO GOOGLE..." : "Continue with Google"}
            </button>
            {message && <p role="status" style={{ color: "#b42318", marginTop: 12, lineHeight: 1.6 }}>{message}</p>}
        </div>}

        {signedIn && message && <p role="status" style={{ margin: "0 0 16px", color: /cancelled/i.test(message) ? "#16804a" : "#b42318", lineHeight: 1.6 }}>{message}</p>}

        {signedIn && orders.length === 0 && <div style={{ background: "white", padding: 28, borderRadius: 12 }}><h2>No orders found for this email address.</h2><p style={{ color: "#666", marginTop: 8 }}>Use the same email address you entered at checkout. New orders will appear here after checkout.</p><Link href="/#shop" className="add-button" style={{ display: "inline-block", marginTop: 18, textDecoration: "none" }}>SHOP THE COLLECTION</Link></div>}

        {signedIn && orders.length > 0 && <div style={{ display: "grid", gap: 16 }}>{orders.map(order => {
          const currentStep = order.status === "Awaiting payment review" ? 0 : statusSteps.indexOf(order.status);
          return <article key={order.id} style={{ background: "white", padding: 22, borderRadius: 12, boxShadow: "0 8px 30px #0000000d" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><div><p style={{ color: "#777", fontSize: 12 }}>ORDER {order.id}</p><h2 style={{ marginTop: 5, fontSize: 20 }}>{order.status}</h2><p style={{ color: "#777", marginTop: 5, fontSize: 12 }}>{new Date(order.date).toLocaleString("en-EG")}</p></div><strong>EGP {order.total.toLocaleString("en-EG")}</strong></div>
            {!/cancelled/i.test(order.status) && <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 5, margin: "22px 0" }}>{statusSteps.map((step, index) => { const active = index <= currentStep && currentStep >= 0; return <div key={step} style={{ textAlign: "center", color: active ? "#17213c" : "#aaa", fontSize: 10 }}><div style={{ height: 4, background: active ? "#f890c8" : "#e7e7e7", borderRadius: 4, marginBottom: 7 }} />{step}</div>; })}</div>}
            {order.trackingNumber && <p style={{ padding: 12, background: "#f8f3f6", borderRadius: 7, marginBottom: 14 }}>Courier tracking number: <strong>{order.trackingNumber}</strong></p>}
            <div style={{ borderTop: "1px solid #eee", paddingTop: 12 }}>{order.items.map((item, index) => <p key={`${order.id}-${index}`} style={{ padding: 3, fontSize: 13 }}>{item.name} · {item.color} / {item.size} × {item.quantity}</p>)}</div>
            {!/shipped|delivered|cancelled/i.test(order.status) && <button type="button" disabled={busy} onClick={() => void cancelOrder(order)} style={{ marginTop: 16, border: "1px solid #efcaca", borderRadius: 6, background: "#fff", color: "#a22", padding: "11px 15px", fontWeight: 700, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1 }}>CANCEL ORDER</button>}
          </article>;
        })}</div>}
      </section>
    </main>
  );
}
