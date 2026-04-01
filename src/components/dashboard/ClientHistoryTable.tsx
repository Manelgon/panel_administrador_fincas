"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { User, Send, Download, Trash2, X } from "lucide-react";
import { toast } from "react-hot-toast";
import DataTable, { Column } from "@/components/DataTable";
import ModalPortal from '@/components/ModalPortal';

type HistoryType = "varios" | "suplidos" | "certificado-renta";

interface ClientHistoryTableProps {
    entries: any[];
    type: HistoryType;
}

export default function ClientHistoryTable({ entries, type }: ClientHistoryTableProps) {
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

    const handleDeleteClick = (doc: any) => {
        setDocToDelete(doc);
        setAdminEmail("");
        setAdminPass("");
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

            switch (type) {
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
            const res = await fetch(`/api/documentos/${type}/signed-url?id=${doc.id}`);

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Error obteniendo URL de descarga");
            }

            const contentType = res.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                const data = await res.json();
                throw new Error(data.error || "Se esperaba un PDF");
            }

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;

            const date = new Date(doc.created_at).toISOString().split('T')[0];
            const title = (doc.payload?.["Nombre Cliente"] || doc.payload?.["Nombre Comunidad"] || doc.payload?.nombre_comunidad || doc.title || "documento").replace(/[^a-z0-9]/gi, '_');
            a.download = `${date}_${type}_${title}.pdf`;

            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            toast.success("Descarga iniciada", { id: loadingToast });
        } catch (err: any) {
            console.error("Error en descarga:", err);
            toast.error("Error al descargar: " + err.message, { id: loadingToast });
        }
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
            label: "tipo",
            sortable: true,
            width: "120px",
            render: (r) => {
                let label = type === "suplidos" ? "Suplido" : type === "certificado-renta" ? "Certificado Renta" : "Varios";
                let bgColor = type === "suplidos" ? "bg-amber-50 text-amber-700 border-amber-100" : type === "certificado-renta" ? "bg-indigo-50 text-indigo-700 border-indigo-100" : "bg-blue-50 text-blue-700 border-blue-100";

                if (type === "varios") {
                    const isFactura = r.title?.toLowerCase().includes("factura");
                    const isCertif = r.title?.toLowerCase().includes("certificado");

                    if (isFactura) {
                        label = "Factura";
                        bgColor = "bg-emerald-50 text-emerald-700 border-emerald-100";
                    } else if (isCertif) {
                        label = "Certificado";
                        bgColor = "bg-blue-50 text-blue-700 border-blue-100";
                    }
                }

                return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${bgColor}`}>{label}</span>;
            }
        };

        const creadoPorCol: Column<any> = {
            key: "profiles",
            label: "generado por",
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
                    label: "nombre comunidad",
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
                    key: "descripcion",
                    label: "Descripción",
                    render: (r) => <div className="max-w-xs truncate" title={r.payload?.Descripcion}>{r.payload?.Descripcion || "-"}</div>,
                },
                {
                    key: "total",
                    label: "TOTAL",
                    sortable: true,
                    align: 'right',
                    width: "110px",
                    render: (r) => r.payload?.["Suma final"] ? parseFloat(r.payload["Suma final"]).toLocaleString("es-ES", { style: "currency", currency: "EUR" }) : "-",
                },
                {
                    key: "fecha_emision",
                    label: "FECHA emision",
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
                    label: "nombre comunidad",
                    sortable: true,
                    render: (r) => r.payload?.["Nombre Comunidad"] || r.payload?.nombre_comunidad || "-",
                },
                {
                    key: "declarante",
                    label: "(Declarante) nombre y apellidos",
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
                    key: "direccion",
                    label: "Direccion",
                    render: (r) => r.payload?.["Dirección 2"] || "-",
                },
                {
                    key: "piso_puerta",
                    label: "piso/puerta",
                    render: (r) => {
                        const p = r.payload?.Piso || "";
                        const pt = r.payload?.Puerta || "";
                        if (!p && !pt) return "-";
                        return `${p}${pt ? ` / ${pt}` : ""}`;
                    }
                },
                {
                    key: "created_at",
                    label: "FECHA",
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
                    label: "nombre comunidad",
                    sortable: true,
                    render: (r) => r.payload?.nombre_comunidad || "-",
                },
                {
                    key: "cliente",
                    label: "cliente (nombre y apellidos)",
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
                    key: "tipo_inmueble",
                    label: "tipo inmueble",
                    render: (r) => r.payload?.tipo_inmueble || "-",
                },
                {
                    key: "total",
                    label: "total",
                    sortable: true,
                    align: 'right',
                    width: "110px",
                    render: (r) => `${r.payload?.suma_final || "-"} €`,
                },
                creadoPorCol
            ];
        }

        const baseResult = [idCol, tipoCol, ...typeCols];

        const actionCol: Column<any> = {
            key: "acciones",
            label: type === "varios" ? "acciones" : "ACCIONES",
            sortable: false,
            align: 'right',
            width: "120px",
            render: (r) => (
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => handleDownload(r)}
                        className="p-1.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                        title="Descargar PDF"
                    >
                        <Download className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => handleSendClick(r)}
                        className="p-1.5 rounded-full bg-yellow-50 text-yellow-600 hover:bg-yellow-100 transition-colors"
                        title="Enviar por Email"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => handleDeleteClick(r)}
                        className="p-1.5 rounded-full bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                        title="Eliminar Documento"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            )
        };

        return [...baseResult, actionCol];
    }, [type, isAdminSession]);

    const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());

    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                <Link
                    href="/dashboard/documentos/suplidos/historial"
                    className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${type === 'suplidos' ? 'bg-yellow-400 text-neutral-950 shadow-sm' : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'}`}
                >
                    Suplidos
                </Link>
                <Link
                    href="/dashboard/documentos/certificado-renta/historial"
                    className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${type === 'certificado-renta' ? 'bg-yellow-400 text-neutral-950 shadow-sm' : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'}`}
                >
                    Certificados Renta
                </Link>
                <Link
                    href="/dashboard/documentos/varios/historial"
                    className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${type === 'varios' ? 'bg-yellow-400 text-neutral-950 shadow-sm' : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'}`}
                >
                    Certificados de estar al dia y Factura
                </Link>
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
            />

            {/* DELETE MODAL */}
            {deleteModalOpen && (
                <ModalPortal>
                <div
                    className="fixed inset-0 bg-black/50 flex items-end sm:items-center sm:justify-center z-[9999] backdrop-blur-sm"
                    onClick={() => setDeleteModalOpen(false)}
                >
                    <div
                        className="bg-white rounded-t-2xl sm:rounded-lg p-6 max-w-md w-full sm:mx-4 shadow-xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-bold text-neutral-900 mb-4">Confirmar Eliminación</h3>
                        <p className="text-neutral-600 mb-4 text-sm">
                            Estás a punto de eliminar el documento: <span className="font-semibold">{docToDelete?.title}</span>. <br />
                            Esta acción no se puede deshacer. {isAdminSession ? "¿Estás seguro de que deseas eliminar este registro?" : "Para confirmar, ingresa credenciales de administrador:"}
                        </p>
                        <form onSubmit={confirmDelete} className="space-y-4" autoComplete="off">
                            {!isAdminSession && (
                                <>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Email Administrador</label>
                                        <input
                                            type="email"
                                            required
                                            placeholder=""
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
                                            placeholder=""
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
                        className="bg-white rounded-t-2xl sm:rounded-lg shadow-xl max-w-sm w-full p-6 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-neutral-900">Enviar Documento</h3>
                            <button onClick={() => setSendModalOpen(false)} className="text-neutral-400 hover:text-neutral-600 text-sm">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={confirmSend} className="space-y-4" autoComplete="off">
                            <div>
                                <label className="block text-xs font-medium text-neutral-700 mb-1">Enviar a:</label>
                                <input
                                    type="email"
                                    required
                                    placeholder=""
                                    autoComplete="off"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:yellow-400 outline-none"
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
