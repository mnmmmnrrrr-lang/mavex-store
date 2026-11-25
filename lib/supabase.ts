 
import { createClient } from "@supabase/supabase-js";

const configuredSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseUrl = configuredSupabaseUrl || "https://placeholder.supabase.co";
// Only the publishable browser key belongs in client bundles. The secret key
// is read separately by server-only code in lib/supabase-admin.ts.
const configuredSupabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const supabaseKey = configuredSupabaseKey || "missing-publishable-key";

export function hasSupabasePublic() {
  return Boolean(configuredSupabaseUrl && configuredSupabaseKey);
}

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);
