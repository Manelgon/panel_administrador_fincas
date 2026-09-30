'use client';

import { useState } from 'react';
import { Check, ChevronDown, ChevronRight, MoreHorizontal, RotateCcw } from 'lucide-react';
import MenuAccionesTarea, { AccionesTarea } from '@/components/checklists/MenuAccionesTarea';
import { Ancla } from '@/components/checklists/PanelFlotante';
import { Categoria, ChecklistTarea, ModoLista, Persona, estadoFecha, formatoFechaHora, iniciales } from '@/lib/checklists';

/** Arrastrar para reordenar: lo controla TareasEditor */
export interface PropsArrastre {
    /** Esta fila es la que se está arrastrando */
    arrastrando: boolean;
    /** Dónde caería la tarea arrastrada respecto a esta fila */
    marca: 'antes' | 'despues' | null;
    /** Se puede soltar aquí (misma categoría o misma tarea madre) */
    aceptaSoltar: boolean;
    onInicio: () => void;
    onSobre: (lado: 'antes' | 'despues') => void;
    onSoltar: () => void;
    onFin: () => void;
}

interface Props extends AccionesTarea {
    modo: ModoLista;
    tarea: ChecklistTarea;
    nombrePorId: Record<string, string>;
    /** Equipo para asignar responsables (solo checklists) */
    personas?: Persona[];
    /** Catálogo para mover de categoría (solo tareas principales) */
    categorias?: Categoria[];
    esSubtarea?: boolean;
    /** Progreso de subtareas ("2 de 5"), solo en checklists con subtareas */
    subtareas?: { hechas: number; total: number };
    numSubtareas?: number;
    abierta?: boolean;
    onAlternar?: () => void;
    arrastre: PropsArrastre;
}

const formatoCorto = (iso: string) =>
    new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function TareaFila(props: Props) {
    const {
        modo, tarea, nombrePorId, personas = [], categorias = [], esSubtarea, subtareas, numSubtareas = 0,
        abierta, onAlternar, arrastre,
        onMarcar, onEditar, onBorrar, onNuevaSubtarea, onResponsables, onMoverCategoria, onCrearCategoria,
    } = props;
    const [menu, setMenu] = useState<Ancla | null>(null);
    const esChecklist = modo === 'checklist';
    const fecha = esChecklist ? estadoFecha(tarea.fecha_limite, tarea.hecho) : null;
    const responsables = (tarea.responsables || []).map(id => nombrePorId[id]).filter(Boolean);

    // Último cambio de estado, discreto a la derecha: quién la realizó o la reabrió
    const estado = tarea.hecho && tarea.completado_at
        ? { hecho: true, texto: 'Realizada', nombre: tarea.completado_por_nombre, fecha: tarea.completado_at }
        : !tarea.hecho && tarea.ultimo_evento?.accion === 'reabierta'
            ? { hecho: false, texto: 'Reabierta', nombre: tarea.ultimo_evento.nombre, fecha: tarea.ultimo_evento.fecha }
            : null;

    // Clic en cualquier parte de la tarea que no sea un botón → menú de acciones en ese punto
    const abrirMenu = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('button, a, input, textarea, select')) return;
        setMenu({ top: e.clientY, bottom: e.clientY, left: e.clientX });
    };

    const abrirConTeclado = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
        e.preventDefault();
        const r = e.currentTarget.getBoundingClientRect();
        setMenu({ top: r.top, bottom: r.bottom, left: r.left });
    };

    return (
        <div
            id={`tarea-${tarea.id}`}
            role="button"
            tabIndex={0}
            aria-haspopup="menu"
            onClick={abrirMenu}
            onKeyDown={abrirConTeclado}
            draggable
            onDragStart={e => {
                e.stopPropagation();
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(tarea.id));
                setMenu(null);
                arrastre.onInicio();
            }}
            onDragOver={e => {
                if (!arrastre.aceptaSoltar) return;
                e.preventDefault();
                e.stopPropagation();
                const r = e.currentTarget.getBoundingClientRect();
                arrastre.onSobre(e.clientY < r.top + r.height / 2 ? 'antes' : 'despues');
            }}
            onDrop={e => {
                if (!arrastre.aceptaSoltar) return;
                e.preventDefault();
                e.stopPropagation();
                arrastre.onSoltar();
            }}
            onDragEnd={arrastre.onFin}
            className={`group relative flex items-start ${arrastre.arrastrando ? 'opacity-40' : ''} gap-3 px-4 py-3 scroll-mt-6 cursor-pointer transition-colors ${esSubtarea ? 'hover:bg-yellow-50' : 'hover:bg-neutral-50/80'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-yellow-400/50 ${menu ? (esSubtarea ? 'bg-yellow-50' : 'bg-neutral-50') : ''} ${esSubtarea ? 'py-2.5 border-b border-neutral-100 last:border-b-0' : ''}`}
        >
            {arrastre.marca && (
                <span
                    aria-hidden="true"
                    className={`pointer-events-none absolute left-2 right-2 h-0.5 rounded-full bg-yellow-400 ${arrastre.marca === 'antes' ? 'top-0' : 'bottom-0'}`}
                />
            )}

            {esChecklist ? (
                <button
                    type="button"
                    onClick={onMarcar}
                    aria-label={tarea.hecho ? 'Marcar como pendiente' : 'Marcar como hecha'}
                    className={`mt-0.5 shrink-0 flex items-center justify-center rounded-full border-2 transition-colors ${esSubtarea ? 'w-4 h-4' : 'w-5 h-5'} ${tarea.hecho
                        ? 'bg-yellow-400 border-yellow-400 text-neutral-950'
                        : 'border-neutral-300 hover:border-yellow-400'}`}
                >
                    {tarea.hecho && <Check className="w-3 h-3" strokeWidth={3} />}
                </button>
            ) : (
                <span className={`mt-2 shrink-0 rounded-full bg-yellow-400 ${esSubtarea ? 'w-1 h-1' : 'w-1.5 h-1.5'}`} />
            )}

            <div className="flex-1 min-w-0">
                <p className={`text-sm leading-snug ${esSubtarea ? '' : 'font-medium'} ${tarea.hecho ? 'line-through text-neutral-400' : 'text-neutral-900'}`}>
                    {tarea.titulo}
                </p>
                {tarea.descripcion && (
                    <p className="text-xs text-neutral-500 mt-0.5 whitespace-pre-line">{tarea.descripcion}</p>
                )}

                <div className="flex flex-wrap items-center gap-2 mt-1 empty:hidden">
                    {!esSubtarea && numSubtareas > 0 && (
                        <button
                            type="button"
                            onClick={onAlternar}
                            className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-neutral-500 hover:text-neutral-900"
                        >
                            {abierta ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                            {subtareas ? `${subtareas.hechas} de ${subtareas.total}` : `${numSubtareas} subtareas`}
                        </button>
                    )}
                    {fecha && (
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${fecha.clase}`}>{fecha.texto}</span>
                    )}
                    {responsables.map(nombre => (
                        <span
                            key={nombre}
                            title={nombre}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-600"
                        >
                            <span className="w-5 h-5 rounded-full bg-neutral-900 text-white text-[9px] flex items-center justify-center">
                                {iniciales(nombre)}
                            </span>
                            <span className="hidden sm:inline">{nombre.split(' ')[0]}</span>
                        </span>
                    ))}
                </div>
            </div>

            {estado && (
                <span
                    title={`${estado.texto}${estado.nombre ? ` por ${estado.nombre}` : ''} el ${formatoFechaHora(estado.fecha)}`}
                    className="shrink-0 mt-0.5 inline-flex items-center gap-1 text-[11px] text-neutral-400 tabular-nums"
                >
                    {estado.hecho
                        ? <Check className="w-3 h-3 text-green-600" strokeWidth={3} />
                        : <RotateCcw className="w-3 h-3 text-amber-500" />}
                    <span className="hidden sm:inline">
                        {estado.nombre ? `${estado.nombre} · ` : ''}{formatoCorto(estado.fecha)}
                    </span>
                </span>
            )}

            <MoreHorizontal
                aria-hidden="true"
                className={`w-4 h-4 mt-0.5 shrink-0 text-neutral-300 transition-opacity ${menu ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
            />

            {menu && (
                <MenuAccionesTarea
                    modo={modo}
                    tarea={tarea}
                    ancla={menu}
                    onCerrar={() => setMenu(null)}
                    acciones={{ onMarcar, onEditar, onBorrar, onNuevaSubtarea, onResponsables, onMoverCategoria, onCrearCategoria }}
                    personas={personas}
                    categorias={categorias}
                />
            )}
        </div>
    );
}
