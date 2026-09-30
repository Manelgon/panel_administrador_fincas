'use client';

import Link from 'next/link';
import type { ReactNode, DragEvent } from 'react';
import type { LucideIcon } from 'lucide-react';
import { GripVertical, Eye, EyeOff, ArrowUp, ArrowDown, ChevronDown } from 'lucide-react';

export interface EdicionBloque {
    activa: boolean;
    oculto: boolean;
    arrastrando: boolean;
    plegado: boolean;
    onPlegar: () => void;
    onOcultar: () => void;
    onMover: (dir: -1 | 1) => void;
    onDragStart: () => void;
    onDragOver: () => void;
    onDragEnd: () => void;
}

interface Props {
    titulo: string;
    icono: LucideIcon;
    contador?: number;
    general?: boolean;
    enlace?: { href: string; texto: string };
    accion?: ReactNode;
    edicion: EdicionBloque;
    children: ReactNode;
}

/** Tarjeta común de cada bloque de "Mi día", con los controles del modo personalizar */
export default function BloqueMiDia({ titulo, icono: Icono, contador, general, enlace, accion, edicion, children }: Props) {
    const { activa, oculto, plegado } = edicion;
    const abierto = activa || !plegado;

    const dragProps = activa ? {
        draggable: true,
        onDragStart: (e: DragEvent) => { e.dataTransfer.effectAllowed = 'move'; edicion.onDragStart(); },
        onDragOver: (e: DragEvent) => { e.preventDefault(); edicion.onDragOver(); },
        onDragEnd: edicion.onDragEnd,
    } : {};

    return (
        <section
            {...dragProps}
            aria-label={titulo}
            className={`bg-white rounded-xl border shadow-sm p-4 md:p-5 transition
                ${activa ? 'border-dashed border-neutral-400 cursor-grab' : 'border-neutral-200'}
                ${activa && oculto ? 'opacity-40' : ''}
                ${edicion.arrastrando ? 'ring-2 ring-yellow-400' : ''}`}
        >
            <header className={`flex items-center justify-between gap-2 ${abierto ? 'mb-2' : ''}`}>
                <h2 className="min-w-0">
                <button type="button" onClick={edicion.onPlegar} disabled={activa} aria-expanded={abierto}
                    className="flex items-center gap-2 text-sm font-bold text-neutral-800 min-w-0 text-left disabled:cursor-grab">
                    {activa
                        ? <GripVertical className="w-4 h-4 text-neutral-400 flex-shrink-0" aria-hidden="true" />
                        : <ChevronDown className={`w-4 h-4 text-neutral-400 flex-shrink-0 transition-transform ${plegado ? '-rotate-90' : ''}`} aria-hidden="true" />}
                    <Icono className="w-4 h-4 text-yellow-600 flex-shrink-0" aria-hidden="true" />
                    <span className="truncate">{titulo}</span>
                    {typeof contador === 'number' && (
                        <span className="min-w-[22px] h-5 px-1.5 rounded-full bg-neutral-100 text-neutral-600 text-[11px] font-bold flex items-center justify-center">
                            {contador}
                        </span>
                    )}
                    {general && <span className="px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500 text-[10px] font-semibold">General</span>}
                </button>
                </h2>

                {activa ? (
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <button type="button" onClick={() => edicion.onMover(-1)} className="p-1 rounded hover:bg-neutral-100 text-neutral-500" aria-label={`Subir ${titulo}`}>
                            <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => edicion.onMover(1)} className="p-1 rounded hover:bg-neutral-100 text-neutral-500" aria-label={`Bajar ${titulo}`}>
                            <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={edicion.onOcultar}
                            className="flex items-center gap-1 px-2 py-1 rounded-md border border-neutral-200 text-xs font-medium text-neutral-600 hover:bg-neutral-50">
                            {oculto ? <><Eye className="w-3.5 h-3.5" /> Mostrar</> : <><EyeOff className="w-3.5 h-3.5" /> Ocultar</>}
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-3 flex-shrink-0">
                        {accion}
                        {enlace && (
                            <Link href={enlace.href} className="text-xs font-medium text-neutral-500 hover:text-neutral-900">
                                {enlace.texto} →
                            </Link>
                        )}
                    </div>
                )}
            </header>
            {abierto && <div className={activa ? 'pointer-events-none select-none' : ''}>{children}</div>}
        </section>
    );
}
