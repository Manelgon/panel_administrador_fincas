import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

// Server-side admin client (bypasses RLS)
/**
 * Extracts { bucket, path } from an adjunto URL.
 * Handles two formats:
 *  1. Proxy: /api/storage/view?bucket=documentos&path=incidencias%2Fuuid.pdf
 *  2. Public: https://xxx.supabase.co/storage/v1/object/public/documentos/incidencias/uuid.pdf
 */
function parseStorageUrl(url: string): { bucket: string; path: string } | null {
    try {
        // Format 1 — internal proxy URL
        if (url.startsWith('/api/storage/view')) {
            const searchParams = new URLSearchParams(url.split('?')[1] || '');
            const bucket = searchParams.get('bucket');
            const path = searchParams.get('path');
            if (bucket && path) return { bucket, path };
        }

        // Format 2 — Supabase public URL
        if (url.includes('/object/public/')) {
            const afterPublic = url.split('/object/public/')[1];
            const parts = afterPublic.split('/');
            const bucket = parts[0];
            const path = parts.slice(1).join('/');
            if (bucket && path) return { bucket, path };
        }
    } catch {
        // Ignore malformed URLs
    }
    return null;
}

/**
 * Deletes all storage files from the adjuntos array.
 * Groups by bucket for efficiency. Errors are logged but not fatal.
 */
async function deleteAdjuntosFromStorage(adjuntos: string[]): Promise<void> {
    if (!adjuntos || adjuntos.length === 0) return;

    // Group paths by bucket
    const byBucket: Record<string, string[]> = {};
    for (const url of adjuntos) {
        const parsed = parseStorageUrl(url);
        if (parsed) {
            if (!byBucket[parsed.bucket]) byBucket[parsed.bucket] = [];
            byBucket[parsed.bucket].push(parsed.path);
        }
    }

    // Delete from each bucket
    for (const [bucket, paths] of Object.entries(byBucket)) {
        const { error } = await supabaseAdmin.storage.from(bucket).remove(paths);
        if (error) {
            console.error(`[universal-delete] Storage removal error (bucket: ${bucket}):`, error.message);
        }
    }
}

export async function POST(request: Request) {
    try {
        const { id, email, password, type } = await request.json();

        if (!id || !type) {
            return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
        }

        // 0. Session-based authentication
        const { supabaseRouteClient } = await import('@/lib/supabase/route');
        const supabase = await supabaseRouteClient();
        const { data: { user: sessionUser } } = await supabase.auth.getUser();

        let isAdmin = false;

        if (sessionUser) {
            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('rol')
                .eq('user_id', sessionUser.id)
                .single();
            isAdmin = profile?.rol === 'admin';
        }

        let verifiedUser = sessionUser;

        // 1. Fallback: credential auth if not admin via session
        if (!isAdmin) {
            if (!email || !password) {
                return NextResponse.json({ error: 'Se requieren credenciales de administrador' }, { status: 401 });
            }

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

            verifiedUser = authData.user;

            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('rol')
                .eq('user_id', verifiedUser.id)
                .single();

            if (profile?.rol !== 'admin') {
                return NextResponse.json({ error: 'No tienes permisos de administrador para realizar esta acción' }, { status: 403 });
            }
            isAdmin = true;
        }

        if (!verifiedUser) {
            return NextResponse.json({ error: 'No se pudo verificar el usuario' }, { status: 500 });
        }

        // 2. Fetch entity details for logging (and adjuntos before deletion)
        let entityName = 'Desconocido';
        let entityDetails = {};

        if (type === 'incidencia' || type === 'sofia_incidencia') {
            const tableName = type === 'sofia_incidencia' ? 'incidencias_serincobot' : 'incidencias';
            const { data } = await supabaseAdmin
                .from(tableName)
                .select('nombre_cliente, adjuntos')
                .eq('id', id)
                .single();
            entityName = data?.nombre_cliente || `Ticket #${id}`;
            entityDetails = { adjuntos_count: (data?.adjuntos ?? []).length };

            // 3a. Delete storage files (adjuntos)
            if (data?.adjuntos && data.adjuntos.length > 0) {
                await deleteAdjuntosFromStorage(data.adjuntos);
            }

            // 3b. Delete timeline messages (record_messages)
            const entityType = type === 'sofia_incidencia' ? 'sofia_incidencia' : 'incidencia';
            const { error: msgError } = await supabaseAdmin
                .from('record_messages')
                .delete()
                .eq('entity_type', entityType)
                .eq('entity_id', id);

            if (msgError) {
                console.error('[universal-delete] Error deleting record_messages:', msgError.message);
            }

        } else if (type === 'morosidad') {
            const { data } = await supabaseAdmin.from('morosidad').select('nombre_cliente, titulo').eq('id', id).single();
            entityName = data?.titulo || data?.nombre_cliente || `Morosidad #${id}`;

            // Delete timeline messages for morosidad too
            await supabaseAdmin
                .from('record_messages')
                .delete()
                .eq('entity_type', 'morosidad')
                .eq('entity_id', id);

        } else if (type === 'comunidad') {
            const { data } = await supabaseAdmin.from('comunidades').select('nombre_cdad').eq('id', id).single();
            entityName = data?.nombre_cdad || `Comunidad #${id}`;
        } else if (type === 'perfil') {
            const { data } = await supabaseAdmin.from('profiles').select('nombre').eq('user_id', id).single();
            entityName = data?.nombre || `Usuario #${id}`;
        } else if (type === 'document') {
            const { data } = await supabaseAdmin.from('doc_submissions').select('title, payload').eq('id', id).single();
            entityName = data?.title || `Documento #${id}`;
            entityDetails = {
                titulo: data?.title,
                cliente: data?.payload?.['Nombre Cliente'] || data?.payload?.['Nombre']
            };
        } else if (type === 'proveedor') {
            const { data } = await supabaseAdmin.from('proveedores').select('nombre_proveedor').eq('id', id).single();
            entityName = data?.nombre_proveedor || `Proveedor #${id}`;
        } else if (type === 'task_timer') {
            const { data } = await supabaseAdmin.from('task_timers').select('comunidades(nombre_cdad)').eq('id', id).single();
            entityName = (data?.comunidades as any)?.nombre_cdad
                ? `Tarea de ${(data?.comunidades as any).nombre_cdad}`
                : 'Tarea (Todas las comunidades)';
        }

        // 4. Delete the main record
        let deleteError = null;

        if (type === 'incidencia' || type === 'sofia_incidencia') {
            const tableName = type === 'sofia_incidencia' ? 'incidencias_serincobot' : 'incidencias';
            const { error } = await supabaseAdmin.from(tableName).delete().eq('id', id);
            deleteError = error;
        } else if (type === 'morosidad') {
            const { error } = await supabaseAdmin.from('morosidad').delete().eq('id', id);
            deleteError = error;
        } else if (type === 'comunidad') {
            const { error } = await supabaseAdmin.from('comunidades').delete().eq('id', id);
            deleteError = error;
        } else if (type === 'perfil') {
            if (id === verifiedUser.id) {
                return NextResponse.json({ error: 'No puedes eliminar tu propia cuenta mientras estás logueado' }, { status: 400 });
            }
            const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
            deleteError = error;
        } else if (type === 'document') {
            const { error } = await supabaseAdmin.from('doc_submissions').delete().eq('id', id);
            deleteError = error;
        } else if (type === 'proveedor') {
            const { error } = await supabaseAdmin.from('proveedores').delete().eq('id', id);
            deleteError = error;
        } else if (type === 'task_timer') {
            const { error } = await supabaseAdmin.from('task_timers').delete().eq('id', id);
            deleteError = error;
        } else {
            return NextResponse.json({ error: 'Tipo de entidad no válido' }, { status: 400 });
        }

        if (deleteError) {
            console.error('[universal-delete] Delete error:', deleteError);
            return NextResponse.json({ error: 'Error al eliminar: ' + deleteError.message }, { status: 500 });
        }

        // 5. Log activity
        await supabaseAdmin.from('activity_logs').insert({
            user_id: verifiedUser.id,
            user_name: verifiedUser.user_metadata?.nombre || verifiedUser.email || 'Admin',
            action: 'delete',
            entity_type: type === 'document' ? 'documento' : type,
            entity_id: typeof id === 'number' ? id : null,
            entity_name: entityName,
            details: JSON.stringify({
                ...entityDetails,
                id,
                deleted_by: email,
                entity_id: id
            })
        });

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('[universal-delete] API error:', error);
        return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
    }
}
