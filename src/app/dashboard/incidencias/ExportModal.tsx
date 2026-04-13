'use client';

import { createPortal } from 'react-dom';

interface Props {
    show: boolean;
    pendingExportParams: { type: 'csv' | 'pdf'; ids?: number[]; includeNotes?: boolean } | null;
    onConfirm: (includeNotes: boolean) => void;
    onClose: () => void;
}

export default function ExportModal({ show, pendingExportParams, onConfirm, onClose }: Props) {
    if (!show) return null;

    return createPortal(
        <div
            className="fixed inset-0 bg-black/50 z-[99999] flex items-end sm:items-center sm:justify-center sm:p-4 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-sm p-6 relative overflow-hidden max-h-[92dvh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                <div className="text-center">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Exportar PDF</h3>
                    <p className="text-sm text-gray-600 mb-8 px-2">
                        ¿Desea incluir las notas de gestión en el documento PDF?
                    </p>

                    <div className="flex flex-col gap-3">
                        <button
                            onClick={() => onConfirm(true)}
                            className="w-full py-3 bg-[#bf4b50] text-white rounded-full font-bold hover:bg-[#a03d42] transition shadow-md"
                        >
                            SÍ
                        </button>
                        <button
                            onClick={() => onConfirm(false)}
                            className="w-full py-3 bg-gray-200 text-red-600 rounded-full font-bold hover:bg-gray-300 transition"
                        >
                            NO
                        </button>
                        <button
                            onClick={onClose}
                            className="w-full py-3 bg-gray-200 text-gray-700 rounded-full font-bold hover:bg-gray-300 transition"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    , document.body);
}
