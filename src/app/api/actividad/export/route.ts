import { NextResponse } from "next/server";
import { supabaseRouteClient } from "@/lib/supabase/route";
import { generateActivitiesPdf } from "@/lib/pdf/activitiesList";

/**
 * POST /api/actividad/export
 * Body: { ids: number[], type: 'csv' | 'pdf' }
 */
export async function POST(req: Request) {
    const { ids, type } = await req.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return NextResponse.json({ error: "No Items Selected" }, { status: 400 });
    }

    const supabase = await supabaseRouteClient();

    // Fetch Data
    const { data: activities, error } = await supabase
        .from('activity_logs')
        .select('*')
        .in('id', ids)
        .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!activities || activities.length === 0) return NextResponse.json({ error: "No data found" }, { status: 404 });

    const now = new Date();
    const dateStr = `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`;
    const filename = `actividad_${dateStr}`;

    const getActionLabel = (action: string) => {
        const labels: any = {
            create: 'Crear',
            update: 'Actualizar',
            delete: 'Eliminar',
            mark_paid: 'Marcar Pago',
            toggle_active: 'Cambiar Estado',
            update_password: 'Cambiar Contraseña',
            clock_in: 'Fichaje Entrada',
            clock_out: 'Fichaje Salida',
            generate: 'Generar',
            read: 'Leído'
        };
        return labels[action] || action;
    };

    const getEntityLabel = (entityType: string) => {
        const labels: any = {
            comunidad: 'Comunidad',
            incidencia: 'Incidencia',
            morosidad: 'Morosidad',
            profile: 'Perfil',
            fichaje: 'Fichaje',
            documento: 'Documento',
            aviso: 'Aviso'
        };
        return labels[entityType] || entityType;
    };

    try {
        if (type === 'pdf') {
            const pdfBytes = await generateActivitiesPdf({ activities });
            return new NextResponse(Buffer.from(pdfBytes), {
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `attachment; filename="${filename}.pdf"`,
                },
            });
        }

        else if (type === 'csv') {
            // Generate CSV
            const headers = ['ID', 'Usuario', 'Accion', 'Tipo', 'Entidad', 'Detalles', 'Fecha'];
            const rows = activities.map(act => [
                act.id,
                `"${(act.user_name || '').replace(/"/g, '""')}"`,
                getActionLabel(act.action),
                getEntityLabel(act.entity_type),
                `"${(act.entity_name || '').replace(/"/g, '""')}"`,
                `"${(typeof act.details === 'string' ? act.details : JSON.stringify(act.details) || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
                new Date(act.created_at).toLocaleString('es-ES')
            ]);

            const csvContent = [
                headers.join(','),
                ...rows.map(r => r.join(','))
            ].join('\n');

            const bom = '\uFEFF';
            return new NextResponse(bom + csvContent, {
                headers: {
                    'Content-Type': 'text/csv; charset=utf-8',
                    'Content-Disposition': `attachment; filename="${filename}.csv"`,
                },
            });
        }

        return NextResponse.json({ error: "Invalid Type" }, { status: 400 });

    } catch (e: any) {
        console.error("Export Error", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
