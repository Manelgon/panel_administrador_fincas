'use client';

import Link from 'next/link';
import { ListChecks } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cargarMiChecklist, marcarPuntoHecho, EVENTO_CHECKLISTS, type MiPuntoChecklist } from '@/lib/miDia';
import BloqueMiDia, { type EdicionBloque } from './BloqueMiDia';
import { useCarga, Pill, Fila, Vacio, ErrorCarga, Cargando, nombreComunidad, diasHasta } from './comun';

function Plazo({ fecha }: { fecha: string | null }) {
    if (!fecha) return <Pill tono="gris">Sin fecha</Pill>;
    const d = diasHasta(fecha);
    if (d < 0) return <Pill tono="rojo">Vencido</Pill>;
    if (d === 0) return <Pill tono="ambar">Hoy</Pill>;
    if (d <= 3) return <Pill tono="ambar">En {d} {d === 1 ? 'día' : 'días'}</Pill>;
    return <Pill tono="gris">En {d} días</Pill>;
}

export default function BloqueChecklist({ edicion }: { edicion: EdicionBloque }) {
    const { datos, error, setDatos } = useCarga(cargarMiChecklist, [EVENTO_CHECKLISTS]);

    const tachar = async (p: MiPuntoChecklist) => {
        // Se quita al momento; si falla, se vuelve a poner
        const antes = datos;
        setDatos(d => d && { items: d.items.filter(i => i.id !== p.id), total: d.total - 1 });
        try {
            await marcarPuntoHecho(p.id);
            toast.success('Hecho');
            window.dispatchEvent(new Event(EVENTO_CHECKLISTS));
        } catch (e) {
            console.error(e);
            setDatos(antes);
            toast.error('No se pudo marcar el punto');
        }
    };

    return (
        <BloqueMiDia titulo="Mi checklist" icono={ListChecks} contador={datos?.total} edicion={edicion}
            enlace={{ href: '/dashboard/checklists', texto: 'Ver todos' }}>
            {error ? <ErrorCarga /> : !datos ? <Cargando /> : datos.items.length === 0 ? (
                <Vacio>No tienes puntos de checklist pendientes.</Vacio>
            ) : (
                <ul>
                    {datos.items.map(p => (
                        <Fila key={p.id}>
                            <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                <input type="checkbox" onChange={() => tachar(p)}
                                    className="mt-1 w-4 h-4 accent-yellow-500 cursor-pointer flex-shrink-0"
                                    aria-label={`Marcar como hecho: ${p.titulo}`} />
                                <Link href={`/dashboard/checklists/${p.checklist_id}`} className="min-w-0 group">
                                    <p className="font-medium text-neutral-800 truncate group-hover:underline">{p.titulo}</p>
                                    <p className="text-xs text-neutral-500 truncate">{p.comunidad ? nombreComunidad(p.comunidad) : 'Sin comunidad'} · {p.checklist}</p>
                                </Link>
                            </div>
                            <Plazo fecha={p.fecha_limite} />
                        </Fila>
                    ))}
                </ul>
            )}
        </BloqueMiDia>
    );
}
