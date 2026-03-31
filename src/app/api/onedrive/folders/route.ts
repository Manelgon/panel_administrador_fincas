import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const response = await fetch('https://serinwebhook.afcademia.com/webhook/6f428d72-971d-4bfe-8c34-4a8adae7b133', {
            method: 'GET',
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
