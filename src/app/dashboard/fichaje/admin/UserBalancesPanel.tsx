"use client";

import { useState, useEffect } from "react";
import { Users, Search, Edit3, Save, X, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";
import DataTable, { Column } from "@/components/DataTable";
import ModalPortal from '@/components/ModalPortal';

interface UserBalance {
    user_id: string;
    nombre: string;
    apellido: string | null;
    vacation_balances: {
        id: string;
        year: number;
        vacaciones_total: number;
        vacaciones_usados: number;
        retribuidos_total: number;
        retribuidos_usados: number;
        no_retribuidos_total: number;
        no_retribuidos_usados: number;
    }[];
}

interface UserBalancesPanelProps {
    adminId: string;
}

export default function UserBalancesPanel({ adminId }: UserBalancesPanelProps) {
    const [users, setUsers] = useState<UserBalance[]>([]);
    const [loading, setLoading] = useState(true);
    const [year, setYear] = useState(new Date().getFullYear());
    const [searchTerm, setSearchTerm] = useState("");

    // Editing state
    const [editingUser, setEditingUser] = useState<any | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchBalances();
    }, [year]);

    const fetchBalances = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/vacations/balances?adminId=${adminId}&year=${year}`);
            const data = await res.json();
            if (res.ok) setUsers(data);
        } catch (error) {
            toast.error("Error al cargar saldos");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch("/api/admin/vacations/balances", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    adminId,
                    userId: editingUser.user_id,
                    year,
                    balances: editingUser.balance
                })
            });
            if (res.ok) {
                toast.success("Saldos actualizados");
                setEditingUser(null);
                fetchBalances();
            }
        } catch (error) {
            toast.error("Error al guardar");
        } finally {
            setSaving(false);
        }
    };

    const filteredUsers = users.filter(u =>
        `${u.nombre} ${u.apellido || ""}`.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const columns: Column<UserBalance>[] = [
        {
            key: "user",
            label: "Empleado",
            render: (row) => (
                <div className="font-bold text-neutral-900">{row.nombre} {row.apellido}</div>
            )
        },
        {
            key: "vacaciones",
            label: "Vacaciones (Tot/Usa)",
            render: (row) => {
                const b = row.vacation_balances[0];
                return <span className="text-sm">{b?.vacaciones_total || 0} / {b?.vacaciones_usados || 0}</span>;
            }
        },
        {
            key: "retribuidos",
            label: "Retribuidos",
            render: (row) => {
                const b = row.vacation_balances[0];
                return <span className="text-sm">{b?.retribuidos_total || 0} / {b?.retribuidos_usados || 0}</span>;
            }
        },
        {
            key: "no_retribuidos",
            label: "No Retrib.",
            render: (row) => {
                const b = row.vacation_balances[0];
                return <span className="text-sm">{b?.no_retribuidos_usados || 0}</span>;
            }
        },
        {
            key: "actions",
            label: "Acciones",
            render: (row) => (
                <button
                    onClick={() => {
                        const b = row.vacation_balances[0] || {
                            vacaciones_total: 23, vacaciones_usados: 0,
                            retribuidos_total: 4, retribuidos_usados: 0,
                            no_retribuidos_total: 0, no_retribuidos_usados: 0
                        };
                        setEditingUser({
                            user_id: row.user_id,
                            nombre: row.nombre,
                            balance: { ...b }
                        });
                    }}
                    className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-yellow-600 transition"
                >
                    <Edit3 className="w-4 h-4" />
                </button>
            )
        }
    ];

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-md border border-neutral-100">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-neutral-400" />
                        <h2 className="text-lg font-bold text-neutral-900 italic">Saldos de Empleados</h2>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-lg">
                            <button onClick={() => setYear(year - 1)} className="p-1 hover:bg-white rounded shadow-sm transition"><ChevronLeft className="w-4 h-4" /></button>
                            <span className="text-sm font-bold px-3">{year}</span>
                            <button onClick={() => setYear(year + 1)} className="p-1 hover:bg-white rounded shadow-sm transition"><ChevronRight className="w-4 h-4" /></button>
                        </div>
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                            <input
                                placeholder="Buscar empleado..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-yellow-400 transition w-full md:w-64"
                            />
                        </div>
                    </div>
                </div>

                <DataTable
                    columns={columns}
                    data={filteredUsers}
                    keyExtractor={(u) => u.user_id}
                    storageKey="user-vacation-balances"
                    loading={loading}
                    emptyMessage="No se encontraron usuarios o saldos."
                />
            </div>

            {/* Modal de Edición */}
            {editingUser && (
                <ModalPortal>
                <div className="fixed inset-0 bg-black/50 z-[9999] flex items-end sm:items-center sm:justify-center sm:p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
                        <div className="p-6 border-b border-neutral-100 bg-neutral-50 flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-bold text-neutral-900 italic">Ajustar Saldo: {editingUser.nombre}</h3>
                                <p className="text-xs text-neutral-500">Año {year}</p>
                            </div>
                            <button onClick={() => setEditingUser(null)}><X className="w-6 h-6 text-neutral-400" /></button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4 border-b pb-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-neutral-400 uppercase">Vacaciones Total</label>
                                    <input
                                        type="number"
                                        value={editingUser.balance.vacaciones_total ?? ""}
                                        onChange={(e) => setEditingUser({ ...editingUser, balance: { ...editingUser.balance, vacaciones_total: e.target.value === "" ? "" : parseInt(e.target.value) } })}
                                        className="w-full p-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-neutral-400 uppercase">Vacaciones Usados</label>
                                    <input
                                        type="number"
                                        value={editingUser.balance.vacaciones_usados ?? ""}
                                        onChange={(e) => setEditingUser({ ...editingUser, balance: { ...editingUser.balance, vacaciones_usados: e.target.value === "" ? "" : parseInt(e.target.value) } })}
                                        className="w-full p-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 border-b pb-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-neutral-400 uppercase">Retribuidos Total</label>
                                    <input
                                        type="number"
                                        value={editingUser.balance.retribuidos_total ?? ""}
                                        onChange={(e) => setEditingUser({ ...editingUser, balance: { ...editingUser.balance, retribuidos_total: e.target.value === "" ? "" : parseInt(e.target.value) } })}
                                        className="w-full p-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-neutral-400 uppercase">Retribuidos Usados</label>
                                    <input
                                        type="number"
                                        value={editingUser.balance.retribuidos_usados ?? ""}
                                        onChange={(e) => setEditingUser({ ...editingUser, balance: { ...editingUser.balance, retribuidos_usados: e.target.value === "" ? "" : parseInt(e.target.value) } })}
                                        className="w-full p-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-neutral-400 uppercase">No Retribuidos Usados</label>
                                    <input
                                        type="number"
                                        value={editingUser.balance.no_retribuidos_usados ?? ""}
                                        onChange={(e) => setEditingUser({ ...editingUser, balance: { ...editingUser.balance, no_retribuidos_usados: e.target.value === "" ? "" : parseInt(e.target.value) } })}
                                        className="w-full p-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="w-full mt-2 bg-yellow-400 hover:bg-yellow-500 text-neutral-900 py-3 rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-yellow-100"
                            >
                                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                Actualizar Saldos
                            </button>
                        </div>
                    </div>
                </div>
                </ModalPortal>
            )}
        </div>
    );
}
