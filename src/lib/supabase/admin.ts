import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client with SERVICE_ROLE_KEY
 * USE WITH CAUTION: This client bypasses RLS
 */
export const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);
