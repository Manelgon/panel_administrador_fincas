import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // 1. Verify Authentication & Admin Role
    const cookieStore = await cookies();

    // Check for Authorization header first (Client-side fetch)
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    // Initialize Anon client to validate token
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
                set(name: string, value: string, options: CookieOptions) {
                    cookieStore.set({ name, value, ...options });
                },
                remove(name: string, options: CookieOptions) {
                    cookieStore.set({ name, value: '', ...options });
                },
            },
        }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(token || undefined);

    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized: No session' }, { status: 401 });
    }

    // 2. Initialize Admin Client
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
        return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    );

    // Check if user is admin using Service Role (Bypasses RLS)
    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('rol')
        .eq('user_id', user.id)
        .single();

    if (!profile || profile.rol !== 'admin') {
        return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // 3. Fetch User from Auth (target user)
    const { data: userData, error: fetchError } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (fetchError || !userData.user) {
        return NextResponse.json({ error: 'User not found in Auth' }, { status: 404 });
    }

    return NextResponse.json({
        user: {
            id: userData.user.id,
            email: userData.user.email,
            user_metadata: userData.user.user_metadata,
            banned_until: userData.user.banned_until,
        }
    });
}
