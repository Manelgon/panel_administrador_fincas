'use client';

import { useState } from 'react';
import { X, Clock, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { logActivity } from '@/lib/logActivity';
import { toast } from 'react-hot-toast';
import SearchableSelect from '@/components/SearchableSelect';
import ModalPortal from '@/components/ModalPortal';

interface AddTimeFromIncidenciaModalProps {
    incidenciaId: number;
    comunidadId: number | null;
    comunidadLabel?: string;
    ticketLabel?: string;
    onClose: () => void;
    onAdded?: () => void;
}

const TASK_TYPES = ['Documentación', 'Contabilidad', 'Incidencias', 'Jurídico', 'Reunión', 'Contestar emails', 'Llamada', 'Otros'];

export default function AddTimeFromIncidenciaModal({
    incidenciaId,
    comunidadId,
    comunidadLabel,
    ticketLabel,
    onClose,
    onAdded,
}: AddTimeFromIncidenciaModalProps) {
    const [nota, setNota] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [hours, setHours] = useState(0);
    const [minutes, setMinutes] = useState(0);
    const [tipoTarea, setTipoTarea] = useState('Incidencias');
    const [otroTexto, setOtroTexto] = useState('');
    const [loading, setLoading] = useState(false);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    const handleSave = async () => {
        const errors: Record<string, string> = {};
        if (!tipoTarea) errors.tipoTarea = 'Selecciona un tipo de tarea';
        if (tipoTarea === 'Otros' && !otroTexto?.trim()) errors.otroTexto = 'Describe el tipo de tarea';
        if (!date) errors.date = 'La fecha es obligatoria';
        if ((parseInt(String(hours)) || 0) * 60 + (parseInt(String(minutes)) || 0) < 1) errors.duration = 'Introduce una duración válida (al menos 1 minuto)';
        if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
        setFormErrors({});

        const totalSeconds = (parseInt(String(hours)) || 0) * 3600 + (parseInt(String(minutes)) || 0) * 60;
        const finalTipo = tipoTarea === 'Otros' ? `Otros: ${otroTexto.trim()}` : tipoTarea;

        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No autenticado');

            const startAt = new Date(`${date}T09:00:00`);
            const endAt = new Date(startAt.getTime() + totalSeconds * 1000);

            const { data, error } = await supabase.from('task_timers').insert({
                user_id: user.id,
                comunidad_id: comunidadId ?? null,
                nota: nota || null,
                start_at: startAt.toISOString(),
                end_at: endAt.toISOString(),
                duration_seconds: totalSeconds,
                is_manual: true,
                tipo_tarea: finalTipo,
                incidencia_id: incidenciaId,
            }).select().single();

            if (error) throw error;

            await logActivity({
                action: 'create',
                entityType: 'task_timer',
                entityId: data?.id,
                entityName: comunidadLabel || 'Comunidad',
                details: {
                    is_manual: true,
                    incidencia_id: incidenciaId,
                    date,
                    duration: `${hours}h ${minutes}m`,
                    nota: nota || null,
                    tipo_tarea: finalTipo,
                },
            });

            toast.success('Tiempo añadido correctamente');
            onAdded?.();
            onClose();
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Error al guardar';
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ModalPortal>
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex justify-center items-end sm:items-center sm:p-6">
                <div
                    className="bg-white w-full max-w-2xl rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[92dvh] sm:max-h-[90dvh] animate-in fade-in slide-in-from-bottom sm:zoom-in-95 duration-200"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex justify-between items-center px-5 py-4 border-b border-neutral-100 bg-neutral-50 shrink-0">
                        <div>
                            <h2 className="text-lg font-bold text-neutral-900 tracking-tight flex items-center gap-2">
                                <Clock className="w-5 h-5 text-yellow-500" />
                                Añadir tiempo
                            </h2>
                            {ticketLabel && (
                                <p className="text-[11px] text-neutral-500 mt-0.5">{ticketLabel}</p>
                            )}
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
                                <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-3 border-b border-yellow-400">Datos del tiempo registrado</h3>

                                {/* Comunidad (read-only) */}
                                <div className="mb-3">
                                    <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500 mb-1.5">
                                        Comunidad
                                    </label>
                                    <div className="w-full rounded-xl border border-neutral-200 bg-neutral-100 px-3 py-2 text-sm text-neutral-600 font-medium">
                                        {comunidadLabel || '—'}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-x-4 gap-y-3">
                                    {/* Tipo de Tarea */}
                                    <div className="md:col-span-2">
                                        <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500 mb-1.5">
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
                                                className={`mt-2 w-full rounded-xl border bg-neutral-50/50 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-yellow-400/50 focus:border-yellow-400 focus:bg-white transition ${formErrors.otroTexto ? 'border-red-400' : 'border-neutral-200'}`}
                                                placeholder="Describe el tipo de tarea..."
                                                value={otroTexto}
                                                onChange={(e) => { setOtroTexto(e.target.value); setFormErrors(prev => ({ ...prev, otroTexto: '' })); }}
                                                autoFocus
                                            />
                                        )}
                                        {formErrors.otroTexto && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.otroTexto}</p>}
                                    </div>

                                    {/* Día */}
                                    <div className="md:col-span-2">
                                        <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500 mb-1.5">
                                            Día <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            className={`w-full rounded-xl border bg-neutral-50/50 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-yellow-400/50 focus:border-yellow-400 focus:bg-white transition ${formErrors.date ? 'border-red-400' : 'border-neutral-200'}`}
                                            value={date}
                                            onChange={(e) => { setDate(e.target.value); setFormErrors(prev => ({ ...prev, date: '' })); }}
                                            max={new Date().toISOString().split('T')[0]}
                                        />
                                        {formErrors.date && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.date}</p>}
                                    </div>

                                    {/* Horas */}
                                    <div className="md:col-span-2">
                                        <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500 mb-1.5">
                                            Horas <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            min={0}
                                            max={23}
                                            className={`w-full rounded-xl border bg-neutral-50/50 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-yellow-400/50 focus:border-yellow-400 focus:bg-white transition ${formErrors.duration ? 'border-red-400' : 'border-neutral-200'}`}
                                            value={hours}
                                            onChange={(e) => { setHours(Math.max(0, Math.min(23, Number(e.target.value)))); setFormErrors(prev => ({ ...prev, duration: '' })); }}
                                        />
                                    </div>

                                    {/* Minutos */}
                                    <div className="md:col-span-2">
                                        <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500 mb-1.5">
                                            Minutos <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            min={0}
                                            max={59}
                                            className={`w-full rounded-xl border bg-neutral-50/50 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-yellow-400/50 focus:border-yellow-400 focus:bg-white transition ${formErrors.duration ? 'border-red-400' : 'border-neutral-200'}`}
                                            value={minutes}
                                            onChange={(e) => { setMinutes(Math.max(0, Math.min(59, Number(e.target.value)))); setFormErrors(prev => ({ ...prev, duration: '' })); }}
                                        />
                                        {formErrors.duration && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.duration}</p>}
                                    </div>

                                    {/* Nota */}
                                    <div className="md:col-span-4">
                                        <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500 mb-1.5">
                                            Nota <span className="text-neutral-400 normal-case tracking-normal font-medium">(Opcional)</span>
                                        </label>
                                        <textarea
                                            className="w-full rounded-xl border border-neutral-200 bg-neutral-50/50 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-yellow-400/50 focus:border-yellow-400 focus:bg-white transition resize-none"
                                            rows={2}
                                            placeholder="Describe la tarea realizada..."
                                            value={nota}
                                            onChange={(e) => setNota(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-neutral-100 bg-neutral-50 flex items-center justify-end gap-3 shrink-0 flex-wrap">
                        <button
                            onClick={() => { setFormErrors({}); onClose(); }}
                            className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200 bg-neutral-100 rounded-lg transition"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className="px-6 py-2 text-sm font-bold text-neutral-950 bg-yellow-400 hover:bg-yellow-500 rounded-lg transition shadow-sm hover:shadow-md active:scale-[0.98] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <div className="w-4 h-4 border-2 border-neutral-400/30 border-t-neutral-900 rounded-full animate-spin" />
                            ) : (
                                <Clock className="w-4 h-4" />
                            )}
                            Guardar tiempo
                        </button>
                    </div>
                </div>
            </div>
        </ModalPortal>
    );
}
