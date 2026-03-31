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

    // Check if user is admin using Service Role (Bypasses RLS)
    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('rol')
        .eq('user_id', user.id)
        .single();

    if (!profile || profile.rol !== 'admin') {
        return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    try {
        const { email, password, nombre, apellido, telefono, rol } = await request.json();

        // 3. Create User in Supabase Auth
        const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { nombre, apellido, telefono }
        });

        if (createError) {
            return NextResponse.json({ error: createError.message }, { status: 400 });
        }

        if (!userData.user) {
            return NextResponse.json({ error: 'User creation failed' }, { status: 400 });
        }

        // 4. Update/Upsert Profile with selected Role
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .upsert({
                user_id: userData.user.id,
                email: email,
                nombre: nombre,
                apellido: apellido || null,
                telefono: telefono || null,
                rol: rol, // Set the requested role
                activo: true
            });

        if (profileError) {
            // Optional: Delete the user if profile creation fails to prevent orphan users
            // await supabaseAdmin.auth.admin.deleteUser(userData.user.id);
            return NextResponse.json({ error: 'Profile creation failed: ' + profileError.message }, { status: 400 });
        }

        return NextResponse.json({ success: true, userId: userData.user.id });

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
