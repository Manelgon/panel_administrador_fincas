'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-hot-toast';
import { AlertCircle, Loader2, Mail, Paperclip, Plus, X } from 'lucide-react';
import MsgReader from '@kenjiuno/msgreader';
import { decompressRTF } from '@kenjiuno/decompressrtf';
import { supabase } from '@/lib/supabaseClient';
import { logActivity } from '@/lib/logActivity';
import SearchableSelect from '@/components/SearchableSelect';
import { Profile, ComunidadOption } from '@/lib/schemas';

interface MsgImportModalProps {
    comunidades: ComunidadOption[];
    profiles: Profile[];
    onClose: () => void;
    onCreated: () => void;
}

interface ParsedMsg {
    subject: string;
    senderName: string;
    senderEmail: string;
    body: string;
}

// Fallback muy básico para emails que solo traen cuerpo en RTF comprimido
function rtfToPlainText(rtf: string): string {
    return rtf
        .replace(/\{\\\*[^{}]*\}/g, '')
        .replace(/\\par[d]?\b/g, '\n')
        .replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/\\u(-?\d+)\??/g, (_, code) => String.fromCharCode((parseInt(code, 10) + 65536) % 65536))
        .replace(/\\[a-zA-Z]+-?\d* ?/g, '')
        .replace(/[{}]/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function htmlToPlainText(html: string): string {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return (doc.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
}

const normalizeText = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

// Tokens iniciales sin valor identificativo en los nombres de comunidad de la BD
// (ej: "CJ RS PISCIS CONDEMAR" → núcleo "piscis condemar", "RESD. BELLAVISTA PERIANA" → "bellavista periana")
const PREFIX_TOKENS = new Set([
    'cj', 'rs', 'resd', 'residencial', 'urb', 'urbanizacion', 'edificio', 'edf',
    'cdad', 'prop', 'cp', 'eucc', 'conjunto', 'comunidad', 'de', 'propietarios',
    'av', 'avda', 'avenida', 'calle', 'pz', 'pj', 'plaza', 'pasaje', 'grupo',
]);

const coreComunidadName = (name: string) => {
    const tokens = normalizeText(name).split(' ');
    let i = 0;
    // Las letras sueltas iniciales también son prefijo (ej: "E.U.C.C." normalizado queda "e u c c")
    while (i < tokens.length - 1 && (PREFIX_TOKENS.has(tokens[i]) || tokens[i].length <= 1)) i++;
    return tokens.slice(i).join(' ');
};

function matchComunidad(text: string, comunidades: ComunidadOption[]): ComunidadOption | null {
    const haystack = normalizeText(text);
    let best: ComunidadOption | null = null;
    let bestLen = 0;
    for (const c of comunidades) {
        const candidates = new Set([normalizeText(c.nombre_cdad || ''), coreComunidadName(c.nombre_cdad || '')]);
        for (const name of candidates) {
            // Mínimo 4 caracteres para evitar falsos positivos con nombres muy cortos
            if (name.length >= 4 && haystack.includes(name) && name.length > bestLen) {
                best = c;
                bestLen = name.length;
            }
        }
    }
    return best;
}

// Párrafos de cortesía legal con los que arrancan los pies de firma: se corta el cuerpo ahí
const DISCLAIMER_MARKERS = [
    /^\s*aviso legal\s*[:\-]/im,
    /^\s*protecci[oó]n de datos\s*[:\-]/im,
    /^\s*cl[aá]usula de confidencialidad/im,
    /^\s*confidencialidad\s*[:\-]/im,
    /^\s*disclaimer\s*[:\-]/im,
    /^\s*este mensaje y sus archivos adjuntos van dirigidos exclusivamente/im,
];

function cleanEmailBody(text: string): string {
    // Quitar referencias de enlace del formato texto plano: <https://...>, <mailto:...>
    let out = text.replace(/<\s*(https?:\/\/|mailto:|www\.)[^>]*>/gi, '');
    // Cortar desde el primer bloque legal detectado
    let cutAt = out.length;
    for (const re of DISCLAIMER_MARKERS) {
        const m = out.match(re);
        if (m?.index !== undefined && m.index < cutAt) cutAt = m.index;
    }
    out = out.slice(0, cutAt);
    return out
        .replace(/[ \t]+$/gm, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function extractBody(data: { body?: string; bodyHtml?: string; html?: Uint8Array; compressedRtf?: Uint8Array }): string {
    if (data.body?.trim()) return data.body.trim();
    if (data.bodyHtml?.trim()) return htmlToPlainText(data.bodyHtml);
    if (data.html?.length) {
        try {
            return htmlToPlainText(new TextDecoder('utf-8').decode(data.html));
        } catch { /* sigue al siguiente fallback */ }
    }
    if (data.compressedRtf?.length) {
        try {
            const bytes = decompressRTF(Array.from(data.compressedRtf));
            const rtf = new TextDecoder('windows-1252').decode(new Uint8Array(bytes));
            return rtfToPlainText(rtf);
        } catch { /* sin cuerpo extraíble */ }
    }
    return '';
}

export default function MsgImportModal({ comunidades, profiles, onClose, onCreated }: MsgImportModalProps) {
    const [mounted, setMounted] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [msgFile, setMsgFile] = useState<File | null>(null);
    const [parsed, setParsed] = useState<ParsedMsg | null>(null);
    const [parsing, setParsing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    const [formData, setFormData] = useState({
        comunidad_id: '',
        nombre_cliente: '',
        gestor_asignado: '',
        motivo_ticket: '',
        mensaje: '',
        email: '',
    });

    useEffect(() => setMounted(true), []);

    const handleFileSelected = async (file: File) => {
        // Limpiar el input ya: permite volver a seleccionar el mismo archivo tras un error
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (!file.name.toLowerCase().endsWith('.msg')) {
            setFormErrors(prev => ({ ...prev, msgFile: 'El archivo debe ser un email de Outlook (.msg)' }));
            return;
        }
        if (file.size === 0) {
            setFormErrors(prev => ({ ...prev, msgFile: `"${file.name}" está vacío (0 bytes). Descárgalo o guárdalo de nuevo desde Outlook.` }));
            return;
        }
        setParsing(true);
        try {
            const buffer = await file.arrayBuffer();
            const reader = new MsgReader(buffer);
            const data = reader.getFileData();

            const result: ParsedMsg = {
                subject: data.subject || '',
                senderName: data.senderName || '',
                senderEmail: data.senderEmail && data.senderEmail.includes('@') ? data.senderEmail : '',
                body: cleanEmailBody(extractBody(data)),
            };

            setMsgFile(file);
            setParsed(result);
            // Buscar la comunidad por nombre en asunto, nombre del archivo y cuerpo del email
            const matched = matchComunidad(`${file.name} ${result.subject} ${result.body}`, comunidades);
            setFormData(prev => ({
                ...prev,
                comunidad_id: prev.comunidad_id || (matched ? String(matched.id) : ''),
                motivo_ticket: prev.motivo_ticket || result.subject,
                mensaje: prev.mensaje || result.body,
                nombre_cliente: prev.nombre_cliente || result.senderName,
                email: prev.email || result.senderEmail,
            }));
            setFormErrors(prev => ({ ...prev, msgFile: '', ...(matched ? { comunidad_id: '' } : {}) }));
            toast.success(matched ? `Email leído · Comunidad detectada: ${matched.nombre_cdad}` : 'Email leído correctamente');
        } catch (err) {
            console.error('Error al leer el archivo .msg:', err);
            setFormErrors(prev => ({ ...prev, msgFile: 'No se pudo leer el archivo. ¿Es un email de Outlook (.msg) válido?' }));
        } finally {
            setParsing(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const errors: Record<string, string> = {};
        if (!msgFile) errors.msgFile = 'Debes adjuntar el archivo .msg del email';
        if (!formData.comunidad_id) errors.comunidad_id = 'Debes seleccionar una comunidad';
        if (!formData.gestor_asignado) errors.gestor_asignado = 'Debes asignar un gestor';
        if (!formData.motivo_ticket.trim()) errors.motivo_ticket = 'El motivo del ticket es obligatorio';
        if (!formData.mensaje.trim()) errors.mensaje = 'El mensaje de la tarea es obligatorio';

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return;
        }
        setFormErrors({});
        if (isSubmitting) return;
        setIsSubmitting(true);
        const loadingToastId = toast.loading('Creando tarea desde el email...');

        try {
            // 1. Subir el .msg original como adjunto
            const uploadData = new FormData();
            uploadData.append('file', msgFile!);
            uploadData.append('path', `incidencias/${Date.now()}`);
            uploadData.append('bucket', 'documentos');

            const res = await fetch('/api/storage/upload', { method: 'POST', body: uploadData });
            if (!res.ok) {
                const error = await res.json().catch(() => null);
                throw new Error(error?.error || 'Error al subir el archivo .msg');
            }
            const uploaded = await res.json();
            const adjuntos = uploaded.publicUrl ? [uploaded.publicUrl] : [];

            // 2. Quien lo recibe: el usuario actual.
            // getSession lee del storage local (sin red) y se tolera el fallo de lock
            // de auth-js ("Lock broken by another request") para no abortar la creación.
            let currentUserId: string | null = null;
            try {
                const { data: { session } } = await supabase.auth.getSession();
                currentUserId = session?.user?.id ?? null;
            } catch (authErr) {
                console.warn('No se pudo obtener el usuario actual (lock de auth):', authErr);
            }

            // 3. Crear la incidencia
            const { data: insertedData, error } = await supabase.from('incidencias').insert([{
                comunidad_id: parseInt(formData.comunidad_id),
                nombre_cliente: formData.nombre_cliente,
                email: formData.email || null,
                motivo_ticket: formData.motivo_ticket,
                mensaje: formData.mensaje,
                quien_lo_recibe: currentUserId,
                gestor_asignado: formData.gestor_asignado,
                adjuntos,
                aviso: 0,
                aviso_proveedor: 0,
                source: 'Email',
            }]).select();

            if (error) throw error;

            const incidenciaId = insertedData?.[0]?.id;
            const comunidad = comunidades.find(c => c.id === parseInt(formData.comunidad_id));
            const gestor = profiles.find(p => p.user_id === formData.gestor_asignado);

            await logActivity({
                action: 'create',
                entityType: 'incidencia',
                entityId: incidenciaId,
                entityName: `Incidencia - ${formData.nombre_cliente}`,
                details: {
                    comunidad: comunidad?.nombre_cdad,
                    asignado_a: gestor?.nombre || 'Sin asignar',
                    entrada: 'Email',
                    origen: `Importada desde .msg (${msgFile!.name})`,
                }
            });

            toast.success('Tarea creada desde el email');
            onCreated();
            onClose();
        } catch (err) {
            console.error('Error creando tarea desde .msg:', err);
            toast.error(err instanceof Error ? err.message : 'Error al crear la tarea');
        } finally {
            toast.dismiss(loadingToastId);
            setIsSubmitting(false);
        }
    };

    if (!mounted) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex justify-center items-end sm:items-center sm:p-6">
            <div
                className="bg-white w-full max-w-2xl rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[92dvh] sm:max-h-[90dvh] animate-in fade-in slide-in-from-bottom sm:zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-center px-5 py-4 border-b border-neutral-100 bg-neutral-50 gap-3">
                    <div className="min-w-0">
                        <h2 className="text-lg font-bold text-neutral-900 tracking-tight">
                            Nueva Tarea desde Email (.msg)
                        </h2>
                        <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-0.5">
                            Adjunta el email de Outlook y se rellenará automáticamente
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
                <div className="p-4 sm:px-5 sm:py-4 overflow-y-auto custom-scrollbar flex-1">
                    <form id="msg-import-form" onSubmit={handleSubmit} className="space-y-4">
                        {/* Archivo .msg */}
                        <div>
                            <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-3 border-b border-yellow-400">Email de Outlook</h3>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".msg"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleFileSelected(file);
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={parsing}
                                className={`w-full rounded-lg border-2 border-dashed px-4 py-5 flex flex-col items-center gap-2 transition text-sm font-medium ${msgFile ? 'border-yellow-400 bg-yellow-50 text-neutral-900' : 'border-neutral-300 bg-neutral-50/60 text-neutral-500 hover:border-yellow-400 hover:bg-yellow-50/50'} ${formErrors.msgFile ? 'border-red-400' : ''}`}
                            >
                                {parsing ? (
                                    <>
                                        <Loader2 className="w-6 h-6 animate-spin text-yellow-500" />
                                        Leyendo email...
                                    </>
                                ) : msgFile ? (
                                    <>
                                        <Mail className="w-6 h-6 text-yellow-600" />
                                        <span className="font-semibold break-all">{msgFile.name}</span>
                                        <span className="text-[11px] text-neutral-400">Haz clic para cambiar el archivo</span>
                                    </>
                                ) : (
                                    <>
                                        <Paperclip className="w-6 h-6" />
                                        Haz clic para adjuntar el archivo .msg
                                    </>
                                )}
                            </button>
                            {formErrors.msgFile && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.msgFile}</p>}
                            {parsed && (
                                <div className="mt-2 text-[11px] text-neutral-500 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2">
                                    <span className="font-bold text-neutral-700">Remitente:</span>{' '}
                                    {parsed.senderName || '—'}{parsed.senderEmail ? ` · ${parsed.senderEmail}` : ''}
                                </div>
                            )}
                        </div>

                        {/* Datos de la tarea */}
                        <div>
                            <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-3 border-b border-yellow-400">Datos de la Tarea</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">
                                        Comunidad <span className="text-red-500">*</span>
                                    </label>
                                    <SearchableSelect
                                        value={formData.comunidad_id}
                                        onChange={(val) => { setFormData({ ...formData, comunidad_id: String(val) }); setFormErrors(prev => ({ ...prev, comunidad_id: '' })); }}
                                        options={comunidades.map(cd => ({
                                            value: String(cd.id),
                                            label: cd.codigo ? `${cd.codigo} - ${cd.nombre_cdad}` : cd.nombre_cdad
                                        }))}
                                        placeholder="Buscar comunidad..."
                                    />
                                    {formErrors.comunidad_id && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.comunidad_id}</p>}
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">
                                        Nombre Propietario
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Nombre completo"
                                        className="w-full rounded-lg border border-neutral-200 bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400 focus:bg-white transition placeholder:text-neutral-400"
                                        value={formData.nombre_cliente}
                                        onChange={e => setFormData({ ...formData, nombre_cliente: e.target.value })}
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">
                                        Gestor Asignado <span className="text-red-500">*</span>
                                    </label>
                                    <SearchableSelect
                                        value={formData.gestor_asignado}
                                        onChange={(val) => { setFormData({ ...formData, gestor_asignado: String(val) }); setFormErrors(prev => ({ ...prev, gestor_asignado: '' })); }}
                                        options={profiles.map(p => ({ value: p.user_id, label: p.nombre }))}
                                        placeholder="Buscar gestor..."
                                    />
                                    {formErrors.gestor_asignado && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.gestor_asignado}</p>}
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">
                                        Motivo del Ticket <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Se rellena con el asunto del email"
                                        className={`w-full rounded-lg border bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400 focus:bg-white transition placeholder:text-neutral-400 ${formErrors.motivo_ticket ? 'border-red-400' : 'border-neutral-200'}`}
                                        value={formData.motivo_ticket}
                                        onChange={e => { setFormData({ ...formData, motivo_ticket: e.target.value }); setFormErrors(prev => ({ ...prev, motivo_ticket: '' })); }}
                                    />
                                    {formErrors.motivo_ticket && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.motivo_ticket}</p>}
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">
                                        Mensaje <span className="text-red-500">*</span>
                                    </label>
                                    <textarea
                                        rows={6}
                                        placeholder="Se rellena con el cuerpo del email"
                                        className={`w-full rounded-lg border bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400 focus:bg-white transition placeholder:text-neutral-400 resize-y ${formErrors.mensaje ? 'border-red-400' : 'border-neutral-200'}`}
                                        value={formData.mensaje}
                                        onChange={e => { setFormData({ ...formData, mensaje: e.target.value }); setFormErrors(prev => ({ ...prev, mensaje: '' })); }}
                                    />
                                    {formErrors.mensaje && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.mensaje}</p>}
                                </div>
                            </div>
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="flex justify-end items-center gap-2 px-5 py-3 border-t border-neutral-100 bg-neutral-50">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-sm font-bold text-neutral-600 hover:bg-neutral-100 transition"
                    >
                        Cancelar
                    </button>
                    <button
                        form="msg-import-form"
                        type="submit"
                        disabled={isSubmitting || parsing}
                        className="px-4 py-2 rounded-lg text-sm font-bold bg-yellow-400 hover:bg-yellow-500 text-neutral-950 transition disabled:opacity-50 flex items-center gap-2"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Creando...
                            </>
                        ) : (
                            <>
                                <Plus className="w-3.5 h-3.5" />
                                Crear Tarea
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}