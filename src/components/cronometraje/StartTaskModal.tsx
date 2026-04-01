'use client';

import { useState, useEffect } from 'react';
import { X, Play, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { logActivity } from '@/lib/logActivity';
import { toast } from 'react-hot-toast';
import SearchableSelect from '@/components/SearchableSelect';
import ModalPortal from '@/components/ModalPortal';

interface Community {
    id: string;
    nombre_cdad: string;
    codigo: string;
}

interface StartTaskModalProps {
    onClose: () => void;
    onStarted: () => void;
}

const TASK_TYPES = ['Documentación', 'Contabilidad', 'Incidencias', 'Jurídico', 'Reunión', 'Contestar emails', 'Llamada', 'Otros'];


export default function StartTaskModal({ onClose, onStarted }: StartTaskModalProps) {
    const [communities, setCommunities] = useState<Community[]>([]);
    const [selectedCommunity, setSelectedCommunity] = useState<string>('');
    const [nota, setNota] = useState('');
    const [tipoTarea, setTipoTarea] = useState('');
    const [otroTexto, setOtroTexto] = useState('');
    const [loading, setLoading] = useState(false);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        supabase
            .from('comunidades')
            .select('id, nombre_cdad, codigo')
            .order('codigo', { ascending: true })
            .then(({ data }) => {
                if (data) setCommunities(data);
            });
    }, []);

    const handleStart = async () => {
        const errors: Record<string, string> = {};
        if (!selectedCommunity) errors.selectedCommunity = 'Selecciona una comunidad';
        if (!tipoTarea) errors.tipoTarea = 'Selecciona un tipo de tarea';
        if (tipoTarea === 'Otros' && !otroTexto?.trim()) errors.otroTexto = 'Describe el tipo de tarea';
        if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
        setFormErrors({});

        const finalTipo = tipoTarea === 'Otros' ? `Otros: ${otroTexto.trim()}` : tipoTarea;

        setLoading(true);
        try {
            const isTodas = selectedCommunity === 'all';
            const { data, error } = await supabase.rpc('start_task_timer', {
                _comunidad_id: isTodas ? null : Number(selectedCommunity),
                _nota: nota || null,
            });
            if (error) throw error;

            // Update tipo_tarea since the RPC doesn't accept it
            if (data?.id) {
                await supabase.from('task_timers').update({ tipo_tarea: finalTipo }).eq('id', data.id);
            }

            const comm = communities.find(c => String(c.id) === selectedCommunity);
            await logActivity({
                action: 'start_task',
                entityType: 'task_timer',
                entityId: data?.id,
                entityName: comm ? `${comm.codigo} - ${comm.nombre_cdad}` : 'Comunidad',
                details: { nota: nota || null, tipo_tarea: finalTipo },
            });

            toast.success('Tarea iniciada');
            window.dispatchEvent(new Event('taskTimerChanged'));
            onStarted();
            onClose();
        } catch (error: any) {
            toast.error(error.message || 'Error al iniciar tarea');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex justify-center items-end sm:items-center sm:p-6">
            <div
                className="bg-white w-full max-w-3xl rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[92vh] sm:max-h-[90vh] animate-in fade-in slide-in-from-bottom sm:zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-center px-5 py-4 border-b border-neutral-100 bg-neutral-50 shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-neutral-900 tracking-tight">
                            Empezar Tarea
                        </h2>
                        <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-0.5">
                            Configura los detalles de la nueva tarea
                        </p>
                    </div>
                    <button
                        onClick={() => { setFormErrors({}); onClose(); }}
                        className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 sm:px-5 sm:py-4 overflow-y-auto custom-scrollbar flex-1">
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-3 border-b border-yellow-400">Datos de la Tarea</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                        {/* Asignación */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">
                                    Comunidad <span className="text-red-500">*</span>
                                </label>
                                <SearchableSelect
                                    options={[
                                        { value: 'all', label: 'TODAS LAS COMUNIDADES' },
                                        ...communities.map(c => ({
                                            value: String(c.id),
                                            label: `${c.codigo} - ${c.nombre_cdad}`,
                                        }))
                                    ]}
                                    value={selectedCommunity}
                                    onChange={(val) => { setSelectedCommunity(String(val)); setFormErrors(prev => ({ ...prev, selectedCommunity: '' })); }}
                                    placeholder="Buscar comunidad..."
                                />
                                {formErrors.selectedCommunity && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.selectedCommunity}</p>}
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
                        </div>

                        {/* Notas */}
                        <div className="flex flex-col h-full min-h-[120px]">
                            <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">
                                Nota <span className="text-neutral-400 font-normal normal-case tracking-normal">(opcional)</span>
                            </label>
                            <textarea
                                className="w-full flex-1 rounded-lg border border-neutral-200 bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400 focus:bg-white transition resize-none"
                                placeholder="Describe brevemente la tarea..."
                                value={nota}
                                onChange={(e) => setNota(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Footer */}
                <div className="px-6 py-4 border-t border-neutral-100 bg-neutral-50 flex items-center justify-end gap-3 shrink-0">
                    <button
                        onClick={() => { setFormErrors({}); onClose(); }}
                        className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200 bg-neutral-100 rounded-lg transition"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleStart}
                        disabled={loading || !selectedCommunity}
                        className="px-6 py-2 text-xs font-bold text-neutral-950 bg-yellow-400 hover:bg-yellow-500 rounded-lg transition shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <div className="w-3.5 h-3.5 border-2 border-neutral-400/30 border-t-neutral-900 rounded-full animate-spin" />
                        ) : (
                            <Play className="w-3.5 h-3.5 fill-current" />
                        )}
                        Empezar
                    </button>
                </div>
            </div>
        </div>
        </ModalPortal>
    );
}
