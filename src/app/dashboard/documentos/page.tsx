"use client";

import { useState, useEffect } from "react";
import Link from 'next/link';
import { FileText, Settings, X, ChevronRight, Loader2 } from 'lucide-react';
import { createBrowserClient } from "@supabase/ssr";
import ModalPortal from '@/components/ModalPortal';
import ClientHistoryTable from "@/components/dashboard/ClientHistoryTable";

// Forms
import SuplidosForm from "./suplidos/suplidos-form";
import VariosForm from "./varios/varios-form";
import CertificadoForm from "./certificado-renta/certificado-form";

export default function DocumentosPage() {
    const [isAdmin, setIsAdmin] = useState(false);
    const [loadingEntries, setLoadingEntries] = useState(true);
    const [entries, setEntries] = useState<any[]>([]);
    const [selectorOpen, setSelectorOpen] = useState(false);
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

    useEffect(() => {
        const fetchEntries = async () => {
            setLoadingEntries(true);
            try {
                const { data, error } = await supabase
                    .from("doc_submissions")
                    .select(`
                        id, created_at, title, pdf_path, payload, doc_key,
                        profiles:user_id ( nombre, apellido, rol, email )
                    `)
                    .in("doc_key", ["suplidos", "certificado_renta", "facturas_varias"])
                    .order("created_at", { ascending: false })
                    .limit(200);

                if (error) throw error;
                setEntries(data || []);
            } catch (error) {
                console.error("Error cargando historial general:", error);
                setEntries([]);
            } finally {
                setLoadingEntries(false);
            }
        };

        fetchEntries();
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
            settingsHref: "/dashboard/documentos/ajustes",
            available: true,
        },
        {
            key: "certificado_renta",
            title: "Certificado Renta",
            desc: "Certificado de imputación de rentas (datos económicos y fiscales).",
            settingsHref: "#",
            available: true,
        },
        {
            key: "varios",
            title: "Certificados de estar al dia y Factura",
            desc: "Genera facturas varias y certificado de pagos al día en un único PDF.",
            settingsHref: "#",
            available: true,
        },
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-xl font-bold text-neutral-900">Historial de Documentos</h1>
                    <p className="text-sm text-neutral-500">Consulta, descarga y envía los documentos generados desde un único sitio.</p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setSelectorOpen(true)}
                        className="inline-flex items-center rounded-md bg-yellow-400 px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-yellow-500 transition shadow-sm hover:shadow"
                    >
                        Crear documento
                    </button>
                    {isAdmin && (
                        <Link
                            href="/dashboard/documentos/ajustes"
                            className="inline-flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 transition shadow-sm"
                        >
                            <Settings className="w-4 h-4" />
                            Ajustes
                        </Link>
                    )}
                </div>
            </div>

            {loadingEntries ? (
                <div className="flex justify-center rounded-xl border border-neutral-200 bg-white p-12 shadow-sm">
                    <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
                </div>
            ) : (
                <ClientHistoryTable entries={entries} type="all" />
            )}

            {selectorOpen && (
                <ModalPortal>
                    <div
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex justify-center items-end sm:items-center sm:p-6"
                        onClick={() => setSelectorOpen(false)}
                    >
                        <div
                            className="bg-white w-full max-w-3xl rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom sm:zoom-in-95 duration-200"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="px-5 py-4 border-b border-neutral-100 flex justify-between items-center bg-neutral-50 shrink-0">
                                <div>
                                    <h2 className="text-lg font-bold text-neutral-900 tracking-tight">Crear documento</h2>
                                    <p className="text-sm text-neutral-500">Selecciona qué documento quieres generar.</p>
                                </div>
                                <button
                                    onClick={() => setSelectorOpen(false)}
                                    className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5">
                                {documentTypes.map((doc) => (
                                    <button
                                        key={doc.key}
                                        onClick={() => {
                                            setSelectorOpen(false);
                                            setActiveModal(doc.key as any);
                                        }}
                                        className="text-left rounded-xl border border-neutral-200 bg-white p-5 hover:border-yellow-400/50 hover:bg-yellow-50 transition"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100 text-yellow-600">
                                                    <FileText className="w-5 h-5" />
                                                </div>
                                                <h3 className="text-base font-semibold text-neutral-900">{doc.title}</h3>
                                                <p className="mt-2 text-sm text-neutral-600">{doc.desc}</p>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-neutral-400 mt-1" />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </ModalPortal>
            )}

            {activeModal && (
                <ModalPortal>
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex justify-center items-end sm:items-center sm:p-6"
                    onClick={() => setActiveModal(null)}
                >
                    <div
                        className="bg-white w-full max-w-4xl rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[92dvh] sm:max-h-[90dvh] animate-in fade-in slide-in-from-bottom sm:zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="px-5 py-4 border-b border-neutral-100 flex justify-between items-center bg-neutral-50 shrink-0">
                            <h2 className="text-lg font-bold text-neutral-900 tracking-tight">
                                {activeModal === "suplidos" && "Registrar Nuevo Suplido"}
                                {activeModal === "varios" && "Registrar Certificado de estar al dia y Factura"}
                                {activeModal === "certificado_renta" && "Registrar Certificado Renta"}
                            </h2>
                            <button
                                onClick={() => setActiveModal(null)}
                                className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
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
