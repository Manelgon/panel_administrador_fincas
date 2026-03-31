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

        if (!userId) {
            return NextResponse.json({ error: 'Falta userId' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('vacation_requests')
            .select('*')
            .eq('user_id', userId)
            .order('date_from', { ascending: false });

        if (error) throw error;

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { userId, type, dateFrom, dateTo, daysCount, commentUser } = body;

        if (!userId || !type || !dateFrom || !dateTo || !daysCount) {
            return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
        }

        // 1) Overlap Check
        // Use inclusive range logic: LTE dateTo AND GTE dateFrom
        const { data: overlap, error: overlapError } = await supabaseAdmin
            .from('vacation_requests')
            .select('id')
            .eq('user_id', userId)
            .in('status', ['PENDIENTE', 'APROBADA'])
            .lte('date_from', dateTo)
            .gte('date_to', dateFrom)
            .limit(1);

        if (overlapError) throw overlapError;
        if (overlap && overlap.length > 0) {
            return NextResponse.json({ error: 'Ya tienes una solicitud pendiente o aprobada para esas fechas.' }, { status: 409 });
        }

        // 2) Balance Check
        const year = new Date(dateFrom).getFullYear();
        const { data: balance, error: balanceError } = await supabaseAdmin
            .from('vacation_balances')
            .select('*')
            .eq('user_id', userId)
            .eq('year', year)
            .maybeSingle();

        if (balanceError) throw balanceError;
        if (!balance) return NextResponse.json({ error: 'No se encontró bolsa de días para este año.' }, { status: 400 });

        let available = 0;
        if (type === 'VACACIONES') available = balance.vacaciones_total - balance.vacaciones_usados;
        else if (type === 'RETRIBUIDO') available = balance.retribuidos_total - balance.retribuidos_usados;
        else available = 999; // NO_RETRIBUIDO usually has no hard limit

        // Also subtract other PENDING requests days
        const { data: pending } = await supabaseAdmin
            .from('vacation_requests')
            .select('days_count')
            .eq('user_id', userId)
            .eq('type', type)
            .eq('status', 'PENDIENTE');

        const reserved = pending?.reduce((acc, curr) => acc + Number(curr.days_count), 0) || 0;

        if (type !== 'NO_RETRIBUIDO' && (available - reserved) < daysCount) {
            return NextResponse.json({ error: `No tienes suficientes días disponibles (${available - reserved} restantes).` }, {
                status:
                    400
            });
        }

        // 3) Create Request
        const { data, error } = await supabaseAdmin
            .from('vacation_requests')
            .insert({
                user_id: userId,
                type,
                date_from: dateFrom,
                date_to: dateTo,
                days_count: daysCount,
                comment_user: commentUser,
                status: 'PENDIENTE'
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json(data);

    } catch (error: any) {
        console.error('Submit vacation error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
