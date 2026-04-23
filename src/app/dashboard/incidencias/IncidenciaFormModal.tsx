'use client';

import { createPortal } from 'react-dom';
import { X, AlertCircle, Loader2, Plus, Paperclip } from 'lucide-react';
import SearchableSelect from '@/components/SearchableSelect';
import { Profile, ComunidadOption } from '@/lib/schemas';

interface FormData {
    comunidad_id: string;
    nombre_cliente: string;
    telefono: string;
    email: string;
    motivo_ticket: string;
    mensaje: string;
    recibido_por: string;
    gestor_asignado: string;
    proveedor: string;
    source: string;
    fecha_registro: string;
}

interface Props {
    show: boolean;
    editingId: number | null;
    formData: FormData;
    formErrors: Record<string, string>;
    files: File[];
    uploading: boolean;
    isSubmitting: boolean;
    isManualDate: boolean;
    enviarAviso: boolean | null;
    notifEmail: boolean;
    notifWhatsapp: boolean;
    comunidades: ComunidadOption[];
    profiles: Profile[];
    onChange: (field: string, value: string) => void;
    onFilesChange: (files: File[]) => void;
    onSubmit: (e: React.FormEvent) => void;
    onClose: () => void;
    setEnviarAviso: (v: boolean | null) => void;
    setNotifEmail: (v: boolean) => void;
    setNotifWhatsapp: (v: boolean) => void;
    setIsManualDate: (v: boolean) => void;
    setFormErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

export default function IncidenciaFormModal({
    show,
    editingId,
    formData,
    formErrors,
    files,
    uploading,
    isSubmitting,
    isManualDate,
    enviarAviso,
    notifEmail,
    notifWhatsapp,
    comunidades,
    profiles,
    onChange,
    onFilesChange,
    onSubmit,
    onClose,
    setEnviarAviso,
    setNotifEmail,
    setNotifWhatsapp,
    setIsManualDate,
    setFormErrors,
}: Props) {
    if (!show) return null;

    return createPortal(
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex justify-center items-end sm:items-center sm:p-6"
        >
            <div
                className="bg-white w-full max-w-4xl rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[92dvh] sm:max-h-[90dvh] animate-in fade-in slide-in-from-bottom sm:zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-center px-5 py-4 border-b border-neutral-100 bg-neutral-50">
                    <div>
                        <h2 className="text-lg font-bold text-neutral-900 tracking-tight">
                            {editingId ? 'Editar Ticket' : 'Nuevo Ticket'}
                        </h2>
                        <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-0.5">
                            Complete los datos de la incidencia
                        </p>
                    </div>
                    <button
                        onClick={() => { onClose(); setFormErrors({}); }}
                        className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 sm:px-5 sm:py-4 overflow-y-auto custom-scrollbar flex-1">
                    <form id="incidencia-form" onSubmit={onSubmit} className="space-y-4">
                        {/* Section 1: Identificación del Cliente */}
                        <div>
                            <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-3 border-b border-[#bf4b50]">Identificación del Cliente</h3>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
                                <div className="md:col-span-2">
                                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">
                                        Comunidad <span className="text-red-500">*</span>
                                    </label>
                                    <SearchableSelect
                                        value={formData.comunidad_id}
                                        onChange={(val) => { onChange('comunidad_id', String(val)); setFormErrors(prev => ({ ...prev, comunidad_id: '' })); }}
                                        options={comunidades.map(cd => ({
                                            value: String(cd.id),
                                            label: cd.codigo ? `${cd.codigo} - ${cd.nombre_cdad}` : cd.nombre_cdad
                                        }))}
                                        placeholder="Buscar comunidad..."
                                    />
                                    {formErrors.comunidad_id && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.comunidad_id}</p>}
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">
                                        Nombre Propietario <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Nombre completo"
                                        className={`w-full rounded-lg border bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#bf4b50]/40 focus:border-[#bf4b50] focus:bg-white transition placeholder:text-neutral-400 ${formErrors.nombre_cliente ? 'border-red-400' : 'border-neutral-200'}`}
                                        value={formData.nombre_cliente}
                                        onChange={e => { onChange('nombre_cliente', e.target.value); setFormErrors(prev => ({ ...prev, nombre_cliente: '' })); }}
                                    />
                                    {formErrors.nombre_cliente && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.nombre_cliente}</p>}
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">
                                        Teléfono Cliente
                                    </label>
                                    <input
                                        type="tel"
                                        placeholder="Ej: 600000000"
                                        className={`w-full rounded-lg border bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#bf4b50]/40 focus:border-[#bf4b50] focus:bg-white transition placeholder:text-neutral-400 ${formErrors.telefono ? 'border-red-400' : 'border-neutral-200'}`}
                                        value={formData.telefono}
                                        onChange={e => { onChange('telefono', e.target.value); setFormErrors(prev => ({ ...prev, telefono: '', contacto: '' })); }}
                                    />
                                    {formErrors.telefono
                                        ? <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.telefono}</p>
                                        : <p className="mt-1 flex items-center gap-1.5 text-[10px] font-bold text-neutral-400 uppercase tracking-wider"><AlertCircle className="w-3 h-3" /> Sin espacios y sin prefijo</p>
                                    }
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">
                                        Email Cliente
                                    </label>
                                    <input
                                        type="email"
                                        placeholder="ejemplo@correo.com"
                                        className={`w-full rounded-lg border bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#bf4b50]/40 focus:border-[#bf4b50] focus:bg-white transition placeholder:text-neutral-400 ${formErrors.email ? 'border-red-400' : 'border-neutral-200'}`}
                                        value={formData.email}
                                        onChange={e => { onChange('email', e.target.value); setFormErrors(prev => ({ ...prev, email: '', contacto: '' })); }}
                                    />
                                    {formErrors.email && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.email}</p>}
                                    {formErrors.contacto && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.contacto}</p>}
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Datos de la Incidencia */}
                        <div>
                            <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-3 border-b border-[#bf4b50]">Datos de la Incidencia</h3>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
                                <div className="md:col-span-2">
                                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">
                                        Entrada (Fuente) <span className="text-red-500">*</span>
                                    </label>
                                    <SearchableSelect
                                        value={formData.source}
                                        onChange={(val) => { onChange('source', String(val)); setFormErrors(prev => ({ ...prev, source: '' })); }}
                                        options={[
                                            { value: 'Llamada', label: '📞 Llamada' },
                                            { value: 'Presencial', label: '🤝 Presencial' },
                                            { value: 'Email', label: '📧 Email' },
                                            { value: 'Whatsapp', label: '💬 Whatsapp' },
                                            { value: 'App 360', label: '📱 App 360' },
                                            { value: 'Acuerdo Junta', label: '📋 Acuerdo Junta' },
                                            { value: 'Tratar Junta', label: '🗣️ Tratar Junta' },
                                            { value: 'Gestión Interna', label: '🏢 Gestión Interna' },
                                        ]}
                                        placeholder="Seleccionar entrada..."
                                    />
                                    {formErrors.source && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.source}</p>}
                                </div>
                                <div className="md:col-span-2">
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                                            Fecha de Registro
                                        </label>
                                        <div className="flex items-center gap-1.5">
                                            <input
                                                type="checkbox"
                                                id="manual-date"
                                                checked={isManualDate}
                                                onChange={(e) => {
                                                    setIsManualDate(e.target.checked);
                                                    if (!e.target.checked) {
                                                        onChange('fecha_registro', new Date().toISOString().slice(0, 10));
                                                    }
                                                }}
                                                className="w-3 h-3 rounded border-neutral-300 text-[#a03d42] focus:ring-[#bf4b50]"
                                            />
                                            <label htmlFor="manual-date" className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest cursor-pointer hover:text-neutral-600 transition-colors">
                                                Modificar
                                            </label>
                                        </div>
                                    </div>
                                    <input
                                        type="date"
                                        disabled={!isManualDate}
                                        className={`w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#bf4b50]/40 focus:border-[#bf4b50] transition ${!isManualDate ? 'bg-neutral-100 cursor-not-allowed opacity-70' : 'bg-neutral-50/60 focus:bg-white'}`}
                                        value={formData.fecha_registro}
                                        onChange={e => onChange('fecha_registro', e.target.value)}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">
                                        Quién lo Recibió <span className="text-red-500">*</span>
                                    </label>
                                    <SearchableSelect
                                        value={formData.recibido_por}
                                        onChange={(val) => { onChange('recibido_por', String(val)); setFormErrors(prev => ({ ...prev, recibido_por: '' })); }}
                                        options={profiles.map(p => ({
                                            value: p.user_id,
                                            label: p.nombre
                                        }))}
                                        placeholder="Buscar persona..."
                                    />
                                    {formErrors.recibido_por && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.recibido_por}</p>}
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">
                                        Gestor Asignado <span className="text-red-500">*</span>
                                    </label>
                                    <SearchableSelect
                                        value={formData.gestor_asignado}
                                        onChange={(val) => { onChange('gestor_asignado', String(val)); setFormErrors(prev => ({ ...prev, gestor_asignado: '' })); }}
                                        options={profiles.map(p => ({
                                            value: p.user_id,
                                            label: `${p.nombre} (${p.rol})`
                                        }))}
                                        placeholder="Buscar gestor..."
                                    />
                                    {formErrors.gestor_asignado && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.gestor_asignado}</p>}
                                </div>
                                <div className="md:col-span-4">
                                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">
                                        Motivo Ticket <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Motivo principal del ticket..."
                                        className={`w-full rounded-lg border bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#bf4b50]/40 focus:border-[#bf4b50] focus:bg-white transition placeholder:text-neutral-400 ${formErrors.motivo_ticket ? 'border-red-400' : 'border-neutral-200'}`}
                                        value={formData.motivo_ticket}
                                        onChange={e => { onChange('motivo_ticket', e.target.value); setFormErrors(prev => ({ ...prev, motivo_ticket: '' })); }}
                                    />
                                    {formErrors.motivo_ticket && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.motivo_ticket}</p>}
                                </div>
                                <div className="md:col-span-4">
                                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">
                                        Mensaje de la Incidencia <span className="text-red-500">*</span>
                                    </label>
                                    <textarea
                                        rows={4}
                                        placeholder="Detalles sobre lo ocurrido..."
                                        className={`w-full rounded-lg border bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#bf4b50]/40 focus:border-[#bf4b50] focus:bg-white transition placeholder:text-neutral-400 resize-y ${formErrors.mensaje ? 'border-red-400' : 'border-neutral-200'}`}
                                        value={formData.mensaje}
                                        onChange={e => { onChange('mensaje', e.target.value); setFormErrors(prev => ({ ...prev, mensaje: '' })); }}
                                    />
                                    {formErrors.mensaje && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.mensaje}</p>}
                                </div>
                            </div>
                        </div>

                        {/* Section 3: Archivos */}
                        <div>
                            <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-3 border-b border-[#bf4b50]">Archivos</h3>

                            <div>
                                <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">
                                    Adjuntar Documentos
                                </label>
                                <input
                                    type="file"
                                    multiple
                                    className="w-full rounded-lg border border-neutral-200 bg-neutral-50/60 text-neutral-500 text-xs px-3 py-2 cursor-pointer
                                    file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-neutral-100 file:text-neutral-700 hover:file:bg-neutral-200 transition"
                                    onChange={(e) => {
                                        if (e.target.files) {
                                            onFilesChange(Array.from(e.target.files));
                                        }
                                    }}
                                />
                                {files.length > 0 && (
                                    <p className="mt-2 text-[10px] font-bold text-neutral-500 uppercase flex items-center gap-1.5"><Paperclip className="w-3 h-3" /> {files.length} archivos seleccionados</p>
                                )}
                            </div>
                        </div>

                        {/* Section: Notificación */}
                        <div>
                            <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-3 border-b border-[#bf4b50]">Notificación al Propietario</h3>
                            <div className="flex flex-col gap-3">
                                {/* Checkboxes de canal */}
                                <div className="bg-neutral-50/60 border border-neutral-100 rounded-lg p-3">
                                    <label className="text-xs font-bold text-neutral-900 uppercase tracking-widest block mb-2">
                                        Canal de notificación
                                    </label>
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={notifEmail}
                                                onChange={e => {
                                                    setNotifEmail(e.target.checked);
                                                    setEnviarAviso(e.target.checked || notifWhatsapp ? true : false);
                                                    setFormErrors(prev => ({ ...prev, contacto: '' }));
                                                }}
                                                className="w-4 h-4 rounded accent-[#bf4b50]"
                                            />
                                            <span className="text-xs font-semibold text-neutral-700">Notificar por Email</span>
                                        </label>
                                        <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={notifWhatsapp}
                                                onChange={e => {
                                                    setNotifWhatsapp(e.target.checked);
                                                    setEnviarAviso(notifEmail || e.target.checked ? true : false);
                                                    setFormErrors(prev => ({ ...prev, contacto: '' }));
                                                }}
                                                className="w-4 h-4 rounded accent-[#bf4b50]"
                                            />
                                            <span className="text-xs font-semibold text-neutral-700">Notificar por WhatsApp</span>
                                        </label>
                                    </div>
                                    <p className="text-[10px] text-neutral-400 mt-2">Deja ambos sin marcar si no deseas notificar al propietario.</p>
                                </div>
                                {/* Datos de contacto para notificación */}
                                {notifEmail && (
                                    <div>
                                        <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">
                                            Email para notificación <span className="text-red-500">*</span>
                                        </label>
                                        {formData.email ? (
                                            <div className="flex items-center gap-2 px-3 py-2 bg-neutral-100 border border-neutral-200 rounded-xl cursor-not-allowed">
                                                <span className="text-sm text-neutral-500 font-medium flex-1 select-none">{formData.email}</span>
                                                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest shrink-0">Del cliente</span>
                                            </div>
                                        ) : (
                                            <>
                                                <input
                                                    type="email"
                                                    placeholder="ejemplo@correo.com"
                                                    className={`w-full bg-white border text-neutral-900 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 transition-all placeholder:text-neutral-400 ${formErrors.email ? 'border-red-400 focus:ring-red-400/20' : 'border-neutral-200 focus:ring-[#bf4b50]/20 focus:border-[#bf4b50]'}`}
                                                    value={formData.email}
                                                    onChange={e => { onChange('email', e.target.value); setFormErrors(prev => ({ ...prev, email: '' })); }}
                                                />
                                                {formErrors.email && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.email}</p>}
                                            </>
                                        )}
                                    </div>
                                )}
                                {notifWhatsapp && (
                                    <div>
                                        <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">
                                            Teléfono para notificación <span className="text-red-500">*</span>
                                        </label>
                                        {formData.telefono ? (
                                            <div className="flex items-center gap-2 px-3 py-2 bg-neutral-100 border border-neutral-200 rounded-xl cursor-not-allowed">
                                                <span className="text-sm text-neutral-500 font-medium flex-1 select-none">{formData.telefono}</span>
                                                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest shrink-0">Del cliente</span>
                                            </div>
                                        ) : (
                                            <>
                                                <input
                                                    type="tel"
                                                    placeholder="600000000"
                                                    className={`w-full bg-white border text-neutral-900 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 transition-all placeholder:text-neutral-400 ${formErrors.telefono ? 'border-red-400 focus:ring-red-400/20' : 'border-neutral-200 focus:ring-[#bf4b50]/20 focus:border-[#bf4b50]'}`}
                                                    value={formData.telefono}
                                                    onChange={e => { onChange('telefono', e.target.value); setFormErrors(prev => ({ ...prev, telefono: '' })); }}
                                                />
                                                {formErrors.telefono && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.telefono}</p>}
                                            </>
                                        )}
                                    </div>
                                )}
                                {formErrors.contacto && (
                                    <p className="flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.contacto}</p>
                                )}
                            </div>
                        </div>

                        {/* Section: Proveedor */}
                        <div>
                            <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-3 border-b border-[#bf4b50]">Proveedor</h3>

                            <div>
                                <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">
                                    Enviar email a Proveedor
                                </label>
                                <select
                                    disabled
                                    className="w-full rounded-lg border border-neutral-200 bg-neutral-100 px-3 py-2 text-sm text-neutral-400 outline-none cursor-not-allowed"
                                    value={formData.proveedor}
                                    onChange={e => onChange('proveedor', e.target.value)}
                                >
                                    <option value="">Próximamente disponible...</option>
                                </select>
                            </div>
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-neutral-100 bg-neutral-50/40 flex justify-end gap-2 flex-wrap">
                    <button
                        type="button"
                        onClick={() => { onClose(); setFormErrors({}); }}
                        className="px-4 py-2 text-xs font-bold text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        form="incidencia-form"
                        type="submit"
                        disabled={
                            isSubmitting ||
                            uploading ||
                            !formData.nombre_cliente ||
                            !formData.comunidad_id ||
                            !formData.mensaje ||
                            !!(notifEmail && !formData.email) ||
                            !!(notifWhatsapp && !formData.telefono) ||
                            !!(formData.telefono && !/^\d{9}$/.test(formData.telefono)) ||
                            !!(formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
                        }
                        className="px-6 py-2 bg-[#bf4b50] hover:bg-[#a03d42] text-white rounded-lg text-xs font-bold transition disabled:opacity-50 flex items-center gap-2 shadow-sm"
                    >
                        {isSubmitting || uploading ? (
                            <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Procesando...
                            </>
                        ) : (
                            <>
                                <Plus className="w-3.5 h-3.5" />
                                {editingId ? 'Guardar Cambios' : 'Registrar Ticket'}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    , document.body);
}
