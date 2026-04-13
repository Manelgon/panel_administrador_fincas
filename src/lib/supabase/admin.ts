import { createClient } from "@supabase/supabase-js";

/**
 * Supabase admin client with SERVICE_ROLE_KEY.
 * USE WITH CAUTION: This client bypasses RLS.
 * Never import this in client components.
 */
export const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    }
);

