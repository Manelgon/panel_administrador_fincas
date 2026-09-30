'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ListTodo, Check, Pause } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cargarMisTareas, resolverTarea, aplazarTarea, type MiTarea } from '@/lib/miDia';
import BloqueMiDia, { type EdicionBloque } from './BloqueMiDia';
import { useCarga, Pill, Fila, Vacio, ErrorCarga, Cargando, nombreComunidad, diasHasta, fechaCorta } from './comun';

function EstadoTarea({ t }: { t: MiTarea }) {
    if (t.fecha_recordatorio) {
        const d = diasHasta(t.fecha_recordatorio);
        if (d < 0) return <Pill tono="rojo">Recordatorio vencido</Pill>;
        if (d === 0) return <Pill tono="ambar">Recordatorio hoy</Pill>;
        if (t.estado === 'Aplazado') return <Pill tono="gris">Aplazada hasta {fechaCorta(t.fecha_recordatorio)}</Pill>;
    }
    if (t.urgencia === 'Alta') return <Pill tono="rojo">Urgencia alta</Pill>;
    if (t.urgencia === 'Media') return <Pill tono="ambar">Urgencia media</Pill>;
    return <Pill tono="gris">Pendiente</Pill>;
}

function manana(): string {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
}

/** Acciones rápidas: resolver (con confirmación) y aplazar a una fecha */
function AccionesTarea({ t, onHecho }: { t: MiTarea; onHecho: () => void }) {
    const [modo, setModo] = useState<'nada' | 'resolver' | 'aplazar'>('nada');
    const [fecha, setFecha] = useState(manana());
    const [ocupado, setOcupado] = useState(false);

    const ejecutar = async (accion: () => Promise<void>, ok: string) => {
        setOcupado(true);
        try { await accion(); toast.success(ok); onHecho(); }
        catch (e) { console.error(e); toast.error('No se pudo actualizar la tarea'); }
        finally { setOcupado(false); setModo('nada'); }
    };

    const base = 'px-2 py-1 rounded-md text-xs font-semibold transition disabled:opacity-50';

    if (modo === 'resolver') return (
        <div className="flex items-center gap-1">
            <span className="text-xs text-neutral-500">¿Resolver?</span>
            <button disabled={ocupado} onClick={() => ejecutar(() => resolverTarea(t), 'Tarea resuelta')} className={`${base} bg-neutral-900 text-white hover:bg-neutral-800`}>Sí</button>
            <button disabled={ocupado} onClick={() => setModo('nada')} className={`${base} text-neutral-600 hover:bg-neutral-100`}>No</button>
        </div>
    );

    if (modo === 'aplazar') return (
        <div className="flex items-center gap-1">
            <input type="date" value={fecha} min={manana()} onChange={e => setFecha(e.target.value)}
                className="border border-neutral-200 rounded-md px-1.5 py-0.5 text-xs" aria-label="Aplazar hasta" />
            <button disabled={ocupado || !fecha} onClick={() => ejecutar(() => aplazarTarea(t, fecha), 'Tarea aplazada')} className={`${base} bg-yellow-400 text-neutral-950 hover:bg-yellow-500`}>Aplazar</button>
            <button disabled={ocupado} onClick={() => setModo('nada')} className={`${base} text-neutral-600 hover:bg-neutral-100`}>✕</button>
        </div>
    );

    return (
        <div className="flex items-center gap-1">
            <button onClick={() => setModo('resolver')} className="p-1.5 rounded-md text-neutral-500 hover:bg-emerald-50 hover:text-emerald-700" title="Resolver" aria-label={`Resolver ${t.titulo}`}>
                <Check className="w-4 h-4" />
            </button>
            <button onClick={() => setModo('aplazar')} className="p-1.5 rounded-md text-neutral-500 hover:bg-yellow-50 hover:text-yellow-700" title="Aplazar" aria-label={`Aplazar ${t.titulo}`}>
                <Pause className="w-4 h-4" />
            </button>
        </div>
    );
}

export default function BloqueTareas({ edicion }: { edicion: EdicionBloque }) {
    const { datos, error, recargar } = useCarga(cargarMisTareas);

    return (
        <BloqueMiDia titulo="Mis tareas" icono={ListTodo} contador={datos?.total} edicion={edicion}
            enlace={{ href: '/dashboard/incidencias', texto: 'Ver todas' }}>
            {error ? <ErrorCarga /> : !datos ? <Cargando /> : datos.items.length === 0 ? (
                <Vacio>No tienes tareas pendientes asignadas.</Vacio>
            ) : (
                <ul>
                    {datos.items.map(t => (
                        <Fila key={t.id}>
                            <Link href={`/dashboard/incidencias?id=${t.id}`} className="min-w-0 flex-1 group">
                                <p className="font-medium text-neutral-800 truncate group-hover:underline">{t.titulo}</p>
                                <p className="text-xs text-neutral-500 truncate">{nombreComunidad(t.comunidad)}{t.cliente ? ` · ${t.cliente}` : ''}</p>
                            </Link>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="hidden sm:inline"><EstadoTarea t={t} /></span>
                                <AccionesTarea t={t} onHecho={recargar} />
                            </div>
                        </Fila>
                    ))}
                </ul>
            )}
        </BloqueMiDia>
    );
}
