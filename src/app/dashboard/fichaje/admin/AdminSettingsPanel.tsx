"use client";

import { useState, useEffect } from "react";
import { Settings, ShieldAlert, Plus, Trash2, Save, Calendar, Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";

interface AdminSettingsProps {
    adminId: string;
}

export default function AdminSettingsPanel({ adminId }: AdminSettingsProps) {
    const [policy, setPolicy] = useState<any>(null);
    const [blockedDates, setBlockedDates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // New blocked date form
    const [newBlocked, setNewBlocked] = useState({
        date_from: "",
        date_to: "",
        reason: ""
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const res = await fetch(`/api/admin/vacations/settings?adminId=${adminId}`);
            const data = await res.json();
            if (res.ok) {
                setPolicy(data.policy);
                setBlockedDates(data.blockedDates);
            }
        } catch (error) {
            toast.error("Error al cargar ajustes");
        } finally {
            setLoading(false);
        }
    };

    const handleUpdatePolicy = async () => {
        setSaving(true);
        try {
            const res = await fetch("/api/admin/vacations/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    adminId,
                    action: "update_policy",
                    data: policy
                })
            });
            if (res.ok) toast.success("Política actualizada");
            else throw new Error("Error update");
        } catch (error) {
            toast.error("Error al guardar política");
        } finally {
            setSaving(false);
        }
    };

    const handleAddBlockedDate = async () => {
        if (!newBlocked.date_from || !newBlocked.date_to || !newBlocked.reason) {
            return toast.error("Completa todos los campos");
        }
        try {
            const res = await fetch("/api/admin/vacations/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    adminId,
                    action: "add_blocked_date",
                    data: newBlocked
                })
            });
            if (res.ok) {
                toast.success("Fecha bloqueada añadida");
                setNewBlocked({ date_from: "", date_to: "", reason: "" });
                fetchData();
            }
        } catch (error) {
            toast.error("Error al añadir");
        }
    };

    const handleDeleteBlockedDate = async (id: string) => {
        try {
            const res = await fetch("/api/admin/vacations/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    adminId,
                    action: "delete_blocked_date",
                    data: { id }
                })
            });
            if (res.ok) {
                toast.success("Fecha eliminada");
                fetchData();
            }
        } catch (error) {
            toast.error("Error al eliminar");
        }
    };

    if (loading) return <div className="p-8 text-center text-neutral-500">Cargando ajustes...</div>;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Policy Configuration */}
            <div className="bg-white p-6 rounded-xl shadow-md border border-neutral-100 space-y-6">
                <div className="flex items-center gap-2 mb-2">
                    <Settings className="w-5 h-5 text-neutral-400" />
                    <h2 className="text-lg font-bold text-neutral-900 italic">Política de Vacaciones</h2>
                </div>

                {policy && (
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-neutral-500 uppercase">Capacidad Máxima Diaria (Cupo)</label>
                            <input
                                type="number"
                                min="1"
                                value={policy.max_approved_per_day ?? ""}
                                onChange={(e) => setPolicy({ ...policy, max_approved_per_day: e.target.value === "" ? "" : parseInt(e.target.value) })}
                                className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-yellow-400"
                            />
                            <p className="text-[10px] text-neutral-400 mt-1 italic">Número máximo de empleados que pueden estar fuera el mismo día.</p>
                        </div>

                        <div className="space-y-3 pt-2">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={policy.count_weekends}
                                    onChange={(e) => setPolicy({ ...policy, count_weekends: e.target.checked })}
                                    className="w-5 h-5 text-yellow-500 rounded border-neutral-300 focus:ring-yellow-500"
                                />
                                <span className="text-sm font-semibold text-neutral-700">Contar Fines de Semana</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={policy.count_holidays}
                                    onChange={(e) => setPolicy({ ...policy, count_holidays: e.target.checked })}
                                    className="w-5 h-5 text-yellow-500 rounded border-neutral-300 focus:ring-yellow-500"
                                />
                                <span className="text-sm font-semibold text-neutral-700">Contar Festivos Nacionales</span>
                            </label>
                        </div>

                        <button
                            onClick={handleUpdatePolicy}
                            disabled={saving}
                            className="w-full mt-4 bg-neutral-900 text-white py-3 rounded-lg font-bold hover:bg-neutral-800 transition flex items-center justify-center gap-2"
                        >
                            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            Guardar Cambios
                        </button>
                    </div>
                )}
            </div>

            {/* Blocked Dates / Blackout Periods */}
            <div className="bg-white p-6 rounded-xl shadow-md border border-neutral-100 space-y-6">
                <div className="flex items-center gap-2 mb-2">
                    <ShieldAlert className="w-5 h-5 text-red-500" />
                    <h2 className="text-lg font-bold text-neutral-900 italic">Días Bloqueados (Veda)</h2>
                </div>

                {/* Add Form */}
                <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-100 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <input
                            type="date"
                            value={newBlocked.date_from}
                            onChange={(e) => setNewBlocked({ ...newBlocked, date_from: e.target.value })}
                            className="p-2 border rounded-lg text-xs"
                        />
                        <input
                            type="date"
                            value={newBlocked.date_to}
                            onChange={(e) => setNewBlocked({ ...newBlocked, date_to: e.target.value })}
                            className="p-2 border rounded-lg text-xs"
                        />
                    </div>
                    <input
                        placeholder="Motivo (ej: Inventario, Cierre anual...)"
                        value={newBlocked.reason}
                        onChange={(e) => setNewBlocked({ ...newBlocked, reason: e.target.value })}
                        className="w-full p-2 border rounded-lg text-xs"
                    />
                    <button
                        onClick={handleAddBlockedDate}
                        className="w-full py-2 bg-yellow-400 text-neutral-900 rounded-lg font-bold text-xs hover:bg-yellow-500 transition flex items-center justify-center gap-1"
                    >
                        <Plus className="w-4 h-4" /> Añadir Restricción
                    </button>
                </div>

                {/* List */}
                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                    {blockedDates.length === 0 ? (
                        <p className="text-center text-xs text-neutral-400 py-8 italic">No hay periodos bloqueados.</p>
                    ) : (
                        blockedDates.map(item => (
                            <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border border-neutral-100 bg-white hover:bg-neutral-50 transition">
                                <div className="space-y-0.5">
                                    <p className="text-xs font-bold text-neutral-900">
                                        {new Date(item.date_from).toLocaleDateString()} al {new Date(item.date_to).toLocaleDateString()}
                                    </p>
                                    <p className="text-[10px] text-neutral-500 uppercase tracking-tight">{item.reason}</p>
                                </div>
                                <button
                                    onClick={() => handleDeleteBlockedDate(item.id)}
                                    className="p-2 text-neutral-300 hover:text-red-500 transition"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
