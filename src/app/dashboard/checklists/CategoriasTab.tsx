'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Archive, ArchiveRestore, ChevronDown, ChevronUp, Loader2, Pencil } from 'lucide-react';
import FilterBar from '@/components/FilterBar';
import FormField from '@/components/FormField';
import FormModal from '@/components/FormModal';
import PageHeader from '@/components/PageHeader';
import { supabase } from '@/lib/supabaseClient';
import { Categoria, crearCategoria, listarCategorias } from '@/lib/checklists';

const FILTROS = [
    { value: 'activo', label: 'Activas', activeClass: 'bg-yellow-400 text-neutral-950' },
    { value: 'inactivo', label: 'Archivadas', activeClass: 'bg-neutral-900 text-white' },
    { value: 'all', label: 'Todas', activeClass: 'bg-neutral-900 text-white' },
];

const inputClass = 'w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30 focus:border-yellow-400 transition-all';
const botonAccion = 'p-1.5 rounded-lg text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 disabled:opacity-30 disabled:pointer-events-none transition-colors';

/** Categorías y cuántas tareas (de plantillas y checklists) usan cada una. */
async function leerCatalogo() {
    const [lista, enPlantillas, enChecklists] = await Promise.all([
        listarCategorias(),
        supabase.from('checklist_plantilla_items').select('categoria_id').not('categoria_id', 'is', null),
        supabase.from('checklist_items').select('categoria_id').not('categoria_id', 'is', null),
    ]);
    const cuenta = new Map<number, number>();
    for (const fila of [...(enPlantillas.data || []), ...(enChecklists.data || [])]) {
        cuenta.set(fila.categoria_id, (cuenta.get(fila.categoria_id) || 0) + 1);
    }
    return { lista, cuenta };
}

// Catálogo único de categorías, compartido por todas las plantillas y checklists.
export default function CategoriasTab() {
    const [categorias, setCategorias] = useState<Categoria[]>([]);
    const [usos, setUsos] = useState<Map<number, number>>(new Map());
    const [cargando, setCargando] = useState(true);
    const [filtroEstado, setFiltroEstado] = useState('activo');
    // undefined = cerrado, null = nueva, Categoria = editar
    const [editando, setEditando] = useState<Categoria | null | undefined>(undefined);

    const cargar = useCallback(() => leerCatalogo().then(({ lista, cuenta }) => {
        setCategorias(lista);
        setUsos(cuenta);
        setCargando(false);
    }), []);

    useEffect(() => { cargar(); }, [cargar]);

    const visibles = useMemo(
        () => categorias.filter(c => filtroEstado === 'all' || (filtroEstado === 'activo') === c.activo),
        [categorias, filtroEstado],
    );

    const mover = async (categoria: Categoria, direccion: -1 | 1) => {
        const i = categorias.findIndex(c => c.id === categoria.id);
        if (!categorias[i + direccion]) return;
        // Se renumera toda la lista (1, 2, 3...) para que no queden números repetidos
        const nueva = [...categorias];
        [nueva[i], nueva[i + direccion]] = [nueva[i + direccion], nueva[i]];
        const resultados = await Promise.all(nueva
            .map((c, pos) => ({ c, orden: pos + 1 }))
            .filter(({ c, orden }) => c.orden !== orden)
            .map(({ c, orden }) => supabase.from('checklist_categorias').update({ orden }).eq('id', c.id)));
        if (resultados.some(r => r.error)) toast.error('No se pudo cambiar el orden');
        cargar();
    };

    const alternarArchivo = async (categoria: Categoria) => {
        const { error } = await supabase.from('checklist_categorias').update({ activo: !categoria.activo }).eq('id', categoria.id);
        if (error) toast.error('No se pudo cambiar el estado');
        else toast.success(categoria.activo ? 'Categoría archivada' : 'Categoría reactivada');
        cargar();
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Categorías de tareas"
                onToggleForm={() => setEditando(null)}
                newButtonLabel="Nueva categoría"
                newButtonShortLabel="Nueva"
            />

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <FilterBar value={filtroEstado} onChange={setFiltroEstado} options={FILTROS} />
                <p className="text-xs text-neutral-500 sm:ml-auto">
                    El orden de esta lista es el orden en que salen los grupos en cada checklist.
                </p>
            </div>

            {cargando ? (
                <div className="flex justify-center py-16 text-neutral-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : (
                <div className="bg-white rounded-xl border border-neutral-200 shadow-sm divide-y divide-neutral-100 max-w-3xl">
                    {visibles.length === 0 && <p className="px-4 py-8 text-sm text-neutral-500 text-center">No hay categorías.</p>}
                    {visibles.map(c => {
                        const i = categorias.findIndex(x => x.id === c.id);
                        return (
                            <div key={c.id} className="group flex items-center gap-3 px-4 py-3">
                                <span className={`h-3.5 w-1.5 rounded-full ${c.activo ? 'bg-yellow-400' : 'bg-neutral-300'}`} />
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-semibold ${c.activo ? 'text-neutral-900' : 'text-neutral-400'}`}>{c.nombre}</p>
                                    <p className="text-xs text-neutral-500">
                                        {usos.get(c.id) || 0} tareas{!c.activo && ' · Archivada'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-0.5">
                                    <button onClick={() => mover(c, -1)} disabled={i === 0} className={botonAccion} title="Subir"><ChevronUp className="w-4 h-4" /></button>
                                    <button onClick={() => mover(c, 1)} disabled={i === categorias.length - 1} className={botonAccion} title="Bajar"><ChevronDown className="w-4 h-4" /></button>
                                    <button onClick={() => setEditando(c)} className={botonAccion} title="Renombrar"><Pencil className="w-4 h-4" /></button>
                                    <button onClick={() => alternarArchivo(c)} className={botonAccion} title={c.activo ? 'Archivar' : 'Reactivar'}>
                                        {c.activo ? <Archive className="w-4 h-4" /> : <ArchiveRestore className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {editando !== undefined && (
                <CategoriaModal
                    categoria={editando}
                    categorias={categorias}
                    onClose={() => setEditando(undefined)}
                    onGuardada={() => { setEditando(undefined); cargar(); }}
                />
            )}
        </div>
    );
}

interface ModalProps {
    categoria: Categoria | null;
    categorias: Categoria[];
    onClose: () => void;
    onGuardada: () => void;
}

function CategoriaModal({ categoria, categorias, onClose, onGuardada }: ModalProps) {
    const [nombre, setNombre] = useState(categoria?.nombre ?? '');
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const limpio = nombre.trim();
        if (!limpio) return setError('El nombre es obligatorio');
        const repetida = categorias.find(c => c.id !== categoria?.id && c.nombre.trim().toLowerCase() === limpio.toLowerCase());
        if (repetida) return setError('Ya existe una categoría con ese nombre');

        try {
            if (categoria) {
                const { error: errorBD } = await supabase.from('checklist_categorias').update({ nombre: limpio }).eq('id', categoria.id);
                if (errorBD) throw errorBD;
            } else {
                await crearCategoria(limpio, categorias);
            }
            toast.success(categoria ? 'Categoría renombrada' : 'Categoría creada');
            onGuardada();
        } catch (err) {
            console.error(err);
            toast.error('No se pudo guardar la categoría');
        }
    };

    return (
        <FormModal
            isOpen
            portalReady
            onClose={onClose}
            onSubmit={handleSubmit}
            title={categoria ? 'Renombrar categoría' : 'Nueva categoría'}
            subtitle={categoria ? 'El nuevo nombre se verá en todas las plantillas y checklists' : undefined}
            editingId={categoria?.id ?? null}
            submitLabel={categoria ? 'Guardar' : 'Crear categoría'}
            formId="categoria-form"
            maxWidth="max-w-md"
        >
            <FormField label="Nombre" required error={error}>
                <input
                    autoFocus
                    className={inputClass}
                    value={nombre}
                    onChange={e => { setNombre(e.target.value); setError(''); }}
                    placeholder="Ej.: Banco y firmas"
                />
            </FormField>
        </FormModal>
    );
}
