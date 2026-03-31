import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const year = searchParams.get('year') || new Date().getFullYear().toString();

        if (!userId) {
            return NextResponse.json({ error: 'Falta userId' }, { status: 400 });
        }

        // 1) Fetch Balance
        const { data: balance, error: balanceError } = await supabaseAdmin
            .from('vacation_balances')
            .select('*')
            .eq('user_id', userId)
            .eq('year', parseInt(year))
            .maybeSingle();

        if (balanceError) throw balanceError;

        // 2) If no balance exists, create one (default values)
        let finalBalance = balance;
        if (!balance) {
            const { data: newBalance, error: createError } = await supabaseAdmin
                .from('vacation_balances')
                .insert({
                    user_id: userId,
                    year: parseInt(year)
                })
                .select()
                .single();
            if (createError) throw createError;
            finalBalance = newBalance;
        }

        // 3) Fetch Policy
        const { data: policy, error: policyError } = await supabaseAdmin
            .from('vacation_policies')
            .select('*')
            .eq('is_active', true)
            .limit(1)
            .maybeSingle();

        if (policyError) throw policyError;

        // 4) RECONCILIATION: Fetch ALL requests (PENDIENTE & APROBADA) to verify balance
        const { data: allRequests, error: reqsError } = await supabaseAdmin
            .from('vacation_requests')
            .select('type, status, days_count')
            .eq('user_id', userId)
            .in('status', ['PENDIENTE', 'APROBADA']);

        if (reqsError) throw reqsError;

        const sync = {
            VACACIONES: { used: 0, pending: 0 },
            RETRIBUIDO: { used: 0, pending: 0 },
            NO_RETRIBUIDO: { used: 0, pending: 0 }
        };

        allRequests?.forEach(r => {
            const key = (r.type === 'VACACIONES' ? 'VACACIONES' : r.type === 'RETRIBUIDO' ? 'RETRIBUIDO' : 'NO_RETRIBUIDO') as keyof typeof sync;
            if (r.status === 'APROBADA') sync[key].used += Number(r.days_count);
            else if (r.status === 'PENDIENTE') sync[key].pending += Number(r.days_count);
        });

        // 5) If any "used" value in balance mismatch sync results, FIX IT automatically
        const needsUpdate =
            finalBalance.vacaciones_usados !== sync.VACACIONES.used ||
            finalBalance.retribuidos_usados !== sync.RETRIBUIDO.used ||
            finalBalance.no_retribuidos_usados !== sync.NO_RETRIBUIDO.used;

        if (needsUpdate) {
            const { data: updatedBalance } = await supabaseAdmin
                .from('vacation_balances')
                .update({
                    vacaciones_usados: sync.VACACIONES.used,
                    retribuidos_usados: sync.RETRIBUIDO.used,
                    no_retribuidos_usados: sync.NO_RETRIBUIDO.used
                })
                .eq('id', finalBalance.id)
                .select()
                .single();
            if (updatedBalance) finalBalance = updatedBalance;
        }

        return NextResponse.json({
            balance: {
                vacaciones: {
                    total: finalBalance.vacaciones_total,
                    used: finalBalance.vacaciones_usados,
                    pending: sync.VACACIONES.pending
                },
                retribuidos: {
                    total: finalBalance.retribuidos_total,
                    used: finalBalance.retribuidos_usados,
                    pending: sync.RETRIBUIDO.pending
                },
                noRetribuidos: {
                    total: finalBalance.no_retribuidos_total,
                    used: finalBalance.no_retribuidos_usados,
                    pending: sync.NO_RETRIBUIDO.pending
                }
            },
            policy: policy || { max_approved_per_day: 1, count_holidays: false, count_weekends: false }
        });

    } catch (error: any) {
        console.error('Vacation status error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
