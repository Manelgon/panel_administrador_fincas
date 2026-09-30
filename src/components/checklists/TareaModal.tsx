'use client';

import { useEffect, useState } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import FormModal from '@/components/FormModal';
import FormField from '@/components/FormField';
import { Categoria, ChecklistTarea, DatosTarea, EventoTarea, ModoLista, Persona, formatoFechaHora, historialTarea } from '@/lib/checklists';

interface Props {
    isOpen: boolean;
    modo: ModoLista;
    /** Tarea que se edita; null = tarea nueva */
    tarea: ChecklistTarea | null;
    /** Título de la tarea madre si es una subtarea */
    madre: string | null;
    personas: Persona[];
    categorias: Categoria[];
    /** Categoría propuesta al crear (p. ej. al pulsar "Añadir" dentro de un grupo) */
    categoriaInicial: number | null;
    onCrearCategoria: (nombre: string) => Promise<Categoria>;
    onClose: () => void;
    onGuardar: (datos: DatosTarea) => Promise<void>;
}

const inputClass = 'w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30 focus:border-yellow-400 transition-all';

// Solo se monta abierto: así el formulario arranca siempre con los datos de la tarea
export default function TareaModal(props: Props) {
    return props.isOpen ? <Formulario {...props} /> : null;
}

const NUEVA = 'nueva';

function Formulario({ modo, tarea, madre, personas, categorias, categoriaInicial, onCrearCategoria, onClose, onGuardar }: Props) {
    const [titulo, setTitulo] = useState(tarea?.titulo ?? '');
    const [descripcion, setDescripcion] = useState(tarea?.descripcion ?? '');
    const [fecha, setFecha] = useState(tarea?.fecha_limite ?? '');
    const [responsables, setResponsables] = useState<string[]>(tarea?.responsables ?? []);
    const [categoriaId, setCategoriaId] = useState<number | null>(tarea ? tarea.categoria_id : categoriaInicial);
    const [creandoCategoria, setCreandoCategoria] = useState(false);
    const [nuevaCategoria, setNuevaCategoria] = useState('');
    const [error, setError] = useState('');
    const [guardando, setGuardando] = useState(false);

    const alternarPersona = (userId: string) =>
        setResponsables(prev => prev.includes(userId) ? prev.filter(u => u !== userId) : [...prev, userId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!titulo.trim()) {
            setError('El título es obligatorio');
            return;
        }
        setGuardando(true);
        try {
            let categoria = categoriaId;
            if (creandoCategoria && nuevaCategoria.trim()) {
                categoria = (await onCrearCategoria(nuevaCategoria)).id;
            }
            await onGuardar({ titulo, descripcion, categoria_id: categoria, fecha_limite: fecha || null, responsables });
        } finally {
            setGuardando(false);
        }
    };

    const esSubtarea = madre !== null;
    const nombre = esSubtarea ? 'subtarea' : 'tarea';

    return (
        <FormModal
            isOpen
            portalReady
            onClose={onClose}
            onSubmit={handleSubmit}
            title={tarea ? `Editar ${nombre}` : `Nueva ${nombre}`}
            subtitle={esSubtarea ? `Dentro de: ${madre}` : undefined}
            editingId={tarea?.id ?? null}
            submitLabel={guardando ? 'Guardando...' : tarea ? 'Guardar cambios' : `Añadir ${nombre}`}
            formId="checklist-tarea-form"
        >
            <div className="space-y-4">
                <FormField label="Título" required error={error}>
                    <input
                        autoFocus
                        className={inputClass}
                        value={titulo}
                        onChange={e => { setTitulo(e.target.value); setError(''); }}
                        placeholder="Qué hay que hacer"
                    />
                </FormField>

                {!esSubtarea && (
                    <FormField label="Categoría">
                        {creandoCategoria ? (
                            <div className="flex gap-2">
                                <input
                                    autoFocus
                                    className={inputClass}
                                    value={nuevaCategoria}
                                    onChange={e => setNuevaCategoria(e.target.value)}
                                    placeholder="Nombre de la nueva categoría"
                                />
                                <button
                                    type="button"
                                    onClick={() => { setCreandoCategoria(false); setNuevaCategoria(''); }}
                                    className="px-3 text-xs font-semibold text-neutral-500 hover:text-neutral-900 rounded-lg hover:bg-neutral-100"
                                >
                                    Cancelar
                                </button>
                            </div>
                        ) : (
                            <select
                                className={inputClass}
                                value={categoriaId ?? ''}
                                onChange={e => {
                                    if (e.target.value === NUEVA) setCreandoCategoria(true);
                                    else setCategoriaId(e.target.value ? Number(e.target.value) : null);
                                }}
                            >
                                <option value="">Sin categoría (Otros)</option>
                                {categorias
                                    .filter(c => c.activo || c.id === categoriaId)
                                    .map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                <option value={NUEVA}>+ Nueva categoría…</option>
                            </select>
                        )}
                    </FormField>
                )}

                <FormField label="Detalle">
                    <textarea
                        className={`${inputClass} min-h-[80px]`}
                        value={descripcion}
                        onChange={e => setDescripcion(e.target.value)}
                        placeholder="Opcional: cómo hacerlo, a quién llamar..."
                    />
                </FormField>

                {modo === 'checklist' && (
                    <>
                        <FormField label="Fecha límite">
                            <input type="date" className={inputClass} value={fecha} onChange={e => setFecha(e.target.value)} />
                        </FormField>

                        <FormField label="Responsables">
                            <div className="flex flex-wrap gap-2">
                                {personas.map(p => {
                                    const activo = responsables.includes(p.user_id);
                                    return (
                                        <button
                                            key={p.user_id}
                                            type="button"
                                            onClick={() => alternarPersona(p.user_id)}
                                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${activo
                                                ? 'bg-yellow-400 border-yellow-400 text-neutral-950'
                                                : 'bg-white border-neutral-200 text-neutral-600 hover:border-neutral-400'}`}
                                        >
                                            {p.nombre}
                                        </button>
                                    );
                                })}
                            </div>
                        </FormField>
                        {tarea && <Historial itemId={tarea.id} />}
                    </>
                )}
            </div>
        </FormModal>
    );
}

/** Historial de estados de una tarea: quién la marcó como realizada o la reabrió. */
function Historial({ itemId }: { itemId: number }) {
    const [eventos, setEventos] = useState<EventoTarea[] | null>(null);

    useEffect(() => { historialTarea(itemId).then(setEventos); }, [itemId]);

    return (
        <FormField label="Historial">
            {eventos === null ? (
                <p className="text-xs text-neutral-400">Cargando…</p>
            ) : eventos.length === 0 ? (
                <p className="text-xs text-neutral-400">Todavía no se ha marcado nunca.</p>
            ) : (
                <ul className="space-y-1.5 max-h-40 overflow-y-auto [scrollbar-width:thin]">
                    {eventos.map((e, i) => (
                        <li key={i} className="flex items-center gap-2 text-xs">
                            {e.accion === 'realizada'
                                ? <Check className="w-3.5 h-3.5 text-green-600 shrink-0" />
                                : <RotateCcw className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                            <span className="text-neutral-800">
                                {e.accion === 'realizada' ? 'Realizada' : 'Reabierta'}{e.nombre ? ` por ${e.nombre}` : ''}
                            </span>
                            <span className="text-neutral-400 ml-auto tabular-nums">{formatoFechaHora(e.fecha)}</span>
                        </li>
                    ))}
                </ul>
            )}
        </FormField>
    );
}
