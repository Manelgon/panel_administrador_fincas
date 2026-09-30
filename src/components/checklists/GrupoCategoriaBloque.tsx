'use client';

import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import TareaFila, { PropsArrastre } from '@/components/checklists/TareaFila';
import { Categoria, ChecklistTarea, GrupoCategoria, ModoLista, Persona, progreso } from '@/lib/checklists';

interface Props {
    modo: ModoLista;
    grupo: GrupoCategoria;
    abierto: boolean;
    onAlternar: () => void;
    /** Tareas con las subtareas plegadas */
    plegadas: Set<number>;
    onAlternarTarea: (id: number) => void;
    nombrePorId: Record<string, string>;
    personas: Persona[];
    onResponsables: (tarea: ChecklistTarea, userIds: string[]) => Promise<void>;
    categorias: Categoria[];
    onMoverCategoria: (tarea: ChecklistTarea, categoriaId: number | null) => Promise<void>;
    onCrearCategoria: (tarea: ChecklistTarea, nombre: string) => Promise<void>;
    onMarcar: (tarea: ChecklistTarea) => void;
    /** Props de arrastrar para reordenar, por tarea */
    arrastre: (tarea: ChecklistTarea) => PropsArrastre;
    onEditar: (tarea: ChecklistTarea, madre: ChecklistTarea | null) => void;
    onBorrar: (tarea: ChecklistTarea) => void;
    onNuevaSubtarea: (madre: ChecklistTarea) => void;
    onNuevaTarea: () => void;
}

// Una categoría con sus tareas: cabecera plegable con progreso y las tarjetas de tarea.
export default function GrupoCategoriaBloque({
    modo, grupo, abierto, onAlternar, plegadas, onAlternarTarea, nombrePorId, personas, onResponsables,
    categorias, onMoverCategoria, onCrearCategoria,
    onMarcar, arrastre, onEditar, onBorrar, onNuevaSubtarea, onNuevaTarea,
}: Props) {
    const { hechas, total } = progreso(grupo.tareas);
    const completo = modo === 'checklist' && total > 0 && hechas === total;
    const nombre = grupo.categoria?.nombre ?? 'Otros';

    return (
        <section id={`categoria-${grupo.categoria?.id ?? 'otros'}`} className="space-y-2 scroll-mt-6">
            <button
                type="button"
                onClick={onAlternar}
                className="w-full flex items-center gap-2 pb-1.5 border-b border-yellow-400 text-left"
            >
                {abierto
                    ? <ChevronDown className="w-4 h-4 text-neutral-500" />
                    : <ChevronRight className="w-4 h-4 text-neutral-500" />}
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-neutral-900 flex-1">{nombre}</h3>
                <span className={`text-xs font-semibold tabular-nums ${completo ? 'text-green-600' : 'text-neutral-500'}`}>
                    {modo === 'checklist' ? `${hechas}/${total}` : `${total} ${total === 1 ? 'tarea' : 'tareas'}`}
                </span>
            </button>

            {abierto && (
                <>
                    {grupo.tareas.map(madre => {
                        const avance = progreso(madre.subtareas.map(s => ({ parent_id: null, hecho: s.hecho })));
                        const abierta = !plegadas.has(madre.id);
                        return (
                            <div key={madre.id} className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
                                <TareaFila
                                    modo={modo}
                                    tarea={madre}
                                    nombrePorId={nombrePorId}
                                    personas={personas}
                                    onResponsables={ids => onResponsables(madre, ids)}
                                    categorias={categorias}
                                    onMoverCategoria={id => onMoverCategoria(madre, id)}
                                    onCrearCategoria={nombre => onCrearCategoria(madre, nombre)}
                                    subtareas={modo === 'checklist' && madre.subtareas.length ? avance : undefined}
                                    numSubtareas={madre.subtareas.length}
                                    abierta={abierta}
                                    onAlternar={() => onAlternarTarea(madre.id)}
                                    onMarcar={() => onMarcar(madre)}
                                    arrastre={arrastre(madre)}
                                    onEditar={() => onEditar(madre, null)}
                                    onBorrar={() => onBorrar(madre)}
                                    onNuevaSubtarea={() => onNuevaSubtarea(madre)}
                                />
                                {/* Subtareas: franja gris separada de la tarea, con una guía vertical a la izquierda */}
                                {abierta && madre.subtareas.length > 0 && (
                                    <div className="border-t-2 border-neutral-200 bg-neutral-100/70 py-1.5 pl-6 pr-1">
                                        <div className="border-l-2 border-yellow-400/70 bg-white/60 rounded-r-lg">
                                            {madre.subtareas.map(sub => (
                                            <TareaFila
                                                key={sub.id}
                                                modo={modo}
                                                tarea={sub}
                                                nombrePorId={nombrePorId}
                                                personas={personas}
                                                onResponsables={ids => onResponsables(sub, ids)}
                                                esSubtarea
                                                onMarcar={() => onMarcar(sub)}
                                                arrastre={arrastre(sub)}
                                                onEditar={() => onEditar(sub, madre)}
                                                onBorrar={() => onBorrar(sub)}
                                            />
                                        ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    <button
                        type="button"
                        onClick={onNuevaTarea}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-400 hover:text-neutral-900 px-2 py-1"
                    >
                        <Plus className="w-3.5 h-3.5" /> Añadir tarea en {nombre}
                    </button>
                </>
            )}
        </section>
    );
}
