import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Server-side admin client (bypasses RLS)
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
    try {
        const { id, email, password } = await request.json();

        if (!id || !email || !password) {
            return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
        }

        // 1. Verify credentials by attempting to sign in (without creating a session)
        // We use a temporary client so we don't mess with global state if any
        const tempClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const { data: authData, error: authError } = await tempClient.auth.signInWithPassword({
            email,
            password,
        });

        if (authError || !authData.user) {
            return NextResponse.json({ error: 'Credenciales de administrador inválidas' }, { status: 401 });
        }

        // 2. Verify the user is actually an admin
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('rol')
            .eq('user_id', authData.user.id)
            .single();

        if (profile?.rol !== 'admin') {
            return NextResponse.json({ error: 'El usuario proporcionado no tiene permisos de administrador' }, { status: 403 });
        }

        // 3. Perform the delete
        const { error: deleteError } = await supabaseAdmin
            .from('incidencias')
            .delete()
            .eq('id', id);

        if (deleteError) {
            return NextResponse.json({ error: deleteError.message }, { status: 500 });
        }

        // 4. Log activity
        await supabaseAdmin.from('activity_logs').insert({
            user_id: authData.user.id,
            user_name: authData.user.user_metadata?.nombre || authData.user.email || 'Admin',
            action: 'delete',
            entity_type: 'incidencia',
            entity_id: id,
            entity_name: `Ticket #${id}`,
            details: JSON.stringify({
                id: id,
                deleted_by: email,
                method: 'delete-incident-api'
            })
        });

        return NextResponse.json({ success: true });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
