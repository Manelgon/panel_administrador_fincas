'use client';

import { createPortal } from 'react-dom';
import { Pause } from 'lucide-react';

interface Props {
    show: boolean;
    aplazarDate: string;
    onDateChange: (date: string) => void;
    onConfirm: () => void;
    onClose: () => void;
}

export default function AplazarModal({ show, aplazarDate, onDateChange, onConfirm, onClose }: Props) {
    if (!show) return null;

    return createPortal(
        <div
            className="fixed inset-0 bg-neutral-900/60 z-[99999] flex items-end sm:items-center sm:justify-center sm:p-4 backdrop-blur-sm animate-in fade-in duration-200"
        >
            <div
                className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-sm p-6 relative flex flex-col items-center text-center max-h-[92dvh] overflow-y-auto animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                    <Pause className="w-8 h-8 text-orange-600" />
                </div>
                <h3 className="text-xl font-bold text-neutral-900 mb-2">
                    Aplazar Ticket
                </h3>
                <p className="text-neutral-500 mb-6 text-sm">
                    Selecciona la fecha en la que quieres que el ticket vuelva a estar pendiente.
                </p>
                <input
                    type="date"
                    value={aplazarDate}
                    onChange={(e) => onDateChange(e.target.value)}
                    min={new Date().toISOString().slice(0, 10)}
                    className="w-full border-2 border-neutral-200 rounded-xl px-4 py-3 text-sm font-medium text-neutral-900 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none transition-all mb-6"
                />
                <div className="flex gap-3 w-full">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-xl font-bold transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={!aplazarDate}
                        className="flex-1 py-3 bg-orange-400 hover:bg-orange-500 text-white rounded-xl font-bold transition-transform active:scale-[0.98] shadow-lg shadow-orange-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        <Pause className="w-4 h-4" />
                        Aplazar
                    </button>
                </div>
            </div>
        </div>
    , document.body);
}
