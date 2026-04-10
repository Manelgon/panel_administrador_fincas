import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: Request) {
    try {
        const payload = await req.json();

        // Supabase webhook sends { type, table, record, old_record }
        const id = payload.record?.id ?? payload.id;

        if (!id) {
            return NextResponse.json({ error: 'Debt ID is required' }, { status: 400 });
        }

        const webhookUrl = process.env.NEW_DEBT_WEBHOOK;

        if (!webhookUrl) {
            console.error('❌ NEW_DEBT_WEBHOOK is not configured');
            return NextResponse.json({
                error: 'Webhook URL not configured',
                details: 'Please add NEW_DEBT_WEBHOOK to your .env.local file'
            }, { status: 500 });
        }

        const { data: moroso, error: fetchError } = await supabaseAdmin
            .from('morosidad')
            .select(`
                *,
                comunidades (nombre_cdad, codigo, direccion),
                resolver:profiles!resuelto_por (nombre)
            `)
            .eq('id', id)
            .single();

        if (fetchError || !moroso) {
            console.error('❌ Error fetching debt:', fetchError);
            return NextResponse.json({ error: 'Debt not found' }, { status: 404 });
        }

        // Fetch gestor name separately (field is a uuid referencing profiles)
        let gestorNombre = 'Desconocido';
        if (moroso.gestor && moroso.gestor.length > 20) {
            const { data: gestorData } = await supabaseAdmin
                .from('profiles')
                .select('nombre')
                .eq('user_id', moroso.gestor)
                .single();
            if (gestorData) gestorNombre = gestorData.nombre;
        } else if (moroso.gestor) {
            gestorNombre = moroso.gestor;
        }

        console.log(`📡 Triggering New Debt Webhook for #${id} to: ${webhookUrl}`);

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                event: 'debt_created',
                timestamp: new Date().toISOString(),
                id: moroso.id,
                id_email_deuda: moroso.id_email_deuda,
                aviso: moroso.aviso,
                comunidad: moroso.comunidades?.nombre_cdad,
                nombre_comunidad: moroso.comunidades?.nombre_cdad,
                codigo_comunidad: moroso.comunidades?.codigo,
                direccion_comunidad: moroso.comunidades?.direccion,
                nombre_deudor: moroso.nombre_deudor,
                apellidos: moroso.apellidos,
                telefono_deudor: moroso.telefono_deudor,
                email_deudor: moroso.email_deudor,
                titulo_documento: moroso.titulo_documento,
                importe: moroso.importe,
                estado: moroso.estado,
                observaciones: moroso.observaciones,
                gestor_nombre: gestorNombre,
                ref: moroso.ref,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ New Debt Webhook failed (${response.status}):`, errorText);
            return NextResponse.json({ error: 'Webhook failed upstream', status: response.status }, { status: 502 });
        }

        console.log('✅ New Debt Webhook triggered successfully');
        return NextResponse.json({ success: true });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error triggering new debt webhook:', error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
