'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

// Nº de contratos activos por comunidad o por proveedor (columna "Contratos"
// en las tablas de Clientes y Proveedores, PRP-004).
export function useContratosActivosCount(field: 'comunidad_id' | 'proveedor_id'): Map<number, number> {
    const [counts, setCounts] = useState<Map<number, number>>(new Map());

    useEffect(() => {
        const fetchCounts = async () => {
            const { data, error } = await supabase
                .from('contratos')
                .select(field)
                .eq('activo', true);
            if (error || !data) return;
            const map = new Map<number, number>();
            for (const row of data as unknown as Record<string, number | null>[]) {
                const id = row[field];
                if (id != null) map.set(id, (map.get(id) || 0) + 1);
            }
            setCounts(map);
        };
        fetchCounts();
    }, [field]);

    return counts;
}
