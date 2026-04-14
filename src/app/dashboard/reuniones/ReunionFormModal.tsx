'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, Plus, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'react-hot-toast';
import SearchableSelect from '@/components/SearchableSelect';
import { logActivity } from '@/lib/logActivity';
import { ComunidadOption } from '@/lib/schemas';

interface Props {
    show: boolean;
    editingId: number | null;
    comunidades: ComunidadOption[];
    onClose: () => void;
    onSaved: () => void;
}

const DOCS_FIELDS: { key: string; label: string }[] = [
    { key: 'estado_cuentas', label: 'Estado de Cuentas' },
    { key: 'pto_ordinario',  label: 'Pto. Ordinario' },
    { key: 'pto_extra',      label: 'Pto. Extra' },
    { key: 'morosos',        label: 'Morosos' },
];

const SEGUIMIENTO_FIELDS: { key: string; label: string }[] = [
    { key: 'citacion_email', label: 'Citación @' },
    { key: 'citacion_carta', label: 'Cit. Carta' },
    { key: 'acta_email',     label: 'Acta @' },
    { key: 'acta_carta',     label: 'Acta Carta' },
];

const SEGUIMIENTO2_FIELDS: { key: string; label: string }[] = [
    { key: 'redactar_acta',  label: 'Redactar Acta' },
    { key: 'vb_pendiente',   label: 'Vº Bº Pendiente' },
    { key: 'pasar_acuerdos', label: 'Pasar Acuerdos' },
];

const emptyForm = {
    comunidad_id: '',
    fecha_reunion: '',
    tipo: '',
    estado_cuentas: false,
    pto_ordinario: false,
    pto_extra: false,
    morosos: false,
    citacion_email: false,
    citacion_carta: false,
    redactar_acta: false,
    vb_pendiente: false,
    acta_email: false,
    acta_carta: false,
    pasar_acuerdos: false,
    notas: '',
};

export default function ReunionFormModal({ show, editingId, comunidades, onClose, onSaved }: Props) {
    const [formData, setFormData] = useState<typeof emptyForm>({ ...emptyForm });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!show) return;
        if (editingId) {
            supabase.from('reuniones').select('*').eq('id', editingId).single().then(({ data }) => {
                if (data) {
                    setFormData({
                        comunidad_id: String(data.comunidad_id),
                        fecha_reunion: data.fecha_reunion || '',
                        tipo: data.tipo || '',
                        estado_cuentas: data.estado_cuentas ?? false,
                        pto_ordinario: data.pto_ordinario ?? false,
                        pto_extra: data.pto_extra ?? false,
                        morosos: data.morosos ?? false,
                        citacion_email: data.citacion_email ?? false,
                        citacion_carta: data.citacion_carta ?? false,
                        redactar_acta: data.redactar_acta ?? false,
                        vb_pendiente: data.vb_pendiente ?? false,
                        acta_email: data.acta_email ?? false,
                        acta_carta: data.acta_carta ?? false,
                        pasar_acuerdos: data.pasar_acuerdos ?? false,
                        notas: data.notas || '',
                    });
                }
            });
        } else {
            setFormData({ ...emptyForm });
            setErrors({});
        }
    }, [show, editingId]);

    if (!show) return null;

    const validate = () => {
        const e: Record<string, string> = {};
        if (!formData.comunidad_id) e.comunidad_id = 'Selecciona una comunidad';
        if (!formData.fecha_reunion) e.fecha_reunion = 'La fecha es obligatoria';
        if (!formData.tipo) e.tipo = 'Selecciona el tipo de junta';
        return e;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const errs = validate();
        if (Object.keys(errs).length > 0) { setErrors(errs); return; }
        setErrors({});
        setIsSubmitting(true);

        const payload = {
            comunidad_id: Number(formData.comunidad_id),
            fecha_reunion: formData.fecha_reunion,
            tipo: formData.tipo,
            estado_cuentas: formData.estado_cuentas,
            pto_ordinario: formData.pto_ordinario,
            pto_extra: formData.pto_extra,
            morosos: formData.morosos,
            citacion_email: formData.citacion_email,
            citacion_carta: formData.citacion_carta,
            redactar_acta: formData.redactar_acta,
            vb_pendiente: formData.vb_pendiente,
            acta_email: formData.acta_email,
            acta_carta: formData.acta_carta,
            pasar_acuerdos: formData.pasar_acuerdos,
            notas: formData.notas || null,
        };

        if (editingId) {
            const { error } = await supabase.from('reuniones').update(payload).eq('id', editingId);
            if (error) {
                toast.error('Error al guardar la reunión');
            } else {
                toast.success('Reunión actualizada');
                await logActivity({ action: 'update', entityType: 'reunion', entityId: editingId, entityName: `${payload.tipo} - ${payload.fecha_reunion}` });
                onSaved();
                onClose();
            }
        } else {
            const { data: { user } } = await supabase.auth.getUser();
            const { error } = await supabase.from('reuniones').insert([{ ...payload, created_by: user?.id }]);
            if (error) {
                toast.error('Error al crear la reunión');
            } else {
                toast.success('Reunión creada');
                await logActivity({ action: 'create', entityType: 'reunion', entityName: `${payload.tipo} - ${payload.fecha_reunion}` });
                onSaved();
                onClose();
            }
        }
        setIsSubmitting(false);
    };

    const toggle = (key: string) => {
        setFormData(prev => ({ ...prev, [key]: !prev[key as keyof typeof prev] }));
    };

    return createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex justify-center items-end sm:items-center sm:p-6">
            <div
                className="bg-white w-full max-w-2xl rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[92dvh] sm:max-h-[90dvh] animate-in fade-in slide-in-from-bottom sm:zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-center px-5 py-4 border-b border-neutral-100 bg-neutral-50">
                    <div>
                        <h2 className="text-lg font-bold text-neutral-900 tracking-tight">
                            {editingId ? 'Editar Reunión' : 'Nueva Reunión'}
                        </h2>
                        <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-0.5">
                            Complete los datos de la junta
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
                <div className="p-4 sm:px-5 sm:py-4 overflow-y-auto flex-1">
                    <form id="reunion-form" onSubmit={handleSubmit} className="space-y-5">

                        {/* Datos básicos */}
                        <div>
                            <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-3 border-b border-[#f5a623]">
                                Datos de la Reunión
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="sm:col-span-2">
                                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">
                                        Comunidad <span className="text-red-500">*</span>
                                    </label>
                                    <SearchableSelect
                                        value={formData.comunidad_id}
                                        onChange={val => { setFormData(prev => ({ ...prev, comunidad_id: String(val) })); setErrors(prev => ({ ...prev, comunidad_id: '' })); }}
                                        options={comunidades.map(c => ({
                                            value: String(c.id),
                                            label: c.codigo ? `${c.codigo} - ${c.nombre_cdad}` : c.nombre_cdad,
                                        }))}
                                        placeholder="Buscar comunidad..."
                                    />
                                    {errors.comunidad_id && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{errors.comunidad_id}</p>}
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">
                                        Fecha <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        className={`w-full rounded-lg border bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#bf4b50]/40 focus:border-[#bf4b50] focus:bg-white transition ${errors.fecha_reunion ? 'border-red-400' : 'border-neutral-200'}`}
                                        value={formData.fecha_reunion}
                                        onChange={e => { setFormData(prev => ({ ...prev, fecha_reunion: e.target.value })); setErrors(prev => ({ ...prev, fecha_reunion: '' })); }}
                                    />
                                    {errors.fecha_reunion && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{errors.fecha_reunion}</p>}
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">
                                        Tipo de Junta <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        className={`w-full rounded-lg border bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#bf4b50]/40 focus:border-[#bf4b50] focus:bg-white appearance-none transition ${errors.tipo ? 'border-red-400' : 'border-neutral-200'}`}
                                        value={formData.tipo}
                                        onChange={e => { setFormData(prev => ({ ...prev, tipo: e.target.value })); setErrors(prev => ({ ...prev, tipo: '' })); }}
                                    >
                                        <option value="">Seleccionar tipo...</option>
                                        <option value="JGO">JGO — Junta General Ordinaria</option>
                                        <option value="JGE">JGE — Junta General Extraordinaria</option>
                                        <option value="JV">JV — Junta de Vocales</option>
                                        <option value="JD">JD — Junta Directiva</option>
                                    </select>
                                    {errors.tipo && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{errors.tipo}</p>}
                                </div>
                            </div>
                        </div>

                        {/* Documentos a Enviar */}
                        <div>
                            <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-3 border-b border-[#f5a623]">
                                Documentos a Enviar
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                                {DOCS_FIELDS.map(({ key, label }) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => toggle(key)}
                                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-xs font-semibold transition-all ${
                                            formData[key as keyof typeof formData]
                                                ? 'bg-[#f5a623]/10 border-[#f5a623]/40 text-[#c47f00]'
                                                : 'bg-neutral-50 border-neutral-200 text-neutral-500 hover:border-neutral-300'
                                        }`}
                                    >
                                        <span className={`w-4 h-4 rounded flex items-center justify-center shrink-0 text-[10px] font-bold ${
                                            formData[key as keyof typeof formData]
                                                ? 'bg-[#f5a623] text-white'
                                                : 'bg-neutral-200 text-neutral-400'
                                        }`}>
                                            {formData[key as keyof typeof formData] ? '✓' : ''}
                                        </span>
                                        {label}
                                    </button>
                                ))}
                            </div>

                        </div>

                        {/* Método de Envío */}
                        <div>
                            <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-3 border-b border-[#f5a623]">
                                Método de Envío
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {SEGUIMIENTO_FIELDS.map(({ key, label }) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => toggle(key)}
                                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-xs font-semibold transition-all ${
                                            formData[key as keyof typeof formData]
                                                ? 'bg-[#f5a623]/10 border-[#f5a623]/40 text-[#c47f00]'
                                                : 'bg-neutral-50 border-neutral-200 text-neutral-500 hover:border-neutral-300'
                                        }`}
                                    >
                                        <span className={`w-4 h-4 rounded flex items-center justify-center shrink-0 text-[10px] font-bold ${
                                            formData[key as keyof typeof formData]
                                                ? 'bg-[#f5a623] text-white'
                                                : 'bg-neutral-200 text-neutral-400'
                                        }`}>
                                            {formData[key as keyof typeof formData] ? '✓' : ''}
                                        </span>
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Seguimiento */}
                        <div>
                            <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-3 border-b border-[#f5a623]">
                                Seguimiento
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {SEGUIMIENTO2_FIELDS.map(({ key, label }) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => toggle(key)}
                                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-xs font-semibold transition-all ${
                                            formData[key as keyof typeof formData]
                                                ? 'bg-[#f5a623]/10 border-[#f5a623]/40 text-[#c47f00]'
                                                : 'bg-neutral-50 border-neutral-200 text-neutral-500 hover:border-neutral-300'
                                        }`}
                                    >
                                        <span className={`w-4 h-4 rounded flex items-center justify-center shrink-0 text-[10px] font-bold ${
                                            formData[key as keyof typeof formData]
                                                ? 'bg-[#f5a623] text-white'
                                                : 'bg-neutral-200 text-neutral-400'
                                        }`}>
                                            {formData[key as keyof typeof formData] ? '✓' : ''}
                                        </span>
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Notas */}
                        <div>
                            <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-3 border-b border-[#f5a623]">
                                Notas
                            </h3>
                            <textarea
                                rows={3}
                                placeholder="Observaciones o notas adicionales..."
                                className="w-full rounded-lg border border-neutral-200 bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#bf4b50]/40 focus:border-[#bf4b50] focus:bg-white transition placeholder:text-neutral-400 resize-y"
                                value={formData.notas}
                                onChange={e => setFormData(prev => ({ ...prev, notas: e.target.value }))}
                            />
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-neutral-100 bg-neutral-50 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-bold text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        form="reunion-form"
                        type="submit"
                        disabled={isSubmitting}
                        className="px-6 py-2 bg-[#f5a623] hover:bg-[#e09510] text-black rounded-lg text-xs font-bold transition disabled:opacity-50 flex items-center gap-2"
                    >
                        {isSubmitting ? (
                            <><Loader2 className="w-3.5 h-3.5 animate-spin" />Guardando...</>
                        ) : (
                            <><Plus className="w-3.5 h-3.5" />{editingId ? 'Guardar Cambios' : 'Crear Reunión'}</>
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
