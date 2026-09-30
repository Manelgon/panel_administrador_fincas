'use client';

import { useState } from 'react';
import { Check, ChevronRight, FolderInput, Pencil, Plus, RotateCcw, Trash2, UserCog } from 'lucide-react';
import { Ancla, PanelFlotante } from '@/components/checklists/PanelFlotante';
import SelectorEnMenu from '@/components/checklists/SelectorEnMenu';
import { Categoria, ChecklistTarea, ModoLista, Persona } from '@/lib/checklists';

export interface AccionesTarea {
    onMarcar: () => void;
    onEditar: () => void;
    onBorrar: () => void;
    onNuevaSubtarea?: () => void;
    onResponsables?: (userIds: string[]) => void | Promise<void>;
    onMoverCategoria?: (categoriaId: number | null) => void | Promise<void>;
    onCrearCategoria?: (nombre: string) => void | Promise<void>;
}

interface Props {
    modo: ModoLista;
    tarea: ChecklistTarea;
    ancla: Ancla;
    onCerrar: () => void;
    acciones: AccionesTarea;
    personas: Persona[];
    categorias: Categoria[];
}

export const ANCHO_MENU_ACCIONES = 240;
const OTROS = 'otros';

type Variante = 'default' | 'success' | 'warning' | 'info' | 'danger';

// Mismos colores que el menú de acciones de las tablas (DataTable)
const COLOR: Record<Variante, string> = {
    default: 'text-neutral-700 hover:bg-neutral-50',
    success: 'text-green-600 hover:bg-green-50',
    warning: 'text-amber-600 hover:bg-amber-50',
    info: 'text-blue-600 hover:bg-blue-50',
    danger: 'text-red-600 hover:bg-red-50',
};

// Menú que sale al pulsar en cualquier parte de una tarea, con el mismo estilo que el de Tareas.
// Responsables y categoría abren su lista (con buscador) dentro del mismo menú.
export default function MenuAccionesTarea({ modo, tarea, ancla, onCerrar, acciones, personas, categorias }: Props) {
    const [vista, setVista] = useState<'principal' | 'responsables' | 'categoria'>('principal');
    const esChecklist = modo === 'checklist';
    const responsables = tarea.responsables || [];

    // Ejecuta la acción y cierra el menú
    const y = (accion: () => void) => () => { onCerrar(); accion(); };

    const item = (icono: React.ReactNode, texto: string, onClick: () => void, variante: Variante = 'default', o: { separador?: boolean; submenu?: boolean } = {}) => (
        <button
            type="button"
            onClick={onClick}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors
                ${o.separador ? 'border-t border-neutral-100 mt-0.5' : ''} ${COLOR[variante]}`}
        >
            <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center">{icono}</span>
            <span className="flex-1">{texto}</span>
            {o.submenu && <ChevronRight className="w-4 h-4 text-neutral-300" />}
        </button>
    );

    const alternarResponsable = (userId: string) => acciones.onResponsables?.(
        responsables.includes(userId) ? responsables.filter(u => u !== userId) : [...responsables, userId],
    );

    return (
        <PanelFlotante ancla={ancla} ancho={ANCHO_MENU_ACCIONES} onCerrar={onCerrar}>
            {vista === 'responsables' && (
                <SelectorEnMenu
                    titulo="Responsables"
                    opciones={personas.map(p => ({ value: p.user_id, label: `${p.nombre} (${p.rol})` }))}
                    seleccionados={responsables}
                    onElegir={alternarResponsable}
                    onVolver={() => setVista('principal')}
                    pie={responsables.length ? { texto: 'Quitar todos', onClick: () => acciones.onResponsables?.([]) } : undefined}
                />
            )}

            {vista === 'categoria' && (
                <SelectorEnMenu
                    titulo="Mover a"
                    opciones={[
                        ...categorias.filter(c => c.activo || c.id === tarea.categoria_id).map(c => ({ value: String(c.id), label: c.nombre })),
                        { value: OTROS, label: 'Otros (sin categoría)' },
                    ]}
                    seleccionados={[tarea.categoria_id === null ? OTROS : String(tarea.categoria_id)]}
                    onElegir={v => {
                        const destino = v === OTROS ? null : Number(v);
                        onCerrar();
                        if (destino !== tarea.categoria_id) acciones.onMoverCategoria?.(destino);
                    }}
                    onCrear={nombre => { onCerrar(); acciones.onCrearCategoria?.(nombre); }}
                    onVolver={() => setVista('principal')}
                />
            )}

            {vista === 'principal' && (
                <>
                    {esChecklist && (tarea.hecho
                        ? item(<RotateCcw className="w-4 h-4" />, 'Marcar como pendiente', y(acciones.onMarcar), 'warning')
                        : item(<Check className="w-4 h-4" />, 'Marcar como realizada', y(acciones.onMarcar), 'success'))}
                    {esChecklist && acciones.onResponsables &&
                        item(<UserCog className="w-4 h-4" />, 'Asignar responsables', () => setVista('responsables'), 'default', { submenu: true })}
                    {acciones.onMoverCategoria && acciones.onCrearCategoria &&
                        item(<FolderInput className="w-4 h-4" />, 'Mover a categoría', () => setVista('categoria'), 'default', { submenu: true })}
                    {acciones.onNuevaSubtarea && item(<Plus className="w-4 h-4" />, 'Añadir subtarea', y(acciones.onNuevaSubtarea), 'info')}
                    {item(<Pencil className="w-4 h-4" />, 'Editar', y(acciones.onEditar))}
                    {item(<Trash2 className="w-4 h-4" />, 'Eliminar', y(acciones.onBorrar), 'danger', { separador: true })}
                </>
            )}
        </PanelFlotante>
    );
}
