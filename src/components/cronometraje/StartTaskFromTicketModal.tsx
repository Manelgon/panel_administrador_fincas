'use client';

import { useState } from 'react';
import { X, Play, AlertCircle, Ticket } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { logActivity } from '@/lib/logActivity';
import { toast } from 'react-hot-toast';
import SearchableSelect from '@/components/SearchableSelect';
import ModalPortal from '@/components/ModalPortal';
import { useGlobalLoading } from '@/lib/globalLoading';

const TASK_TYPES = ['Documentación', 'Contabilidad', 'Incidencias', 'Jurídico', 'Reunión', 'Contestar emails', 'Llamada', 'Otros'];

interface Props {
    incidenciaId: number;
    comunidadId: number | null;
    comunidadLabel?: string;
    ticketLabel?: string;
    onClose: () => void;
    onStarted?: () => void;
}

export default function StartTaskFromTicketModal({
    incidenciaId,
    comunidadId,
    comunidadLabel,
    ticketLabel,
    onClose,
    onStarted,
}: Props) {
    const { withLoading } = useGlobalLoading();
    const [tipoTarea, setTipoTarea] = useState('Incidencias');
    const [otroTexto, setOtroTexto] = useState('');
    const [nota, setNota] = useState('');
    const [loading, setLoading] = useState(false);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    const handleStart = async () => {
        const errors: Record<string, string> = {};
        if (!tipoTarea) errors.tipoTarea = 'Selecciona un tipo de tarea';
        if (tipoTarea === 'Otros' && !otroTexto.trim()) errors.otroTexto = 'Describe el tipo de tarea';
        if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
        setFormErrors({});

        const finalTipo = tipoTarea === 'Otros' ? `Otros: ${otroTexto.trim()}` : tipoTarea;
        const finalNota = nota.trim() || `Ticket #${incidenciaId}`;

        await withLoading(async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase.rpc('start_task_timer', {
                    _comunidad_id: comunidadId ?? null,
                    _nota: finalNota,
                    _tipo_tarea: finalTipo,
                    _incidencia_id: incidenciaId,
                });
                if (error) throw error;

                await logActivity({
                    action: 'start_task',
                    entityType: 'task_timer',
                    entityId: data?.id,
                    entityName: ticketLabel || `Ticket #${incidenciaId}`,
                    details: {
                        incidencia_id: incidenciaId,
                        tipo_tarea: finalTipo,
                        nota: finalNota,
                        comunidad_id: comunidadId,
                    },
                });

                toast.success('Tarea iniciada');
                window.dispatchEvent(new Event('taskTimerChanged'));
                onStarted?.();
                onClose();
            } catch (err: any) {
                toast.error(err.message || 'Error al iniciar la tarea');
            } finally {
                setLoading(false);
            }
        }, 'Iniciando tarea...');
    };

    return (
        <ModalPortal>
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10001] flex justify-center items-end sm:items-center sm:p-6">
                <div
                    className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[92dvh] sm:max-h-[90dvh] animate-in fade-in slide-in-from-bottom sm:zoom-in-95 duration-200"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex justify-between items-center px-5 py-4 border-b border-neutral-100 bg-neutral-50 shrink-0">
                        <div>
                            <h2 className="text-lg font-bold text-neutral-900 tracking-tight flex items-center gap-2">
                                <Ticket className="w-4 h-4 text-yellow-500" />
                                Empezar Tarea del Ticket
                            </h2>
                            <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-0.5">
                                {ticketLabel || `Ticket #${incidenciaId}`}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-4">
                        <div>
                            <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">
                                Comunidad
                            </label>
                            <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">
                                {comunidadLabel || (comunidadId ? `Comunidad #${comunidadId}` : '— Sin comunidad —')}
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">
                                Tipo de Tarea <span className="text-red-500">*</span>
                            </label>
                            <SearchableSelect
                                options={TASK_TYPES.map((tipo) => ({ value: tipo, label: tipo }))}
                                value={tipoTarea}
                                onChange={(val) => { setTipoTarea(String(val)); if (val !== 'Otros') setOtroTexto(''); setFormErrors(prev => ({ ...prev, tipoTarea: '' })); }}
                                placeholder="Selecciona un tipo..."
                            />
                            {formErrors.tipoTarea && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.tipoTarea}</p>}
                            {tipoTarea === 'Otros' && (
                                <input
                                    type="text"
                                    className={`mt-2 w-full rounded-lg border bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400 focus:bg-white transition ${formErrors.otroTexto ? 'border-red-400' : 'border-neutral-200'}`}
                                    placeholder="Describe el tipo de tarea..."
                                    value={otroTexto}
                                    onChange={(e) => { setOtroTexto(e.target.value); setFormErrors(prev => ({ ...prev, otroTexto: '' })); }}
                                    autoFocus
                                />
                            )}
                            {formErrors.otroTexto && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.otroTexto}</p>}
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">
                                Nota <span className="text-neutral-400 font-normal normal-case tracking-normal">(opcional)</span>
                            </label>
                            <textarea
                                className="w-full min-h-[90px] rounded-lg border border-neutral-200 bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400 focus:bg-white transition resize-none"
                                placeholder={`Trabajo sobre Ticket #${incidenciaId}...`}
                                value={nota}
                                onChange={(e) => setNota(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-5 py-4 border-t border-neutral-100 bg-neutral-50 flex items-center justify-end gap-3 shrink-0 flex-wrap">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200 bg-neutral-100 rounded-lg transition"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleStart}
                            disabled={loading}
                            className="px-6 py-2 text-xs font-bold text-neutral-950 bg-yellow-400 hover:bg-yellow-500 rounded-lg transition shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <div className="w-3.5 h-3.5 border-2 border-neutral-400/30 border-t-neutral-900 rounded-full animate-spin" />
                            ) : (
                                <Play className="w-3.5 h-3.5 fill-current" />
                            )}
                            Comenzar
                        </button>
                    </div>
                </div>
            </div>
        </ModalPortal>
    );
}
