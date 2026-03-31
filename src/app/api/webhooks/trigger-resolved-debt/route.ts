import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
    try {
        const payload = await req.json();
        const { id } = payload;

        if (!id) {
            return NextResponse.json({ error: 'Debt ID is required' }, { status: 400 });
        }

        const webhookUrl = process.env.RESOLVED_DEBT_WEBHOOK;

        if (!webhookUrl) {
            console.error('❌ RESOLVED_DEBT_WEBHOOK is not configured in .env.local');
            return NextResponse.json({
                error: 'Webhook URL not configured',
                details: 'Please add RESOLVED_DEBT_WEBHOOK to your .env.local file'
            }, { status: 500 });
        }

        // Initialize Admin Client to fetch full debt details securely
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!serviceRoleKey) {
            console.error('❌ SUPABASE_SERVICE_ROLE_KEY is missing');
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            serviceRoleKey,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        );

        // Fetch debt data with safe relations (avoiding unknown FK names for gestor)
        const { data: moroso, error: fetchError } = await supabaseAdmin
            .from('morosidad')
            .select(`
                *,
                comunidades (nombre_cdad, codigo),
                resolver:profiles!resuelto_por (nombre)
            `)
            .eq('id', id)
            .single();

        if (fetchError || !moroso) {
            console.error('❌ Error fetching debt:', fetchError);
            return NextResponse.json({ error: 'Debt not found' }, { status: 404 });
        }

        // Fetch Gestor Name separately if present (safest bet without strict FK knowledge)
        let gestorNombre = 'Desconocido';
        if (moroso.gestor) {
            // Check if it looks like a uuid
            if (moroso.gestor.length > 20) {
                const { data: gestorData } = await supabaseAdmin
                    .from('profiles')
                    .select('nombre')
                    .eq('user_id', moroso.gestor)
                    .single();
                if (gestorData) gestorNombre = gestorData.nombre;
            } else {
                // Might be legacy text
                gestorNombre = moroso.gestor;
            }
        }

        console.log(`📡 Triggering Resolved Debt Webhook for Debt #${id} to: ${webhookUrl}`);

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                event: 'debt_resolved',
                timestamp: new Date().toISOString(),
                id: moroso.id,
                comunidad: moroso.comunidades?.nombre_cdad,
                nombre_comunidad: moroso.comunidades?.nombre_cdad,
                codigo_comunidad: moroso.comunidades?.codigo,

                nombre_deudor: moroso.nombre_deudor,
                apellidos: moroso.apellidos,
                telefono_deudor: moroso.telefono_deudor,
                email_deudor: moroso.email_deudor,
                titulo_documento: moroso.titulo_documento,
                importe: moroso.importe,
                estado: moroso.estado,
                observaciones: moroso.observaciones,

                // Nuevos campos solicitados
                id_email_deuda: moroso.id_email_deuda,
                gestor_nombre: gestorNombre,

                resuelto_por: (Array.isArray(moroso.resolver) ? moroso.resolver[0]?.nombre : moroso.resolver?.nombre),
                fecha_pago: moroso.fecha_pago,

                // Include any other fields expected by the webhook receiver
                ...payload // Merge original payload as fallback
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Resolved Debt Webhook failed upstream (${response.status}):`, errorText);
            return NextResponse.json({ error: 'Webhook failed upstream', status: response.status }, { status: 502 });
        }

        console.log('✅ Resolved Debt Webhook triggered successfully');
        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Error triggering resolved debt webhook:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
