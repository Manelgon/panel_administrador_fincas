'use client';

import { createPortal } from 'react-dom';
import { Trash2 } from 'lucide-react';

interface Props {
    show: boolean;
    onConfirm: () => void;
    onClose: () => void;
}

export default function DeleteDocConfirmModal({ show, onConfirm, onClose }: Props) {
    if (!show) return null;

    return createPortal(
        <div
            className="fixed inset-0 bg-neutral-900/60 z-[99999] flex items-end sm:items-center sm:justify-center sm:p-4 backdrop-blur-sm animate-in fade-in duration-200"
        >
            <div
                className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-sm p-6 relative flex flex-col items-center text-center max-h-[92dvh] overflow-y-auto animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
            >
                <div className="w-16 h-16 bg-yellow-50 rounded-full flex items-center justify-center mb-4">
                    <Trash2 className="w-8 h-8 text-yellow-600" />
                </div>
                <h3 className="text-xl font-bold text-neutral-900 mb-2">
                    ¿Eliminar documento?
                </h3>
                <p className="text-neutral-500 mb-6">
                    Esta acción no se puede deshacer. El archivo será eliminado permanentemente del sistema.
                </p>
                <div className="flex gap-3 w-full">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-xl font-bold transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 py-3 bg-[#bf4b50] hover:bg-[#a03d42] text-white rounded-xl font-bold transition-transform active:scale-[0.98] shadow-lg shadow-yellow-100"
                    >
                        Eliminar
                    </button>
                </div>
            </div>
        </div>
    , document.body);
}
