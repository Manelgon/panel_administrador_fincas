"use client";

import { useEffect, useState } from "react";
import { Calendar, Plus, ChevronLeft, ChevronRight, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "react-hot-toast";
import RequestVacationModal from "./RequestVacationModal";

interface VacationStatus {
    balance: {
        vacaciones: { total: number; used: number; pending: number };
        retribuidos: { total: number; used: number; pending: number };
        noRetribuidos: { total: number; used: number; pending: number };
    };
    policy: { count_holidays: boolean; count_weekends: boolean };
}

export default function VacationDashboard() {
    const [status, setStatus] = useState<VacationStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [history, setHistory] = useState<any[]>([]);
    const [activeMonth, setActiveMonth] = useState(new Date());
    const [dayColors, setDayColors] = useState<Record<string, { color: string; count: number; reason?: string }>>({});
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    const [visibleCount, setVisibleCount] = useState(5);

    useEffect(() => {
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                setUserId(session.user.id);
                fetchData(session.user.id);
            } else {
                setLoading(false);
            }
        };
        checkSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                setUserId(session.user.id);
                fetchData(session.user.id);
            } else {
                setUserId(null);
                setHistory([]);
                setStatus(null);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        fetchCalendar();
    }, [activeMonth]);

    const fetchData = async (uid?: string) => {
        const idToUse = uid || userId;
        if (!idToUse) return;
        setLoading(true);
        try {
            const [statusRes, historyRes] = await Promise.all([
                fetch(`/api/vacations/status?userId=${idToUse}`),
                fetch(`/api/vacations/requests?userId=${idToUse}`)
            ]);
            const statusData = await statusRes.json();
            const historyData = await historyRes.json();
            if (statusRes.ok) setStatus(statusData);
            if (historyRes.ok) setHistory(historyData);
        } catch {
            toast.error("Error al cargar datos de vacaciones");
        } finally {
            setLoading(false);
        }
    };

    const fetchCalendar = async () => {
        const year = activeMonth.getFullYear();
        const month = activeMonth.getMonth() + 1;
        const monthStr = `${year}-${month.toString().padStart(2, '0')}`;
        try {
            const res = await fetch(`/api/vacations/calendar?month=${monthStr}`);
            const data = await res.json();
            setDayColors(data.days || {});
        } catch {
            console.error("Calendar fetch error");
        }
    };

    const handleMonthChange = (offset: number) => {
        const newDate = new Date(activeMonth.getFullYear(), activeMonth.getMonth() + offset, 1);
        setActiveMonth(newDate);
    };

    const renderCalendar = () => {
        const year = activeMonth.getFullYear();
        const month = activeMonth.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date();
        const isToday = (d: number) =>
            today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;

        const startOffset = firstDay === 0 ? 6 : firstDay - 1;
        const days = [];

        for (let i = 0; i < startOffset; i++) {
            days.push(<div key={`e-${i}`} />);
        }

        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
            const dayInfo = dayColors[dateStr];
            const dow = new Date(year, month, i).getDay();
            const isWeekend = dow === 0 || dow === 6;
            const todayFlag = isToday(i);

            let bg = '';
            let numColor = '';
            if (dayInfo?.color === 'green') {
                bg = 'bg-green-50 border-green-200';
                numColor = 'text-green-700';
            } else if (dayInfo?.color === 'amber') {
                bg = 'bg-amber-50 border-amber-200';
                numColor = 'text-amber-700';
            } else if (dayInfo?.color === 'red') {
                bg = 'bg-red-50 border-red-200';
                numColor = 'text-red-600';
            } else {
                bg = isWeekend ? 'bg-neutral-50 border-neutral-100' : 'bg-white border-neutral-100';
                numColor = isWeekend ? 'text-neutral-400' : 'text-neutral-600';
            }

            days.push(
                <div
                    key={i}
                    className={`h-12 rounded-lg border p-1.5 flex flex-col transition-colors ${bg}`}
                    title={dayInfo?.reason || ''}
                >
                    <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full flex-shrink-0 ${
                        todayFlag
                            ? 'bg-yellow-400 text-neutral-950'
                            : numColor
                    }`}>
                        {i}
                    </span>
                    {dayInfo?.reason && (
                        <span className="text-[8px] leading-tight text-current opacity-60 mt-auto truncate">
                            {dayInfo.reason}
                        </span>
                    )}
                </div>
            );
        }

        return days;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16 text-neutral-400 text-sm">
                Cargando vacaciones...
            </div>
        );
    }

    const balanceItems = [
        {
            label: "Vacaciones Anuales",
            val: status?.balance.vacaciones,
            barColor: "bg-yellow-400",
        },
        {
            label: "Días Retribuidos",
            val: status?.balance.retribuidos,
            barColor: "bg-blue-400",
        },
        {
            label: "No Retribuidos",
            val: status?.balance.noRetribuidos,
            barColor: "bg-neutral-400",
        },
    ];

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-base font-bold text-neutral-900">Mis Vacaciones</h2>
                    <p className="text-xs text-neutral-400">{new Date().getFullYear()}</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-neutral-950 px-4 py-2 rounded-xl font-bold text-sm transition shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    Solicitar días
                </button>
            </div>

            {/* Balance Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {balanceItems.map((item) => {
                    const total = item.val?.total || 0;
                    const used = item.val?.used || 0;
                    const pending = item.val?.pending || 0;
                    const available = total - used - pending;
                    const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;

                    return (
                        <div key={item.label} className="bg-white rounded-xl border border-neutral-100 shadow-sm p-4 space-y-3">
                            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">{item.label}</p>

                            <div className="flex items-end gap-1.5">
                                <span className="text-3xl font-bold text-neutral-900 leading-none">{available}</span>
                                <span className="text-xs text-neutral-400 mb-0.5">/ {total} días</span>
                            </div>

                            <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all ${item.barColor}`}
                                    style={{ width: `${pct}%` }}
                                />
                            </div>

                            <div className="flex items-center gap-3 text-[10px] font-medium">
                                <span className="text-neutral-400">{used} usados</span>
                                {pending > 0 && (
                                    <span className="text-amber-500">{pending} pendiente{pending !== 1 ? 's' : ''}</span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Calendar */}
            <div className="bg-white rounded-xl border border-neutral-100 shadow-sm p-5">
                {/* Calendar Header */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                        <h3 className="text-sm font-bold text-neutral-700 flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-yellow-500" />
                            Disponibilidad del equipo
                        </h3>
                        <div className="hidden md:flex items-center gap-3 text-[10px] text-neutral-400">
                            <span className="flex items-center gap-1">
                                <span className="w-3 h-3 rounded-sm bg-green-100 border border-green-300 inline-block" />
                                Libre
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-3 h-3 rounded-sm bg-amber-100 border border-amber-300 inline-block" />
                                Parcial
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-3 h-3 rounded-sm bg-red-100 border border-red-300 inline-block" />
                                Lleno
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-0.5">
                        <button
                            onClick={() => handleMonthChange(-1)}
                            className="p-1.5 hover:bg-neutral-100 rounded-lg transition"
                        >
                            <ChevronLeft className="w-4 h-4 text-neutral-500" />
                        </button>
                        <span className="text-sm font-bold min-w-[130px] text-center capitalize text-neutral-800">
                            {activeMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                        </span>
                        <button
                            onClick={() => handleMonthChange(1)}
                            className="p-1.5 hover:bg-neutral-100 rounded-lg transition"
                        >
                            <ChevronRight className="w-4 h-4 text-neutral-500" />
                        </button>
                    </div>
                </div>

                {/* Day headers */}
                <div className="grid grid-cols-7 gap-1 mb-1">
                    {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
                        <div key={d} className="text-center text-[10px] font-bold text-neutral-400 uppercase py-1">{d}</div>
                    ))}
                </div>

                {/* Days grid */}
                <div className="grid grid-cols-7 gap-1">
                    {renderCalendar()}
                </div>
            </div>

            {/* Mis Solicitudes */}
            <div className="bg-white rounded-xl border border-neutral-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-neutral-700 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-neutral-400" />
                        Mis Solicitudes
                    </h3>
                    <span className="text-[10px] text-neutral-400">{history.length} solicitud{history.length !== 1 ? 'es' : ''}</span>
                </div>

                {history.length === 0 ? (
                    <p className="text-sm text-neutral-400 text-center py-8">
                        No tienes solicitudes aún.
                    </p>
                ) : (
                    <div className="space-y-2">
                        {history.slice(0, visibleCount).map((req: any) => {
                            const statusConfig = {
                                APROBADA: { icon: CheckCircle2, iconColor: 'text-green-500', bg: 'bg-green-100', badge: 'bg-green-100 text-green-700', label: 'Aprobada' },
                                RECHAZADA: { icon: XCircle, iconColor: 'text-red-500', bg: 'bg-red-100', badge: 'bg-red-100 text-red-700', label: 'Rechazada' },
                                PENDIENTE: { icon: AlertCircle, iconColor: 'text-amber-500', bg: 'bg-amber-100', badge: 'bg-amber-100 text-amber-700', label: 'Pendiente' },
                            }[req.status as string] || {
                                icon: AlertCircle, iconColor: 'text-neutral-400', bg: 'bg-neutral-100', badge: 'bg-neutral-100 text-neutral-600', label: req.status
                            };
                            const StatusIcon = statusConfig.icon;

                            const from = new Date(req.date_from + 'T00:00:00');
                            const to = new Date(req.date_to + 'T00:00:00');
                            const sameMonth = from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear();

                            const fromStr = from.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
                            const toStr = to.toLocaleDateString('es-ES', {
                                day: 'numeric',
                                month: 'short',
                                ...(from.getFullYear() !== to.getFullYear() ? { year: 'numeric' } : {}),
                            });

                            const typeLabel = req.type === 'VACACIONES' ? 'Vacaciones' :
                                req.type === 'RETRIBUIDO' ? 'Día retribuido' : 'No retribuido';

                            return (
                                <div key={req.id} className="flex items-center gap-3 p-3 rounded-xl border border-neutral-100 hover:bg-neutral-50 transition group">
                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${statusConfig.bg}`}>
                                        <StatusIcon className={`w-4 h-4 ${statusConfig.iconColor}`} />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-sm font-semibold text-neutral-800">
                                                {fromStr}{!sameMonth || req.date_from !== req.date_to ? ` — ${toStr}` : ''}
                                            </span>
                                            <span className="text-[10px] font-bold text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded-md">
                                                {req.days_count}d
                                            </span>
                                        </div>
                                        <span className="text-[10px] text-neutral-400">{typeLabel}</span>
                                        {req.comment_admin && (
                                            <p className="text-[11px] text-neutral-500 italic mt-0.5 truncate">"{req.comment_admin}"</p>
                                        )}
                                    </div>

                                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold flex-shrink-0 ${statusConfig.badge}`}>
                                        {statusConfig.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}

                {history.length > visibleCount && (
                    <button
                        onClick={() => setVisibleCount(v => v + 5)}
                        className="w-full mt-3 py-2 text-xs font-semibold text-neutral-500 hover:text-neutral-800 hover:bg-neutral-50 rounded-lg transition"
                    >
                        Ver más ({history.length - visibleCount} restantes)
                    </button>
                )}
                {visibleCount > 5 && history.length <= visibleCount && history.length > 5 && (
                    <button
                        onClick={() => setVisibleCount(5)}
                        className="w-full mt-3 py-2 text-xs font-semibold text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50 rounded-lg transition"
                    >
                        Ver menos
                    </button>
                )}
            </div>

            {status && userId && isModalOpen && (
                <RequestVacationModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSuccess={fetchData}
                    userId={userId}
                    policy={status.policy}
                    balance={status.balance}
                />
            )}
        </div>
    );
}
