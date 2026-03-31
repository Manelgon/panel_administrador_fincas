import { NextResponse } from "next/server";
import { supabaseRouteClient } from "@/lib/supabase/route";

/**
 * GET /api/fichaje/export/csv?user_id=X&month=YYYY-MM
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('user_id');
    const month = searchParams.get('month');

    if (!month) {
        return NextResponse.json({ error: "Month is required" }, { status: 400 });
    }

    const supabase = await supabaseRouteClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Role check
    const { data: profile } = await supabase
        .from('profiles')
        .select('rol')
        .eq('user_id', user.id)
        .single();

    const targetUserId = (profile?.rol === 'admin' && userId) ? userId : user.id;

    // Fetch User Info
    const { data: targetProfile } = await supabase
        .from('profiles')
        .select('nombre, apellido')
        .eq('user_id', targetUserId)
        .single();

    const userName = targetProfile ? `${targetProfile.nombre} ${targetProfile.apellido || ''}`.trim() : 'Usuario';

    // Fetch Entries
    const startOfMonth = `${month}-01`;
    const nextMonth = getNextMonth(month);

    const { data: entries, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('user_id', targetUserId)
        .gte('start_at', `${startOfMonth}T00:00:00`)
        .lt('start_at', `${nextMonth}T00:00:00`)
        .order('start_at', { ascending: true });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Generate CSV
    const headers = ['Empleado', 'Fecha', 'Hora Inicio', 'Hora Fin', 'Horas', 'Tipo Cierre'];
    const rows = entries?.map(entry => {
        const start = new Date(entry.start_at);
        const end = entry.end_at ? new Date(entry.end_at) : new Date(); // Or null if strictly history

        const durationMs = entry.end_at ? (end.getTime() - start.getTime()) : 0;
        const durationHours = (durationMs / (1000 * 60 * 60)).toFixed(2);

        return [
            userName,
            start.toLocaleDateString('es-ES'),
            start.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
            entry.end_at ? end.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '-',
            durationHours,
            entry.closed_by === 'auto' ? 'Autocierre' : (entry.closed_by === 'admin' ? 'Admin' : 'Usuario')
        ];
    });

    const csvContent = [
        headers.join(','),
        ...(rows?.map(row => row.join(',')) || [])
    ].join('\n');

    // Add BOM for Excel compatibility with UTF-8
    const bom = '\uFEFF';
    const csvWithBom = bom + csvContent;

    return new NextResponse(csvWithBom, {
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="fichaje_${month}_${userName.replace(/\s+/g, '_')}.csv"`,
        },
    });
}

function getNextMonth(yyyyMM: string) {
    const [year, month] = yyyyMM.split('-').map(Number);
    const date = new Date(year, month, 1);
    const nextY = date.getFullYear();
    const nextM = String(date.getMonth() + 1).padStart(2, '0');
    return `${nextY}-${nextM}-01`;
}
