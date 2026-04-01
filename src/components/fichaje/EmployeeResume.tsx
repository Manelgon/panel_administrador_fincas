import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Download, FileText, Clock, AlertCircle, Send, X, Loader2, ChevronLeft, ChevronRight, TrendingUp, Briefcase } from 'lucide-react';
import { toast } from 'react-hot-toast';
import ModalPortal from '@/components/ModalPortal';

interface ResumeData {
    user: string;
    month: string;
    total_hours: number;
    worked_days: number;
    days: {
        date: string;
        hours: number;
        entries: { start: string; end: string | null; closed_by: string }[];
    }[];
}

interface EmployeeResumeProps {
    userId?: string;
    allowExport?: boolean;
}

const formatHours = (h: number) => {
    const hours = Math.floor(h);
    const mins = Math.round((h - hours) * 60);
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
};

export default function EmployeeResume({ userId, allowExport = false }: EmployeeResumeProps) {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<ResumeData | null>(null);
    const [month, setMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });

    const [showSendModal, setShowSendModal] = useState(false);
    const [email, setEmail] = useState('');
    const [sending, setSending] = useState(false);

    useEffect(() => {
        fetchResume();
    }, [month, userId]);

    const changeMonth = (offset: number) => {
        const [y, m] = month.split('-').map(Number);
        const d = new Date(y, m - 1 + offset, 1);
        setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    };

    const monthLabel = () => {
        const [y, m] = month.split('-').map(Number);
        return new Date(y, m - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    };

    const isCurrentMonth = () => {
        const now = new Date();
        return month === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    };

    const fetchResume = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const targetId = userId || user.id;
            const res = await fetch(`/api/fichaje/resumen?user_id=${targetId}&month=${month}`);
            if (!res.ok) throw new Error("Error cargando resumen");
            setData(await res.json());
        } catch (error) {
            console.error(error);
            toast.error("Error al cargar el resumen");
        } finally {
            setLoading(false);
        }
    };

    const handleExport = (type: 'csv' | 'pdf') => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (!user) return;
            const targetId = userId || user.id;
            const a = document.createElement('a');
            a.href = `/api/fichaje/export/${type}?user_id=${targetId}&month=${month}`;
            a.download = `resumen_${month}.${type}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        });
    };

    const confirmSend = async () => {
        if (!email) { toast.error("Introduce un email"); return; }
        setSending(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const targetId = userId || user?.id;
            const res = await fetch('/api/fichaje/export/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: targetId, month, toEmail: email })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Error enviando email");
            }
            toast.success("Resumen enviado correctamente");
            setShowSendModal(false);
            setEmail('');
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setSending(false);
        }
    };

    const avgHours = data?.worked_days ? data.total_hours / data.worked_days : 0;
    const autocloseCount = data?.days.filter(d => d.entries.some(e => e.closed_by === 'auto')).length || 0;

    return (
        <div className="space-y-5 animate-in fade-in duration-300">

            {/* Header: navegación de mes + exportar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                {/* Month nav */}
                <div className="flex items-center gap-1 bg-white border border-neutral-100 shadow-sm rounded-xl px-2 py-1.5">
                    <button
                        onClick={() => changeMonth(-1)}
                        className="p-1.5 hover:bg-neutral-100 rounded-lg transition"
                    >
                        <ChevronLeft className="w-4 h-4 text-neutral-500" />
                    </button>
                    <span className="text-sm font-bold min-w-[150px] text-center capitalize text-neutral-800 px-1">
                        {monthLabel()}
                    </span>
                    <button
                        onClick={() => changeMonth(1)}
                        disabled={isCurrentMonth()}
                        className="p-1.5 hover:bg-neutral-100 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <ChevronRight className="w-4 h-4 text-neutral-500" />
                    </button>
                </div>

                {/* Export actions */}
                {allowExport && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => handleExport('csv')}
                            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-600 rounded-lg text-xs font-semibold transition"
                        >
                            <FileText className="w-3.5 h-3.5 text-green-600" />
                            CSV
                        </button>
                        <button
                            onClick={() => handleExport('pdf')}
                            className="flex items-center gap-1.5 px-3 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-xs font-semibold transition"
                        >
                            <Download className="w-3.5 h-3.5 text-yellow-400" />
                            PDF
                        </button>
                        <button
                            onClick={() => setShowSendModal(true)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-600 rounded-lg text-xs font-semibold transition"
                        >
                            <Send className="w-3.5 h-3.5 text-blue-500" />
                            Enviar
                        </button>
                    </div>
                )}
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white rounded-xl border border-neutral-100 shadow-sm p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-yellow-500" />
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Total horas</p>
                    </div>
                    <p className="text-2xl font-bold text-neutral-900 leading-none">
                        {loading ? '—' : formatHours(data?.total_hours || 0)}
                    </p>
                </div>

                <div className="bg-white rounded-xl border border-neutral-100 shadow-sm p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Briefcase className="w-4 h-4 text-blue-500" />
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Días trabajados</p>
                    </div>
                    <p className="text-2xl font-bold text-neutral-900 leading-none">
                        {loading ? '—' : data?.worked_days || 0}
                        <span className="text-sm font-normal text-neutral-400 ml-1">días</span>
                    </p>
                </div>

                <div className="bg-white rounded-xl border border-neutral-100 shadow-sm p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-green-500" />
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Media diaria</p>
                    </div>
                    <p className="text-2xl font-bold text-neutral-900 leading-none">
                        {loading ? '—' : formatHours(avgHours)}
                        <span className="text-sm font-normal text-neutral-400 ml-1">/día</span>
                    </p>
                </div>

                <div className={`rounded-xl border shadow-sm p-4 ${autocloseCount > 0 ? 'bg-orange-50 border-orange-100' : 'bg-white border-neutral-100'}`}>
                    <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className={`w-4 h-4 ${autocloseCount > 0 ? 'text-orange-500' : 'text-neutral-300'}`} />
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Autocierres</p>
                    </div>
                    <p className={`text-2xl font-bold leading-none ${autocloseCount > 0 ? 'text-orange-600' : 'text-neutral-900'}`}>
                        {loading ? '—' : autocloseCount}
                        <span className="text-sm font-normal text-neutral-400 ml-1">días</span>
                    </p>
                </div>
            </div>

            {/* Detail Table */}
            <div className="bg-white rounded-xl border border-neutral-100 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-16 text-neutral-400 text-sm gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Cargando...
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-neutral-50 border-b border-neutral-100">
                                <tr>
                                    <th className="px-4 py-3 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Fecha</th>
                                    <th className="px-4 py-3 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Entrada — Salida</th>
                                    <th className="px-4 py-3 text-[10px] font-bold text-neutral-400 uppercase tracking-widest text-right">Total</th>
                                    <th className="px-4 py-3 text-[10px] font-bold text-neutral-400 uppercase tracking-widest text-center">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-50">
                                {data?.days.map((day) => {
                                    const hasAutoclose = day.entries.some(e => e.closed_by === 'auto');
                                    const dateObj = new Date(day.date + 'T00:00:00');
                                    const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

                                    return (
                                        <tr
                                            key={day.date}
                                            className={`hover:bg-neutral-50 transition ${isWeekend ? 'bg-neutral-50/50' : ''}`}
                                        >
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-neutral-800 capitalize">
                                                        {dateObj.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="space-y-0.5">
                                                    {day.entries.map((entry, idx) => (
                                                        <div key={idx} className="flex items-center gap-1.5 text-neutral-600 text-xs">
                                                            <span className="font-mono">{entry.start}</span>
                                                            <span className="text-neutral-300">→</span>
                                                            <span className={`font-mono ${!entry.end ? 'text-yellow-600 font-semibold' : ''}`}>
                                                                {entry.end || 'En curso'}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <span className="font-bold text-neutral-900">{formatHours(day.hours)}</span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {hasAutoclose ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-[10px] font-bold">
                                                        <AlertCircle className="w-3 h-3" />
                                                        Autocierre
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-bold">
                                                        OK
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {!data?.days.length && (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center text-neutral-400 text-sm">
                                            No hay registros para este mes.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Send Modal */}
            {showSendModal && (
                <ModalPortal>
                    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center sm:justify-center sm:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full max-w-sm p-6 space-y-5 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
                            <div className="flex items-center justify-between">
                                <h3 className="text-base font-bold text-neutral-900">Enviar resumen por email</h3>
                                <button onClick={() => setShowSendModal(false)} className="p-1.5 hover:bg-neutral-100 rounded-lg transition">
                                    <X className="w-4 h-4 text-neutral-400" />
                                </button>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Destinatario</label>
                                <input
                                    type="email"
                                    autoFocus
                                    placeholder="email@ejemplo.com"
                                    className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 outline-none transition"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && confirmSend()}
                                />
                            </div>
                            <div className="flex gap-2 pt-1">
                                <button
                                    onClick={() => setShowSendModal(false)}
                                    className="flex-1 py-2 text-sm font-semibold text-neutral-500 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition"
                                    disabled={sending}
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={confirmSend}
                                    disabled={sending}
                                    className="flex-[2] py-2 text-sm font-bold text-neutral-950 bg-yellow-400 hover:bg-yellow-500 rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    {sending ? 'Enviando...' : 'Enviar'}
                                </button>
                            </div>
                        </div>
                    </div>
                </ModalPortal>
            )}
        </div>
    );
}
