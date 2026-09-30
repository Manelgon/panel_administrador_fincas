'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2, Plus } from 'lucide-react';
import GrupoCategoriaBloque from '@/components/checklists/GrupoCategoriaBloque';
import TareaModal from '@/components/checklists/TareaModal';
import { PropsArrastre } from '@/components/checklists/TareaFila';
import { EVENTO_CHECKLISTS } from '@/hooks/useMisTareasChecklist';
import {
    Categoria, ChecklistTarea, DatosTarea, ModoLista, Persona,
    actualizarTarea, agruparPorCategoria, agruparTareas, borrarTarea, cargarTareas, crearCategoria,
    crearTarea, fijarResponsables, listarCategorias, listarPersonas, marcarTarea, moverACategoria, reordenar,
} from '@/lib/checklists';

interface Props {
    modo: ModoLista;
    /** id de la plantilla o del checklist */
    padreId: number;
    /** Avisa al padre cada vez que cambian las tareas o el catálogo (progreso y panel lateral) */
    onCambio?: (tareas: ChecklistTarea[], categorias: Categoria[]) => void;
}

interface EstadoModal {
    tarea: ChecklistTarea | null;
    madre: ChecklistTarea | null;
    categoriaInicial: number | null;
}

export default function TareasEditor({ modo, padreId, onCambio }: Props) {
    const [tareas, setTareas] = useState<ChecklistTarea[]>([]);
    const [categorias, setCategorias] = useState<Categoria[]>([]);
    const [personas, setPersonas] = useState<Persona[]>([]);
    const [cargando, setCargando] = useState(true);
    const [plegadas, setPlegadas] = useState<Set<number>>(new Set());
    const [gruposPlegados, setGruposPlegados] = useState<Set<string>>(new Set());
    const [modal, setModal] = useState<EstadoModal | null>(null);
    const [nuevaRapida, setNuevaRapida] = useState('');
    const [arrastre, setArrastre] = useState<{ origen: ChecklistTarea; destino: number | null; lado: 'antes' | 'despues' } | null>(null);

    const recargar = useCallback(async () => {
        try {
            setTareas(await cargarTareas(modo, padreId));
        } catch (err) {
            console.error(err);
            toast.error('No se pudieron cargar las tareas');
        } finally {
            setCargando(false);
        }
    }, [modo, padreId]);

    useEffect(() => { recargar(); }, [recargar]);
    useEffect(() => { listarCategorias().then(setCategorias); }, []);
    useEffect(() => { if (modo === 'checklist') listarPersonas().then(setPersonas); }, [modo]);
    useEffect(() => { onCambio?.(tareas, categorias); }, [tareas, categorias, onCambio]);

    const grupos = useMemo(
        () => agruparPorCategoria(agruparTareas(tareas), categorias),
        [tareas, categorias],
    );
    const nombrePorId = useMemo(
        () => Object.fromEntries(personas.map(p => [p.user_id, p.nombre])),
        [personas],
    );

    // Hermanas = mismo padre y, si son principales, misma categoría
    const hermanasDe = (tarea: ChecklistTarea) => tareas
        .filter(t => t.parent_id === tarea.parent_id && (tarea.parent_id !== null || t.categoria_id === tarea.categoria_id))
        .sort((a, b) => a.orden - b.orden || a.id - b.id);

    const siguienteOrden = (parentId: number | null) =>
        Math.max(0, ...tareas.filter(t => t.parent_id === parentId).map(t => t.orden)) + 1;

    const ejecutar = async (accion: () => Promise<unknown>, mensajeError: string) => {
        try {
            await accion();
            await recargar();
            window.dispatchEvent(new Event(EVENTO_CHECKLISTS));
            return true;
        } catch (err) {
            console.error(err);
            toast.error(mensajeError);
            await recargar();
            return false;
        }
    };

    const handleMarcar = async (tarea: ChecklistTarea) => {
        const hecho = !tarea.hecho;
        setTareas(prev => prev.map(t => t.id === tarea.id ? { ...t, hecho } : t));
        await ejecutar(() => marcarTarea(tarea.id, hecho), 'No se pudo marcar la tarea');
    };

    const handleResponsables = async (tarea: ChecklistTarea, userIds: string[]) => {
        const actuales = tareas.find(t => t.id === tarea.id)?.responsables || [];
        setTareas(prev => prev.map(t => t.id === tarea.id ? { ...t, responsables: userIds } : t));
        await ejecutar(() => fijarResponsables(tarea.id, actuales, userIds), 'No se pudieron cambiar los responsables');
    };

    const handleMoverCategoria = async (tarea: ChecklistTarea, categoriaId: number | null) => {
        const orden = siguienteOrden(null);
        setTareas(prev => prev.map(t => t.id === tarea.id ? { ...t, categoria_id: categoriaId, orden } : t));
        await ejecutar(() => moverACategoria(modo, tarea.id, categoriaId, orden), 'No se pudo mover la tarea');
    };

    const handleCrearYMover = async (tarea: ChecklistTarea, nombre: string) => {
        try {
            const categoria = await handleCrearCategoria(nombre);
            await handleMoverCategoria(tarea, categoria.id);
        } catch (err) {
            console.error(err);
            toast.error('No se pudo crear la categoría');
        }
    };

    // ---- Arrastrar para reordenar (dentro de la misma categoría o de la misma tarea madre)
    const mismoGrupo = (a: ChecklistTarea, b: ChecklistTarea) =>
        a.parent_id === b.parent_id && (a.parent_id !== null || a.categoria_id === b.categoria_id);

    const handleSoltar = async () => {
        const estado = arrastre;
        setArrastre(null);
        if (!estado || estado.destino === null || estado.destino === estado.origen.id) return;

        const sinOrigen = hermanasDe(estado.origen).filter(t => t.id !== estado.origen.id);
        const i = sinOrigen.findIndex(t => t.id === estado.destino);
        if (i < 0) return;
        sinOrigen.splice(estado.lado === 'antes' ? i : i + 1, 0, estado.origen);

        const nuevoOrden = new Map(sinOrigen.map((t, pos) => [t.id, pos + 1]));
        setTareas(prev => prev.map(t => nuevoOrden.has(t.id) ? { ...t, orden: nuevoOrden.get(t.id)! } : t));
        await ejecutar(() => reordenar(modo, sinOrigen), 'No se pudo guardar el nuevo orden');
    };

    const propsArrastre = (tarea: ChecklistTarea): PropsArrastre => ({
        arrastrando: arrastre?.origen.id === tarea.id,
        marca: arrastre?.destino === tarea.id ? arrastre.lado : null,
        aceptaSoltar: !!arrastre && mismoGrupo(arrastre.origen, tarea),
        onInicio: () => setArrastre({ origen: tarea, destino: null, lado: 'antes' }),
        onSobre: lado => setArrastre(prev => prev && (prev.destino !== tarea.id || prev.lado !== lado)
            ? { ...prev, destino: tarea.id, lado }
            : prev),
        onSoltar: handleSoltar,
        onFin: () => setArrastre(null),
    });

    const handleBorrar = async (tarea: ChecklistTarea) => {
        const subtareas = tareas.filter(t => t.parent_id === tarea.id).length;
        const aviso = subtareas
            ? `¿Eliminar "${tarea.titulo}" y sus ${subtareas} subtareas?`
            : `¿Eliminar "${tarea.titulo}"?`;
        if (!window.confirm(aviso)) return;
        await ejecutar(() => borrarTarea(modo, tarea.id), 'No se pudo eliminar la tarea');
    };

    const handleCrearCategoria = async (nombre: string) => {
        const categoria = await crearCategoria(nombre, categorias);
        setCategorias(await listarCategorias());
        return categoria;
    };

    const handleGuardarModal = async (datos: DatosTarea) => {
        if (!modal) return;
        const parentId = modal.madre?.id ?? null;
        const ok = await ejecutar(
            () => modal.tarea
                ? actualizarTarea(modo, modal.tarea, datos)
                : crearTarea(modo, padreId, parentId, siguienteOrden(parentId), datos),
            'No se pudo guardar la tarea',
        );
        if (!ok) return;
        if (parentId) setPlegadas(prev => { const s = new Set(prev); s.delete(parentId); return s; });
        setModal(null);
    };

    const handleNuevaRapida = async (e: React.FormEvent) => {
        e.preventDefault();
        const titulo = nuevaRapida.trim();
        if (!titulo) return;
        setNuevaRapida('');
        await ejecutar(
            () => crearTarea(modo, padreId, null, siguienteOrden(null), { titulo, descripcion: '' }),
            'No se pudo añadir la tarea',
        );
    };

    const alternar = <T,>(setter: React.Dispatch<React.SetStateAction<Set<T>>>, clave: T) =>
        setter(prev => { const s = new Set(prev); if (s.has(clave)) s.delete(clave); else s.add(clave); return s; });

    if (cargando) {
        return (
            <div className="flex justify-center py-16 text-neutral-400">
                <Loader2 className="w-6 h-6 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {grupos.length === 0 && (
                <p className="text-sm text-neutral-500 bg-white border border-dashed border-neutral-200 rounded-xl px-4 py-8 text-center">
                    Todavía no hay tareas. Añade la primera abajo.
                </p>
            )}

            {grupos.map(grupo => {
                const clave = grupo.categoria ? String(grupo.categoria.id) : 'otros';
                return (
                    <GrupoCategoriaBloque
                        key={clave}
                        modo={modo}
                        grupo={grupo}
                        abierto={!gruposPlegados.has(clave)}
                        onAlternar={() => alternar(setGruposPlegados, clave)}
                        plegadas={plegadas}
                        onAlternarTarea={id => alternar(setPlegadas, id)}
                        nombrePorId={nombrePorId}
                        personas={personas}
                        onResponsables={handleResponsables}
                        categorias={categorias}
                        onMoverCategoria={handleMoverCategoria}
                        onCrearCategoria={handleCrearYMover}
                        onMarcar={handleMarcar}
                        arrastre={propsArrastre}
                        onEditar={(tarea, madre) => setModal({ tarea, madre, categoriaInicial: null })}
                        onBorrar={handleBorrar}
                        onNuevaSubtarea={madre => setModal({ tarea: null, madre, categoriaInicial: null })}
                        onNuevaTarea={() => setModal({ tarea: null, madre: null, categoriaInicial: grupo.categoria?.id ?? null })}
                    />
                );
            })}

            <form onSubmit={handleNuevaRapida} className="flex items-center gap-2 bg-white rounded-xl border border-neutral-200 px-3 py-2">
                <Plus className="w-4 h-4 text-neutral-400 shrink-0" />
                <input
                    value={nuevaRapida}
                    onChange={e => setNuevaRapida(e.target.value)}
                    placeholder="Añadir tarea sin categoría y pulsar Intro"
                    className="flex-1 text-sm bg-transparent py-1.5 focus:outline-none placeholder:text-neutral-400"
                />
                <button
                    type="button"
                    onClick={() => setModal({ tarea: null, madre: null, categoriaInicial: null })}
                    className="text-xs font-semibold text-neutral-500 hover:text-neutral-900 px-2 py-1 rounded-lg hover:bg-neutral-100"
                >
                    Con detalle…
                </button>
            </form>

            <TareaModal
                isOpen={modal !== null}
                modo={modo}
                tarea={modal?.tarea ?? null}
                madre={modal?.madre?.titulo ?? null}
                personas={personas}
                categorias={categorias}
                categoriaInicial={modal?.categoriaInicial ?? null}
                onCrearCategoria={handleCrearCategoria}
                onClose={() => setModal(null)}
                onGuardar={handleGuardarModal}
            />
        </div>
    );
}
