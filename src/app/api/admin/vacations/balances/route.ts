import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function isAdmin(userId: string) {
    const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('rol')
        .eq('user_id', userId)
        .maybeSingle();

    if (error) {
        console.error('isAdmin check error (balances):', error);
        return false;
    }
    return data?.rol === 'admin';
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const adminId = searchParams.get('adminId');
        const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());

        if (!adminId || !(await isAdmin(adminId))) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        // 1) Fetch all profiles
        const { data: profiles, error: profilesError } = await supabaseAdmin
            .from('profiles')
            .select('user_id, nombre, apellido')
            .order('nombre', { ascending: true });

        if (profilesError) {
            console.error('Fetch profiles error:', profilesError);
            throw profilesError;
        }

        // 2) Fetch balances for these profiles for the specific year
        const userIds = profiles.map(p => p.user_id);
        const { data: balances, error: balancesError } = await supabaseAdmin
            .from('vacation_balances')
            .select('*')
            .in('user_id', userIds)
            .eq('year', year);

        if (balancesError) {
            console.error('Fetch balances error:', balancesError);
            throw balancesError;
        }

        // 3) Merge data
        const merged = profiles.map(p => ({
            ...p,
            vacation_balances: balances.filter(b => b.user_id === p.user_id)
        }));

        return NextResponse.json(merged);
    } catch (error: any) {
        console.error('Admin balances GET error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { adminId, userId, year, balances } = body;

        if (!adminId || !(await isAdmin(adminId))) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        const { error } = await supabaseAdmin
            .from('vacation_balances')
            .upsert({
                user_id: userId,
                year: year,
                ...balances
            });

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
