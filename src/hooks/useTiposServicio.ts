'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export interface TipoServicio {
    id: number;
    nombre: string;
    activo: boolean;
}

// Compara nombres ignorando mayúsculas, tildes y espacios sobrantes, para
// detectar duplicados del tipo "Ascensores" / "ASCENSORES " / "ascensores".
export function normalizarNombreTipo(nombre: string): string {
    return nombre
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

// Catálogo de tipos de servicio de contratos (tabla tipos_servicio_contrato).
export function useTiposServicio() {
    const [tipos, setTipos] = useState<TipoServicio[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchTipos = useCallback(async () => {
        const { data, error } = await supabase
            .from('tipos_servicio_contrato')
            .select('id, nombre, activo')
            .order('nombre');
        if (!error && data) setTipos(data as TipoServicio[]);
        setLoading(false);
    }, []);

    useEffect(() => { fetchTipos(); }, [fetchTipos]);

    // Crea un tipo nuevo. Devuelve el nombre existente si ya había uno
    // equivalente, para no llenar el catálogo de duplicados.
    const crearTipo = useCallback(async (nombre: string): Promise<{ nombre: string; yaExistia: boolean } | null> => {
        const limpio = nombre.replace(/\s+/g, ' ').trim();
        if (!limpio) return null;

        const existente = tipos.find(t => normalizarNombreTipo(t.nombre) === normalizarNombreTipo(limpio));
        if (existente) return { nombre: existente.nombre, yaExistia: true };

        const { data, error } = await supabase
            .from('tipos_servicio_contrato')
            .insert({ nombre: limpio, activo: true })
            .select('id, nombre, activo')
            .single();
        if (error || !data) return null;

        setTipos(prev => [...prev, data as TipoServicio].sort((a, b) => a.nombre.localeCompare(b.nombre)));
        return { nombre: (data as TipoServicio).nombre, yaExistia: false };
    }, [tipos]);

    return { tipos, loading, fetchTipos, crearTipo };
}
