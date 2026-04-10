import { NextResponse } from 'next/server';
import { supabaseRouteClient } from '@/lib/supabase/route';
import { supabaseAdmin } from '@/lib/supabase/admin';

// Primary Admin Client for cross-table operations
export async function POST(request: Request) {
    try {
        const { sofiaId, gestorId, comunidadId } = await request.json();

        if (!sofiaId || !gestorId || !comunidadId) {
            return NextResponse.json({ error: 'Faltan datos de transferencia (Sofia ID, Gestor o Comunidad)' }, { status: 400 });
        }

        // 1. Fetch original record from secondary
        const { data: sofiaRecord, error: fetchError } = await supabaseAdmin
            .from('incidencias_serincobot')
            .select('*')
            .eq('id', sofiaId)
            .single();

        if (fetchError || !sofiaRecord) {
            return NextResponse.json({ error: 'No se encontró el registro original en Sofia' }, { status: 404 });
        }

        // 2. Resolve "Sofia-Bot" profile ID from primary
        const { data: botProfile, error: botError } = await supabaseAdmin
            .from('profiles')
            .select('user_id')
            .eq('nombre', 'Sofia-Bot')
            .single();

        if (botError || !botProfile) {
            console.error('Bot profile not found:', botError);
            // Fallback or handle error? For now, we need this to track origin correctly.
        }

        // 3. Prepare data for primary table
        const newIncidentData = {
            comunidad_id: comunidadId,
            nombre_cliente: sofiaRecord.nombre_cliente,
            telefono: sofiaRecord.telefono,
            email: sofiaRecord.email,
            mensaje: sofiaRecord.mensaje,
            urgencia: sofiaRecord.urgencia || 'Media',
            resuelto: sofiaRecord.resuelto || false,
            created_at: sofiaRecord.created_at || new Date().toISOString(),
            quien_lo_recibe: botProfile?.user_id || null, // Origin is the Bot
            gestor_asignado: gestorId, // Target is the selected gestor
            adjuntos: sofiaRecord.adjuntos || [],
            aviso: sofiaRecord.aviso || false,
            id_email_gestion: sofiaRecord.id_email_gestion || null
        };

        // 4. Insert into primary table
        const { data: newIncident, error: insertError } = await supabaseAdmin
            .from('incidencias')
            .insert([newIncidentData])
            .select()
            .single();

        if (insertError) {
            console.error('Insert error details:', insertError);
            return NextResponse.json({
                error: 'Error al crear el ticket en la base principal',
                details: insertError.message,
                code: insertError.code
            }, { status: 500 });
        }

        // 5. Migrate Chat Messages
        // We update entity_type to 'incidencia' and entity_id to the new incident ID
        const { error: chatError } = await supabaseAdmin
            .from('record_messages')
            .update({
                entity_type: 'incidencia',
                entity_id: newIncident.id
            })
            .eq('entity_type', 'sofia_incidencia')
            .eq('entity_id', sofiaId);

        if (chatError) {
            console.error('Chat migration error (non-fatal):', chatError);
            // We don't fail the whole process for chat, but it's important
        }

        // 6. Delete from secondary table
        const { error: deleteError } = await supabaseAdmin
            .from('incidencias_serincobot')
            .delete()
            .eq('id', sofiaId);

        if (deleteError) {
            console.error('Cleanup error (bot DB):', deleteError);
            // Non-fatal for the user, but leaves garbage
        }

        return NextResponse.json({ success: true, newId: newIncident.id });

    } catch (error: any) {
        console.error('Transfer API error:', error);
        return NextResponse.json({ error: error.message || 'Error interno en la transferencia' }, { status: 500 });
    }
}
