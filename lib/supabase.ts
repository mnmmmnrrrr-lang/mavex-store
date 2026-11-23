 
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// Only the publishable browser key belongs in client bundles. The secret key
// is read separately by server-only code in lib/supabase-admin.ts.
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "missing-publishable-key";

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);
