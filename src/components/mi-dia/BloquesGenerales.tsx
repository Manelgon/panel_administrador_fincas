'use client';

import Link from 'next/link';
import { Coins, CalendarDays, Palmtree, FileClock } from 'lucide-react';
import { cargarDeudasAbiertas, cargarReunionesProximas, cargarMisVacaciones, cargarContratosPreaviso } from '@/lib/miDia';
import BloqueMiDia, { type EdicionBloque } from './BloqueMiDia';
import { useCarga, Pill, Fila, Vacio, ErrorCarga, Cargando, nombreComunidad, diasHasta, fechaCorta } from './comun';

/** Deudas que hay que mover: las más antiguas sin pagar y las que están en disputa. Sin cifras: eso está en Deudas. */
export function BloqueDeudas({ edicion }: { edicion: EdicionBloque }) {
    const { datos, error } = useCarga(cargarDeudasAbiertas);

    return (
        <BloqueMiDia titulo="Deudas que mover" icono={Coins} general edicion={edicion}
            enlace={{ href: '/dashboard/deudas', texto: 'Ver deudas' }}>
            {error ? <ErrorCarga /> : !datos ? <Cargando /> : datos.items.length === 0 ? (
                <Vacio>No hay deudas abiertas.</Vacio>
            ) : (
                <ul>
                    {datos.items.map(d => (
                        <Fila key={d.id}>
                            <Link href={`/dashboard/deudas?id=${d.id}`} className="min-w-0 flex-1 group">
                                <p className="font-medium text-neutral-800 truncate group-hover:underline">{d.deudor}</p>
                                <p className="text-xs text-neutral-500 truncate">
                                    {nombreComunidad(d.comunidad)}
                                    {d.fecha_notificacion && ` · notificada hace ${-diasHasta(d.fecha_notificacion)} días`}
                                </p>
                            </Link>
                            {d.estado === 'En disputa' ? <Pill tono="ambar">En disputa</Pill> : <Pill tono="rojo">Sin pagar</Pill>}
                        </Fila>
                    ))}
                </ul>
            )}
        </BloqueMiDia>
    );
}

export function BloqueReuniones({ edicion }: { edicion: EdicionBloque }) {
    const { datos, error } = useCarga(cargarReunionesProximas);

    return (
        <BloqueMiDia titulo="Próximas reuniones" icono={CalendarDays} general edicion={edicion}
            enlace={{ href: '/dashboard/reuniones', texto: 'Ver reuniones' }}>
            {error ? <ErrorCarga /> : !datos ? <Cargando /> : datos.length === 0 ? (
                <Vacio>No hay reuniones en los próximos 7 días.</Vacio>
            ) : (
                <ul>
                    {datos.map(r => (
                        <Fila key={r.id}>
                            <div className="min-w-0 flex-1">
                                <p className="font-medium text-neutral-800 truncate">{nombreComunidad(r.comunidad)}</p>
                                {r.tipo && <p className="text-xs text-neutral-500 truncate">{r.tipo}</p>}
                            </div>
                            <span className={`text-xs flex-shrink-0 ${diasHasta(r.fecha_reunion) === 0 ? 'font-bold text-yellow-700' : 'text-neutral-500'}`}>
                                {diasHasta(r.fecha_reunion) === 0 ? 'Hoy' : fechaCorta(r.fecha_reunion)}
                            </span>
                        </Fila>
                    ))}
                </ul>
            )}
        </BloqueMiDia>
    );
}

const ESTADO_VAC: Record<string, { tono: 'verde' | 'ambar'; texto: string }> = {
    APROBADA: { tono: 'verde', texto: 'Aprobada' },
    PENDIENTE: { tono: 'ambar', texto: 'Pendiente' },
};

export function BloqueVacaciones({ edicion }: { edicion: EdicionBloque }) {
    const { datos, error } = useCarga(cargarMisVacaciones);

    return (
        <BloqueMiDia titulo="Mis vacaciones" icono={Palmtree} edicion={edicion}
            enlace={{ href: '/dashboard/fichaje', texto: 'Ver' }}>
            {error ? <ErrorCarga /> : !datos ? <Cargando /> : (
                <ul>
                    {datos.proximas.length === 0 && (
                        <Fila><span className="text-neutral-400">No tienes vacaciones próximas solicitadas.</span></Fila>
                    )}
                    {datos.proximas.map(v => (
                        <Fila key={v.id}>
                            <span className="text-neutral-800">{fechaCorta(v.date_from)} – {fechaCorta(v.date_to)}</span>
                            {ESTADO_VAC[v.status] && <Pill tono={ESTADO_VAC[v.status].tono}>{ESTADO_VAC[v.status].texto}</Pill>}
                        </Fila>
                    ))}
                    {datos.diasDisponibles !== null && (
                        <Fila>
                            <span className="text-neutral-600">Días de vacaciones disponibles</span>
                            <span className="font-bold text-neutral-900">{datos.diasDisponibles}</span>
                        </Fila>
                    )}
                </ul>
            )}
        </BloqueMiDia>
    );
}

function PlazoPreaviso({ fecha }: { fecha: string }) {
    const d = diasHasta(fecha);
    if (d < 0) return <Pill tono="rojo">Preaviso vencido</Pill>;
    if (d === 0) return <Pill tono="ambar">Preaviso hoy</Pill>;
    return <Pill tono={d <= 7 ? 'ambar' : 'gris'}>En {d} {d === 1 ? 'día' : 'días'}</Pill>;
}

/** Contratos cuyo preaviso vence en 30 días o ya venció (con el contrato aún en vigor) */
export function BloqueContratos({ edicion }: { edicion: EdicionBloque }) {
    const { datos, error } = useCarga(cargarContratosPreaviso);

    return (
        <BloqueMiDia titulo="Contratos con preaviso" icono={FileClock} contador={datos?.total} general edicion={edicion}
            enlace={{ href: '/dashboard/proveedores?tab=contratos', texto: 'Ver contratos' }}>
            {error ? <ErrorCarga /> : !datos ? <Cargando /> : datos.items.length === 0 ? (
                <Vacio>Ningún preaviso de contrato vence en los próximos 30 días.</Vacio>
            ) : (
                <ul>
                    {datos.items.map(c => (
                        <Fila key={c.id}>
                            <div className="min-w-0 flex-1">
                                <p className="font-medium text-neutral-800 truncate">
                                    {[c.tipo_servicio, c.proveedor].filter(Boolean).join(' · ') || 'Contrato'}
                                </p>
                                <p className="text-xs text-neutral-500 truncate">
                                    {nombreComunidad(c.comunidad)} · preaviso {fechaCorta(c.fecha_preaviso)}
                                </p>
                            </div>
                            <PlazoPreaviso fecha={c.fecha_preaviso} />
                        </Fila>
                    ))}
                </ul>
            )}
        </BloqueMiDia>
    );
}
