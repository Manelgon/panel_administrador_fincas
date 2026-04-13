import { supabase as defaultSupabase } from './supabaseClient';

export type ActivityAction = 'create' | 'update' | 'delete' | 'mark_paid' | 'toggle_active' | 'update_password' | 'clock_in' | 'clock_out' | 'generate' | 'read' | 'start_task' | 'stop_task' | 'import_pdf';
export type EntityType = 'comunidad' | 'incidencia' | 'morosidad' | 'profile' | 'fichaje' | 'documento' | 'aviso' | 'proveedor' | 'sofia_incidencia' | 'informe_email' | 'task_timer' | 'importacion_pdf' | 'reunion';


interface LogActivityParams {
    action: ActivityAction;
    entityType: EntityType;
    entityId?: number;
    entityName?: string;
    details?: any;
    supabaseClient?: any; // Allow passing a server-side client
}

export async function logActivity({
    action,
    entityType,
    entityId,
    entityName,
    details,
    supabaseClient
}: LogActivityParams) {
    const client = supabaseClient || defaultSupabase;

    try {
        // Get current user
        const { data: { user } } = await client.auth.getUser();
        if (!user) {
            console.warn('[logActivity] No user found, skipping log');
            return;
        }

        // Get user profile for name
        const { data: profile } = await client
            .from('profiles')
            .select('nombre')
            .eq('user_id', user.id)
            .single();

        // Insert activity log
        await client.from('activity_logs').insert({
            user_id: user.id,
            user_name: profile?.nombre || user.email || 'Usuario',
            action,
            entity_type: entityType,
            entity_id: entityId,
            entity_name: entityName,
            details: details ? JSON.stringify(details) : null,
        });
    } catch (error) {
        console.error('Error logging activity:', error);
        // Don't throw - logging should not break the main operation
    }
}
