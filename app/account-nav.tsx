"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabaseBrowserSession, supabaseBrowser } from "@/lib/supabase-browser";

type NavUser = { email: string; label: string };

function getNavUser(user: { email?: string; user_metadata?: Record<string, unknown> } | null): NavUser | null {
  if (!user?.email) return null;
  const metadata = user.user_metadata || {};
  const label = [metadata.full_name, metadata.name, metadata.given_name]
    .find((value) => typeof value === "string" && value.trim()) as string | undefined;
  return { email: user.email, label: label?.trim() || user.email };
}

export default function AccountNav() {
  const [user, setUser] = useState<NavUser | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let active = true;

    void getSupabaseBrowserSession().then((session) => {
      if (active) setUser(getNavUser(session?.user || null));
    }).catch(() => {
      if (active) setUser(null);
    });

    const { data: { subscription } } = supabaseBrowser.auth.onAuthStateChange((_event, session) => {
      if (active) setUser(getNavUser(session?.user || null));
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    setSigningOut(true);
    try {
      const { error } = await supabaseBrowser.auth.signOut();
      if (!error) setUser(null);
    } catch {
      // Keep the current navigation state if sign-out could not complete.
    } finally {
      setSigningOut(false);
    }
  }

  if (!user) return <Link href="/account">MY ORDERS</Link>;

  return (
    <span className="navbar-account-user">
      <Link href="/account" title={`My Orders · ${user.email}`} aria-label={`My orders for ${user.email}`}>
        {user.label}
      </Link>
      <button type="button" onClick={() => void signOut()} disabled={signingOut}>
        {signingOut ? "..." : "LOG OUT"}
      </button>
    </span>
  );
}
