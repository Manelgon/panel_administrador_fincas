'use client';

import { useMemo } from 'react';
import { AlertTriangle, CalendarClock } from 'lucide-react';
import {
    Categoria, ChecklistTarea, agruparPorCategoria, agruparTareas, estadoFecha, progreso,
} from '@/lib/checklists';

interface Props {
    tareas: ChecklistTarea[];
    categorias: Categoria[];
}

const DIAS_PROXIMAS = 7;

function diasHasta(fecha: string) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const [y, m, d] = fecha.split('-').map(Number);
    return Math.round((new Date(y, m - 1, d).getTime() - hoy.getTime()) / 86400000);
}

function irA(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Panel fijo a la derecha del checklist: índice de categorías y avisos de fechas.
export default function ResumenLateral({ tareas, categorias }: Props) {
    const grupos = useMemo(
        () => agruparPorCategoria(agruparTareas(tareas), categorias),
        [tareas, categorias],
    );

    // Tareas y subtareas sin hacer con fecha vencida o dentro de los próximos días
    const avisos = useMemo(() => tareas
        .filter(t => !t.hecho && t.fecha_limite && diasHasta(t.fecha_limite) <= DIAS_PROXIMAS)
        .map(t => ({ tarea: t, dias: diasHasta(t.fecha_limite!) }))
        .sort((a, b) => a.dias - b.dias), [tareas]);

    const vencidas = avisos.filter(a => a.dias < 0).length;

    return (
        <aside className="space-y-4 lg:sticky lg:top-6">
            <div className="bg-white rounded-xl border border-neutral-200 shadow-sm p-4">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-neutral-900 pb-2 mb-3 border-b border-yellow-400">
                    Categorías
                </h3>
                {grupos.length === 0 ? (
                    <p className="text-xs text-neutral-500">Sin tareas todavía.</p>
                ) : (
                    <ul className="space-y-1">
                        {grupos.map(g => {
                            const { hechas, total, pct } = progreso(g.tareas);
                            const completo = total > 0 && hechas === total;
                            return (
                                <li key={g.categoria?.id ?? 'otros'}>
                                    <button
                                        type="button"
                                        onClick={() => irA(`categoria-${g.categoria?.id ?? 'otros'}`)}
                                        className="w-full text-left rounded-lg px-2 py-1.5 hover:bg-neutral-50 transition-colors"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-xs font-semibold text-neutral-800 truncate">{g.categoria?.nombre ?? 'Otros'}</span>
                                            <span className={`text-[11px] font-semibold tabular-nums ${completo ? 'text-green-600' : 'text-neutral-500'}`}>
                                                {hechas}/{total}
                                            </span>
                                        </div>
                                        <div className="mt-1 h-1 rounded-full bg-neutral-100 overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${completo ? 'bg-green-500' : 'bg-yellow-400'}`}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            <div className="bg-white rounded-xl border border-neutral-200 shadow-sm p-4">
                <h3 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-900 pb-2 mb-3 border-b border-yellow-400">
                    {vencidas > 0
                        ? <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                        : <CalendarClock className="w-3.5 h-3.5" />}
                    Vencidas y próximas
                </h3>
                {avisos.length === 0 ? (
                    <p className="text-xs text-neutral-500">
                        Nada vencido ni con fecha en los próximos {DIAS_PROXIMAS} días.
                    </p>
                ) : (
                    <ul className="space-y-1">
                        {avisos.map(({ tarea }) => {
                            const fecha = estadoFecha(tarea.fecha_limite, false);
                            return (
                                <li key={tarea.id}>
                                    <button
                                        type="button"
                                        onClick={() => irA(`tarea-${tarea.id}`)}
                                        className="w-full flex items-start justify-between gap-2 text-left rounded-lg px-2 py-1.5 hover:bg-neutral-50 transition-colors"
                                    >
                                        <span className="text-xs text-neutral-800 line-clamp-2">{tarea.titulo}</span>
                                        {fecha && (
                                            <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${fecha.clase}`}>
                                                {fecha.texto}
                                            </span>
                                        )}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </aside>
    );
}
