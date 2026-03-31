import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
    try {
        const payload = await req.json();
        const { id } = payload;

        if (!id) {
            return NextResponse.json({ error: 'Incident ID is required' }, { status: 400 });
        }

        // Priority: Env variable > Hardcoded fallback (if any)
        const webhookUrl = process.env.RESOLVED_TICKET_WEBHOOK;

        if (!webhookUrl) {
            console.error('❌ RESOLVED_TICKET_WEBHOOK is not configured in .env.local');
            return NextResponse.json({
                error: 'Webhook URL not configured',
                details: 'Please add RESOLVED_TICKET_WEBHOOK to your .env.local file'
            }, { status: 500 });
        }

        // Initialize Admin Client to fetch full incident details securely
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

        // Fetch incident data
        const { data: incidencia, error: fetchError } = await supabaseAdmin
            .from('incidencias')
            .select(`
                *,
                comunidades (nombre_cdad, codigo),
                gestor:profiles!gestor_asignado (nombre),
                receptor:profiles!quien_lo_recibe (nombre),
                resolver:profiles!resuelto_por (nombre)
            `)
            .eq('id', id)
            .single();

        if (fetchError || !incidencia) {
            console.error('❌ Error fetching incident:', fetchError);
            return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
        }

        console.log('🔍 Debug Incidencia Data:', JSON.stringify(incidencia, null, 2));
        console.log(`📡 Triggering Resolved Webhook for Ticket #${id} to: ${webhookUrl}`);

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                event: 'ticket_resolved',
                timestamp: new Date().toISOString(),
                id: incidencia.id,
                id_email_gestion: incidencia.id_email_gestion,
                aviso: incidencia.aviso,
                telefono: incidencia.telefono,
                email: incidencia.email,
                // Handle potential array responses for joined relations (defensive coding)
                gestor_asignado: (Array.isArray(incidencia.gestor) ? incidencia.gestor[0]?.nombre : incidencia.gestor?.nombre) || 'Desconocido',
                recibido_por: (Array.isArray(incidencia.receptor) ? incidencia.receptor[0]?.nombre : incidencia.receptor?.nombre) || 'Desconocido',
                recibido_por_nombre: (Array.isArray(incidencia.receptor) ? incidencia.receptor[0]?.nombre : incidencia.receptor?.nombre) || 'Desconocido',

                comunidad: (Array.isArray(incidencia.comunidades) ? incidencia.comunidades[0]?.nombre_cdad : incidencia.comunidades?.nombre_cdad),
                nombre_comunidad: (Array.isArray(incidencia.comunidades) ? incidencia.comunidades[0]?.nombre_cdad : incidencia.comunidades?.nombre_cdad),
                codigo_comunidad: (Array.isArray(incidencia.comunidades) ? incidencia.comunidades[0]?.codigo : incidencia.comunidades?.codigo),

                resuelto_por: (Array.isArray(incidencia.resolver) ? incidencia.resolver[0]?.nombre : incidencia.resolver?.nombre),
                // Include any other fields expected by the webhook receiver
                ...payload // Merge original payload as fallback/override if needed, but DB data takes precedence above if mapped explicitly
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Webhook failed upstream (${response.status}):`, errorText);
            return NextResponse.json({ error: 'Webhook failed upstream', status: response.status }, { status: 502 });
        }

        console.log('✅ Webhook triggered successfully');
        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Error triggering resolved ticket webhook:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
