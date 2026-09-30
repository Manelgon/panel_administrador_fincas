'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, Check, Plus, Search } from 'lucide-react';

export interface OpcionSelector {
    value: string;
    label: string;
}

interface Props {
    titulo: string;
    opciones: OpcionSelector[];
    seleccionados: string[];
    onElegir: (value: string) => void;
    onVolver: () => void;
    /** Si se pasa, permite crear una opción nueva con el texto buscado */
    onCrear?: (texto: string) => void;
    /** Acción extra al pie (p. ej. "Quitar todos") */
    pie?: { texto: string; onClick: () => void };
}

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Lista con buscador dentro del menú de acciones, con el mismo aspecto que SearchableSelect.
export default function SelectorEnMenu({ titulo, opciones, seleccionados, onElegir, onVolver, onCrear, pie }: Props) {
    const [busqueda, setBusqueda] = useState('');

    const filtradas = useMemo(
        () => opciones.filter(o => normalizar(o.label).includes(normalizar(busqueda))),
        [opciones, busqueda],
    );
    const puedeCrear = onCrear && busqueda.trim() && !opciones.some(o => normalizar(o.label) === normalizar(busqueda));

    return (
        <div>
            <button
                type="button"
                onClick={onVolver}
                className="w-full flex items-center gap-1.5 px-3 pt-1.5 pb-2 text-[10px] font-bold uppercase tracking-widest text-neutral-500 hover:text-neutral-900"
            >
                <ArrowLeft className="w-3.5 h-3.5" /> {titulo}
            </button>

            <div className="mx-2 mb-1 flex items-center gap-2 rounded-lg border border-neutral-200 px-2.5 focus-within:ring-2 focus-within:ring-yellow-400 focus-within:border-yellow-400">
                <Search className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                <input
                    autoFocus
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                    onKeyDown={e => {
                        if (e.key !== 'Enter') return;
                        e.preventDefault();
                        if (filtradas.length === 1) onElegir(filtradas[0].value);
                        else if (puedeCrear) onCrear!(busqueda.trim());
                    }}
                    placeholder="Buscar..."
                    className="flex-1 min-w-0 py-1.5 text-sm bg-transparent focus:outline-none placeholder:text-neutral-400"
                />
            </div>

            <div role="listbox" className="py-1">
                {filtradas.length === 0 && !puedeCrear && (
                    <div className="px-3 py-2 text-sm text-gray-500 text-center">No se encontraron resultados</div>
                )}
                {filtradas.map(o => {
                    const elegido = seleccionados.includes(o.value);
                    return (
                        <div
                            key={o.value}
                            role="option"
                            aria-selected={elegido}
                            onClick={() => onElegir(o.value)}
                            className={`px-3 py-2 text-sm cursor-pointer flex items-center justify-between ${elegido
                                ? 'bg-yellow-100 text-yellow-900 font-medium'
                                : 'text-gray-700 hover:bg-yellow-100'}`}
                        >
                            <span className="truncate">{o.label}</span>
                            {elegido && <Check className="w-4 h-4 text-yellow-600 shrink-0" aria-hidden="true" />}
                        </div>
                    );
                })}
                {puedeCrear && (
                    <div
                        role="option"
                        aria-selected={false}
                        onClick={() => onCrear!(busqueda.trim())}
                        className="px-3 py-2 text-sm cursor-pointer flex items-center gap-2 text-blue-600 hover:bg-blue-50"
                    >
                        <Plus className="w-4 h-4 shrink-0" />
                        <span className="truncate">Crear «{busqueda.trim()}»</span>
                    </div>
                )}
            </div>

            {pie && (
                <button
                    type="button"
                    onClick={pie.onClick}
                    className="w-full border-t border-neutral-100 px-3 py-2 text-left text-xs font-semibold text-neutral-500 hover:text-red-600"
                >
                    {pie.texto}
                </button>
            )}
        </div>
    );
}
