'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, History, FileText, Plus, X } from "lucide-react";
import Link from "next/link";
import CertificadoForm from "./certificado-form";

export default function CertificadoRentaPage() {
    const [showForm, setShowForm] = useState(false);
    const [portalReady, setPortalReady] = useState(false);
    useEffect(() => setPortalReady(true), []);

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
                        <h1 className="text-xl font-bold text-neutral-900">Certificado Imputación Renta</h1>
                        <p className="text-sm text-neutral-600 mt-1">
                            Genera el PDF desde la app y luego descárgalo o envíalo por email.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Link
                        href="/dashboard/documentos/certificado-renta/historial"
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
                        Nuevo Certificado
                    </button>
                </div>
            </div>

            {/* Empty State / Welcome */}
            {!showForm && (
                <div className="bg-white rounded-xl border border-dashed border-neutral-300 p-12 flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-yellow-50 rounded-full flex items-center justify-center mb-4">
                        <FileText className="w-8 h-8 text-yellow-600" />
                    </div>
                    <h2 className="text-lg font-bold text-neutral-900 mb-2">Generar Certificado Renta</h2>
                    <p className="text-neutral-600 max-w-sm mb-6">
                        Genera certificados de imputación de rentas de forma rápida y profesional.
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

            {/* Form Modal */}
            {portalReady && showForm && createPortal(
                <div className="fixed inset-0 bg-black/50 z-[9999] flex items-end sm:items-center sm:justify-center sm:p-4 backdrop-blur-sm">
                    <div
                        className="w-full sm:max-w-4xl max-h-[92vh] sm:max-h-[90vh] bg-white rounded-t-2xl sm:rounded-xl shadow-xl flex flex-col animate-in fade-in slide-in-from-bottom sm:zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="px-6 sm:px-8 pt-6 sm:pt-7 pb-4 border-b border-slate-100 flex justify-between items-center">
                            <h2 className="text-lg font-semibold text-slate-900">
                                Nuevo Certificado de Renta
                            </h2>
                            <button
                                onClick={() => setShowForm(false)}
                                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 sm:p-8 overflow-y-auto custom-scrollbar">
                            <CertificadoForm onSuccess={() => setShowForm(false)} />
                        </div>
                    </div>
                </div>
            , document.body)}
        </div>
    );
}
