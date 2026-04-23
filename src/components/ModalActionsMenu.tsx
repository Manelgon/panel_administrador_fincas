'use client';

import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';

export interface ModalAction {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
    variant?: 'default' | 'danger' | 'warning' | 'success' | 'info';
    /** Si true, siempre se muestra como botón independiente (no entra en el menú) */
    primary?: boolean;
}

interface Props {
    actions: ModalAction[];
    /** Número de acciones visibles antes de colapsar en móvil (default: 1) */
    visibleOnMobile?: number;
}

const variantClass: Record<string, string> = {
    default: 'text-neutral-700 hover:bg-neutral-100',
    danger: 'text-red-600 hover:bg-red-50',
    warning: 'text-orange-600 hover:bg-orange-50',
    success: 'text-green-700 hover:bg-green-50',
    info: 'text-blue-600 hover:bg-blue-50',
};

const variantBtnClass: Record<string, string> = {
    default: 'px-4 py-2 text-sm font-bold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl transition-all flex items-center gap-2',
    danger: 'px-4 py-2 text-sm font-bold text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all flex items-center gap-2',
    warning: 'px-4 py-2 text-sm font-bold text-orange-600 hover:bg-orange-50 rounded-xl border border-orange-200 transition-all flex items-center gap-2',
    success: 'px-4 py-2 text-sm font-bold text-green-700 hover:bg-green-50 rounded-xl transition-all flex items-center gap-2',
    info: 'px-4 py-2 text-sm font-bold text-blue-600 hover:bg-blue-50 rounded-xl transition-all flex items-center gap-2',
};

export default function ModalActionsMenu({ actions, visibleOnMobile = 1 }: Props) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const primaryActions = actions.filter(a => a.primary);
    const secondaryActions = actions.filter(a => !a.primary);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div className="flex items-center gap-2">
            {/* En desktop: todos los botones secundarios visibles */}
            <div className="hidden sm:flex items-center gap-2">
                {secondaryActions.map((a, i) => (
                    <button
                        key={i}
                        onClick={() => { a.onClick(); setOpen(false); }}
                        disabled={a.disabled}
                        className={`${variantBtnClass[a.variant || 'default']} disabled:opacity-50`}
                    >
                        {a.icon}
                        {a.label}
                    </button>
                ))}
            </div>

            {/* En móvil: dropdown "Acciones" para los secundarios */}
            {secondaryActions.length > 0 && (
                <div className="relative sm:hidden" ref={ref}>
                    <button
                        onClick={() => setOpen(v => !v)}
                        className="px-3 py-2 text-sm font-bold text-neutral-600 hover:bg-neutral-100 rounded-xl transition-all flex items-center gap-1.5 border border-neutral-200"
                    >
                        <MoreHorizontal className="w-4 h-4" />
                        Acciones
                    </button>
                    {open && (
                        <div className="absolute bottom-full mb-2 right-0 bg-white border border-neutral-200 rounded-xl shadow-xl py-1 min-w-[160px] z-10">
                            {secondaryActions.map((a, i) => (
                                <button
                                    key={i}
                                    onClick={() => { a.onClick(); setOpen(false); }}
                                    disabled={a.disabled}
                                    className={`w-full text-left px-4 py-2.5 text-sm font-semibold flex items-center gap-2.5 disabled:opacity-50 ${variantClass[a.variant || 'default']}`}
                                >
                                    {a.icon}
                                    {a.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Botones primarios: siempre visibles */}
            {primaryActions.map((a, i) => (
                <button
                    key={i}
                    onClick={a.onClick}
                    disabled={a.disabled}
                    className={`${variantBtnClass[a.variant || 'default']} disabled:opacity-50`}
                >
                    {a.icon}
                    {a.label}
                </button>
            ))}
        </div>
    );
}
