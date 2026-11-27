"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

type ReturnMessage = { id: string; sender: "customer" | "admin"; text: string; date: string };
type ReturnConversation = { id: string; orderId: string; customerName: string; issue: string; evidenceUrl?: string; messages: ReturnMessage[]; date: string; status: string };
const inputStyle = { width: "100%", marginTop: 7, padding: 13, border: "1px solid #ddd", borderRadius: 7, font: "inherit", color: "#111", background: "#fff" };
const emailIsValid = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
const activeReturnStorageKey = "mavex-active-return-chat";

function rememberReturn(id: string, email: string) {
  try { window.localStorage.setItem(activeReturnStorageKey, JSON.stringify({ id, email })); }
  catch { /* The conversation remains available until this page is closed. */ }
}

function forgetReturn() {
  try { window.localStorage.removeItem(activeReturnStorageKey); }
  catch { /* Ignore storage restrictions; clear the in-memory session below. */ }
}

export default function ReturnsPage() {
  const [orderId, setOrderId] = useState("");
  const [email, setEmail] = useState("");
  const [issue, setIssue] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [reference, setReference] = useState("");
  const [trackEmail, setTrackEmail] = useState("");
  const [activeId, setActiveId] = useState("");
  const [activeEmail, setActiveEmail] = useState("");
  const [conversation, setConversation] = useState<ReturnConversation | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [conversationError, setConversationError] = useState("");
  const [chatText, setChatText] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);

  async function refreshConversation(id: string, customerEmail: string) {
    const response = await fetch(`/api/returns/${encodeURIComponent(id)}?email=${encodeURIComponent(customerEmail)}`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not load this request.");
    setConversation(result as ReturnConversation);
    setConversationError("");
    return result as ReturnConversation;
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(activeReturnStorageKey);
        if (saved) {
          const parsed = JSON.parse(saved) as { id?: unknown; email?: unknown };
          if (typeof parsed.id === "string" && parsed.id.startsWith("RET-") && typeof parsed.email === "string" && emailIsValid(parsed.email)) {
            setReference(parsed.id);
            setTrackEmail(parsed.email);
            setActiveId(parsed.id);
            setActiveEmail(parsed.email);
          } else {
            forgetReturn();
          }
        }
      } catch {
        forgetReturn();
      } finally {
        setSessionChecked(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!activeId || !activeEmail) return;
    let stopped = false;
    const refresh = async () => {
      try {
        const response = await fetch(`/api/returns/${encodeURIComponent(activeId)}?email=${encodeURIComponent(activeEmail)}`, { cache: "no-store" });
        const result = await response.json();
        if (response.ok && !stopped) {
          setConversation(result as ReturnConversation);
          setConversationError("");
        } else if (!stopped) {
          setConversationError(result.error || "Could not reopen this conversation. You can try again or switch requests.");
        }
      } catch { if (!stopped) setConversationError("Connection interrupted. Reconnecting to your conversation..."); }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 8000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [activeId, activeEmail]);

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice("");
    try {
      const form = new FormData();
      form.set("orderId", orderId); form.set("email", email); form.set("issue", issue);
      if (photo) form.set("photo", photo);
      const response = await fetch("/api/returns", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not submit your request.");
      const normalizedEmail = email.trim().toLowerCase();
      rememberReturn(result.id, normalizedEmail);
      setReference(result.id); setTrackEmail(normalizedEmail); setActiveId(result.id); setActiveEmail(normalizedEmail);
      setConversationError("");
      setIssue(""); setPhoto(null);
      const photoInput = document.querySelector<HTMLInputElement>("#return-photo");
      if (photoInput) photoInput.value = "";
      setNotice(`Request ${result.id} was submitted. You can continue the conversation below.`);
      await refreshConversation(result.id, normalizedEmail);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not submit your request."); }
    finally { setBusy(false); }
  }

  async function trackRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice("");
    const normalizedEmail = trackEmail.trim().toLowerCase();
    setActiveId(""); setActiveEmail("");
    try {
      const result = await refreshConversation(reference.trim().toUpperCase(), normalizedEmail);
      rememberReturn(result.id, normalizedEmail);
      setActiveId(result.id); setActiveEmail(normalizedEmail);
      setConversationError("");
    } catch (error) { setConversation(null); setNotice(error instanceof Error ? error.message : "Could not find this request."); }
    finally { setBusy(false); }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!chatText.trim() || !activeId || !activeEmail) return;
    setChatBusy(true); setNotice("");
    try {
      const response = await fetch(`/api/returns/${encodeURIComponent(activeId)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: activeEmail, text: chatText }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not send your message.");
      setChatText(""); await refreshConversation(activeId, activeEmail);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not send your message."); }
    finally { setChatBusy(false); }
  }

  function switchRequest() {
    forgetReturn();
    setActiveId("");
    setActiveEmail("");
    setConversation(null);
    setConversationError("");
    setNotice("");
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f6f5f4", padding: "24px 5% 60px", color: "#171717", fontFamily: "Arial,sans-serif" }}>
      <header style={{ maxWidth: 760, margin: "0 auto 30px", display: "flex", justifyContent: "space-between" }}>
        <Link href="/" style={{ color: "#17213c", textDecoration: "none", fontSize: 25, fontWeight: 900 }}>MAVEX®</Link>
        <Link href="/" style={{ color: "#555" }}>Back to store</Link>
      </header>
      <div style={{ maxWidth: 760, margin: "auto", display: "grid", gap: 20 }}>
        {!sessionChecked && <section style={{ background: "#fff", padding: 24, borderRadius: 12, color: "#666" }}>Checking for your open conversation...</section>}
        {sessionChecked && !activeId && <section style={{ background: "#fff", padding: "clamp(22px,5vw,40px)", borderRadius: 12, boxShadow: "0 16px 50px #17213c12" }}>
          <p style={{ color: "#a54d7e", letterSpacing: 1, fontWeight: 800, fontSize: 12 }}>CUSTOMER CARE</p>
          <h1 style={{ fontSize: 30, margin: "8px 0" }}>Returns &amp; Exchanges</h1>
          <p style={{ color: "#666", lineHeight: 1.8, marginBottom: 22 }}>Enter your order details, explain the issue, and attach a clear photo. The MAVEX team will review it and reply in your request chat. Return requests must match an order email.</p>
          <form onSubmit={submitRequest} style={{ display: "grid", gap: 14 }}>
            <label>Order number<input required value={orderId} onChange={(event) => setOrderId(event.target.value)} placeholder="MVX-..." style={inputStyle} /></label>
            <label>Email address used for the order<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" style={inputStyle} /></label>
            <label>Describe the issue<textarea required minLength={10} maxLength={1200} rows={5} value={issue} onChange={(event) => setIssue(event.target.value)} placeholder="Describe the problem with the item..." style={{ ...inputStyle, resize: "vertical" }} /></label>
            <label>Photo of the issue (JPG, PNG, or WebP; up to 3 MB)<input id="return-photo" required type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setPhoto(event.target.files?.[0] || null)} style={{ ...inputStyle, padding: 10 }} /></label>
            {photo && <p style={{ color: "#666", fontSize: 12 }}>Selected: {photo.name} · {(photo.size / (1024 * 1024)).toFixed(1)} MB</p>}
            <button disabled={busy} style={{ width: "100%", border: 0, borderRadius: 7, background: "#17213c", color: "white", padding: 15, marginTop: 4, fontWeight: 800, cursor: busy ? "wait" : "pointer" }}>{busy ? "SUBMITTING..." : "SUBMIT RETURN REQUEST"}</button>
          </form>
        </section>}

        {sessionChecked && !activeId && <section style={{ background: "#fff", padding: "clamp(22px,5vw,34px)", borderRadius: 12, boxShadow: "0 16px 50px #17213c12" }}>
          <h2 style={{ fontSize: 21, marginBottom: 8 }}>Already submitted a request?</h2>
          <p style={{ color: "#666", lineHeight: 1.7, marginBottom: 16 }}>Enter the reference number and the same email address to reopen your conversation.</p>
          <form onSubmit={trackRequest} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12, alignItems: "end" }}>
            <label>Request reference<input required value={reference} onChange={(event) => setReference(event.target.value)} placeholder="RET-..." style={inputStyle} /></label>
            <label>Order email<input required type="email" value={trackEmail} onChange={(event) => setTrackEmail(event.target.value)} placeholder="you@example.com" style={inputStyle} /></label>
            <button disabled={busy} style={{ border: "1px solid #17213c", borderRadius: 7, background: "#fff", color: "#17213c", padding: 14, fontWeight: 800, cursor: busy ? "wait" : "pointer" }}>OPEN CONVERSATION</button>
          </form>
        </section>}

        {sessionChecked && activeId && !conversation && <section style={{ background: "#fff", padding: 24, borderRadius: 12 }}><p style={{ color: "#a54d7e", fontWeight: 800 }}>REOPENING YOUR CONVERSATION</p><p style={{ marginTop: 8, color: "#666" }}>{conversationError || "Loading your messages..."}</p>{conversationError && <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}><button type="button" onClick={() => void refreshConversation(activeId, activeEmail).catch(error => setConversationError(error instanceof Error ? error.message : "Could not reopen this conversation."))} style={{ border: 0, borderRadius: 6, background: "#17213c", color: "#fff", padding: "10px 14px", fontWeight: 700, cursor: "pointer" }}>TRY AGAIN</button><button type="button" onClick={switchRequest} style={{ border: "1px solid #ddd", borderRadius: 6, background: "#fff", padding: "10px 14px", cursor: "pointer" }}>OPEN ANOTHER REQUEST</button></div>}</section>}

        {conversation && activeId && emailIsValid(activeEmail) && (
          <section style={{ background: "#fff", padding: "clamp(20px,4vw,30px)", borderRadius: 12, boxShadow: "0 16px 50px #17213c12" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div><p style={{ color: "#a54d7e", fontSize: 11, fontWeight: 800, letterSpacing: 1 }}>RETURN CONVERSATION</p><h2 style={{ fontSize: 20, marginTop: 6 }}>{conversation.id} · Order {conversation.orderId}</h2></div>
              <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}><span style={{ background: "#fff1f8", padding: "7px 11px", fontSize: 12, fontWeight: 800 }}>{conversation.status}</span><button type="button" onClick={switchRequest} style={{ border: "1px solid #ddd", background: "#fff", padding: "7px 10px", cursor: "pointer", fontSize: 11 }}>OPEN ANOTHER REQUEST</button></div>
            </div>
            <p style={{ marginTop: 8, color: "#777", fontSize: 11 }}>This conversation will reopen automatically on this device.</p>
            {conversation.evidenceUrl && <a href={conversation.evidenceUrl} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 18 }}><Image src={conversation.evidenceUrl} alt="Photo attached to the return request" width={360} height={270} unoptimized style={{ width: "min(100%,360px)", height: "auto", maxHeight: 300, objectFit: "contain", border: "1px solid #eee" }} /></a>}
            <div aria-live="polite" style={{ display: "grid", gap: 10, maxHeight: 420, overflowY: "auto", margin: "18px 0", padding: 14, background: "#f7f7f8", border: "1px solid #eee" }}>
              {(conversation.messages || []).map((message) => <article key={message.id} style={{ justifySelf: message.sender === "customer" ? "end" : "start", width: "min(88%,520px)", background: message.sender === "customer" ? "#fff0f8" : "#fff", border: "1px solid #e9e4e7", padding: 12 }}><strong style={{ fontSize: 11 }}>{message.sender === "customer" ? "YOU" : "MAVEX SUPPORT"}</strong><p style={{ margin: "6px 0", lineHeight: 1.65, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{message.text}</p><time style={{ color: "#777", fontSize: 10 }}>{new Date(message.date).toLocaleString("en-EG")}</time></article>)}
            </div>
            <form onSubmit={sendMessage} style={{ display: "grid", gap: 10 }}><label>Reply to MAVEX<textarea required maxLength={1200} rows={3} value={chatText} onChange={(event) => setChatText(event.target.value)} placeholder="Write your message..." style={{ ...inputStyle, resize: "vertical" }} /></label><button disabled={chatBusy} style={{ justifySelf: "end", border: 0, borderRadius: 7, background: "#17213c", color: "#fff", padding: "12px 20px", fontWeight: 800, cursor: chatBusy ? "wait" : "pointer" }}>{chatBusy ? "SENDING..." : "SEND MESSAGE"}</button></form>
          </section>
        )}
        {notice && <p role="status" style={{ padding: 14, background: "#fff", color: /submitted/i.test(notice) ? "#16804a" : "#a22", lineHeight: 1.6 }}>{notice}</p>}
      </div>
    </main>
  );
}
