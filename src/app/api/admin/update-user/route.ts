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
        const { userId, email, password, nombre, apellido, telefono, rol, activo } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        // 3. Update Auth User (Email, Password, Ban Status)
        const authUpdates: any = {
            email: email,
            user_metadata: { nombre }
        };

        if (password && password.length >= 6) {
            authUpdates.password = password;
        }

        if (activo !== undefined) {
            // If activo is false, we ban the user to prevent login
            // If active is true, we unban (ban_duration = "none")
            if (activo === false) {
                authUpdates.ban_duration = "876000h"; // ~100 years
            } else {
                authUpdates.ban_duration = "none";
            }
        }

        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
            userId,
            authUpdates
        );

        if (authError) {
            return NextResponse.json({ error: 'Auth Update Failed: ' + authError.message }, { status: 400 });
        }

        // 4. Update Profile in Database
        const profileUpdates: any = {};
        if (email) profileUpdates.email = email;
        if (nombre) profileUpdates.nombre = nombre;
        // Allow empty string to clear these fields
        if (apellido !== undefined) profileUpdates.apellido = apellido;
        if (telefono !== undefined) profileUpdates.telefono = telefono;
        if (rol) profileUpdates.rol = rol;
        if (activo !== undefined) profileUpdates.activo = activo;

        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .update(profileUpdates)
            .eq('user_id', userId);

        if (profileError) {
            return NextResponse.json({ error: 'Profile Update Failed: ' + profileError.message }, { status: 400 });
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error: ' + error.message }, { status: 500 });
    }
}
