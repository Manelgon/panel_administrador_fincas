import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function isAdmin(userId: string) {
    const { data } = await supabaseAdmin.from('profiles').select('rol').eq('user_id', userId).maybeSingle();
    return data?.rol === 'admin';
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const adminId = searchParams.get('adminId');

        if (!adminId || !(await isAdmin(adminId))) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        const [policyRes, blockedRes] = await Promise.all([
            supabaseAdmin.from('vacation_policies').select('*').eq('is_active', true).maybeSingle(),
            supabaseAdmin.from('blocked_dates').select('*').order('date_from', { ascending: true })
        ]);

        return NextResponse.json({
            policy: policyRes.data,
            blockedDates: blockedRes.data
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { adminId, action, data } = body;

        if (!adminId || !(await isAdmin(adminId))) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        if (action === 'update_policy') {
            const { error } = await supabaseAdmin
                .from('vacation_policies')
                .update({
                    max_approved_per_day: data.max_approved_per_day,
                    count_holidays: data.count_holidays,
                    count_weekends: data.count_weekends,
                    updated_at: new Date().toISOString()
                })
                .eq('id', data.id);
            if (error) throw error;
        } else if (action === 'add_blocked_date') {
            const { error } = await supabaseAdmin
                .from('blocked_dates')
                .insert({
                    date_from: data.date_from,
                    date_to: data.date_to,
                    reason: data.reason
                });
            if (error) throw error;
        } else if (action === 'delete_blocked_date') {
            const { error } = await supabaseAdmin
                .from('blocked_dates')
                .delete()
                .eq('id', data.id);
            if (error) throw error;
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
