'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

/** Evento que lanza el editor de checklists tras cualquier cambio, para refrescar el contador */
export const EVENTO_CHECKLISTS = 'checklistsChanged';

const REFRESCO_MS = 60_000;

async function contarPendientes(): Promise<number> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return 0;

    const { count } = await supabase
        .from('checklist_item_responsables')
        .select('item_id, checklist_items!inner(hecho, checklists!inner(activo))', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
        .eq('checklist_items.hecho', false)
        .eq('checklist_items.checklists.activo', true);
    return count ?? 0;
}

/**
 * Nº de tareas y subtareas de checklist pendientes asignadas al usuario conectado
 * (solo checklists activos). Se refresca al navegar, al cambiar algo en un checklist
 * y cada minuto.
 */
export function useMisTareasChecklist(pathname: string) {
    const [pendientes, setPendientes] = useState(0);

    useEffect(() => {
        let vivo = true;
        const refrescar = () => contarPendientes().then(n => { if (vivo) setPendientes(n); });
        refrescar();
        window.addEventListener(EVENTO_CHECKLISTS, refrescar);
        const intervalo = setInterval(refrescar, REFRESCO_MS);
        return () => {
            vivo = false;
            window.removeEventListener(EVENTO_CHECKLISTS, refrescar);
            clearInterval(intervalo);
        };
    }, [pathname]);

    return pendientes;
}
