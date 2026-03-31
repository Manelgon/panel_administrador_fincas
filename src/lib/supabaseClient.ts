import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

// Create a client that uses browser cookies for session management
export const supabase = createBrowserClient(supabaseUrl, supabaseKey);

// Helper hook if needed later
export const useSupabase = () => {
    return { supabase };
};
