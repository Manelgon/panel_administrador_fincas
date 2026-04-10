import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: Request) {
    try {
        const payload = await req.json();

        // Supabase webhook sends { type, table, record, old_record }
        const id = payload.record?.id ?? payload.id;

        if (!id) {
            return NextResponse.json({ error: 'Incident ID is required' }, { status: 400 });
        }

        const webhookUrl = process.env.NEW_TICKET_WEBHOOK;

        if (!webhookUrl) {
            console.error('❌ NEW_TICKET_WEBHOOK is not configured');
            return NextResponse.json({
                error: 'Webhook URL not configured',
                details: 'Please add NEW_TICKET_WEBHOOK to your .env.local file'
            }, { status: 500 });
        }

        const { data: incidencia, error: fetchError } = await supabaseAdmin
            .from('incidencias')
            .select(`
                *,
                comunidades (nombre_cdad, codigo),
                gestor:profiles!gestor_asignado (nombre),
                receptor:profiles!quien_lo_recibe (nombre)
            `)
            .eq('id', id)
            .single();

        if (fetchError || !incidencia) {
            console.error('❌ Error fetching incident:', fetchError);
            return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
        }

        console.log(`📡 Triggering New Ticket Webhook for #${id} to: ${webhookUrl}`);

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                event: 'ticket_created',
                timestamp: new Date().toISOString(),
                id: incidencia.id,
                id_email_gestion: incidencia.id_email_gestion,
                aviso: incidencia.aviso,
                telefono: incidencia.telefono,
                email: incidencia.email,
                nombre_cliente: incidencia.nombre_cliente,
                mensaje: incidencia.mensaje,
                motivo_ticket: incidencia.motivo_ticket,
                source: incidencia.source,
                gestor_asignado: (Array.isArray(incidencia.gestor) ? incidencia.gestor[0]?.nombre : incidencia.gestor?.nombre) || 'Desconocido',
                recibido_por: (Array.isArray(incidencia.receptor) ? incidencia.receptor[0]?.nombre : incidencia.receptor?.nombre) || 'Desconocido',
                comunidad: (Array.isArray(incidencia.comunidades) ? incidencia.comunidades[0]?.nombre_cdad : incidencia.comunidades?.nombre_cdad),
                nombre_comunidad: (Array.isArray(incidencia.comunidades) ? incidencia.comunidades[0]?.nombre_cdad : incidencia.comunidades?.nombre_cdad),
                codigo_comunidad: (Array.isArray(incidencia.comunidades) ? incidencia.comunidades[0]?.codigo : incidencia.comunidades?.codigo),
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ New Ticket Webhook failed (${response.status}):`, errorText);
            return NextResponse.json({ error: 'Webhook failed upstream', status: response.status }, { status: 502 });
        }

        console.log('✅ New Ticket Webhook triggered successfully');
        return NextResponse.json({ success: true });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error triggering new ticket webhook:', error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
