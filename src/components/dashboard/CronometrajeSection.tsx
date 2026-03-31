'use client';

import { Timer, Clock, CheckCircle, TrendingUp } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, AreaChart, Area, Legend
} from 'recharts';
import KPICard from '@/components/KPICard';

interface CronoStats {
    totalSeconds: number;
    totalTasks: number;
    avgSeconds: number;
}

interface CronoChartData {
    cronoTopCommunities: { name: string; seconds: number; fullName: string }[];
    cronoByGestor: { name: string; tasks: number; seconds: number }[];
    cronoWeekly: { name: string; tasks: number; hours: number }[];
    cronoDistType: any[];
}

interface CronometrajeSectionProps {
    cronoStats: CronoStats;
    chartData: CronoChartData;
    embedded?: boolean;
}

function formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function CronometrajeSection({ cronoStats, chartData, embedded = false }: CronometrajeSectionProps) {
    return (
        <div className="space-y-6">
            {!embedded && (
                <div className="flex items-center gap-2">
                    <Timer className="w-5 h-5 text-yellow-500" />
                    <h2 className="text-lg md:text-xl font-bold text-neutral-900">Rendimiento de Cronometraje</h2>
                </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <KPICard
                    title="Total Horas"
                    value={`${Math.floor(cronoStats.totalSeconds / 3600)}h ${Math.floor((cronoStats.totalSeconds % 3600) / 60)}m`}
                    icon={Clock}
                    trend={`${cronoStats.totalTasks} tareas`}
                    color="border-yellow-400"
                    iconColor="text-yellow-500"
                />
                <KPICard
                    title="Tareas Realizadas"
                    value={String(cronoStats.totalTasks)}
                    icon={CheckCircle}
                    color="border-emerald-400"
                    iconColor="text-emerald-500"
                />
                <KPICard
                    title="Media por Tarea"
                    value={cronoStats.avgSeconds > 0 ? `${Math.floor(cronoStats.avgSeconds / 3600)}h ${Math.floor((cronoStats.avgSeconds % 3600) / 60)}m` : '0m'}
                    icon={TrendingUp}
                    color="border-slate-400"
                    iconColor="text-slate-500"
                />
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Communities by Time */}
                <div className="bg-white p-4 md:p-6 rounded-2xl border border-neutral-200 shadow-sm flex flex-col">
                    <h3 className="text-sm font-bold text-neutral-800 uppercase tracking-wider mb-4">Top Comunidades por Tiempo</h3>
                    {chartData.cronoTopCommunities.length === 0 ? (
                        <div className="h-40 flex items-center justify-center text-sm text-neutral-400">Sin datos</div>
                    ) : (
                        <div className="flex-1 min-h-[280px]" id="chart-crono-top-communities">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData.cronoTopCommunities} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                                    <XAxis
                                        type="number"
                                        tickFormatter={(v) => {
                                            const h = Math.floor(v / 3600);
                                            const m = Math.floor((v % 3600) / 60);
                                            return h > 0 ? `${h}h ${m}m` : `${m}m`;
                                        }}
                                        tick={{ fontSize: 11, fill: '#737373' }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#525252' }} axisLine={false} tickLine={false} width={120} />
                                    <Tooltip
                                        formatter={(value) => {
                                            const s = Math.round(Number(value ?? 0));
                                            return [formatTime(s), 'Tiempo'];
                                        }}
                                        labelFormatter={(label) => {
                                            const item = chartData.cronoTopCommunities.find(d => d.name === String(label));
                                            return item?.fullName || String(label);
                                        }}
                                        contentStyle={{ borderRadius: '8px', border: '1px solid #e5e5e5', fontSize: '12px' }}
                                    />
                                    <Bar dataKey="seconds" fill="#EAB308" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>

                {/* Performance by Gestor */}
                <div className="bg-white p-4 md:p-6 rounded-2xl border border-neutral-200 shadow-sm flex flex-col">
                    <h3 className="text-sm font-bold text-neutral-800 uppercase tracking-wider mb-4">Rendimiento por Gestor</h3>
                    {chartData.cronoByGestor.length === 0 ? (
                        <div className="h-40 flex items-center justify-center text-sm text-neutral-400">Sin datos</div>
                    ) : (
                        <div className="flex-1 min-h-[280px]" id="chart-crono-gestor">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData.cronoByGestor} margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#525252' }} axisLine={false} tickLine={false} />
                                    <YAxis
                                        yAxisId="left"
                                        tickFormatter={(v) => {
                                            const h = Math.floor(v / 3600);
                                            const m = Math.floor((v % 3600) / 60);
                                            return h > 0 ? `${h}h` : `${m}m`;
                                        }}
                                        tick={{ fontSize: 11, fill: '#737373' }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#737373' }} axisLine={false} tickLine={false} />
                                    <Tooltip
                                        formatter={(value, name) => {
                                            if (name === 'Tiempo') {
                                                const s = Math.round(Number(value ?? 0));
                                                return [formatTime(s), 'Tiempo'];
                                            }
                                            return [value ?? 0, String(name)];
                                        }}
                                        contentStyle={{ borderRadius: '8px', border: '1px solid #e5e5e5', fontSize: '12px' }}
                                    />
                                    <Legend />
                                    <Bar yAxisId="left" dataKey="seconds" name="Tiempo" fill="#EAB308" radius={[4, 4, 0, 0]} />
                                    <Bar yAxisId="right" dataKey="tasks" name="Tareas" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            </div>

            {/* Weekly Evolution */}
            <div className="bg-white p-4 md:p-6 rounded-2xl border border-neutral-200 shadow-sm">
                <h3 className="text-sm font-bold text-neutral-800 uppercase tracking-wider mb-4">Evolución Semanal de Horas</h3>
                {chartData.cronoWeekly.length === 0 ? (
                    <div className="h-40 flex items-center justify-center text-sm text-neutral-400">Sin datos</div>
                ) : (
                    <div className="h-64" id="chart-crono-weekly">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData.cronoWeekly} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="cronoGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#EAB308" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#EAB308" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#737373' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 11, fill: '#737373' }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    formatter={(value, name) => {
                                        if (name === 'Horas') return [`${value ?? 0}h`, 'Horas'];
                                        return [value ?? 0, String(name)];
                                    }}
                                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e5e5', fontSize: '12px' }}
                                />
                                <Legend />
                                <Area type="monotone" dataKey="hours" name="Horas" stroke="#EAB308" fill="url(#cronoGradient)" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {/* Distribución por Tipo de Tarea */}
            <div className="bg-white p-4 md:p-6 rounded-2xl border border-neutral-200 shadow-sm" id="chart-crono-dist-type">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <h3 className="text-sm font-bold text-neutral-800 uppercase tracking-wider">Distribución por Tipo de Tarea</h3>
                    <div className="flex flex-wrap gap-3">
                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#3b82f6]"></div><span className="text-[11px] text-neutral-500 font-medium">Documentación</span></div>
                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#22c55e]"></div><span className="text-[11px] text-neutral-500 font-medium">Contabilidad</span></div>
                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#ef4444]"></div><span className="text-[11px] text-neutral-500 font-medium">Incidencias</span></div>
                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#a855f7]"></div><span className="text-[11px] text-neutral-500 font-medium">Jurídico</span></div>
                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#06b6d4]"></div><span className="text-[11px] text-neutral-500 font-medium">Reunión</span></div>
                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#eab308]"></div><span className="text-[11px] text-neutral-500 font-medium">Contestar emails</span></div>
                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#8b5cf6]"></div><span className="text-[11px] text-neutral-500 font-medium">Llamada</span></div>
                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#f97316]"></div><span className="text-[11px] text-neutral-500 font-medium">Otros</span></div>
                    </div>
                </div>

                {!chartData.cronoDistType || chartData.cronoDistType.length === 0 ? (
                    <div className="h-40 flex items-center justify-center text-sm text-neutral-400">
                        Sin datos
                    </div>
                ) : (
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData.cronoDistType} margin={{ top: 0, right: 20, left: 0, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis 
                                    dataKey="name" 
                                    tick={{ fontSize: 11, fill: '#737373' }} 
                                    axisLine={false} 
                                    tickLine={false}
                                />
                                <YAxis
                                    tickFormatter={(v) => {
                                        const h = Math.floor(v / 3600);
                                        const m = Math.floor((v % 3600) / 60);
                                        if (h === 0 && m === 0) return '0m';
                                        return h > 0 ? `${h}h` : `${m}m`;
                                    }}
                                    tick={{ fontSize: 11, fill: '#737373' }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip
                                    formatter={(value: any, name: any) => [formatTime(Math.round(value)), name]}
                                    labelFormatter={(label: any) => {
                                        const item = chartData.cronoDistType.find((d: any) => d.name === label);
                                        return item?.fullName || label;
                                    }}
                                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e5e5', fontSize: '12px' }}
                                />
                                <Bar dataKey="Documentación" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                                <Bar dataKey="Contabilidad" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
                                <Bar dataKey="Incidencias" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} />
                                <Bar dataKey="Jurídico" stackId="a" fill="#a855f7" radius={[0, 0, 0, 0]} />
                                <Bar dataKey="Reunión" stackId="a" fill="#06b6d4" radius={[0, 0, 0, 0]} />
                                <Bar dataKey="Contestar emails" stackId="a" fill="#eab308" radius={[0, 0, 0, 0]} />
                                <Bar dataKey="Llamada" stackId="a" fill="#8b5cf6" radius={[0, 0, 0, 0]} />
                                <Bar dataKey="Otros" stackId="a" fill="#f97316" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        </div>
    );
}
