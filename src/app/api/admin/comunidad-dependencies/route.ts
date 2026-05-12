import { supabaseAdmin } from '@/lib/supabase/admin';
import { supabaseRouteClient } from '@/lib/supabase/route';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const idParam = searchParams.get('id');
    const id = idParam ? Number(idParam) : NaN;

    if (!idParam || Number.isNaN(id)) {
        return NextResponse.json({ error: 'id es obligatorio' }, { status: 400 });
    }

    const supabase = await supabaseRouteClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('rol')
        .eq('user_id', user.id)
        .single();

    if (profile?.rol !== 'admin') {
        return NextResponse.json({ error: 'Solo admin' }, { status: 403 });
    }

    const { data: comunidad } = await supabaseAdmin
        .from('comunidades')
        .select('id, codigo, nombre_cdad, activo')
        .eq('id', id)
        .single();

    if (!comunidad) {
        return NextResponse.json({ error: 'Comunidad no encontrada' }, { status: 404 });
    }

    const [tickets, morosidad, reuniones, fichajes, empleados] = await Promise.all([
        supabaseAdmin.from('incidencias').select('id', { count: 'exact', head: true }).eq('comunidad_id', id),
        supabaseAdmin.from('morosidad').select('id', { count: 'exact', head: true }).eq('comunidad_id', id),
        supabaseAdmin.from('reuniones').select('id', { count: 'exact', head: true }).eq('comunidad_id', id),
        supabaseAdmin.from('task_timers').select('id', { count: 'exact', head: true }).eq('comunidad_id', id),
        supabaseAdmin.from('empleado_comunidad').select('id', { count: 'exact', head: true }).eq('comunidad_id', id),
    ]);

    return NextResponse.json({
        comunidad: {
            id: comunidad.id,
            codigo: comunidad.codigo,
            nombre_cdad: comunidad.nombre_cdad,
            activo: comunidad.activo,
        },
        counts: {
            tickets: tickets.count ?? 0,
            morosidad: morosidad.count ?? 0,
            reuniones: reuniones.count ?? 0,
            fichajes: fichajes.count ?? 0,
            empleados: empleados.count ?? 0,
        },
    });
}
