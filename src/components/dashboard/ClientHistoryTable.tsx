"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { User, Send, Download, Trash2, X } from "lucide-react";
import { toast } from "react-hot-toast";
import DataTable, { Column } from "@/components/DataTable";
import ModalPortal from '@/components/ModalPortal';

type HistoryType = "varios" | "suplidos" | "certificado-renta" | "all";

interface ClientHistoryTableProps {
    entries: any[];
    type: HistoryType;
}

export default function ClientHistoryTable({ entries, type }: ClientHistoryTableProps) {
    const getDocType = (doc: any): Exclude<HistoryType, "all"> => {
        if (doc?.doc_key === "suplidos") return "suplidos";
        if (doc?.doc_key === "certificado_renta") return "certificado-renta";
        return "varios";
    };

    const getDocTypeMeta = (doc: any) => {
        const docType = getDocType(doc);
        if (docType === "suplidos") {
            return {
                type: docType,
                label: "Suplido",
                badgeClass: "bg-amber-50 text-amber-700 border-amber-100",
                modalBadgeClass: "bg-amber-100 text-amber-700",
            };
        }
        if (docType === "certificado-renta") {
            return {
                type: docType,
                label: "Certif. Renta",
                badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-100",
                modalBadgeClass: "bg-indigo-100 text-indigo-700",
            };
        }

        const isFactura = doc?.title?.toLowerCase().includes("factura");
        return {
            type: docType,
            label: isFactura ? "Factura" : "Certificado",
            badgeClass: isFactura
                ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                : "bg-blue-50 text-blue-700 border-blue-100",
            modalBadgeClass: isFactura
                ? "bg-emerald-100 text-emerald-700"
                : "bg-blue-100 text-blue-700",
        };
    };

    // Admin Session State
    const [userRole, setUserRole] = useState<string | null>(null);

    useEffect(() => {
        const checkRole = async () => {
            const { createBrowserClient } = await import("@supabase/ssr");
            const supabase = createBrowserClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('rol')
                    .eq('user_id', user.id)
                    .single();
                setUserRole(profile?.rol || null);
            }
        };
        checkRole();
    }, []);

    const isAdminSession = userRole === 'admin';

    // Detail Modal State
    const [selectedDoc, setSelectedDoc] = useState<any>(null);
    const [detailModalOpen, setDetailModalOpen] = useState(false);

    // Delete State
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [docToDelete, setDocToDelete] = useState<any>(null);
    const [adminEmail, setAdminEmail] = useState("");
    const [adminPass, setAdminPass] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);

    // Send State
    const [sendModalOpen, setSendModalOpen] = useState(false);
    const [docToSend, setDocToSend] = useState<any>(null);
    const [targetEmail, setTargetEmail] = useState("");
    const [isSending, setIsSending] = useState(false);

    const handleRowClick = (doc: any) => {
        setSelectedDoc(doc);
        setDetailModalOpen(true);
    };

    const handleDeleteClick = (doc: any) => {
        setDocToDelete(doc);
        setAdminEmail("");
        setAdminPass("");
        setDetailModalOpen(false);
        setDeleteModalOpen(true);
    };

    const confirmDelete = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!docToDelete) return;

        setIsDeleting(true);
        try {
            const res = await fetch("/api/admin/universal-delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: docToDelete.id,
                    email: isAdminSession ? undefined : adminEmail,
                    password: isAdminSession ? undefined : adminPass,
                    type: "document"
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error al eliminar");

            toast.success("Documento eliminado correctamente");
            setDeleteModalOpen(false);
            window.location.reload();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleSendClick = (doc: any) => {
        setDocToSend(doc);
        setTargetEmail("");
        setDetailModalOpen(false);
        setSendModalOpen(true);
    };

    const confirmSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!docToSend) return;

        setIsSending(true);
        try {
            let endpoint = "";
            let payload: any = {
                submissionId: docToSend.id,
                toEmail: targetEmail
            };

            switch (type === "all" ? getDocType(docToSend) : type) {
                case "suplidos":
                    endpoint = "/api/documentos/suplidos/send";
                    break;
                case "certificado-renta":
                    endpoint = "/api/documentos/certificado-renta/send";
                    break;
                case "varios":
                    endpoint = "/api/documentos/varios/send-single";
                    break;
                default:
                    throw new Error("Tipo de documento no soportado para envío");
            }

            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error al enviar");

            toast.success("Documento enviado correctamente");
            setSendModalOpen(false);
        } catch (err: any) {
            toast.error("Funcionalidad de envío limitada para este tipo de documento o error: " + err.message);
        } finally {
            setIsSending(false);
        }
    };

    const handleDownload = async (doc: any) => {
        const loadingToast = toast.loading("Preparando descarga...");
        try {
            const downloadType = type === "all" ? getDocType(doc) : type;
            const res = await fetch(`/api/documentos/${downloadType}/signed-url?id=${doc.id}`);
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Error obteniendo URL de descarga");
            }

            const link = document.createElement("a");
            link.href = data.url;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.download = "";
            document.body.appendChild(link);
            link.click();
            link.remove();

            toast.success("Descarga iniciada", { id: loadingToast });
        } catch (err: any) {
            console.error("Error en descarga:", err);
            toast.error("Error al descargar: " + err.message, { id: loadingToast });
        }
    };

    // Helper: obtener campos clave del doc para mostrar en el modal
    const getDocFields = (doc: any) => {
        const effectiveType = type === "all" ? getDocType(doc) : type;

        if (effectiveType === "suplidos") return [
            { label: "Código", value: doc.payload?.["Código"] || "-" },
            { label: "Nombre Cliente", value: doc.payload?.["Nombre Cliente"] || "-" },
            { label: "NIF", value: doc.payload?.["NIF"] || "-" },
            { label: "Descripción", value: doc.payload?.Descripcion || "-" },
            { label: "Total", value: doc.payload?.["Suma final"] ? parseFloat(doc.payload["Suma final"]).toLocaleString("es-ES", { style: "currency", currency: "EUR" }) : "-" },
            { label: "Fecha Emisión", value: doc.payload?.["Fecha emisión"] ? new Date(doc.payload["Fecha emisión"]).toLocaleDateString("es-ES") : new Date(doc.created_at).toLocaleDateString("es-ES") },
        ];
        if (effectiveType === "certificado-renta") return [
            { label: "Código", value: doc.payload?.["Código"] || doc.payload?.codigo || "-" },
            { label: "Comunidad", value: doc.payload?.["Nombre Comunidad"] || doc.payload?.nombre_comunidad || "-" },
            { label: "Declarante", value: `${doc.payload?.Apellidos || ""} ${doc.payload?.Nombre || ""}`.trim() || "-" },
            { label: "NIF", value: doc.payload?.Nif || doc.payload?.NIF || "-" },
            { label: "Dirección", value: doc.payload?.["Dirección 2"] || "-" },
            { label: "Piso / Puerta", value: [doc.payload?.Piso, doc.payload?.Puerta].filter(Boolean).join(" / ") || "-" },
            { label: "Fecha", value: new Date(doc.created_at).toLocaleDateString("es-ES") },
        ];
        // varios
        return [
            { label: "Código", value: doc.payload?.codigo || "-" },
            { label: "Comunidad", value: doc.payload?.nombre_comunidad || "-" },
            { label: "Cliente", value: doc.payload?.cliente || doc.payload?.nombre_apellidos || "-" },
            { label: "NIF", value: doc.payload?.nif || "-" },
            { label: "Tipo Inmueble", value: doc.payload?.tipo_inmueble || "-" },
            { label: "Total", value: doc.payload?.suma_final ? `${doc.payload.suma_final} €` : "-" },
        ];
    };

    const columns: Column<any>[] = useMemo(() => {
        const idCol: Column<any> = {
            key: "id",
            label: "ID",
            sortable: true,
            width: "60px",
        };

        const tipoCol: Column<any> = {
            key: "tipo",
            label: "Tipo",
            sortable: true,
            width: "120px",
            render: (r) => {
                const meta = getDocTypeMeta(r);
                return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${meta.badgeClass}`}>{meta.label}</span>;
            }
        };

        const creadoPorCol: Column<any> = {
            key: "profiles",
            label: "Generado por",
            sortable: true,
            render: (r) => {
                const u = r.profiles;
                const who = u ? `${u.nombre ?? ""} ${u.apellido ?? ""}`.trim() : (r.user_id || "Sistema");
                return (
                    <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-neutral-400" />
                        <span className="text-neutral-900">{who}</span>
                    </div>
                );
            },
            getSearchValue: (r) => {
                const u = r.profiles;
                return u ? `${u.nombre ?? ""} ${u.apellido ?? ""}`.trim() : (r.user_id || "Sistema");
            }
        };

        let typeCols: Column<any>[] = [];

        if (type === "suplidos") {
            typeCols = [
                {
                    key: "codigo",
                    label: "Código",
                    sortable: true,
                    render: (r) => r.payload?.["Código"] || "-",
                },
                {
                    key: "nombre_comunidad",
                    label: "Nombre Comunidad",
                    sortable: true,
                    render: (r) => r.payload?.["Nombre Cliente"] || "-",
                },
                {
                    key: "nombre_cliente",
                    label: "Nombre Cliente",
                    sortable: true,
                    render: (r) => r.payload?.["Nombre Cliente"] || "-",
                },
                {
                    key: "nif",
                    label: "NIF",
                    sortable: true,
                    render: (r) => r.payload?.["NIF"] || "-",
                },
                {
                    key: "total",
                    label: "Total",
                    sortable: true,
                    align: 'right',
                    width: "110px",
                    render: (r) => r.payload?.["Suma final"] ? parseFloat(r.payload["Suma final"]).toLocaleString("es-ES", { style: "currency", currency: "EUR" }) : "-",
                },
                {
                    key: "fecha_emision",
                    label: "Fecha Emisión",
                    sortable: true,
                    render: (r) => r.payload?.["Fecha emisión"] ? new Date(r.payload["Fecha emisión"]).toLocaleDateString("es-ES") : new Date(r.created_at).toLocaleDateString("es-ES"),
                },
                creadoPorCol
            ];
        } else if (type === "certificado-renta") {
            typeCols = [
                {
                    key: "codigo",
                    label: "Código",
                    sortable: true,
                    render: (r) => r.payload?.["Código"] || r.payload?.codigo || "-",
                },
                {
                    key: "nombre_comunidad",
                    label: "Nombre Comunidad",
                    sortable: true,
                    render: (r) => r.payload?.["Nombre Comunidad"] || r.payload?.nombre_comunidad || "-",
                },
                {
                    key: "declarante",
                    label: "Declarante",
                    sortable: true,
                    render: (r) => `${r.payload?.Apellidos || ""} ${r.payload?.Nombre || ""}`.trim() || "-",
                },
                {
                    key: "nif",
                    label: "NIF",
                    sortable: true,
                    render: (r) => r.payload?.Nif || r.payload?.NIF || "-",
                },
                {
                    key: "created_at",
                    label: "Fecha",
                    sortable: true,
                    render: (r) => new Date(r.created_at).toLocaleDateString("es-ES"),
                },
                creadoPorCol
            ];
        } else if (type === "varios") {
            typeCols = [
                {
                    key: "codigo",
                    label: "Código",
                    sortable: true,
                    render: (r) => r.payload?.codigo || "-",
                },
                {
                    key: "nombre_comunidad",
                    label: "Nombre Comunidad",
                    sortable: true,
                    render: (r) => r.payload?.nombre_comunidad || "-",
                },
                {
                    key: "cliente",
                    label: "Cliente",
                    sortable: true,
                    render: (r) => r.payload?.cliente || r.payload?.nombre_apellidos || "-",
                },
                {
                    key: "nif",
                    label: "NIF",
                    sortable: true,
                    render: (r) => r.payload?.nif || "-",
                },
                {
                    key: "total",
                    label: "Total",
                    sortable: true,
                    align: 'right',
                    width: "110px",
                    render: (r) => `${r.payload?.suma_final || "-"} €`,
                },
                creadoPorCol
            ];
        } else if (type === "all") {
            typeCols = [
                {
                    key: "codigo",
                    label: "Código",
                    sortable: true,
                    render: (r) => r.payload?.["Código"] || r.payload?.codigo || "-",
                },
                {
                    key: "nombre_comunidad",
                    label: "Comunidad",
                    sortable: true,
                    render: (r) => r.payload?.["Nombre Comunidad"] || r.payload?.nombre_comunidad || r.payload?.["Nombre Cliente"] || "-",
                },
                {
                    key: "cliente",
                    label: "Cliente / Declarante",
                    sortable: true,
                    render: (r) =>
                        r.payload?.cliente ||
                        r.payload?.nombre_apellidos ||
                        `${r.payload?.Apellidos || ""} ${r.payload?.Nombre || ""}`.trim() ||
                        r.payload?.["Nombre Cliente"] ||
                        "-",
                },
                {
                    key: "nif",
                    label: "NIF",
                    sortable: true,
                    render: (r) => r.payload?.nif || r.payload?.Nif || r.payload?.NIF || "-",
                },
                {
                    key: "created_at",
                    label: "Fecha",
                    sortable: true,
                    render: (r) => new Date(r.created_at).toLocaleDateString("es-ES"),
                },
                creadoPorCol
            ];
        }

        return [idCol, tipoCol, ...typeCols];
    }, [type]);

    const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());

    return (
        <div className="space-y-6">
            {/* Filtros de tipo + acciones de selección */}
            <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                    <Link
                        href="/dashboard/documentos"
                        className={`px-3 py-1 rounded-full text-sm font-medium transition text-center ${type === 'all' ? 'bg-yellow-400 text-neutral-950' : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'}`}
                    >
                        Todos
                    </Link>
                    <Link
                        href="/dashboard/documentos"
                        className="px-3 py-1 rounded-full text-sm font-medium transition text-center bg-neutral-200 text-neutral-700 hover:bg-neutral-300"
                    >
                        General
                    </Link>
                    <Link
                        href="/dashboard/documentos/suplidos/historial"
                        className={`px-3 py-1 rounded-full text-sm font-medium transition text-center ${type === 'suplidos' ? 'bg-yellow-400 text-neutral-950' : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'}`}
                    >
                        Suplidos
                    </Link>
                    <Link
                        href="/dashboard/documentos/certificado-renta/historial"
                        className={`px-3 py-1 rounded-full text-sm font-medium transition text-center ${type === 'certificado-renta' ? 'bg-yellow-400 text-neutral-950' : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'}`}
                    >
                        Certif. Renta
                    </Link>
                    <Link
                        href="/dashboard/documentos/varios/historial"
                        className={`px-3 py-1 rounded-full text-sm font-medium transition text-center ${type === 'varios' ? 'bg-yellow-400 text-neutral-950' : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'}`}
                    >
                        Certif. Estar al Día y Factura
                    </Link>
                </div>

                {/* Acciones de selección (visible solo si hay selección) */}
                {selectedIds.size > 0 && (
                    <div className="flex gap-2 items-center animate-in fade-in slide-in-from-bottom-2">
                        <span className="text-sm font-medium text-neutral-500 mr-2">{selectedIds.size} seleccionados</span>
                        <button
                            onClick={() => {
                                selectedIds.forEach((id) => {
                                    const doc = entries.find((e) => e.id === id);
                                    if (doc) handleDownload(doc);
                                });
                            }}
                            className="bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition"
                        >
                            <Download className="w-4 h-4 text-blue-600" />
                            Descargar
                        </button>
                    </div>
                )}
            </div>

            <DataTable
                data={entries}
                columns={columns}
                keyExtractor={(r) => r.id}
                storageKey={`history-${type}`}
                emptyMessage="No se encontraron documentos en el historial"
                selectable={true}
                selectedKeys={selectedIds}
                onSelectionChange={setSelectedIds}
                onRowClick={handleRowClick}
                rowActions={(row) => [
                    {
                        label: "Descargar PDF",
                        icon: <Download className="w-4 h-4" />,
                        onClick: (r) => handleDownload(r),
                    },
                    {
                        label: "Enviar por Email",
                        icon: <Send className="w-4 h-4" />,
                        onClick: (r) => handleSendClick(r),
                    },
                    {
                        label: "Eliminar",
                        icon: <Trash2 className="w-4 h-4" />,
                        onClick: (r) => handleDeleteClick(r),
                        variant: "danger" as const,
                        separator: true,
                    },
                ]}
            />

            {/* DETAIL MODAL */}
            {detailModalOpen && selectedDoc && (
                <ModalPortal>
                    <div
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex justify-center items-end sm:items-center sm:p-6"
                        onClick={() => setDetailModalOpen(false)}
                    >
                        <div
                            className="bg-white w-full max-w-2xl rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[92dvh] sm:max-h-[90dvh] animate-in fade-in slide-in-from-bottom sm:zoom-in-95 duration-200"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="px-6 py-4 border-b border-neutral-100 flex items-start justify-between bg-white shrink-0">
                                <div>
                                    <h2 className="text-xl font-black text-neutral-900 tracking-tight">
                                        Documento #{selectedDoc.id}
                                    </h2>
                                    <p className="text-xs text-neutral-500 mt-0.5">
                                        Generado el {new Date(selectedDoc.created_at).toLocaleDateString("es-ES")}
                                        {selectedDoc.profiles && (
                                            <> · por {`${selectedDoc.profiles.nombre ?? ""} ${selectedDoc.profiles.apellido ?? ""}`.trim()}</>
                                        )}
                                    </p>
                                    <div className="mt-2">
                                        {/* Badge tipo */}
                                        {(() => {
                                            const meta = getDocTypeMeta(selectedDoc);
                                            return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${meta.modalBadgeClass}`}>{meta.label}</span>;
                                        })()}
                                    </div>
                                </div>
                                <button
                                    onClick={() => setDetailModalOpen(false)}
                                    className="p-2 rounded-xl hover:bg-neutral-100 text-neutral-400 hover:text-neutral-900 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="p-5 overflow-y-auto flex-1">
                                <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-3 border-b border-yellow-400">
                                    Datos del Documento
                                </h3>
                                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                                    {getDocFields(selectedDoc).map((field) => (
                                        <div key={field.label}>
                                            <dt className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-0.5">{field.label}</dt>
                                            <dd className="text-sm text-neutral-900 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2">{field.value}</dd>
                                        </div>
                                    ))}
                                </dl>
                            </div>

                            {/* Footer */}
                            <div className="px-5 py-4 border-t border-neutral-100 flex justify-between items-center gap-3 bg-neutral-50 shrink-0">
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleDownload(selectedDoc)}
                                        className="flex items-center gap-2 px-4 py-2 bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 rounded-lg text-sm font-medium transition"
                                    >
                                        <Download className="w-4 h-4 text-blue-600" />
                                        Descargar PDF
                                    </button>
                                    <button
                                        onClick={() => handleSendClick(selectedDoc)}
                                        className="flex items-center gap-2 px-4 py-2 bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 rounded-lg text-sm font-medium transition"
                                    >
                                        <Send className="w-4 h-4 text-yellow-600" />
                                        Enviar
                                    </button>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleDeleteClick(selectedDoc)}
                                        className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        Eliminar
                                    </button>
                                    <button
                                        onClick={() => setDetailModalOpen(false)}
                                        className="px-4 py-2 bg-yellow-400 text-neutral-950 rounded-lg text-sm font-semibold hover:bg-yellow-500 transition"
                                    >
                                        Cerrar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </ModalPortal>
            )}

            {/* DELETE MODAL */}
            {deleteModalOpen && (
                <ModalPortal>
                <div
                    className="fixed inset-0 bg-black/50 flex items-end sm:items-center sm:justify-center z-[9999] backdrop-blur-sm"
                    onClick={() => setDeleteModalOpen(false)}
                >
                    <div
                        className="bg-white rounded-t-2xl sm:rounded-lg p-6 max-w-md w-full sm:mx-4 shadow-xl max-h-[92dvh] overflow-y-auto animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-bold text-neutral-900 mb-4">Confirmar Eliminación</h3>
                        <p className="text-neutral-600 mb-4 text-sm">
                            Estás a punto de eliminar el documento <span className="font-semibold">#{docToDelete?.id}</span>.<br />
                            Esta acción no se puede deshacer. {isAdminSession ? "¿Estás seguro?" : "Para confirmar, ingresa credenciales de administrador:"}
                        </p>
                        <form onSubmit={confirmDelete} className="space-y-4" autoComplete="off">
                            {!isAdminSession && (
                                <>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Email Administrador</label>
                                        <input
                                            type="email"
                                            required
                                            autoComplete="off"
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm"
                                            value={adminEmail}
                                            onChange={e => setAdminEmail(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Contraseña Administrador</label>
                                        <input
                                            type="password"
                                            required
                                            autoComplete="new-password"
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm"
                                            value={adminPass}
                                            onChange={e => setAdminPass(e.target.value)}
                                        />
                                    </div>
                                </>
                            )}
                            <div className="flex gap-3 justify-end pt-2">
                                <button
                                    type="button"
                                    onClick={() => setDeleteModalOpen(false)}
                                    className="px-4 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition font-medium text-sm"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isDeleting}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium shadow-sm disabled:opacity-50 text-sm"
                                >
                                    {isDeleting ? 'Eliminando...' : 'Eliminar Registro'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
                </ModalPortal>
            )}

            {/* SEND MODAL */}
            {sendModalOpen && (
                <ModalPortal>
                <div
                    className="fixed inset-0 bg-black/50 z-[9999] flex items-end sm:items-center sm:justify-center sm:p-4 backdrop-blur-sm"
                    onClick={() => setSendModalOpen(false)}
                >
                    <div
                        className="bg-white rounded-t-2xl sm:rounded-lg shadow-xl max-w-sm w-full p-6 max-h-[92dvh] overflow-y-auto animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-neutral-900">Enviar Documento</h3>
                            <button onClick={() => setSendModalOpen(false)} className="text-neutral-400 hover:text-neutral-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={confirmSend} className="space-y-4" autoComplete="off">
                            <div>
                                <label className="block text-xs font-medium text-neutral-700 mb-1">Enviar a:</label>
                                <input
                                    type="email"
                                    required
                                    autoComplete="off"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-yellow-400 outline-none"
                                    value={targetEmail}
                                    onChange={e => setTargetEmail(e.target.value)}
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setSendModalOpen(false)}
                                    className="px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100 rounded-md"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSending}
                                    className="px-3 py-2 text-sm bg-yellow-400 text-neutral-950 font-medium rounded-md hover:bg-yellow-500 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isSending ? "Enviando..." : <><Send className="w-3 h-3" /> Enviar</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
                </ModalPortal>
            )}
        </div>
    );
}
