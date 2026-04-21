import { NextResponse } from "next/server";
import { supabaseRouteClient } from "@/lib/supabase/route";
import { generateIncidentDetailPdf } from "@/lib/pdf/incidentDetail";
import { generateIncidentsPdf } from "@/lib/pdf/incidentsList";

/**
 * POST /api/incidencias/export
 * Body: { ids: number[], type: 'csv' | 'pdf', layout?: 'list' | 'detail' }
 */
export async function POST(req: Request) {
    const { ids, type, layout, includeNotes, isSecondary, table } = await req.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return NextResponse.json({ error: "No Items Selected" }, { status: 400 });
    }

    const supabase = await supabaseRouteClient();

    const tableName = table || 'incidencias';

    // Fetch Data
    const { data: incidents, error } = await supabase
        .from(tableName)
        .select(`
            *,
            comunidades (nombre_cdad),
            gestor:profiles!gestor_asignado (nombre),
            receptor:profiles!quien_lo_recibe (nombre)
        `)
        .in('id', ids)
        .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    if (!incidents || incidents.length === 0) return NextResponse.json({ error: "No data found" }, { status: 404 });

    const now = new Date();
    const dateStr = `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`;
    const filename = `incidencias_${dateStr}`;

    try {
        if (type === 'pdf') {
            let pdfBytes;

            // Check if detail View requested (Single Item)
            if (layout === 'detail' && incidents.length === 1) {
                let notes: any[] = [];
                if (includeNotes) {
                    const primarySupabase = await supabaseRouteClient();
                    const { data: messages } = await primarySupabase
                        .from('record_messages')
                        .select(`
                            id,
                            created_at,
                            content,
                            profiles (nombre)
                        `)
                        .eq('entity_type', isSecondary ? 'sofia_incidencia' : 'incidencia')
                        .eq('entity_id', incidents[0].id)
                        .order('created_at', { ascending: true });
                    notes = messages || [];
                }
                pdfBytes = await generateIncidentDetailPdf({ incident: incidents[0], notes });
            } else {
                pdfBytes = await generateIncidentsPdf({ incidents });
            }

            return new NextResponse(Buffer.from(pdfBytes), {
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `attachment; filename="${filename}.pdf"`,
                },
            });
        }

        else if (type === 'csv') {
            // Generate CSV
            const headers = ['ID', 'Fecha', 'Comunidad', 'Cliente', 'Telefono', 'Email', 'Mensaje', 'Estado', 'Gestor', 'Urgencia'];
            const rows = incidents.map(inc => [
                inc.id,
                new Date(inc.created_at).toLocaleDateString(),
                `"${(inc.comunidad || inc.comunidades?.nombre_cdad || '').replace(/"/g, '""')}"`,
                `"${(inc.nombre_cliente || '').replace(/"/g, '""')}"`,
                inc.telefono || '',
                inc.email || '',
                `"${(inc.mensaje || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`, // Remove newlines
                inc.resuelto ? 'Resuelto' : 'Pendiente',
                inc.gestor?.nombre || inc.gestor_asignado || '',
                inc.urgencia || ''
            ]);

            const csvContent = [
                headers.join(','),
                ...rows.map(r => r.join(','))
            ].join('\n');

            // Add BOM for Excel
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
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
}
