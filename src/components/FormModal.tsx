'use client';

import { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus } from 'lucide-react';

interface FormModalProps {
    isOpen: boolean;
    portalReady: boolean;
    onClose: () => void;
    onSubmit: (e: React.FormEvent) => void;
    title: string;
    subtitle?: string;
    editingId: number | null;
    submitLabel?: string;
    formId?: string;
    maxWidth?: string;
    children: ReactNode;
}

export default function FormModal({
    isOpen,
    portalReady,
    onClose,
    onSubmit,
    title,
    subtitle,
    editingId,
    submitLabel,
    formId = 'crud-form',
    maxWidth = 'max-w-2xl',
    children,
}: FormModalProps) {
    if (!portalReady || !isOpen) return null;

    const finalSubmitLabel = submitLabel || (editingId ? 'Guardar Cambios' : 'Crear');

    return createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex justify-center items-end sm:items-center sm:p-6">
            <div
                className={`bg-white w-full ${maxWidth} rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[92dvh] sm:max-h-[90dvh] animate-in fade-in slide-in-from-bottom sm:zoom-in-95 duration-200`}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-white shrink-0">
                    <div>
                        <h2 className="text-xl font-black text-neutral-900 tracking-tight">{title}</h2>
                        {subtitle && (
                            <p className="text-xs text-neutral-500 mt-0.5">{subtitle}</p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl hover:bg-neutral-100 text-neutral-400 hover:text-neutral-900 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <form id={formId} onSubmit={onSubmit} className="space-y-6">
                        {children}
                    </form>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-white border-t border-neutral-100 flex items-center justify-end gap-3 shrink-0 flex-wrap">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-3 text-sm font-bold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        form={formId}
                        type="submit"
                        className="px-8 py-3 text-sm font-black text-neutral-900 bg-yellow-400 hover:bg-yellow-500 rounded-xl transition-all shadow-sm flex items-center gap-2 hover:shadow-md hover:-translate-y-0.5"
                    >
                        <Plus className="w-4 h-4" />
                        {finalSubmitLabel}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
