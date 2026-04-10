'use client';

/**
 * DashboardCharts — recharts loaded lazily via dynamic import.
 * All recharts components live here so they are excluded from the initial bundle.
 */

import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, BarChart, Bar, Legend,
} from 'recharts';
import type { ChartData } from '@/hooks/useDashboardData';

const COLORS = ['#FF8042', '#FFBB28', '#00C49F'];
const SENTIMENT_COLORS: Record<string, string> = {
    'Negativo': '#FF8042',
    'Neutral': '#FFBB28',
    'Positivo': '#00C49F',
};

interface DashboardChartsProps {
    chartData: ChartData;
    selectedCommunity: string;
    visibleLines: { pendientes: boolean; aplazadas: boolean; total: boolean };
}

export default function DashboardCharts({ chartData, selectedCommunity, visibleLines }: DashboardChartsProps) {
    return (
        <>
            {/* ── Evolución de incidencias ──────────────────────────────────── */}
            <div className="h-[220px] w-full">
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

            {/* ── Distribuciones (Estado / Urgencia / Sentimiento / Deuda) ──── */}
            <div className={`grid grid-cols-1 ${selectedCommunity === 'all' ? 'sm:grid-cols-3' : 'sm:grid-cols-4'} gap-4 mt-6`}>
                {[
                    {
                        label: 'Estado', data: chartData.incidenciasStatus,
                        colorFn: (e: { name: string }) => e.name === 'Resuelta' ? '#10b981' : e.name === 'Aplazada' ? '#f97316' : '#eab308',
                    },
                    {
                        label: 'Urgencia', data: chartData.urgencyDistribution,
                        colorFn: (_: unknown, i: number) => COLORS[i % COLORS.length],
                    },
                    {
                        label: 'Sentimiento', data: chartData.sentimentDistribution,
                        colorFn: (e: { name: string }) => SENTIMENT_COLORS[e.name] || '#94a3b8',
                    },
                    ...(selectedCommunity !== 'all' ? [{
                        label: 'Estado Deuda', data: chartData.debtStatus,
                        colorFn: (e: { name: string }) => e.name === 'Pagado' ? '#10b981' : '#eab308',
                    }] : []),
                ].map(({ label, data, colorFn }) => (
                    <div key={label}>
                        <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-2">{label}</p>
                        <div className="h-[200px]">
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

            {/* ── Top comunidades ───────────────────────────────────────────── */}
            {selectedCommunity === 'all' && (
                <div className="mt-6 pt-6 border-t border-neutral-100">
                    <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-3">Top comunidades</p>
                    <div className="h-[220px]">
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

            {/* ── Deudas ────────────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-3">Deuda por comunidad</p>
                    <div className="h-[260px]">
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
                    <div className="h-[260px]">
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
        </>
    );
}
