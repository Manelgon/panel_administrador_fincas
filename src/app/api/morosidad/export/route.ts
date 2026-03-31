import { NextResponse } from "next/server";
import { supabaseRouteClient } from "@/lib/supabase/route";
import { generateDebtDetailPdf } from "@/lib/pdf/debtDetail";
import { generateDebtsPdf } from "@/lib/pdf/debtsList";

/**
 * POST /api/morosidad/export
 * Body: { ids: number[], type: 'csv' | 'pdf', layout?: 'list' | 'detail' }
 */
export async function POST(req: Request) {
    const { ids, type, layout, includeNotes } = await req.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return NextResponse.json({ error: "No Items Selected" }, { status: 400 });
    }

    const supabase = await supabaseRouteClient();

    // Fetch Data
    const { data: debts, error } = await supabase
        .from('morosidad')
        .select(`
            *,
            comunidades (nombre_cdad),
            gestor_profile:profiles!gestor (nombre),
            resolver:profiles!resuelto_por (nombre)
        `)
        .in('id', ids)
        .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!debts || debts.length === 0) return NextResponse.json({ error: "No data found" }, { status: 404 });

    const now = new Date();
    const dateStr = `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`;
    const filename = `morosidad_${dateStr}`;

    try {
        if (type === 'pdf') {
            let pdfBytes;
            // Check if detail View requested (Single Item)
            if (layout === 'detail' && debts.length === 1) {
                let notes: any[] = [];
                if (includeNotes) {
                    const { data: messages } = await supabase
                        .from('record_messages')
                        .select(`
                            id,
                            created_at,
                            content,
                            profiles (nombre)
                        `)
                        .eq('entity_type', 'morosidad')
                        .eq('entity_id', debts[0].id)
                        .order('created_at', { ascending: true });
                    notes = messages || [];
                }
                pdfBytes = await generateDebtDetailPdf({ debt: debts[0], notes });
            } else {
                pdfBytes = await generateDebtsPdf({ debts });
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
            const headers = ['ID', 'Fecha', 'Comunidad', 'Deudor', 'Apellidos', 'Telefono', 'Email', 'Concepto', 'Importe', 'Estado', 'Gestor', 'F. Notificación', 'F. Pago'];
            const rows = debts.map(debt => [
                debt.id,
                new Date(debt.created_at).toLocaleDateString(),
                `"${(debt.comunidades?.nombre_cdad || '').replace(/"/g, '""')}"`,
                `"${(debt.nombre_deudor || '').replace(/"/g, '""')}"`,
                `"${(debt.apellidos || '').replace(/"/g, '""')}"`,
                debt.telefono_deudor || '',
                debt.email_deudor || '',
                `"${(debt.titulo_documento || '').replace(/"/g, '""')}"`,
                debt.importe || '',
                debt.estado || '',
                debt.gestor_profile?.nombre || '',
                debt.fecha_notificacion ? new Date(debt.fecha_notificacion).toLocaleDateString() : '',
                debt.fecha_pago ? new Date(debt.fecha_pago).toLocaleDateString() : ''
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
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
