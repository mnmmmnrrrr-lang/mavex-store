 
import { createClient } from "@supabase/supabase-js";
import { hasSupabasePublic, supabaseKey, supabaseUrl } from "@/lib/supabase-config";

// Only the publishable browser key belongs in client bundles. The secret key
// is read separately by server-only code in lib/supabase-admin.ts.
export { hasSupabasePublic };

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);
