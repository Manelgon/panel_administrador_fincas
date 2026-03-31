import { NextResponse } from "next/server";
import { supabaseRouteClient } from "@/lib/supabase/route";
import { generateNoticeDetailPdf } from "@/lib/pdf/noticeDetail";

export async function POST(req: Request) {
    const { ids, type, layout } = await req.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return NextResponse.json({ error: "No Items Selected" }, { status: 400 });
    }

    const supabase = await supabaseRouteClient();

    // Fetch Notifications
    const { data: notifications, error } = await supabase
        .from('notifications')
        .select('*')
        .in('id', ids)
        .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!notifications || notifications.length === 0) return NextResponse.json({ error: "No data found" }, { status: 404 });

    const now = new Date();
    const dateStr = `${now.getDate().toString().padStart(2, '0')}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getFullYear()}`;

    try {
        if (type === 'pdf') {
            let pdfBytes;

            // Detail View (Single Item)
            if (layout === 'detail' && notifications.length === 1) {
                const notif = notifications[0];
                let entityData = null;

                // Fetch Entity if exists
                if (notif.entity_type && notif.entity_id) {
                    if (notif.entity_type === 'incidencia') {
                        const { data } = await supabase
                            .from('incidencias')
                            .select('*, comunidades(nombre_cdad)')
                            .eq('id', notif.entity_id)
                            .single();
                        entityData = data;
                    } else if (notif.entity_type === 'morosidad') {
                        const { data } = await supabase
                            .from('morosidad')
                            .select('*, comunidades(nombre_cdad)')
                            .eq('id', notif.entity_id)
                            .single();
                        entityData = data;
                    }
                }

                pdfBytes = await generateNoticeDetailPdf({ notification: notif, entityData });
            } else {
                // Bulk List - Not implemented yet (or fallback to simple csv/pdf list later)
                // For now, if user requests bulk PDF of avisos, we can return error or simple list
                // User requirement was specifically for "modal del detalle", so this path might not be hit yet.
                // Let's return error or implement basic list later.
                // For safety, let's just use detail generator for the first item or error?
                // Or better: Implement basic list loop if needed.
                // Given the request, let's stick to detail. If they select multiple, we might default to CSV logic or simple loop.
                return NextResponse.json({ error: "Bulk PDF not implemented" }, { status: 501 });
            }

            const filename = layout === 'detail'
                ? `AVISO_${notifications[0].id.substring(0, 8)}_${dateStr}`
                : `avisos_${dateStr}`;

            return new NextResponse(Buffer.from(pdfBytes), {
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `attachment; filename="${filename}.pdf"`,
                },
            });
        }

        return NextResponse.json({ error: "Invalid type" }, { status: 400 });

    } catch (e: any) {
        console.error(e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
