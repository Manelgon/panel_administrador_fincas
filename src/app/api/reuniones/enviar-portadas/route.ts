import { NextResponse } from 'next/server';
import { supabaseRouteClient } from '@/lib/supabase/route';

export async function POST(req: Request) {
    const supabase = await supabaseRouteClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const webhookUrl = process.env.EMAIL_WEBHOOK_URL;
    if (!webhookUrl) return NextResponse.json({ error: 'Webhook no configurado' }, { status: 500 });

    const incoming = await req.formData();
    const toEmail = String(incoming.get('to_email') || '');
    if (!toEmail) return NextResponse.json({ error: 'Falta destinatario' }, { status: 400 });

    const convocatoria = incoming.get('convocatoria');
    const acta = incoming.get('acta');
    if (!(convocatoria instanceof Blob) || !(acta instanceof Blob)) {
        return NextResponse.json({ error: 'Faltan los PDFs' }, { status: 400 });
    }

    const forward = new FormData();
    forward.append('to_email', toEmail);
    forward.append('type', 'portadas_reunion');
    forward.append('route', 'reuniones');
    forward.append('reunion_id',   String(incoming.get('reunion_id')   || ''));
    forward.append('tipo_reunion', String(incoming.get('tipo_reunion') || ''));
    forward.append('fecha',        String(incoming.get('fecha')        || ''));
    forward.append('comunidad',    String(incoming.get('comunidad')    || ''));

    const convocatoriaName = (incoming.get('convocatoria') as File).name || 'convocatoria.pdf';
    const actaName         = (incoming.get('acta')         as File).name || 'acta.pdf';
    forward.append('convocatoria', convocatoria, convocatoriaName);
    forward.append('acta',         acta,         actaName);

    try {
        const res = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                Envio_documentacion_Panel_serincosol: process.env.N8N_WEBHOOK_SECRET || '',
            },
            body: forward,
        });
        if (!res.ok) {
            console.error('[enviar-portadas] webhook non-OK:', res.status);
            return NextResponse.json({ error: 'Error enviando al webhook' }, { status: 502 });
        }
        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error('[enviar-portadas] fetch error:', err);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}
