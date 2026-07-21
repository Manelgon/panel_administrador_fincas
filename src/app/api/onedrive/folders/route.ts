import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/requireAuth';

export async function GET() {
    try {
        const auth = await requireAuth();
        if (!auth.success) return auth.response;

        const webhookUrl = process.env.ONEDRIVE_FOLDERS_WEBHOOK;
        if (!webhookUrl) {
            return NextResponse.json({ error: 'Webhook no configurado' }, { status: 500 });
        }

        const response = await fetch(webhookUrl, {
            method: 'GET',
            headers: {
                Envio_documentacion_Panel_serincosol: process.env.N8N_WEBHOOK_SECRET || '',
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch folders from n8n');
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching folders:', error);
        return NextResponse.json({ error: 'Error fetching folders' }, { status: 500 });
    }
}
