'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { ComunidadRef } from '@/lib/miDia';

/** Carga asíncrona sencilla con recarga manual y por eventos del panel */
export function useCarga<T>(cargar: () => Promise<T>, eventos: string[] = []) {
    const [datos, setDatos] = useState<T | null>(null);
    const [error, setError] = useState(false);

    const recargar = useCallback(() => {
        cargar()
            .then(d => { setDatos(d); setError(false); })
            .catch(e => { console.error('[mi-dia]', e); setError(true); });
    }, [cargar]);

    useEffect(() => {
        recargar();
        eventos.forEach(ev => window.addEventListener(ev, recargar));
        return () => eventos.forEach(ev => window.removeEventListener(ev, recargar));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [recargar]);

    return { datos, error, recargar, setDatos };
}

type Tono = 'rojo' | 'ambar' | 'gris' | 'verde' | 'azul';

const TONOS: Record<Tono, string> = {
    rojo: 'bg-red-50 text-red-700',
    ambar: 'bg-yellow-100 text-yellow-800',
    gris: 'bg-neutral-100 text-neutral-600',
    verde: 'bg-emerald-50 text-emerald-700',
    azul: 'bg-blue-50 text-blue-700',
};

export function Pill({ tono, children }: { tono: Tono; children: ReactNode }) {
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${TONOS[tono]}`}>
            {children}
        </span>
    );
}

export function nombreComunidad(c: ComunidadRef): string {
    if (!c) return 'Todas las comunidades';
    return c.codigo ? `${c.codigo} · ${c.nombre_cdad}` : c.nombre_cdad;
}

/** Días naturales entre hoy y una fecha (negativo = pasada) */
export function diasHasta(fecha: string): number {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const f = new Date(fecha.slice(0, 10) + 'T00:00:00');
    return Math.round((f.getTime() - hoy.getTime()) / 86_400_000);
}

export function fechaCorta(fecha: string): string {
    return new Date(fecha.slice(0, 10) + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function haceCuanto(fecha: string): string {
    const min = Math.floor((Date.now() - new Date(fecha).getTime()) / 60_000);
    if (min < 60) return `hace ${Math.max(min, 1)} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `hace ${h} h`;
    const d = Math.floor(h / 24);
    return d === 1 ? 'ayer' : `hace ${d} días`;
}

export function duracion(seg: number | null): string {
    if (!seg) return '0 min';
    const h = Math.floor(seg / 3600);
    const m = Math.round((seg % 3600) / 60);
    return h ? `${h} h ${m} min` : `${m} min`;
}

export function Fila({ children }: { children: ReactNode }) {
    return <li className="flex items-center justify-between gap-3 py-2.5 border-t border-neutral-100 first:border-t-0 text-sm">{children}</li>;
}

export function Vacio({ children }: { children: ReactNode }) {
    return <p className="text-sm text-neutral-400 py-3">{children}</p>;
}

export function ErrorCarga() {
    return <p className="text-sm text-red-600 py-3">No se ha podido cargar este bloque.</p>;
}

export function Cargando() {
    return (
        <div className="space-y-2 py-1" aria-hidden="true">
            {[0, 1, 2].map(i => <div key={i} className="h-9 rounded-lg bg-neutral-100 animate-pulse" />)}
        </div>
    );
}
