import { type ReactNode } from 'react';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand';

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
    success: 'bg-emerald-100 text-emerald-800',
    warning: 'bg-amber-100  text-amber-800',
    danger:  'bg-red-100    text-red-800',
    info:    'bg-blue-100   text-blue-800',
    neutral: 'bg-gray-100   text-gray-700',
    brand:   'bg-yellow-100 text-yellow-800',
};

interface BadgeProps {
    variant?: BadgeVariant;
    children: ReactNode;
    className?: string;
    dot?: boolean;
}

export default function Badge({ variant = 'neutral', children, className = '', dot = false }: BadgeProps) {
    return (
        <span
            className={`
                inline-flex items-center gap-1.5 px-2 py-0.5
                text-xs font-semibold rounded-full whitespace-nowrap
                ${VARIANT_CLASSES[variant]} ${className}
            `}
        >
            {dot && (
                <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: 'currentColor' }}
                    aria-hidden="true"
                />
            )}
            {children}
        </span>
    );
}

/** Utility: map common Spanish state strings to badge variants */
export function stateToVariant(state: string): BadgeVariant {
    const s = state.toLowerCase();
    if (['resuelto', 'al corriente', 'activo', 'pagado', 'completado'].some(v => s.includes(v))) return 'success';
    if (['pendiente', 'en proceso', 'aplazado', 'en revisión'].some(v => s.includes(v))) return 'warning';
    if (['mora', 'urgente', 'vencido', 'impagado', 'rechazado'].some(v => s.includes(v))) return 'danger';
    if (['cerrado', 'inactivo', 'archivado', 'cancelado'].some(v => s.includes(v))) return 'neutral';
    return 'info';
}
