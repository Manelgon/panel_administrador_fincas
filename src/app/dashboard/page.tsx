'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useGlobalLoading } from '@/lib/globalLoading';
import KPICard from '@/components/KPICard';
import SearchableSelect from '@/components/SearchableSelect';
import {
    Building, AlertCircle, FileText, CheckCircle,
    Pause, Filter, ChevronDown, Users, Timer, FileDown, X
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, BarChart, Bar, Legend
} from 'recharts';
import dynamic from 'next/dynamic';
import { generateDashboardPDF } from '@/lib/dashboardPdfReport';
import { useDashboardData } from '@/hooks/useDashboardData';

const CronometrajeSection = dynamic(
    () => import('@/components/dashboard/CronometrajeSection'),
    { ssr: false, loading: () => <div className="h-40 flex items-center justify-center text-sm text-neutral-400">Cargando gráficas...</div> }
);

const COLORS = ['#FF8042', '#FFBB28', '#00C49F'];
const SENTIMENT_COLORS: Record<string, string> = {
    'Negativo': '#FF8042',
    'Neutral': '#FFBB28',
    'Positivo': '#00C49F',
};

// ─── Accordion section wrapper ────────────────────────────────────────────────
function Section({
    id, title, icon: Icon, iconColor = 'text-neutral-400',
    defaultOpen = false, forceOpen = false, children
}: {
    id: string;
    title: string;
    icon: React.ElementType;
    iconColor?: string;
    defaultOpen?: boolean;
    forceOpen?: boolean;
    children: React.ReactNode;
}) {
    const [open, setOpen] = useState(defaultOpen);
    const isOpen = forceOpen || open;

    return (
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
            <button
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-neutral-50 transition-colors"
                aria-expanded={isOpen}
                aria-controls={`section-${id}`}
            >
                <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${iconColor}`} aria-hidden="true" />
                    <span className="text-sm font-bold text-neutral-800">{title}</span>
                </div>
                <ChevronDown
                    className={`w-4 h-4 text-neutral-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                />
            </button>

            {isOpen && (
                <div id={`section-${id}`} className="border-t border-neutral-100 p-4 md:p-6">
                    {children}
                </div>
            )}
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
    const {
        stats, cronoStats, chartData, loading,
        period, communities, selectedCommunity,
        changePeriod, changeCommunity,
    } = useDashboardData();

    const { withLoading } = useGlobalLoading();
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [showPdfModal, setShowPdfModal] = useState(false);
    const [pdfCommunity, setPdfCommunity] = useState('all');
    const [pdfDateFrom, setPdfDateFrom] = useState('');
    const [pdfDateTo, setPdfDateTo] = useState('');
    const [pdfMode, setPdfMode] = useState<'both' | 'charts' | 'data'>('both');
    const [pdfSections, setPdfSections] = useState<string[]>(['incidencias', 'cronometraje', 'rendimiento', 'deudas']);
    const [pdfIncludeTimeline, setPdfIncludeTimeline] = useState(false);
    const [portalReady, setPortalReady] = useState(false);
    useEffect(() => setPortalReady(true), []);

    const [visibleLines, setVisibleLines] = useState({ pendientes: true, aplazadas: true, total: true });
    const toggleLine = (key: keyof typeof visibleLines) =>
        setVisibleLines(prev => ({ ...prev, [key]: !prev[key] }));

    const toggleSection = (s: string) =>
        setPdfSections(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

    const handleGeneratePDF = async () => {
        if (isGeneratingPDF) return;
        setShowPdfModal(false);
        await withLoading(async () => {
            setIsGeneratingPDF(true);
            try {
                await generateDashboardPDF({
                    stats, cronoStats, chartData, period,
                    selectedCommunity: pdfCommunity,
                    communities,
                    includeCharts: pdfMode !== 'data',
                    sections: pdfMode !== 'charts' ? pdfSections : [],
                    includeTimeline: pdfIncludeTimeline,
                    dateFrom: pdfDateFrom || undefined,
                    dateTo: pdfDateTo || undefined,
                });
            } finally {
                setIsGeneratingPDF(false);
            }
        }, 'Generando informe PDF...');
    };

    return (
        <>
            <div className="space-y-4 md:space-y-5 pb-10">
                {/* Header */}
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                    <div className="flex-shrink-0">
                        <h1 className="text-xl md:text-2xl font-bold text-neutral-900 tracking-tight">Panel de Control</h1>
                        <p className="text-neutral-500 text-sm">Visión general del estado de las comunidades.</p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
                        {/* Community Selector */}
                        <div className="flex items-center gap-2 w-full sm:w-80">
                            <Filter className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                            <div className="flex-1">
                                <SearchableSelect
                                    options={[
                                        { value: 'all', label: 'Todas' },
                                        ...communities.map(c => ({
                                            value: String(c.id),
                                            label: `${c.codigo} - ${c.nombre_cdad}`
                                        }))
                                    ]}
                                    value={selectedCommunity}
                                    onChange={(val) => changeCommunity(String(val))}
                                    placeholder="Filtrar por comunidad..."
                                    className="!py-1"
                                />
                            </div>
                        </div>

                        {/* Period Switcher */}
                        <div className="flex bg-white rounded-lg p-1 border border-neutral-200 shadow-sm w-full sm:w-auto">
                            {['all', '30', '90'].map((p) => (
                                <button
                                    key={p}
                                    onClick={() => changePeriod(p)}
                                    className={`flex-1 md:flex-none px-3 md:px-4 py-1.5 text-xs font-medium rounded-md transition ${period === p ? 'bg-yellow-400 text-neutral-950 shadow-sm' : 'text-neutral-600 hover:bg-neutral-50'}`}
                                >
                                    {p === 'all' ? 'Todo' : `${p} días`}
                                </button>
                            ))}
                        </div>

                        {/* PDF Download */}
                        <button
                            onClick={() => { setPdfCommunity(selectedCommunity); setShowPdfModal(true); }}
                            disabled={loading || isGeneratingPDF}
                            className="flex items-center gap-2 bg-neutral-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-neutral-800 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto justify-center"
                        >
                            {isGeneratingPDF ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <FileDown className="w-4 h-4" />
                            )}
                            {isGeneratingPDF ? 'Generando...' : 'Descargar PDF'}
                        </button>
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
                    <KPICard
                        title="Comunidades"
                        value={
                            selectedCommunity === 'all'
                                ? 'Todas'
                                : (() => {
                                    const c = communities.find((c) => String(c.id) === selectedCommunity);
                                    return c ? `${c.codigo}` : 'Sel.';
                                })()
                        }
                        icon={Building}
                        color="border-yellow-400"
                        iconColor="text-yellow-500"
                        href="/dashboard/comunidades"
                    />
                    <KPICard title="Incid. Pendientes" value={stats.incidenciasPendientes} icon={AlertCircle} color="border-red-400" iconColor="text-red-500" href="/dashboard/incidencias" />
                    <KPICard title="Aplazadas" value={stats.incidenciasAplazadas} icon={Pause} color="border-orange-400" iconColor="text-orange-500" href="/dashboard/incidencias" />
                    <KPICard title="Resueltas" value={stats.incidenciasResueltas} icon={CheckCircle} color="border-emerald-400" iconColor="text-emerald-500" href="/dashboard/incidencias" />
                    <KPICard title="Deuda Total" value={`${stats.totalDeuda.toLocaleString()}€`} icon={FileText} color="border-yellow-400" iconColor="text-yellow-600" href="/dashboard/deudas" />
                </div>

                {/* ── Sección Incidencias ─────────────────────────────────────────── */}
                <Section id="incidencias" title="Incidencias" icon={AlertCircle} iconColor="text-red-500" defaultOpen forceOpen={isGeneratingPDF}>
                    {/* Evolución */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">Evolución</p>
                            <div className="flex items-center gap-4">
                                {([
                                    { key: 'pendientes', label: 'Pendientes', color: '#EAB308' },
                                    { key: 'aplazadas',  label: 'Aplazadas',  color: '#F97316' },
                                    { key: 'total',      label: 'Total (P+A)', color: '#6366F1' },
                                ] as const).map(({ key, label, color }) => (
                                    <label key={key} className="flex items-center gap-1.5 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={visibleLines[key]}
                                            onChange={() => toggleLine(key)}
                                            className="sr-only"
                                        />
                                        <span
                                            className="w-3 h-3 rounded-sm flex-shrink-0 border-2 transition-colors"
                                            style={{ backgroundColor: visibleLines[key] ? color : 'transparent', borderColor: color }}
                                        />
                                        <span className="text-xs text-neutral-500">{label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="h-[220px] w-full" id="chart-evolution">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData.incidenciasEvolution}>
                                    <defs>
                                        <linearGradient id="colorPendientes" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#FACC15" stopOpacity={0.5} />
                                            <stop offset="95%" stopColor="#FACC15" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorAplazadas" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#F97316" stopOpacity={0.5} />
                                            <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E5" />
                                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#737373' }} tickLine={false} axisLine={false} dy={8} />
                                    <YAxis tick={{ fontSize: 11, fill: '#737373' }} tickLine={false} axisLine={false} />
                                    <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e5e5' }} />
                                    {visibleLines.total      && <Area type="monotone" dataKey="total"     name="Total (P+A)" stroke="#6366F1" fill="url(#colorTotal)"      activeDot={{ r: 5 }} strokeDasharray="4 2" />}
                                    {visibleLines.pendientes && <Area type="monotone" dataKey="count"     name="Pendientes"  stroke="#EAB308" fill="url(#colorPendientes)" activeDot={{ r: 5 }} />}
                                    {visibleLines.aplazadas  && <Area type="monotone" dataKey="aplazadas" name="Aplazadas"   stroke="#F97316" fill="url(#colorAplazadas)"  activeDot={{ r: 5 }} />}
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Distribuciones */}
                    <div className={`grid grid-cols-1 ${selectedCommunity === 'all' ? 'sm:grid-cols-3' : 'sm:grid-cols-4'} gap-4`}>
                        {[
                            {
                                label: 'Estado', chartId: 'chart-incident-status', data: chartData.incidenciasStatus,
                                colorFn: (e: { name: string }) => e.name === 'Resuelta' ? '#10b981' : e.name === 'Aplazada' ? '#f97316' : '#eab308',
                            },
                            {
                                label: 'Urgencia', chartId: 'chart-urgency', data: chartData.urgencyDistribution,
                                colorFn: (_: unknown, i: number) => COLORS[i % COLORS.length],
                            },
                            {
                                label: 'Sentimiento', chartId: 'chart-sentiment', data: chartData.sentimentDistribution,
                                colorFn: (e: { name: string }) => SENTIMENT_COLORS[e.name] || '#94a3b8',
                            },
                            ...(selectedCommunity !== 'all' ? [{
                                label: 'Estado Deuda', chartId: 'chart-debt-status-inc', data: chartData.debtStatus,
                                colorFn: (e: { name: string }) => e.name === 'Pagado' ? '#10b981' : '#eab308',
                            }] : []),
                        ].map(({ label, chartId, data, colorFn }) => (
                            <div key={label}>
                                <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-2">{label}</p>
                                <div className="h-[200px]" id={chartId}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={data} cx="50%" cy="45%" innerRadius="55%" outerRadius="75%" paddingAngle={4} dataKey="value">
                                                {data.map((entry, index) => (
                                                    <Cell key={index} fill={(colorFn as (e: typeof entry, i: number) => string)(entry, index)} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                            <Legend verticalAlign="bottom" height={30} iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Top comunidades */}
                    {selectedCommunity === 'all' && (
                        <div className="mt-6 pt-6 border-t border-neutral-100">
                            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-3">Top comunidades</p>
                            <div className="h-[220px]" id="chart-top-communities">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart layout="vertical" data={chartData.topComunidades} margin={{ top: 0, right: 20, left: 40, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E5E5E5" />
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11, fill: '#525252' }} tickLine={false} axisLine={false} />
                                        <Tooltip cursor={{ fill: '#f5f5f5' }} />
                                        <Bar dataKey="count" fill="#404040" radius={[0, 4, 4, 0]} barSize={18} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}
                </Section>

                {/* ── Sección Deudas ──────────────────────────────────────────────── */}
                <Section id="deudas" title="Deudas" icon={FileText} iconColor="text-yellow-600" forceOpen={isGeneratingPDF}>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2">
                            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-3">Deuda por comunidad</p>
                            <div className="h-[260px]" id="chart-debt-by-community">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData.debtByCommunity} margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E5" />
                                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#525252' }} tickLine={false} axisLine={false} interval={0} />
                                        <YAxis tick={{ fontSize: 11, fill: '#525252' }} tickLine={false} axisLine={false} />
                                        <Tooltip cursor={{ fill: '#f5f5f5' }} formatter={(v: unknown) => [`${((v as number) ?? 0).toLocaleString()}€`, 'Deuda']} />
                                        <Bar dataKey="value" fill="#CA8A04" radius={[4, 4, 0, 0]} barSize={36} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-3">Estado</p>
                            <div className="h-[260px]" id="chart-debt-status">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={chartData.debtStatus} cx="50%" cy="45%" innerRadius="55%" outerRadius="75%" paddingAngle={4} dataKey="value">
                                            {chartData.debtStatus.map((entry, index) => (
                                                <Cell key={index} fill={entry.name === 'Pagado' ? '#10b981' : '#eab308'} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(v: unknown, n: unknown) => [`${((v as number) ?? 0).toLocaleString()}€`, String(n ?? '')]} />
                                        <Legend verticalAlign="bottom" height={30} iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </Section>

                {/* ── Sección Cronometraje ────────────────────────────────────────── */}
                <Section id="cronometraje" title="Cronometraje de Tareas" icon={Timer} iconColor="text-yellow-500" forceOpen={isGeneratingPDF}>
                    <CronometrajeSection cronoStats={cronoStats} chartData={chartData} embedded />
                </Section>

                {/* ── Sección Rendimiento de Equipo ───────────────────────────────── */}
                <Section id="equipo" title="Rendimiento del Equipo" icon={Users} iconColor="text-neutral-500" forceOpen={isGeneratingPDF}>
                    <div className="overflow-x-auto -mx-4 md:-mx-6">
                        <table className="w-full text-sm text-left min-w-[520px]">
                            <thead className="border-b border-neutral-100">
                                <tr>
                                    <th className="px-4 md:px-6 py-2.5 text-xs font-bold text-neutral-500 uppercase tracking-wide">Usuario</th>
                                    <th className="px-4 md:px-6 py-2.5 text-xs font-bold text-neutral-500 uppercase tracking-wide text-center">Asignadas</th>
                                    <th className="px-4 md:px-6 py-2.5 text-xs font-bold text-neutral-500 uppercase tracking-wide text-center">Resueltas</th>
                                    <th className="px-4 md:px-6 py-2.5 text-xs font-bold text-neutral-500 uppercase tracking-wide text-center">Pendientes</th>
                                    <th className="px-4 md:px-6 py-2.5 text-xs font-bold text-neutral-500 uppercase tracking-wide text-center">Eficacia</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                                {chartData.userPerformance.map((user, i) => (
                                    <tr key={i} className="hover:bg-neutral-50 transition">
                                        <td className="px-4 md:px-6 py-2.5 font-semibold text-neutral-900">{user.name}</td>
                                        <td className="px-4 md:px-6 py-2.5 text-center text-neutral-600">{user.assigned}</td>
                                        <td className="px-4 md:px-6 py-2.5 text-center text-neutral-600">{user.resolved}</td>
                                        <td className="px-4 md:px-6 py-2.5 text-center font-medium text-amber-600">{user.pending}</td>
                                        <td className="px-4 md:px-6 py-2.5 text-center">
                                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${user.efficiency >= 80 ? 'bg-emerald-100 text-emerald-700' :
                                                    user.efficiency >= 50 ? 'bg-amber-100 text-amber-700' :
                                                        'bg-red-100 text-red-700'
                                                }`}>
                                                {user.efficiency}%
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Section>
            </div>

            {/* PDF Options Modal */}
            {portalReady && showPdfModal && createPortal(
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-end sm:items-center sm:justify-center sm:p-4"
                >
                    <div
                        className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl border border-neutral-200 w-full max-w-lg max-h-[92dvh] flex flex-col animate-in fade-in slide-in-from-bottom sm:zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex justify-between items-center px-5 py-4 border-b border-neutral-100 bg-neutral-50">
                            <div>
                                <h3 className="text-lg font-bold text-neutral-900 tracking-tight">Configurar Informe PDF</h3>
                                <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-0.5">Selecciona qué incluir en el informe</p>
                            </div>
                            <button onClick={() => setShowPdfModal(false)} className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-4 sm:px-5 sm:py-4 space-y-5">
                            {/* Comunidad */}
                            <div>
                                <label className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-3 border-b border-yellow-400 block">Comunidad</label>
                                <select
                                    value={pdfCommunity}
                                    onChange={e => setPdfCommunity(e.target.value)}
                                    className="w-full rounded-lg border border-neutral-200 bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400 focus:bg-white transition"
                                >
                                    <option value="all">Todas las comunidades</option>
                                    {communities.map(c => (
                                        <option key={c.id} value={String(c.id)}>{c.codigo} — {c.nombre_cdad}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Rango de fechas */}
                            <div>
                                <label className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-3 border-b border-yellow-400 block">Rango de fechas</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Desde</p>
                                        <input
                                            type="date"
                                            value={pdfDateFrom}
                                            onChange={e => setPdfDateFrom(e.target.value)}
                                            className="w-full rounded-lg border border-neutral-200 bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400 focus:bg-white transition"
                                        />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Hasta</p>
                                        <input
                                            type="date"
                                            value={pdfDateTo}
                                            onChange={e => setPdfDateTo(e.target.value)}
                                            className="w-full rounded-lg border border-neutral-200 bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400 focus:bg-white transition"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Contenido del PDF */}
                            <div>
                                <label className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-3 border-b border-yellow-400 block">Contenido del PDF</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {([
                                        { key: 'both', label: 'Gráficas + Datos', desc: 'Todo el informe' },
                                        { key: 'charts', label: 'Solo gráficas', desc: 'Visualizaciones' },
                                        { key: 'data', label: 'Solo datos', desc: 'Estadísticas' },
                                    ] as const).map(({ key, label, desc }) => (
                                        <button
                                            key={key}
                                            onClick={() => setPdfMode(key)}
                                            className={`py-2.5 px-2 rounded-lg text-xs font-bold border transition text-center ${pdfMode === key ? 'bg-yellow-100 text-yellow-700 border-yellow-400' : 'bg-white text-neutral-400 border-neutral-200 hover:border-neutral-300 hover:text-neutral-600'}`}
                                        >
                                            <div>{label}</div>
                                            <div className={`text-[10px] font-normal mt-0.5 ${pdfMode === key ? 'text-yellow-600' : 'text-neutral-300'}`}>{desc}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Secciones — solo visible si hay datos */}
                            <div className={pdfMode === 'charts' ? 'opacity-40 pointer-events-none' : ''}>
                                <label className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-3 border-b border-yellow-400 block">Estadísticas a incluir</label>
                                <div className="grid grid-cols-5 gap-2">
                                    {[
                                        { key: 'incidencias', label: 'Incidencias' },
                                        { key: 'cronometraje', label: 'Cronometraje' },
                                        { key: 'rendimiento', label: 'Rend. Equipo' },
                                        { key: 'deudas', label: 'Deudas' },
                                    ].map(({ key, label }) => {
                                        const active = pdfSections.includes(key);
                                        return (
                                            <button
                                                key={key}
                                                onClick={() => toggleSection(key)}
                                                className={`py-1.5 rounded-lg text-xs font-bold border transition w-full ${active ? 'bg-yellow-100 text-yellow-700 border-yellow-300' : 'bg-white text-neutral-400 border-neutral-200 hover:border-neutral-300 hover:text-neutral-600'}`}
                                            >
                                                {label}
                                            </button>
                                        );
                                    })}
                                    <button
                                        onClick={() => setPdfSections(['incidencias', 'cronometraje', 'rendimiento', 'deudas'])}
                                        className={`py-1.5 rounded-lg text-xs font-bold border transition w-full ${pdfSections.length === 4 ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-400 border-neutral-200 hover:border-neutral-300 hover:text-neutral-600'}`}
                                    >
                                        Todas
                                    </button>
                                </div>
                            </div>

                            {/* Timeline — solo cuando hay datos de incidencias o deudas */}
                            {pdfMode !== 'charts' && (pdfSections.includes('incidencias') || pdfSections.includes('deudas')) && (
                                <div>
                                    <label className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-3 border-b border-yellow-400 block">Opciones adicionales</label>
                                    <button
                                        onClick={() => setPdfIncludeTimeline(v => !v)}
                                        className={`w-full flex items-center gap-3 py-2.5 px-3 rounded-lg text-xs font-bold border transition ${pdfIncludeTimeline ? 'bg-yellow-100 text-yellow-700 border-yellow-400' : 'bg-white text-neutral-400 border-neutral-200 hover:border-neutral-300 hover:text-neutral-600'}`}
                                    >
                                        <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition ${pdfIncludeTimeline ? 'bg-yellow-400 border-yellow-400' : 'border-neutral-300'}`}>
                                            {pdfIncludeTimeline && <svg className="w-2.5 h-2.5 text-neutral-900" fill="none" viewBox="0 0 10 10"><path d="M1.5 5l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                        </span>
                                        <span>Incluir mensajes del timeline en incidencias y deudas</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-5 py-3 border-t border-neutral-100 bg-neutral-50/40 flex justify-end gap-2 flex-wrap">
                            <button
                                onClick={() => setShowPdfModal(false)}
                                className="px-4 py-2 text-xs font-bold text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleGeneratePDF}
                                disabled={pdfSections.length === 0 || isGeneratingPDF}
                                className="px-6 py-2 bg-yellow-400 hover:bg-yellow-500 text-neutral-950 rounded-lg text-xs font-bold transition disabled:opacity-50 flex items-center gap-2 shadow-sm"
                            >
                                <FileDown className="w-3.5 h-3.5" />
                                Generar PDF
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
