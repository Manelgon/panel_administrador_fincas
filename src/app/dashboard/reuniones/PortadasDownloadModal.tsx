'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, Send, FileText, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabaseClient';
import { Reunion } from '@/lib/schemas';
import { generarPortadaPdf, nombreArchivo, PortadaKind, EmisorFooter } from './lib/generarPortadasPdf';

interface Props {
    reunion: Reunion;
    onClose: () => void;
}

export default function PortadasDownloadModal({ reunion, onClose }: Props) {
    const [direccion, setDireccion] = useState<string>('');
    const [nombreCdad, setNombreCdad] = useState<string>('');
    const [emisor, setEmisor] = useState<EmisorFooter>({});
    const [toEmail, setToEmail] = useState<string>('');
    const [emailError, setEmailError] = useState<string>('');
    const [isDownloading, setIsDownloading] = useState<PortadaKind | 'both' | null>(null);
    const [isSending, setIsSending] = useState(false);

    useEffect(() => {
        if (!reunion.comunidad_id) return;
        supabase
            .from('comunidades')
            .select('direccion, nombre_cdad')
            .eq('id', reunion.comunidad_id)
            .maybeSingle()
            .then(({ data }) => {
                if (data?.direccion) setDireccion(data.direccion);
                if (data?.nombre_cdad) setNombreCdad(data.nombre_cdad);
            });
    }, [reunion.comunidad_id]);

    useEffect(() => {
        supabase
            .from('company_settings')
            .select('setting_key, setting_value')
            .in('setting_key', ['emisor_address', 'emisor_phone', 'emisor_cif'])
            .then(({ data }) => {
                if (!data) return;
                const map: Record<string, string> = {};
                data.forEach(row => { map[row.setting_key] = row.setting_value; });
                setEmisor({
                    direccion: map.emisor_address,
                    telefono:  map.emisor_phone,
                    cif:       map.emisor_cif,
                });
            });
    }, []);

    const fechaDisplay = useMemo(
        () => reunion.fecha_reunion
            ? new Date(reunion.fecha_reunion + 'T00:00:00').toLocaleDateString('es-ES')
            : '',
        [reunion.fecha_reunion]
    );

    const buildPdf = async (kind: PortadaKind) =>
        generarPortadaPdf({
            kind,
            tipoReunion: reunion.tipo,
            fecha: fechaDisplay,
            comunidad: nombreCdad || reunion.comunidad || '',
            direccion,
            emisor,
        });

    const triggerDownload = (blob: Blob, filename: string) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    const downloadOne = async (kind: PortadaKind) => {
        setIsDownloading(kind);
        try {
            const blob = await buildPdf(kind);
            triggerDownload(blob, nombreArchivo(kind, reunion.tipo, reunion.fecha_reunion));
        } catch (err) {
            console.error('[PortadasDownloadModal] download error:', err);
            toast.error('Error al generar el PDF');
        } finally {
            setIsDownloading(null);
        }
    };

    const downloadBoth = async () => {
        setIsDownloading('both');
        try {
            const [conv, acta] = await Promise.all([buildPdf('convocatoria'), buildPdf('acta')]);
            triggerDownload(conv, nombreArchivo('convocatoria', reunion.tipo, reunion.fecha_reunion));
            triggerDownload(acta, nombreArchivo('acta',        reunion.tipo, reunion.fecha_reunion));
        } catch (err) {
            console.error('[PortadasDownloadModal] download both error:', err);
            toast.error('Error al generar los PDFs');
        } finally {
            setIsDownloading(null);
        }
    };

    const sendByEmail = async () => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!toEmail || !emailRegex.test(toEmail)) {
            setEmailError('Introduce un email válido');
            return;
        }
        setEmailError('');
        setIsSending(true);
        try {
            const [conv, acta] = await Promise.all([buildPdf('convocatoria'), buildPdf('acta')]);
            const form = new FormData();
            form.append('to_email', toEmail);
            form.append('reunion_id', String(reunion.id));
            form.append('tipo_reunion', reunion.tipo);
            form.append('fecha', fechaDisplay);
            form.append('comunidad', reunion.comunidad || '');
            form.append('convocatoria', conv, nombreArchivo('convocatoria', reunion.tipo, reunion.fecha_reunion));
            form.append('acta',         acta, nombreArchivo('acta',         reunion.tipo, reunion.fecha_reunion));

            const res = await fetch('/api/reuniones/enviar-portadas', { method: 'POST', body: form });
            if (!res.ok) throw new Error('send failed');
            toast.success('Portadas enviadas por email');
            onClose();
        } catch (err) {
            console.error('[PortadasDownloadModal] send error:', err);
            toast.error('Error al enviar el email');
        } finally {
            setIsSending(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-end sm:items-center sm:justify-center sm:p-6">
            <div
                className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[92dvh] sm:max-h-[85dvh] animate-in fade-in slide-in-from-bottom sm:zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center px-5 py-4 border-b border-neutral-100 bg-neutral-50">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#f5a623]/15 flex items-center justify-center shrink-0">
                            <FileText className="w-5 h-5 text-[#f5a623]" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-neutral-900 tracking-tight">Portadas convocatoria y acta</h2>
                            <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-0.5">
                                {reunion.tipo} · {reunion.comunidad || '—'} · {fechaDisplay}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 sm:px-5 sm:py-4 overflow-y-auto flex-1 space-y-6">

                    <div>
                        <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-3 border-b border-[#f5a623]">
                            Descargar PDFs
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => downloadOne('convocatoria')}
                                disabled={isDownloading !== null}
                                className="h-10 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-xs font-bold text-neutral-800 transition flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isDownloading === 'convocatoria'
                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                    : <Download className="w-4 h-4" />}
                                Convocatoria
                            </button>
                            <button
                                onClick={() => downloadOne('acta')}
                                disabled={isDownloading !== null}
                                className="h-10 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-xs font-bold text-neutral-800 transition flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isDownloading === 'acta'
                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                    : <Download className="w-4 h-4" />}
                                Acta
                            </button>
                        </div>
                        <button
                            onClick={downloadBoth}
                            disabled={isDownloading !== null}
                            className="mt-2 w-full h-10 rounded-lg bg-[#f5a623] hover:bg-[#e09510] text-neutral-950 text-xs font-bold transition flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isDownloading === 'both'
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <Download className="w-4 h-4" />}
                            Descargar ambos
                        </button>
                    </div>

                    <div>
                        <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-3 border-b border-[#f5a623]">
                            Enviar por email
                        </h3>
                        <div className="flex gap-2">
                            <input
                                type="email"
                                value={toEmail}
                                onChange={e => { setToEmail(e.target.value); if (emailError) setEmailError(''); }}
                                placeholder="destinatario@ejemplo.com"
                                className="flex-1 h-10 px-3 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623]/40"
                            />
                            <button
                                onClick={sendByEmail}
                                disabled={isSending || isDownloading !== null}
                                className="h-10 px-5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition flex items-center gap-2 disabled:opacity-50"
                            >
                                {isSending
                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                    : <Send className="w-4 h-4" />}
                                Enviar
                            </button>
                        </div>
                        {emailError && (
                            <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500">
                                <AlertCircle className="w-3 h-3 shrink-0" />{emailError}
                            </p>
                        )}
                    </div>
                </div>

                <div className="px-5 py-3 border-t border-neutral-100 bg-neutral-50 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-bold text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
