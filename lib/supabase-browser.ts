"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseKey, supabaseUrl } from "@/lib/supabase-config";

export const supabaseBrowser = createBrowserClient(supabaseUrl, supabaseKey);

let legacySessionMigration: Promise<void> | null = null;

export async function getSupabaseBrowserSession() {
  const { data: initial } = await supabaseBrowser.auth.getSession();
  if (initial.session || typeof window === "undefined") return initial.session;

  if (!legacySessionMigration) {
    legacySessionMigration = (async () => {
      try {
        const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
        const stored = window.localStorage.getItem(`sb-${projectRef}-auth-token`);
        if (!stored) return;

        const legacy = JSON.parse(stored) as { access_token?: string; refresh_token?: string };
        if (!legacy.access_token || !legacy.refresh_token) return;

        const { error } = await supabaseBrowser.auth.setSession({
          access_token: legacy.access_token,
          refresh_token: legacy.refresh_token,
        });
        if (!error) window.localStorage.removeItem(`sb-${projectRef}-auth-token`);
      } catch {
        // Leave an unreadable legacy session untouched; the customer can sign in again.
      }
    })();
  }

  await legacySessionMigration;
  const { data } = await supabaseBrowser.auth.getSession();
  return data.session;
}
