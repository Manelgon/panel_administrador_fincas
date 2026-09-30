import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// Cron diario: avisa a los responsables de las tareas de checklist que vencen
// en 2 días o menos, y de las que ya han vencido. La lógica (y el control para
// no repetir avisos) vive en la función SQL checklist_avisar_vencimientos.
export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin.rpc('checklist_avisar_vencimientos', { p_dias_antes: 2 });
    if (error) {
        console.error('[checklist-vencimientos] Error:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }

    return NextResponse.json({ success: true, notified_count: data ?? 0 });
}
