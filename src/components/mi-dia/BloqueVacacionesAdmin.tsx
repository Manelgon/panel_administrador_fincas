'use client';

import { useState } from 'react';
import { CalendarCheck, Check, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cargarVacacionesPorAprobar, resolverSolicitud, type SolicitudVacaciones } from '@/lib/miDia';
import BloqueMiDia, { type EdicionBloque } from './BloqueMiDia';
import { useCarga, Fila, Vacio, ErrorCarga, Cargando, fechaCorta } from './comun';

const TIPO: Record<string, string> = {
    VACACIONES: 'Vacaciones',
    RETRIBUIDO: 'Permiso retribuido',
    NO_RETRIBUIDO: 'Permiso no retribuido',
};

/** Solo admins: solicitudes pendientes del equipo, para aprobar o rechazar sin ir a Control Horario */
export default function BloqueVacacionesAdmin({ edicion }: { edicion: EdicionBloque }) {
    const { datos, error, recargar } = useCarga(cargarVacacionesPorAprobar);
    const [ocupado, setOcupado] = useState<number | null>(null);
    const [rechazando, setRechazando] = useState<number | null>(null);

    const resolver = async (s: SolicitudVacaciones, status: 'APROBADA' | 'RECHAZADA') => {
        setOcupado(s.id);
        try {
            await resolverSolicitud(s.id, status);
            toast.success(status === 'APROBADA' ? 'Solicitud aprobada' : 'Solicitud rechazada');
            recargar();
        } catch (e) {
            console.error(e);
            toast.error('No se pudo actualizar la solicitud');
        } finally {
            setOcupado(null);
            setRechazando(null);
        }
    };

    return (
        <BloqueMiDia titulo="Vacaciones por aprobar" icono={CalendarCheck} contador={datos?.length} edicion={edicion}
            enlace={{ href: '/dashboard/fichaje/admin', texto: 'Control horario' }}>
            {error ? <ErrorCarga /> : !datos ? <Cargando /> : datos.length === 0 ? (
                <Vacio>No hay solicitudes pendientes de aprobar.</Vacio>
            ) : (
                <ul>
                    {datos.map(s => (
                        <Fila key={s.id}>
                            <div className="min-w-0 flex-1">
                                <p className="font-medium text-neutral-800 truncate">{s.persona}</p>
                                <p className="text-xs text-neutral-500 truncate" title={s.comment_user ?? undefined}>
                                    {TIPO[s.type] ?? s.type} · {fechaCorta(s.date_from)} – {fechaCorta(s.date_to)} · {s.days_count} {Number(s.days_count) === 1 ? 'día' : 'días'}
                                </p>
                            </div>
                            {rechazando === s.id ? (
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    <span className="text-xs text-neutral-500">¿Rechazar?</span>
                                    <button disabled={ocupado === s.id} onClick={() => resolver(s, 'RECHAZADA')}
                                        className="px-2 py-1 rounded-md bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50">Sí</button>
                                    <button onClick={() => setRechazando(null)}
                                        className="px-2 py-1 rounded-md text-neutral-600 text-xs font-semibold hover:bg-neutral-100">No</button>
                                </div>
                            ) : (
                            <div className="flex items-center gap-1 flex-shrink-0">
                                <button disabled={ocupado === s.id} onClick={() => resolver(s, 'APROBADA')}
                                    className="flex items-center gap-1 px-2 py-1 rounded-md bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 disabled:opacity-50">
                                    <Check className="w-3.5 h-3.5" aria-hidden="true" /> Aprobar
                                </button>
                                <button disabled={ocupado === s.id} onClick={() => setRechazando(s.id)}
                                    className="p-1.5 rounded-md text-neutral-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                                    aria-label={`Rechazar solicitud de ${s.persona}`} title="Rechazar">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            )}
                        </Fila>
                    ))}
                </ul>
            )}
        </BloqueMiDia>
    );
}
