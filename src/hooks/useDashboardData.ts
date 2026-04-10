'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

// ---- Types ----

export interface DashboardStats {
    totalComunidades: number;
    incidenciasPendientes: number;
    incidenciasAplazadas: number;
    incidenciasResueltas: number;
    totalDeuda: number;
    deudaRecuperada: number;
}

export interface CronoStats {
    totalSeconds: number;
    totalTasks: number;
    avgSeconds: number;
}

export interface Community {
    id: string;
    nombre_cdad: string;
    codigo: string;
}

export interface ChartData {
    incidenciasEvolution: { date: string; count: number; aplazadas: number; total: number }[];
    urgencyDistribution: { name: string; value: number }[];
    topComunidades: { name: string; count: number }[];
    userPerformance: { name: string; assigned: number; resolved: number; pending: number; efficiency: number }[];
    debtByCommunity: { name: string; value: number }[];
    debtStatus: { name: string; value: number }[];
    incidenciasStatus: { name: string; value: number }[];
    sentimentDistribution: { name: string; value: number }[];
    cronoTopCommunities: { name: string; seconds: number; fullName: string }[];
    cronoByGestor: { name: string; tasks: number; seconds: number }[];
    cronoWeekly: { name: string; tasks: number; hours: number }[];
    cronoDistType: Record<string, unknown>[];
}

const EMPTY_CHART_DATA: ChartData = {
    incidenciasEvolution: [],
    urgencyDistribution: [],
    topComunidades: [],
    userPerformance: [],
    debtByCommunity: [],
    debtStatus: [],
    incidenciasStatus: [],
    sentimentDistribution: [],
    cronoTopCommunities: [],
    cronoByGestor: [],
    cronoWeekly: [],
    cronoDistType: [],
};

// ---- Hook ----

export function useDashboardData() {
    const [stats, setStats] = useState<DashboardStats>({
        totalComunidades: 0,
        incidenciasPendientes: 0,
        incidenciasAplazadas: 0,
        incidenciasResueltas: 0,
        totalDeuda: 0,
        deudaRecuperada: 0,
    });

    const [cronoStats, setCronoStats] = useState<CronoStats>({
        totalSeconds: 0,
        totalTasks: 0,
        avgSeconds: 0,
    });

    const [chartData, setChartData] = useState<ChartData>(EMPTY_CHART_DATA);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState('all');
    const [communities, setCommunities] = useState<Community[]>([]);
    const [selectedCommunity, setSelectedCommunity] = useState<string>('all');
    const [isInitialized, setIsInitialized] = useState(false);

    // Load saved community filter on mount
    useEffect(() => {
        const savedCommunity = localStorage.getItem('dashboard_community');
        if (savedCommunity) setSelectedCommunity(savedCommunity);
        setIsInitialized(true);
    }, []);

    const changePeriod = (newPeriod: string) => setPeriod(newPeriod);

    const changeCommunity = (commId: string) => {
        setSelectedCommunity(commId || 'all');
        localStorage.setItem('dashboard_community', commId || 'all');
    };

    const fetchDashboardData = useCallback(async () => {
        setLoading(true);
        try {
            // ── Build date filter ───────────────────────────────────────────────
            const dateFilter = period !== 'all'
                ? (() => { const d = new Date(); d.setDate(d.getDate() - parseInt(period)); return d.toISOString(); })()
                : null;

            // ── Build incidencias query ─────────────────────────────────────────
            let incQuery = supabase.from('incidencias').select(`
                id, created_at, resuelto, dia_resuelto, urgencia, sentimiento, gestor_asignado, comunidad_id, estado,
                comunidades (nombre_cdad),
                profiles:gestor_asignado (nombre)
            `);
            if (dateFilter) incQuery = incQuery.or(`resuelto.eq.false,dia_resuelto.gte.${dateFilter},created_at.gte.${dateFilter}`);
            if (selectedCommunity !== 'all') incQuery = incQuery.eq('comunidad_id', selectedCommunity);

            // ── Build morosidad query ───────────────────────────────────────────
            let morQuery = supabase.from('morosidad').select('importe, estado, comunidad_id, created_at, comunidades(nombre_cdad)');
            if (dateFilter) morQuery = morQuery.gte('created_at', dateFilter);
            if (selectedCommunity !== 'all') morQuery = morQuery.eq('comunidad_id', selectedCommunity);

            // ── Build count queries ─────────────────────────────────────────────
            let pendientesQuery = supabase.from('incidencias').select('*', { count: 'exact', head: true })
                .eq('resuelto', false).or('and(estado.neq.Aplazado,estado.neq.Resuelto),estado.is.null');
            let aplazadasQuery = supabase.from('incidencias').select('*', { count: 'exact', head: true })
                .eq('resuelto', false).eq('estado', 'Aplazado');
            if (dateFilter) {
                pendientesQuery = pendientesQuery.gte('created_at', dateFilter);
                aplazadasQuery = aplazadasQuery.gte('created_at', dateFilter);
            }
            if (selectedCommunity !== 'all') {
                pendientesQuery = pendientesQuery.eq('comunidad_id', selectedCommunity);
                aplazadasQuery = aplazadasQuery.eq('comunidad_id', selectedCommunity);
            }

            // ── Build pending tickets chart query ───────────────────────────────
            let pendingChartQuery = supabase.from('incidencias')
                .select('urgencia, sentimiento, comunidad_id, comunidades(nombre_cdad)')
                .eq('resuelto', false);
            if (dateFilter) pendingChartQuery = pendingChartQuery.gte('created_at', dateFilter);
            if (selectedCommunity !== 'all') pendingChartQuery = pendingChartQuery.eq('comunidad_id', selectedCommunity);

            // ── Build cronometraje query ────────────────────────────────────────
            let cronoQuery = supabase.from('task_timers')
                .select('id, user_id, comunidad_id, start_at, duration_seconds, tipo_tarea, comunidades(nombre_cdad, codigo), profiles(nombre)')
                .not('duration_seconds', 'is', null);
            if (dateFilter) cronoQuery = cronoQuery.gte('start_at', dateFilter);
            if (selectedCommunity !== 'all') cronoQuery = cronoQuery.eq('comunidad_id', selectedCommunity);

            // ── Fire all independent queries in parallel ────────────────────────
            const [
                { data: incidencias, error: incError },
                { data: morosidad, error: morError },
                { data: profiles },
                { data: sofiaData },
                { count: countPendientes },
                { count: countAplazadas },
                { data: pendingTickets },
                { data: taskTimers },
                { data: allCommunities },
                { count: countComunidades },
            ] = await Promise.all([
                incQuery.limit(5000),
                morQuery,
                supabase.from('profiles').select('nombre'),
                supabase.from('incidencias_serincobot').select('resuelto, estado'),
                pendientesQuery,
                aplazadasQuery,
                pendingChartQuery,
                cronoQuery.limit(2000),
                supabase.from('comunidades').select('id, nombre_cdad, codigo').order('codigo', { ascending: true }),
                supabase.from('comunidades').select('*', { count: 'exact', head: true }),
            ]);

            if (incError) throw incError;
            if (morError) throw morError;

            // Update communities list (replaces the separate fetchCommunities call)
            if (allCommunities) setCommunities(allCommunities);

            // ── Sofia stats ────────────────────────────────────────────────────
            const sofiaTotal = sofiaData?.length || 0;
            const sofiaResueltas = sofiaData?.filter(i => i.resuelto).length || 0;
            const sofiaAplazadas = sofiaData?.filter(i => !i.resuelto && i.estado === 'Aplazado').length || 0;
            const sofiaPendientes = sofiaData?.filter(i => !i.resuelto && i.estado !== 'Aplazado').length || 0;

            const resueltas = incidencias?.filter(i => i.resuelto).length || 0;
            const pendientes = countPendientes || 0;
            const aplazadas = countAplazadas || 0;

            const totalDeuda = morosidad?.filter(m => m.estado === 'Pendiente').reduce((acc, curr) => acc + (curr.importe || 0), 0) || 0;
            const deudaPagada = morosidad?.filter(m => m.estado === 'Pagado').reduce((acc, curr) => acc + (curr.importe || 0), 0) || 0;

            setStats({
                totalComunidades: countComunidades || 0,
                incidenciasPendientes: pendientes + sofiaPendientes,
                incidenciasAplazadas: aplazadas + sofiaAplazadas,
                incidenciasResueltas: resueltas + sofiaResueltas,
                totalDeuda,
                deudaRecuperada: deudaPagada,
            });

            // ── Charts: Evolution ──────────────────────────────────────────────
            const daysToShow = period === 'all' ? 30 : parseInt(period);
            const createdMap = new Map<string, number>();
            const resolvedMap = new Map<string, number>();
            const aplazadasMap = new Map<string, number>();

            incidencias?.forEach(inc => {
                const cDate = new Date(inc.created_at).toLocaleDateString();
                createdMap.set(cDate, (createdMap.get(cDate) || 0) + 1);
                if (inc.dia_resuelto) {
                    const rDate = new Date(inc.dia_resuelto).toLocaleDateString();
                    resolvedMap.set(rDate, (resolvedMap.get(rDate) || 0) + 1);
                }
                if ((inc as Record<string, unknown>).estado === 'Aplazado') {
                    const aDate = new Date(inc.created_at).toLocaleDateString();
                    aplazadasMap.set(aDate, (aplazadasMap.get(aDate) || 0) + 1);
                }
            });

            let runningPending = pendientes;
            let runningAplazadas = aplazadas;
            const evolutionData = [];
            for (let i = 0; i < daysToShow; i++) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dateStr = d.toLocaleDateString();
                evolutionData.push({ date: dateStr, count: runningPending, aplazadas: runningAplazadas, total: runningPending + runningAplazadas });
                const createdCount = createdMap.get(dateStr) || 0;
                const resolvedCount = resolvedMap.get(dateStr) || 0;
                const aplazadasCount = aplazadasMap.get(dateStr) || 0;
                runningPending = Math.max(0, runningPending - (createdCount - resolvedCount));
                runningAplazadas = Math.max(0, runningAplazadas - aplazadasCount);
            }
            evolutionData.reverse();

            // ── Charts: Urgency & Sentiment ────────────────────────────────────
            const urgencyMap: Record<string, number> = { 'Alta': 0, 'Media': 0, 'Baja': 0 };
            const sentimentMap: Record<string, number> = {};
            pendingTickets?.forEach(inc => {
                if (inc.urgencia && Object.hasOwn(urgencyMap, inc.urgencia)) urgencyMap[inc.urgencia]++;
                const sent = inc.sentimiento || 'Neutral';
                sentimentMap[sent] = (sentimentMap[sent] || 0) + 1;
            });
            const urgencyData = Object.entries(urgencyMap).map(([name, value]) => ({ name, value }));
            const sentimentData = Object.entries(sentimentMap)
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value);

            // ── Charts: Top Comunidades ────────────────────────────────────────
            const comMap = new Map<string, number>();
            pendingTickets?.forEach(inc => {
                const com = inc.comunidades as unknown as Record<string, unknown>;
                const name = com?.nombre_cdad as string || 'Desconocida';
                comMap.set(name, (comMap.get(name) || 0) + 1);
            });
            const topComunidades = Array.from(comMap.entries())
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);

            // ── Table: User Performance ────────────────────────────────────────
            const userMap = new Map<string, { assigned: number; resolved: number }>();
            profiles?.forEach(p => { if (p.nombre) userMap.set(p.nombre, { assigned: 0, resolved: 0 }); });
            incidencias?.forEach(inc => {
                const profileData = (inc as Record<string, unknown>).profiles;
                const profile = Array.isArray(profileData) ? profileData[0] : profileData;
                const userName = (profile as Record<string, unknown>)?.nombre as string || 'Sin Asignar';
                const current = userMap.get(userName) || { assigned: 0, resolved: 0 };
                current.assigned++;
                if (inc.resuelto) current.resolved++;
                userMap.set(userName, current);
            });
            const userPerformance = Array.from(userMap.entries()).map(([name, data]) => {
                const finalData = { ...data };
                if (name === 'Sofia-Bot') { finalData.assigned += sofiaTotal; finalData.resolved += sofiaResueltas; }
                return { name, ...finalData, pending: finalData.assigned - finalData.resolved, efficiency: finalData.assigned > 0 ? Math.round((finalData.resolved / finalData.assigned) * 100) : 0 };
            });

            // ── Charts: Debt ───────────────────────────────────────────────────
            const debtByCom = new Map<string, number>();
            morosidad?.forEach(m => {
                if (m.estado !== 'Pagado') {
                    const mCom = m.comunidades as unknown as Record<string, unknown>;
                    const name = mCom?.nombre_cdad as string || 'Desconocida';
                    debtByCom.set(name, (debtByCom.get(name) || 0) + (m.importe || 0));
                }
            });
            const debtByCommunity = Array.from(debtByCom.entries())
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 5);
            const debtStatusMap: Record<string, number> = { 'Pendiente': 0, 'Pagado': 0 };
            morosidad?.forEach(m => { if (m.estado && Object.hasOwn(debtStatusMap, m.estado)) debtStatusMap[m.estado] += (m.importe || 0); });
            const debtStatus = Object.entries(debtStatusMap).map(([name, value]) => ({ name, value }));

            // ── Cronometraje stats ─────────────────────────────────────────────
            const cronoTotalSeconds = taskTimers?.reduce((acc, t) => acc + (t.duration_seconds || 0), 0) || 0;
            const cronoTotalTasks = taskTimers?.length || 0;
            setCronoStats({
                totalSeconds: cronoTotalSeconds,
                totalTasks: cronoTotalTasks,
                avgSeconds: cronoTotalTasks > 0 ? Math.round(cronoTotalSeconds / cronoTotalTasks) : 0,
            });

            // ── Crono: Top communities (reuse allCommunities from Promise.all) ──
            const communityNames = new Map<number, string>();
            allCommunities?.forEach(c => communityNames.set(c.id, c.nombre_cdad));

            let cronoSharedSeconds = 0;
            const cronoSpecificMap = new Map<string, number>();
            taskTimers?.forEach(t => {
                if (!t.duration_seconds) return;
                if (t.comunidad_id === null) {
                    cronoSharedSeconds += t.duration_seconds;
                } else {
                    const tCom = t.comunidades as unknown as Record<string, unknown>;
                    const name = tCom?.nombre_cdad as string || communityNames.get(t.comunidad_id) || 'Desconocida';
                    cronoSpecificMap.set(name, (cronoSpecificMap.get(name) || 0) + t.duration_seconds);
                }
            });

            const totalComms = communityNames.size || 1;
            const perCommShare = Math.floor(cronoSharedSeconds / totalComms);
            const cronoCommunityMap = new Map<string, number>();
            communityNames.forEach(name => {
                const total = (cronoSpecificMap.get(name) || 0) + perCommShare;
                if (total > 0) cronoCommunityMap.set(name, total);
            });
            const cronoTopCommunities = Array.from(cronoCommunityMap.entries())
                .map(([name, seconds]) => ({ name: name.length > 15 ? name.slice(0, 15) + '...' : name, seconds, fullName: name }))
                .sort((a, b) => b.seconds - a.seconds)
                .slice(0, 10);

            // ── Crono: By gestor ───────────────────────────────────────────────
            const cronoGestorMap = new Map<string, { tasks: number; seconds: number }>();
            taskTimers?.forEach(t => {
                const tProf = t.profiles as unknown as Record<string, unknown>;
                const name = tProf?.nombre as string || 'Sin asignar';
                const existing = cronoGestorMap.get(name) || { tasks: 0, seconds: 0 };
                existing.tasks++;
                existing.seconds += t.duration_seconds || 0;
                cronoGestorMap.set(name, existing);
            });
            const cronoByGestor = Array.from(cronoGestorMap.entries())
                .map(([name, data]) => ({ name, tasks: data.tasks, seconds: data.seconds }))
                .sort((a, b) => b.seconds - a.seconds);

            // ── Crono: Weekly evolution ────────────────────────────────────────
            const cronoWeekMap = new Map<string, { tasks: number; seconds: number }>();
            taskTimers?.forEach(t => {
                const d = new Date(t.start_at);
                const weekStart = new Date(d);
                weekStart.setDate(d.getDate() - ((d.getDay() + 6) % 7));
                const key = weekStart.toISOString().slice(0, 10);
                const existing = cronoWeekMap.get(key) || { tasks: 0, seconds: 0 };
                existing.tasks++;
                existing.seconds += t.duration_seconds || 0;
                cronoWeekMap.set(key, existing);
            });
            const cronoWeekly = Array.from(cronoWeekMap.entries())
                .map(([week, data]) => {
                    const d = new Date(week);
                    return { name: d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }), tasks: data.tasks, hours: Math.round((data.seconds / 3600) * 100) / 100 };
                })
                .sort((a, b) => a.name.localeCompare(b.name));

            // ── Crono: Task type distribution ──────────────────────────────────
            const taskTypesList = ['Documentación', 'Contabilidad', 'Incidencias', 'Jurídico', 'Reunión', 'Contestar emails', 'Llamada', 'Otros'];
            const compDistMap = new Map<string, Record<string, number>>();
            allCommunities?.forEach(c => {
                const initial: Record<string, number> = {};
                taskTypesList.forEach(type => { initial[type] = 0; });
                compDistMap.set(String(c.id), initial);
            });
            taskTimers?.forEach(t => {
                const duration = t.duration_seconds || 0;
                if (duration === 0) return;
                let typeStr = t.tipo_tarea || 'Otros';
                if (typeStr.startsWith('Otros:') || !taskTypesList.includes(typeStr)) typeStr = 'Otros';
                if (t.comunidad_id === null) {
                    const share = duration / (allCommunities?.length || 1);
                    allCommunities?.forEach(c => {
                        const row = compDistMap.get(String(c.id));
                        if (row) row[typeStr] = (row[typeStr] || 0) + share;
                    });
                } else {
                    const row = compDistMap.get(String(t.comunidad_id));
                    if (row) row[typeStr] = (row[typeStr] || 0) + duration;
                }
            });
            const cronoDistType = Array.from(compDistMap.entries()).map(([id, types]) => {
                const comm = allCommunities?.find(c => String(c.id) === id);
                const total = Object.values(types).reduce((a, b) => a + b, 0);
                return { name: comm?.codigo || '?', fullName: comm ? `${comm.codigo} - ${comm.nombre_cdad}` : '?', ...types, total };
            }).filter(d => d.total > 0).sort((a, b) => b.total - a.total).slice(0, 15);

            setChartData({
                incidenciasEvolution: evolutionData,
                urgencyDistribution: urgencyData,
                topComunidades,
                userPerformance,
                debtByCommunity,
                debtStatus,
                incidenciasStatus: [
                    { name: 'Resuelta', value: resueltas },
                    { name: 'Pendiente', value: pendientes },
                    { name: 'Aplazada', value: aplazadas },
                ],
                sentimentDistribution: sentimentData,
                cronoTopCommunities,
                cronoByGestor,
                cronoWeekly,
                cronoDistType,
            });

        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    }, [period, selectedCommunity]);

    // Subscribe to realtime — debounced to avoid full refetch on every row change
    useEffect(() => {
        if (!isInitialized) return;

        fetchDashboardData();

        let debounceTimer: ReturnType<typeof setTimeout>;
        const debouncedFetch = () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => fetchDashboardData(), 2000);
        };

        const channel = supabase
            .channel('dashboard-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'incidencias' }, debouncedFetch)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'morosidad' }, debouncedFetch)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'comunidades' }, debouncedFetch)
            .subscribe();

        return () => {
            clearTimeout(debounceTimer);
            supabase.removeChannel(channel);
        };
    }, [isInitialized, fetchDashboardData]);

    return {
        stats,
        cronoStats,
        chartData,
        loading,
        period,
        communities,
        selectedCommunity,
        changePeriod,
        changeCommunity,
    };
}
