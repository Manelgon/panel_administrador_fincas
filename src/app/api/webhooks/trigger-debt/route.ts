
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const contentType = req.headers.get('content-type') || '';
        const webhookUrl = process.env.DEBT_WEBHOOK_URL;

        if (!webhookUrl) {
            console.warn('DEBT_WEBHOOK_URL is not configured');
            return NextResponse.json({ skipped: true, reason: 'No webhook configured' });
        }

        let body: any;
        let headers: any = {};

        if (contentType.includes('multipart/form-data')) {
            const formData = await req.formData();
            const forwardFormData = new FormData();

            // Forward all fields and files
            for (const [key, value] of Array.from(formData.entries())) {
                forwardFormData.append(key, value);
            }

            // Add metadata
            forwardFormData.append('event', 'debt_created');
            forwardFormData.append('timestamp', new Date().toISOString());

            body = forwardFormData;
            // fetch will automatically set the correct boundary for FormData
        } else {
            const payload = await req.json();
            body = JSON.stringify({
                event: 'debt_created',
                timestamp: new Date().toISOString(),
                data: payload
            });
            headers['Content-Type'] = 'application/json';
        }

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: headers,
            body: body,
        });

        if (!response.ok) {
            console.error('Webhook failed:', response.status, await response.text());
            return NextResponse.json({ error: 'Webhook failed upstream' }, { status: 502 });
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Error triggering debt webhook:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
