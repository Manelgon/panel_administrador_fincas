import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { validateRequest } from '@/lib/api/validateRequest';
import { vacationSettingsActionSchema } from '@/lib/schemas';
import { requireAdmin } from '@/lib/api/requireAuth';

export async function GET(request: Request) {
    try {
        const auth = await requireAdmin();
        if (!auth.success) return auth.response;

        const [policyRes, blockedRes] = await Promise.all([
            supabaseAdmin.from('vacation_policies').select('*').eq('is_active', true).maybeSingle(),
            supabaseAdmin.from('blocked_dates').select('*').order('date_from', { ascending: true })
        ]);

        return NextResponse.json({
            policy: policyRes.data,
            blockedDates: blockedRes.data
        });
    } catch (error: any) {
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const auth = await requireAdmin();
    if (!auth.success) return auth.response;

    const validation = await validateRequest(request, vacationSettingsActionSchema);
    if (!validation.success) return validation.response;
    const { action, data } = validation.data;

    try {
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
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
}
