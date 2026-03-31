import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const month = searchParams.get('month'); // YYYY-MM

        if (!month) {
            return NextResponse.json({ error: 'Falta month' }, { status: 400 });
        }

        const dateFrom = `${month}-01`;
        const lastDay = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).getDate();
        const dateTo = `${month}-${String(lastDay).padStart(2, '0')}`;

        // 1) Fetch Approved Requests in range
        const { data: approved, error } = await supabaseAdmin
            .from('vacation_requests')
            .select('date_from, date_to')
            .eq('status', 'APROBADA')
            .lte('date_from', dateTo)
            .gte('date_to', dateFrom);

        if (error) throw error;

        // 2) Fetch Blocked Dates
        const { data: blocked, error: blockedError } = await supabaseAdmin
            .from('blocked_dates')
            .select('*')
            .lte('date_from', dateTo)
            .gte('date_to', dateFrom);

        if (blockedError) throw blockedError;

        // 3) Fetch Policy
        const { data: policy } = await supabaseAdmin
            .from('vacation_policies')
            .select('max_approved_per_day')
            .eq('is_active', true)
            .maybeSingle();

        const maxDaily = policy?.max_approved_per_day || 1;

        // 4) Process daily colors
        const days: Record<string, { color: 'green' | 'amber' | 'red'; count: number; reason?: string }> = {};

        for (let i = 1; i <= lastDay; i++) {
            const dayStr = `${month}-${i.toString().padStart(2, '0')}`;

            // Count approved - truncate date fields to 10 chars (YYYY-MM-DD)
            const count = approved?.filter(r => {
                const start = String(r.date_from).substring(0, 10);
                const end = String(r.date_to).substring(0, 10);
                return dayStr >= start && dayStr <= end;
            }).length || 0;

            // Check blocked
            const block = blocked?.find(b => {
                const start = String(b.date_from).substring(0, 10);
                const end = String(b.date_to).substring(0, 10);
                return dayStr >= start && dayStr <= end;
            });

            let color: 'green' | 'amber' | 'red' = 'green';
            if (block || count >= maxDaily) {
                color = 'red';
            } else if (count > 0) {
                color = 'amber';
            }

            days[dayStr] = {
                color,
                count,
                reason: block?.reason
            };
        }

        return NextResponse.json({ days, maxDaily });

    } catch (error: any) {
        console.error('Calendar API error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
