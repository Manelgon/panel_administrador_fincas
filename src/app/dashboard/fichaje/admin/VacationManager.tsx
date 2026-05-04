"use client";

import { useState, useEffect } from "react";
import { Check, X, MessageSquare, Calendar, User, Info, Settings, ShieldAlert, Edit3, Save, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "react-hot-toast";
import { useGlobalLoading } from "@/lib/globalLoading";
import DataTable, { Column } from "@/components/DataTable";
import AdminSettingsPanel from "./AdminSettingsPanel";
import UserBalancesPanel from "./UserBalancesPanel";
import { ListChecks, Users, Sliders } from "lucide-react";
import ModalPortal from '@/components/ModalPortal';

interface ExtendedVacationRequest {
    id: string;
    user_id: string;
    type: string;
    date_from: string;
    date_to: string;
    days_count: number;
    status: string;
    comment_user: string | null;
    comment_admin: string | null;
    created_at: string;
    profiles: {
        nombre: string;
        apellido: string | null;
    };
}

export default function VacationManager() {
    const { withLoading } = useGlobalLoading();
    const [requests, setRequests] = useState<ExtendedVacationRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [adminId, setAdminId] = useState<string | null>(null);
    const [adminComment, setAdminComment] = useState("");
    const [selectedReq, setSelectedReq] = useState<ExtendedVacationRequest | null>(null);
    const [activeSubTab, setActiveSubTab] = useState<'requests' | 'balances' | 'settings'>('requests');

    // Edit state
    const [editingReq, setEditingReq] = useState<any | null>(null);
    const [savingEdit, setSavingEdit] = useState(false);

    useEffect(() => {
        fetchAdminId();
    }, []);

    useEffect(() => {
        if (adminId && activeSubTab === 'requests') {
            fetchRequests();
        }
    }, [adminId, activeSubTab]);

    const fetchAdminId = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) setAdminId(session.user.id);
    };

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/vacations/requests?adminId=${adminId}`);
            const data = await res.json();
            if (res.ok) setRequests(data);
        } catch (error) {
            toast.error("Error cargando solicitudes");
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (requestId: string, status: 'APROBADA' | 'RECHAZADA') => {
        setProcessingId(requestId);
        await withLoading(async () => {
            try {
                const res = await fetch("/api/admin/vacations/requests", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        adminId,
                        requestId,
                        status,
                        commentAdmin: adminComment
                    })
                });

                if (res.ok) {
                    toast.success(status === 'APROBADA' ? "Solicitud aprobada" : "Solicitud rechazada");
                    fetchRequests();
                    setSelectedReq(null);
                    setAdminComment("");
                } else {
                    const data = await res.json();
                    toast.error(data.error || "Error al procesar");
                }
            } catch (error) {
                toast.error("Error de red");
            } finally {
                setProcessingId(null);
            }
        }, status === 'APROBADA' ? 'Aprobando solicitud...' : 'Rechazando solicitud...');
    };

    const openEditModal = (row: ExtendedVacationRequest) => {
        setEditingReq({
            id: row.id,
            user_id: row.user_id,
            nombre: `${row.profiles.nombre} ${row.profiles.apellido || ''}`.trim(),
            type: row.type,
            date_from: row.date_from,
            date_to: row.date_to,
            days_count: row.days_count,
            status: row.status,
            comment_admin: row.comment_admin || '',
        });
    };

    const handleSaveEdit = async () => {
        if (!editingReq || !adminId) return;
        setSavingEdit(true);
        await withLoading(async () => {
            try {
                const res = await fetch("/api/admin/vacations/requests", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        adminId,
                        requestId: editingReq.id,
                        type: editingReq.type,
                        date_from: editingReq.date_from,
                        date_to: editingReq.date_to,
                        days_count: editingReq.days_count,
                        status: editingReq.status,
                        comment_admin: editingReq.comment_admin,
                    })
                });

                if (res.ok) {
                    toast.success("Solicitud actualizada");
                    setEditingReq(null);
                    fetchRequests();
                } else {
                    const err = await res.json().catch(() => ({}));
                    toast.error(err.error || "Error al actualizar");
                }
            } catch (error) {
                toast.error("Error de red");
            } finally {
                setSavingEdit(false);
            }
        }, 'Guardando cambios...');
    };

    // Calculate days between two dates
    const calcDays = (from: string, to: string) => {
        if (!from || !to) return 0;
        const d1 = new Date(from);
        const d2 = new Date(to);
        const diffTime = d2.getTime() - d1.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        return Math.max(0, diffDays);
    };

    const columns: Column<ExtendedVacationRequest>[] = [
        {
            key: "user",
            label: "Empleado",
            render: (row) => (
                <div className="flex flex-col">
                    <span className="font-bold text-neutral-900">{row.profiles.nombre} {row.profiles.apellido}</span>
                </div>
            )
        },
        {
            key: "type",
            label: "Tipo",
            render: (row) => (
                <span className="text-[10px] font-bold px-2 py-1 bg-neutral-100 rounded-full uppercase text-neutral-600">
                    {row.type}
                </span>
            )
        },
        {
            key: "dates",
            label: "Periodo",
            render: (row) => (
                <div className="flex flex-col">
                    <span className="text-sm">{new Date(row.date_from).toLocaleDateString()} - {new Date(row.date_to).toLocaleDateString()}</span>
                    <span className="text-[10px] text-neutral-400">{row.days_count} días</span>
                </div>
            )
        },
        {
            key: "status",
            label: "Estado",
            render: (row) => (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${row.status === 'APROBADA' ? 'bg-green-100 text-green-700' :
                    row.status === 'RECHAZADA' ? 'bg-red-100 text-red-700' :
                        row.status === 'CANCELADA' ? 'bg-neutral-100 text-neutral-500' :
                            'bg-yellow-100 text-yellow-700'
                    }`}>
                    {row.status}
                </span>
            )
        },
        {
            key: "actions",
            label: "Acciones",
            render: (row) => (
                <div className="flex items-center gap-2">
                    {row.status === 'PENDIENTE' && (
                        <button
                            onClick={() => setSelectedReq(row)}
                            className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-600 transition"
                            title="Procesar"
                        >
                            <MessageSquare className="w-4 h-4" />
                        </button>
                    )}
                    <button
                        onClick={() => openEditModal(row)}
                        className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-yellow-600 transition"
                        title="Editar solicitud"
                    >
                        <Edit3 className="w-4 h-4" />
                    </button>
                </div>
            )
        }
    ];

    return (
        <div className="space-y-6">
            {/* Sub-tabs Navigation */}
            <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl w-fit">
                <button
                    onClick={() => setActiveSubTab('requests')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition ${activeSubTab === 'requests' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}
                >
                    <ListChecks className="w-4 h-4" />
                    Solicitudes
                </button>
                <button
                    onClick={() => setActiveSubTab('balances')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition ${activeSubTab === 'balances' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}
                >
                    <Users className="w-4 h-4" />
                    Saldos Usuarios
                </button>
                <button
                    onClick={() => setActiveSubTab('settings')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition ${activeSubTab === 'settings' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}
                >
                    <Sliders className="w-4 h-4" />
                    Ajustes
                </button>
            </div>

            {activeSubTab === 'requests' && (
                <div className="bg-white p-6 rounded-xl shadow-md border border-neutral-100">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                            <ShieldAlert className="w-5 h-5 text-yellow-500" />
                            Bandeja de Solicitudes
                        </h2>
                        <div className="text-xs text-neutral-500">
                            {requests.filter(r => r.status === 'PENDIENTE').length} pendientes
                        </div>
                    </div>

                    <DataTable
                        columns={columns}
                        data={requests}
                        keyExtractor={(r) => r.id}
                        storageKey="admin-vacation-requests"
                        loading={loading}
                        emptyMessage="No hay solicitudes de vacaciones."
                    />
                </div>
            )}

            {adminId && activeSubTab === 'balances' && (
                <UserBalancesPanel adminId={adminId} />
            )}

            {adminId && activeSubTab === 'settings' && (
                <AdminSettingsPanel adminId={adminId} />
            )}

            {/* Modal de Procesamiento (aprobar/rechazar PENDIENTES) */}
            {selectedReq && (
                <ModalPortal>
                <div className="fixed inset-0 bg-black/50 z-[9999] flex items-end sm:items-center sm:justify-center sm:p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[92dvh] flex flex-col animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
                        <div className="p-6 border-b border-neutral-100 bg-neutral-50">
                            <h3 className="text-lg font-bold text-neutral-900 italic">
                                Procesar: {selectedReq.profiles.nombre}
                            </h3>
                            <p className="text-xs text-neutral-500 mt-1">
                                {selectedReq.type} | {selectedReq.days_count} días
                            </p>
                        </div>

                        <div className="p-6 space-y-4">
                            {selectedReq.comment_user && (
                                <div className="p-3 bg-yellow-50 border border-yellow-100 rounded-lg">
                                    <p className="text-[10px] font-bold text-yellow-700 uppercase mb-1">Nota del empleado:</p>
                                    <p className="text-sm text-neutral-700 italic">"{selectedReq.comment_user}"</p>
                                </div>
                            )}

                            <div>
                                <label className="text-xs font-bold text-neutral-500 uppercase">Comentario Admin</label>
                                <textarea
                                    className="w-full mt-1 p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm h-24 resize-none outline-none focus:ring-2 focus:ring-yellow-400"
                                    placeholder="Motivo de la decisión..."
                                    value={adminComment}
                                    onChange={(e) => setAdminComment(e.target.value)}
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => handleAction(selectedReq.id, 'RECHAZADA')}
                                    disabled={processingId === selectedReq.id}
                                    className="flex-1 py-3 px-4 bg-red-100 text-red-700 rounded-xl font-bold hover:bg-red-200 transition flex items-center justify-center gap-2"
                                >
                                    <X className="w-4 h-4" /> Rechazar
                                </button>
                                <button
                                    onClick={() => handleAction(selectedReq.id, 'APROBADA')}
                                    disabled={processingId === selectedReq.id}
                                    className="flex-1 py-3 px-4 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition flex items-center justify-center gap-2 shadow-lg shadow-green-200"
                                >
                                    <Check className="w-4 h-4" /> Aprobar
                                </button>
                            </div>

                            <button
                                onClick={() => setSelectedReq(null)}
                                className="w-full py-2 text-sm text-neutral-400 hover:text-neutral-600 transition"
                            >
                                Cerrar sin cambios
                            </button>
                        </div>
                    </div>
                </div>
                </ModalPortal>
            )}

            {/* Modal de Edición (cualquier solicitud) */}
            {editingReq && (
                <ModalPortal>
                <div className="fixed inset-0 bg-black/50 z-[9999] flex items-end sm:items-center sm:justify-center sm:p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[92dvh] flex flex-col animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
                        <div className="p-6 border-b border-neutral-100 bg-neutral-50 flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-bold text-neutral-900 italic">Editar Solicitud</h3>
                                <p className="text-xs text-neutral-500 mt-1">{editingReq.nombre}</p>
                            </div>
                            <button onClick={() => setEditingReq(null)}>
                                <X className="w-6 h-6 text-neutral-400" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4 overflow-y-auto">
                            {/* Tipo */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-neutral-400 uppercase">Tipo</label>
                                <select
                                    value={editingReq.type}
                                    onChange={(e) => setEditingReq({ ...editingReq, type: e.target.value })}
                                    className="w-full p-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm"
                                >
                                    <option value="VACACIONES">Vacaciones</option>
                                    <option value="RETRIBUIDO">Retribuido</option>
                                    <option value="NO_RETRIBUIDO">No Retribuido</option>
                                </select>
                            </div>

                            {/* Fechas */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-neutral-400 uppercase">Desde</label>
                                    <input
                                        type="date"
                                        value={editingReq.date_from}
                                        onChange={(e) => {
                                            const newFrom = e.target.value;
                                            const days = calcDays(newFrom, editingReq.date_to);
                                            setEditingReq({ ...editingReq, date_from: newFrom, days_count: days });
                                        }}
                                        className="w-full p-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-neutral-400 uppercase">Hasta</label>
                                    <input
                                        type="date"
                                        value={editingReq.date_to}
                                        onChange={(e) => {
                                            const newTo = e.target.value;
                                            const days = calcDays(editingReq.date_from, newTo);
                                            setEditingReq({ ...editingReq, date_to: newTo, days_count: days });
                                        }}
                                        className="w-full p-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm"
                                    />
                                </div>
                            </div>

                            {/* Días */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-neutral-400 uppercase">Días</label>
                                <input
                                    type="number"
                                    min={0}
                                    value={editingReq.days_count}
                                    onChange={(e) => setEditingReq({ ...editingReq, days_count: parseInt(e.target.value) || 0 })}
                                    className="w-full p-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm"
                                />
                            </div>

                            {/* Estado */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-neutral-400 uppercase">Estado</label>
                                <select
                                    value={editingReq.status}
                                    onChange={(e) => setEditingReq({ ...editingReq, status: e.target.value })}
                                    className="w-full p-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm"
                                >
                                    <option value="PENDIENTE">Pendiente</option>
                                    <option value="APROBADA">Aprobada</option>
                                    <option value="RECHAZADA">Rechazada</option>
                                    <option value="CANCELADA">Cancelada</option>
                                    <option value="MODIFICADA">Modificada</option>
                                </select>
                            </div>

                            {/* Comentario Admin */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-neutral-400 uppercase">Comentario Admin</label>
                                <textarea
                                    value={editingReq.comment_admin}
                                    onChange={(e) => setEditingReq({ ...editingReq, comment_admin: e.target.value })}
                                    className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm h-20 resize-none outline-none focus:ring-2 focus:ring-yellow-400"
                                    placeholder="Nota del administrador..."
                                />
                            </div>

                            {/* Guardar */}
                            <button
                                onClick={handleSaveEdit}
                                disabled={savingEdit}
                                className="w-full mt-2 bg-yellow-400 hover:bg-yellow-500 text-neutral-900 py-3 rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-yellow-100"
                            >
                                {savingEdit ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                Guardar Cambios
                            </button>
                        </div>
                    </div>
                </div>
                </ModalPortal>
            )}
        </div>
    );
}
