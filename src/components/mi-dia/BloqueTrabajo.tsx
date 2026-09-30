'use client';

import { History, Play } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cargarTrabajoReciente, seguirTrabajo, type TrabajoReciente } from '@/lib/miDia';
import BloqueMiDia, { type EdicionBloque } from './BloqueMiDia';
import { useCarga, Fila, Vacio, ErrorCarga, Cargando, nombreComunidad, duracion, haceCuanto } from './comun';

export default function BloqueTrabajo({ edicion }: { edicion: EdicionBloque }) {
    const { datos, error } = useCarga(cargarTrabajoReciente, ['taskTimerChanged']);

    const seguir = async (t: TrabajoReciente) => {
        try { await seguirTrabajo(t); toast.success('Cronómetro en marcha'); }
        catch (e) { toast.error(e instanceof Error ? e.message : 'No se pudo iniciar el cronómetro'); }
    };

    return (
        <BloqueMiDia titulo="Lo último que he trabajado" icono={History} edicion={edicion}
            enlace={{ href: '/dashboard/cronometraje', texto: 'Crono' }}>
            {error ? <ErrorCarga /> : !datos ? <Cargando /> : datos.length === 0 ? (
                <Vacio>Aún no has cronometrado ninguna tarea.</Vacio>
            ) : (
                <ul>
                    {datos.map(t => (
                        <Fila key={t.id}>
                            <div className="min-w-0 flex-1">
                                <p className="font-medium text-neutral-800 truncate">{t.tipo_tarea || t.nota || 'Tarea'}</p>
                                <p className="text-xs text-neutral-500 truncate">
                                    {nombreComunidad(t.comunidad)} · {duracion(t.duration_seconds)} · {haceCuanto(t.start_at)}
                                </p>
                            </div>
                            <button onClick={() => seguir(t)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-yellow-400 hover:bg-yellow-500 text-neutral-950 text-xs font-bold flex-shrink-0">
                                <Play className="w-3 h-3" aria-hidden="true" /> Seguir
                            </button>
                        </Fila>
                    ))}
                </ul>
            )}
        </BloqueMiDia>
    );
}
