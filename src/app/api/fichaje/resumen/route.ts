import { NextResponse } from "next/server";
import { supabaseRouteClient } from "@/lib/supabase/route";

/**
 * GET /api/fichaje/resumen?user_id=X&month=YYYY-MM
 * 
 * Returns monthly summary:
 * - total_hours
 * - worked_days
 * - days: array of daily details
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('user_id');
    const month = searchParams.get('month'); // Format: YYYY-MM

    if (!month) {
        return NextResponse.json({ error: "Month is required (YYYY-MM)" }, { status: 400 });
    }

    const supabase = await supabaseRouteClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Role check: Admin can view any user, Employee only their own
    const { data: profile } = await supabase
        .from('profiles')
        .select('rol')
        .eq('user_id', user.id)
        .single();

    const targetUserId = (profile?.rol === 'admin' && userId) ? userId : user.id;

    // 2. Get Detailed Entries for this month
    const startOfMonth = `${month}-01`;
    const { data: entries, error: entriesError } = await supabase
        .from('time_entries')
        .select('*')
        .eq('user_id', targetUserId)
        .gte('start_at', `${startOfMonth}T00:00:00`)
        .lt('start_at', `${getNextMonth(month)}T00:00:00`)
        .order('start_at', { ascending: true });

    if (entriesError) {
        console.error("Error fetching entries:", entriesError);
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }

    // 3. Construct Response
    // Group entries by day
    const entriesByDay: Record<string, any[]> = {};
    const hoursByDay: Record<string, number> = {};

    entries?.forEach(entry => {
        const date = entry.start_at.split('T')[0];
        if (!entriesByDay[date]) {
            entriesByDay[date] = [];
            hoursByDay[date] = 0;
        }

        const start = new Date(entry.start_at).getTime();
        // If no end_at, assume currently working. We calculate up to 'now' for the summary.
        // But to be consistent with time_entries, usually we don't count open entries, or we count up to now.
        // Let's count up to now if there's no end_at
        const end = entry.end_at ? new Date(entry.end_at).getTime() : new Date().getTime();
        const durationHours = (end - start) / (1000 * 60 * 60);
        
        hoursByDay[date] += durationHours;

        entriesByDay[date].push({
            start: formatTime(entry.start_at),
            end: entry.end_at ? formatTime(entry.end_at) : null,
            closed_by: entry.closed_by || 'user'
        });
    });

    const totalHours = Object.values(hoursByDay).reduce((acc, curr) => acc + curr, 0);
    const workedDays = Object.keys(hoursByDay).length;

    const days = Object.keys(entriesByDay).map(date => ({
        date,
        hours: Number(hoursByDay[date]),
        entries: entriesByDay[date]
    })).sort((a, b) => a.date.localeCompare(b.date));

    // Get user name for display
    const { data: targetProfile } = await supabase
        .from('profiles')
        .select('nombre, apellido')
        .eq('user_id', targetUserId)
        .single();

    return NextResponse.json({
        user: targetProfile ? `${targetProfile.nombre} ${targetProfile.apellido || ''}`.trim() : 'Usuario',
        month,
        total_hours: Number(totalHours.toFixed(2)),
        worked_days: workedDays,
        days: days || []
    });
}

function getNextMonth(yyyyMM: string) {
    const [year, month] = yyyyMM.split('-').map(Number);
    const date = new Date(year, month, 1); // This is actually next month because month is 0-indexed in Date but 1-indexed in string... wait
    // Date(2023, 0, 1) is Jan 1st
    // If input is 2023-01. month var is 1.
    // Date(2023, 1, 1) is Feb 1st. Correct.
    const nextY = date.getFullYear();
    const nextM = String(date.getMonth() + 1).padStart(2, '0');
    return `${nextY}-${nextM}-01`;
}

function formatTime(isoString: string) {
    if (!isoString) return null;
    return new Date(isoString).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}
