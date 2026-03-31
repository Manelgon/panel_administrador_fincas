import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
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

    // Check if requester is admin using Service Role (Bypasses RLS)
    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('rol')
        .eq('user_id', user.id)
        .single();

    if (!profile || profile.rol !== 'admin') {
        return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    try {
        const { userId } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        // Prevent admin from deleting themselves
        if (userId === user.id) {
            return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 });
        }

        // 3. Delete User from Supabase Auth (Cascades to Profiles)
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (deleteError) {
            return NextResponse.json({ error: deleteError.message }, { status: 400 });
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
