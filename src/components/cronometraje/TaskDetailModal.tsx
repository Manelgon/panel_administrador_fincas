'use client';

import { X, Trash2 } from 'lucide-react';
import ModalPortal from '@/components/ModalPortal';

function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

interface TaskDetailModalProps {
    task: any;
    onClose: () => void;
    onDeleteClick: () => void;
    numCommunities?: number;
}

export default function TaskDetailModal({ task, onClose, onDeleteClick, numCommunities = 1 }: TaskDetailModalProps) {
    if (!task) return null;

    const startDate = new Date(task.start_at);
    const endDate = task.end_at ? new Date(task.end_at) : null;

    const formatDateTime = (date: Date) => {
        return date.toLocaleString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex justify-center items-center p-4 sm:p-6">
            <div
                className="bg-white w-full max-w-lg rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[95vh] animate-in fade-in zoom-in duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-white shrink-0">
                    <div>
                        <h2 className="text-xl font-black text-neutral-900 tracking-tight">Detalles de Tarea</h2>
                        <p className="text-xs text-neutral-500 mt-0.5">Información detallada del registro</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-xl transition-colors text-neutral-400 hover:text-neutral-700">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">

                    {/* Identificación */}
                    <div>
                        <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-4 border-b border-yellow-400">Identificación</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="sm:col-span-2">
                                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Comunidad</label>
                                <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">
                                    {task.comunidades
                                        ? `${(task.comunidades as any).codigo} – ${(task.comunidades as any).nombre_cdad}`
                                        : <span className="text-orange-600 font-semibold">Todas las Comunidades</span>
                                    }
                                </div>
                            </div>
                            <div className="sm:col-span-2">
                                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Usuario</label>
                                <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">
                                    {task.profiles?.nombre || '–'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Temporalidad */}
                    <div>
                        <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-4 border-b border-yellow-400">Temporalidad</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Inicio</label>
                                <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">
                                    {formatDateTime(startDate)}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Fin</label>
                                <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">
                                    {endDate ? formatDateTime(endDate) : <span className="text-emerald-600 font-semibold">En curso</span>}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Duración Total</label>
                                <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm font-mono font-bold text-neutral-900">
                                    {task.duration_seconds ? formatDuration(task.duration_seconds) : '–'}
                                </div>
                            </div>
                            {!task.comunidad_id && task.duration_seconds && (
                                <div>
                                    <label className="block text-xs font-semibold text-orange-600 mb-1.5">Atribuido (÷{numCommunities})</label>
                                    <div className="w-full rounded-lg border border-orange-200 bg-orange-50 px-3 py-2.5 text-sm font-mono font-bold text-orange-600">
                                        {formatDuration(Math.round(task.duration_seconds / numCommunities))}
                                    </div>
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Tipo de Registro</label>
                                <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">
                                    {task.is_manual ? (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">Manual</span>
                                    ) : (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700">Tiempo Real</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Nota */}
                    <div>
                        <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-4 border-b border-yellow-400">Nota / Descripción</h3>
                        <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 min-h-[80px] whitespace-pre-wrap">
                            {task.nota || <span className="text-neutral-400 italic">Sin nota...</span>}
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-white border-t border-neutral-100 flex items-center justify-between shrink-0">
                    <button
                        onClick={onDeleteClick}
                        className="px-4 py-2 text-sm font-bold text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all flex items-center gap-2"
                    >
                        <Trash2 className="w-4 h-4" />
                        Eliminar
                    </button>
                    <button
                        onClick={onClose}
                        className="px-8 py-3 text-sm font-black text-neutral-900 border-2 border-neutral-900 hover:bg-neutral-50 rounded-xl transition-all"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
        </ModalPortal>
    );
}
