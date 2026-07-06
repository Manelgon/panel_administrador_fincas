import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { validateRequest } from '@/lib/api/validateRequest';
import { deleteUserApiSchema } from '@/lib/schemas';

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

    // Check if requester is admin using Service Role (Bypasses RLS)
    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('rol')
        .eq('user_id', user.id)
        .single();

    if (!profile || profile.rol !== 'admin') {
        return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const validation = await validateRequest(request, deleteUserApiSchema);
    if (!validation.success) return validation.response;
    const { userId } = validation.data;

    try {
        // Prevent admin from deleting themselves
        if (userId === user.id) {
            return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 });
        }

        // Protección legal: el control horario (art. 34.9 ET) obliga a conservar
        // los fichajes 4 años. Si el empleado tiene registros, no se borra: se desactiva.
        const { count: fichajesCount } = await supabaseAdmin
            .from('time_entries')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId);
        if (fichajesCount && fichajesCount > 0) {
            return NextResponse.json({
                error: 'Este empleado tiene fichajes que la ley obliga a conservar durante 4 años. Desactívalo en lugar de eliminarlo.'
            }, { status: 409 });
        }

        // 3. Delete User from Supabase Auth (Cascades to Profiles)
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (deleteError) {
            return NextResponse.json({ error: "Error en la operación" }, { status: 400 });
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
