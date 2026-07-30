import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// Cron diario (PRP-004): notifica a los admins los contratos activos cuya
// fecha de preaviso llegó o pasó, sin duplicar mientras haya un aviso sin leer.
export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const hoy = new Date().toISOString().slice(0, 10);

        const { data: contratos, error } = await supabaseAdmin
            .from('contratos')
            .select('id, tipo_servicio, fecha_vencimiento, fecha_preaviso, comunidades(nombre_cdad), proveedores(nombre)')
            .eq('activo', true)
            .lte('fecha_preaviso', hoy);

        if (error) {
            console.error('[contratos-preaviso] Error consultando contratos:', error);
            return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
        }

        if (!contratos || contratos.length === 0) {
            return NextResponse.json({ success: true, notified_count: 0 });
        }

        // Contratos que ya tienen una notificación sin leer → no duplicar
        const { data: pendientes } = await supabaseAdmin
            .from('notifications')
            .select('entity_id')
            .eq('entity_type', 'contrato')
            .eq('is_read', false)
            .in('entity_id', contratos.map(c => c.id));

        const yaNotificados = new Set((pendientes || []).map(n => n.entity_id));
        const candidatos = contratos.filter(c => !yaNotificados.has(c.id));

        if (candidatos.length === 0) {
            return NextResponse.json({ success: true, notified_count: 0, skipped: contratos.length });
        }

        // Se avisa a todos los admins y gestores (los que gestionan renovaciones)
        const { data: admins, error: adminsError } = await supabaseAdmin
            .from('profiles')
            .select('user_id')
            .in('rol', ['admin', 'gestor'])
            .eq('activo', true);

        if (adminsError || !admins || admins.length === 0) {
            console.error('[contratos-preaviso] Sin admins/gestores a notificar:', adminsError);
            return NextResponse.json({ error: 'Sin administradores o gestores a notificar' }, { status: 500 });
        }

        const notifications = candidatos.flatMap(contrato => {
            const comunidad = (contrato.comunidades as unknown as { nombre_cdad: string } | null)?.nombre_cdad || 'Sin comunidad';
            const proveedor = (contrato.proveedores as unknown as { nombre: string } | null)?.nombre || 'Sin proveedor';
            const vence = contrato.fecha_vencimiento
                ? new Date(contrato.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-ES')
                : 'sin fecha';
            return admins.map(admin => ({
                user_id: admin.user_id,
                type: 'contrato_preaviso',
                title: 'Preaviso de contrato próximo a vencer',
                body: `${contrato.tipo_servicio || 'Contrato'} con ${proveedor} (${comunidad}) — vence el ${vence}`,
                entity_type: 'contrato',
                entity_id: contrato.id,
                is_read: false,
            }));
        });

        const { error: insertError } = await supabaseAdmin
            .from('notifications')
            .insert(notifications);

        if (insertError) {
            console.error('[contratos-preaviso] Error insertando notificaciones:', insertError);
            return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            notified_count: candidatos.length,
            skipped: yaNotificados.size,
        });
    } catch (err) {
        console.error('[contratos-preaviso] Cron error:', err);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
