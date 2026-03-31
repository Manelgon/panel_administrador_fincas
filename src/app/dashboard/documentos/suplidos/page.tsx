'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { FileText, History, ArrowLeft, Plus, X } from 'lucide-react';
import SuplidosForm from './suplidos-form';

export default function SuplidosPage() {
    const [showForm, setShowForm] = useState(false);

    // Portal ready (client-only)
    const [portalReady, setPortalReady] = useState(false);
    useEffect(() => setPortalReady(true), []);

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (showForm) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [showForm]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3">
                    <Link
                        href="/dashboard/documentos"
                        className="p-2 -ml-2 rounded-full hover:bg-neutral-100 transition text-neutral-500 hover:text-neutral-900"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-neutral-900">Documentos · Suplidos</h1>
                        <p className="text-sm text-neutral-600 mt-1">
                            Genera el PDF desde la app y luego descárgalo o envíalo por email.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Link
                        href="/dashboard/documentos/suplidos/historial"
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-neutral-200 rounded-md text-sm font-semibold text-neutral-900 hover:bg-neutral-50 transition"
                    >
                        <History className="w-4 h-4" />
                        Historial
                    </Link>
                    <button
                        onClick={() => setShowForm(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-neutral-950 rounded-md text-sm font-bold transition shadow-sm hover:shadow-lg"
                    >
                        <Plus className="w-4 h-4" />
                        Nuevo Suplido
                    </button>
                </div>
            </div>

            {/* Empty State / Welcome */}
            {!showForm && (
                <div className="bg-white rounded-xl border border-dashed border-neutral-300 p-12 flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-yellow-50 rounded-full flex items-center justify-center mb-4">
                        <FileText className="w-8 h-8 text-yellow-600" />
                    </div>
                    <h2 className="text-lg font-bold text-neutral-900 mb-2">Generar Nuevo Suplido</h2>
                    <p className="text-neutral-600 max-w-sm mb-6">
                        Comienza a rellenar los datos para generar un nuevo documento de suplidos profesional.
                    </p>
                    <button
                        onClick={() => setShowForm(true)}
                        className="bg-yellow-400 hover:bg-yellow-500 text-neutral-950 px-6 py-3 rounded-lg font-bold transition shadow-md hover:shadow-xl flex items-center gap-2"
                    >
                        <Plus className="w-5 h-5" />
                        Crear Documento
                    </button>
                </div>
            )}

            {/* Form Modal — Administrative flat layout */}
            {portalReady && showForm && createPortal(
                <div
                    className="fixed inset-0 bg-black/60 z-[9999] flex items-start sm:items-center justify-center p-0 sm:p-4 backdrop-blur-[6px] overflow-y-auto"
                >
                    <div
                        className="w-full sm:max-w-5xl bg-white rounded-none sm:rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.22)] border border-neutral-200/70 flex flex-col my-0 sm:my-auto animate-in fade-in zoom-in duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-5 py-3 border-b border-neutral-100 flex items-center justify-between bg-gradient-to-r from-neutral-50 to-white flex-shrink-0 rounded-t-2xl">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-yellow-400 flex items-center justify-center">
                                    <FileText className="w-4 h-4 text-neutral-900" />
                                </div>
                                <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wide">Registrar Suplido</h2>
                            </div>
                            <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors text-neutral-400 hover:text-neutral-700">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="flex-grow overflow-hidden">
                            <SuplidosForm onSuccess={() => setShowForm(false)} />
                        </div>
                    </div>
                </div>
            , document.body)}
        </div>
    );
}
