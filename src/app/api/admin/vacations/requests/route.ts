import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper to check admin role
async function isAdmin(userId: string) {
    const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('rol')
        .eq('user_id', userId)
        .maybeSingle();

    if (error) {
        console.error('isAdmin check error:', error);
        return false;
    }
    return data?.rol === 'admin';
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const adminId = searchParams.get('adminId');

        if (!adminId || !(await isAdmin(adminId))) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        // 1) Fetch requests
        const { data: requests, error: reqError } = await supabaseAdmin
            .from('vacation_requests')
            .select('*')
            .order('created_at', { ascending: false });

        if (reqError) {
            console.error('Fetch requests error:', reqError);
            throw reqError;
        }

        // 2) Fetch profiles for these requests
        const userIds = [...new Set(requests.map(r => r.user_id))];
        const { data: profiles, error: profError } = await supabaseAdmin
            .from('profiles')
            .select('user_id, nombre, apellido')
            .in('user_id', userIds);

        if (profError) {
            console.error('Fetch profiles error (requests):', profError);
            throw profError;
        }

        // 3) Map profiles to requests
        const merged = requests.map(r => ({
            ...r,
            profiles: profiles.find(p => p.user_id === r.user_id) || null
        }));

        return NextResponse.json(merged);
    } catch (error: any) {
        console.error('Admin vacation list GET error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { adminId, requestId, status, commentAdmin } = body;

        if (!adminId || !requestId || !status) {
            return NextResponse.json({ error: 'Faltan campos' }, { status: 400 });
        }

        if (!(await isAdmin(adminId))) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        // 1) Fetch current request and associated balance
        const { data: vReq, error: fetchError } = await supabaseAdmin
            .from('vacation_requests')
            .select('*')
            .eq('id', requestId)
            .single();

        if (fetchError) throw fetchError;

        // 2) Update Balance based on status transition
        const year = new Date(vReq.date_from).getFullYear();
        let { data: balance } = await supabaseAdmin
            .from('vacation_balances')
            .select('*')
            .eq('user_id', vReq.user_id)
            .eq('year', year)
            .maybeSingle();

        // If no balance exists, create it now
        if (!balance) {
            const { data: newBalance, error: createError } = await supabaseAdmin
                .from('vacation_balances')
                .insert({
                    user_id: vReq.user_id,
                    year: year
                })
                .select()
                .single();
            if (createError) throw createError;
            balance = newBalance;
        }

        if (balance) {
            const column = vReq.type === 'VACACIONES' ? 'vacaciones_usados' :
                vReq.type === 'RETRIBUIDO' ? 'retribuidos_usados' :
                    'no_retribuidos_usados';

            let newUsed = balance[column] || 0;

            // If changing TO Approved FROM something else -> ADD
            if (status === 'APROBADA' && vReq.status !== 'APROBADA') {
                newUsed += Number(vReq.days_count);
            }
            // If changing FROM Approved TO something else -> SUBTRACT
            else if (vReq.status === 'APROBADA' && status !== 'APROBADA') {
                newUsed = Math.max(0, newUsed - Number(vReq.days_count));
            }

            if (newUsed !== balance[column]) {
                const { error: updError } = await supabaseAdmin
                    .from('vacation_balances')
                    .update({ [column]: newUsed })
                    .eq('id', balance.id);
                if (updError) throw updError;
            }
        }

        // 3) Update Request
        const { data, error } = await supabaseAdmin
            .from('vacation_requests')
            .update({
                status,
                comment_admin: commentAdmin,
                admin_id: adminId,
                updated_at: new Date().toISOString()
            })
            .eq('id', requestId)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json(data);
    } catch (error: any) {
        console.error('Admin vacation action error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
