import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { validateRequest } from '@/lib/api/validateRequest';
import { vacationRequestActionSchema } from '@/lib/schemas';
import { requireAdmin } from '@/lib/api/requireAuth';

export async function GET(request: Request) {
    try {
        const auth = await requireAdmin();
        if (!auth.success) return auth.response;

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
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const auth = await requireAdmin();
    if (!auth.success) return auth.response;

    const validation = await validateRequest(request, vacationRequestActionSchema);
    if (!validation.success) return validation.response;
    const { requestId, status, commentAdmin } = validation.data;

    try {
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
                admin_id: auth.userId,
                updated_at: new Date().toISOString()
            })
            .eq('id', requestId)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json(data);
    } catch (error: any) {
        console.error('Admin vacation action error:', error);
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const auth = await requireAdmin();
        if (!auth.success) return auth.response;

        const body = await request.json();
        const { requestId, type, date_from, date_to, days_count, status, comment_admin } = body;

        if (!requestId) {
            return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
        }

        // 1) Fetch current request
        const { data: vReq, error: fetchError } = await supabaseAdmin
            .from('vacation_requests')
            .select('*')
            .eq('id', requestId)
            .single();

        if (fetchError) throw fetchError;

        // 2) Handle balance changes if status is changing
        const oldStatus = vReq.status;
        const newStatus = status || oldStatus;
        const oldType = vReq.type;
        const newType = type || oldType;
        const oldDays = Number(vReq.days_count);
        const newDays = days_count != null ? Number(days_count) : oldDays;
        const yearFrom = new Date(date_from || vReq.date_from).getFullYear();

        // Get or create balance
        let { data: balance } = await supabaseAdmin
            .from('vacation_balances')
            .select('*')
            .eq('user_id', vReq.user_id)
            .eq('year', yearFrom)
            .maybeSingle();

        if (!balance) {
            const { data: newBalance, error: createError } = await supabaseAdmin
                .from('vacation_balances')
                .insert({ user_id: vReq.user_id, year: yearFrom })
                .select()
                .single();
            if (createError) throw createError;
            balance = newBalance;
        }

        if (balance) {
            const getColumn = (t: string) =>
                t === 'VACACIONES' ? 'vacaciones_usados' :
                t === 'RETRIBUIDO' ? 'retribuidos_usados' :
                'no_retribuidos_usados';

            const updates: Record<string, number> = {};

            // If was APROBADA, subtract old days from old type column
            if (oldStatus === 'APROBADA') {
                const oldCol = getColumn(oldType);
                updates[oldCol] = Math.max(0, (balance[oldCol] || 0) - oldDays);
            }

            // If new status is APROBADA, add new days to new type column
            if (newStatus === 'APROBADA') {
                const newCol = getColumn(newType);
                const base = updates[newCol] != null ? updates[newCol] : (balance[newCol] || 0);
                updates[newCol] = base + newDays;
            }

            if (Object.keys(updates).length > 0) {
                const { error: updError } = await supabaseAdmin
                    .from('vacation_balances')
                    .update(updates)
                    .eq('id', balance.id);
                if (updError) throw updError;
            }
        }

        // 3) Update request fields
        const updateData: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
            admin_id: auth.userId,
        };
        if (type) updateData.type = type;
        if (date_from) updateData.date_from = date_from;
        if (date_to) updateData.date_to = date_to;
        if (days_count != null) updateData.days_count = days_count;
        if (status) updateData.status = status;
        if (comment_admin !== undefined) updateData.comment_admin = comment_admin;

        const { data, error } = await supabaseAdmin
            .from('vacation_requests')
            .update(updateData)
            .eq('id', requestId)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json(data);
    } catch (error: any) {
        console.error('Admin vacation PATCH error:', error);
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
}
