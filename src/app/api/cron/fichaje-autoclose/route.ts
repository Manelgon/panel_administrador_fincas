import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        // Result is now an array of { id, user_id, start_at }
        const { data: closedSessions, error } = await supabaseAdmin.rpc('auto_close_stale_sessions');

        if (error) {
            console.error('Error in auto_close_stale_sessions:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const sessions = closedSessions || [];

        // Log activity for each closed session
        if (sessions.length > 0) {
            // Fetch profiles to get names for logging
            const userIds = [...new Set(sessions.map((s: any) => s.user_id))];
            const { data: profiles } = await supabaseAdmin
                .from('profiles')
                .select('user_id, nombre, apellido')
                .in('user_id', userIds);

            const profileMap = new Map(profiles?.map((p: any) => [p.user_id, p]) || []);

            const logs = sessions.map((session: any) => {
                const profile = profileMap.get(session.user_id);
                const userName = profile ? `${profile.nombre} ${profile.apellido || ''}`.trim() : 'Usuario Desconocido';

                return {
                    user_id: session.user_id, // Attributing the action to the user themselves, or maybe the system? 
                    // Keeping user_id as the affected user seems reasonable for filtering, 
                    // but usually user_id is "Who performed the action". 
                    // If I put the user_id, it looks like THEY clocked out.
                    // For now, I will use the user_id of the session owner, but the "user_name" field will say "SYSTEM (Auto-Close)" 
                    // or I keep the user name and the details clarify.
                    // Let's use the user's ID so it shows in their history if filtered by user_id,
                    // but the user_name in activity_logs is redundant if we have profiles joined.
                    // However, existing logActivity uses user.id.

                    user_name: 'SISTEMA (Auto-Close)', // Distinguish clearly that it wasn't them
                    action: 'clock_out',
                    entity_type: 'fichaje',
                    entity_id: session.id,
                    entity_name: `Fichaje - ${userName}`,
                    details: JSON.stringify({
                        method: 'auto_close_cron',
                        original_start: session.start_at
                    })
                };
            });

            const { error: logError } = await supabaseAdmin
                .from('activity_logs')
                .insert(logs);

            if (logError) {
                console.error('Error inserting activity logs:', logError);
            }
        }

        return NextResponse.json({
            success: true,
            closed_count: sessions.length,
            closed_sessions: sessions,
        });
    } catch (err: any) {
        console.error('Cron error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
