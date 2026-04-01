"use client";

import { useState, useEffect } from "react";
import Link from 'next/link';
import { FileText, Settings, History, X } from 'lucide-react';
import { createBrowserClient } from "@supabase/ssr";
import ModalPortal from '@/components/ModalPortal';

// Forms
import SuplidosForm from "./suplidos/suplidos-form";
import VariosForm from "./varios/varios-form";
import CertificadoForm from "./certificado-renta/certificado-form";

export default function DocumentosPage() {
    const [isAdmin, setIsAdmin] = useState(false);
    const [activeModal, setActiveModal] = useState<"suplidos" | "varios" | "certificado_renta" | null>(null);

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    useEffect(() => {
        const checkRole = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('rol')
                    .eq('user_id', user.id)
                    .single();
                setIsAdmin(profile?.rol === 'admin');
            }
        };
        checkRole();
    }, []);

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (activeModal) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [activeModal]);

    const documentTypes = [
        {
            key: "suplidos",
            title: "Suplidos",
            desc: "Genera el documento de suplidos en PDF (descargar / enviar).",
            href: "/dashboard/documentos/suplidos",
            settingsHref: "/dashboard/documentos/ajustes",
            historyHref: "/dashboard/documentos/suplidos/historial",
            available: true,
        },
        {
            key: "certificado_renta",
            title: "Certificado Renta",
            desc: "Certificado de imputación de rentas (datos económicos y fiscales).",
            href: "/dashboard/documentos/certificado-renta",
            settingsHref: "#",
            historyHref: "/dashboard/documentos/certificado-renta/historial",
            available: true,
        },
        {
            key: "varios",
            title: "Certificados de estar al dia y Factura",
            desc: "Genera facturas varias y certificado de pagos al día en un único PDF.",
            href: "/dashboard/documentos/varios",
            settingsHref: "#",
            historyHref: "/dashboard/documentos/varios/historial",
            available: true,
        },
    ];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center gap-3">
                <h1 className="text-xl font-bold text-neutral-900">Documentos</h1>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {documentTypes.map((doc) => (
                    <div
                        key={doc.key}
                        className={[
                            "relative flex flex-col justify-between rounded-xl border bg-white p-6 transition-all",
                            doc.available ? "border-neutral-200 shadow-sm" : "border-neutral-100 opacity-60",
                        ].join(" ")}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                                <h3 className="text-base font-semibold text-neutral-900">{doc.title}</h3>
                                <p className="mt-2 text-sm text-neutral-600">{doc.desc}</p>
                            </div>

                            <div className="flex items-center gap-1">
                                {/* History Icon */}
                                {doc.available && doc.historyHref && (
                                    <Link
                                        href={doc.historyHref}
                                        title="Historial de documentos"
                                        className="p-1.5 rounded-full text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 transition"
                                    >
                                        <History className="w-5 h-5" />
                                    </Link>
                                )}

                                {/* Settings Icon (Only for Admin) */}
                                {isAdmin && doc.available && (
                                    <Link
                                        href={doc.settingsHref}
                                        title="Ajustes de precios"
                                        className="p-1.5 rounded-full text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 transition"
                                    >
                                        <Settings className="w-5 h-5" />
                                    </Link>
                                )}
                            </div>
                        </div>

                        <div className="mt-6">
                            {doc.available ? (
                                <button
                                    onClick={() => setActiveModal(doc.key as any)}
                                    className="inline-flex rounded-md bg-yellow-400 px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-yellow-500 transition shadow-sm hover:shadow"
                                >
                                    Crear documento
                                </button>
                            ) : (
                                <div className="inline-flex rounded-md bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-500">
                                    Próximamente
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal Overlay */}
            {activeModal && (
                <ModalPortal>
                <div
                    className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-0 sm:p-4 md:p-8 backdrop-blur-sm overflow-y-auto"
                >
                    <div
                        className="w-full sm:w-full sm:max-w-4xl h-full sm:h-auto sm:max-h-[85vh] bg-white rounded-none sm:rounded-xl shadow-xl flex flex-col animate-in fade-in zoom-in duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 flex justify-between items-center bg-white flex-shrink-0 rounded-t-xl">
                            <h2 className="text-lg font-semibold text-slate-900">
                                {activeModal === "suplidos" && "Registrar Nuevo Suplido"}
                                {activeModal === "varios" && "Registrar Certificado de estar al dia y Factura"}
                                {activeModal === "certificado_renta" && "Registrar Certificado Renta"}
                            </h2>
                            <button
                                onClick={() => setActiveModal(null)}
                                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-grow flex flex-col min-h-0">
                            {activeModal === "suplidos" && <SuplidosForm onSuccess={() => setActiveModal(null)} onCancel={() => setActiveModal(null)} />}
                            {activeModal === "varios" && <VariosForm onSuccess={() => setActiveModal(null)} onCancel={() => setActiveModal(null)} />}
                            {activeModal === "certificado_renta" && <CertificadoForm onSuccess={() => setActiveModal(null)} onCancel={() => setActiveModal(null)} />}
                        </div>
                    </div>
                </div>
                </ModalPortal>
            )}
        </div>
    );
}
