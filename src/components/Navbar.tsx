'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Timer, Play, Square } from 'lucide-react';
import StartTaskModal from '@/components/cronometraje/StartTaskModal';
import { logActivity } from '@/lib/logActivity';
import { toast } from 'react-hot-toast';

interface ActiveTask {
    id: number;
    start_at: string;
    nota?: string;
    comunidades?: { nombre_cdad: string; codigo?: string };
}

interface ActiveFichaje {
    id: number;
    start_at: string;
}

export default function Navbar() {
    const [stats, setStats] = useState({ comunidades: 0, incidencias: 0, morosidad: 0 });
    const [showStartTaskModal, setShowStartTaskModal] = useState(false);
    
    // Task Timer State
    const [dashActiveTask, setDashActiveTask] = useState<ActiveTask | null>(null);
    const [dashElapsed, setDashElapsed] = useState(0);
    const [stopping, setStopping] = useState(false);

    // Fichaje State
    const [dashActiveFichaje, setDashActiveFichaje] = useState<ActiveFichaje | null>(null);
    const [fichajeElapsed, setFichajeElapsed] = useState(0);
    const [fichajeLoading, setFichajeLoading] = useState(false);

    const fetchActiveTask = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
            .from('task_timers')
            .select('id, start_at, nota, comunidades(nombre_cdad, codigo)')
            .eq('user_id', user.id)
            .is('end_at', null)
            .maybeSingle();
        const taskData = data as any;
        if (taskData && Array.isArray(taskData.comunidades)) {
            taskData.comunidades = taskData.comunidades[0];
        }
        setDashActiveTask(taskData || null);
        if (data) {
            setDashElapsed(Math.floor((Date.now() - new Date(data.start_at).getTime()) / 1000));
        }
    }, []);

    const fetchActiveFichaje = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
            .from('time_entries')
            .select('id, start_at')
            .eq('user_id', user.id)
            .is('end_at', null)
            .order('start_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        setDashActiveFichaje(data || null);
        if (data) {
            setFichajeElapsed(Math.floor((Date.now() - new Date(data.start_at).getTime()) / 1000));
        }
    }, []);

    useEffect(() => {
        fetchStats();
        fetchActiveTask();
        fetchActiveFichaje();

        const handleTaskChange = () => fetchActiveTask();
        const handleFichajeChange = () => fetchActiveFichaje();
        const handleCommunitiesChange = () => fetchStats();

        window.addEventListener('taskTimerChanged', handleTaskChange);
        window.addEventListener('fichajeChanged', handleFichajeChange);
        window.addEventListener('communitiesChanged', handleCommunitiesChange);

        return () => {
            window.removeEventListener('taskTimerChanged', handleTaskChange);
            window.removeEventListener('fichajeChanged', handleFichajeChange);
            window.removeEventListener('communitiesChanged', handleCommunitiesChange);
        };
    }, [fetchActiveTask, fetchActiveFichaje]);

    useEffect(() => {
        if (!dashActiveTask) return;
        const iv = setInterval(() => setDashElapsed(p => p + 1), 1000);
        return () => clearInterval(iv);
    }, [dashActiveTask]);

    // Fichaje live ticker
    useEffect(() => {
        if (!dashActiveFichaje) return;
        const iv = setInterval(() => setFichajeElapsed(p => p + 1), 1000);
        return () => clearInterval(iv);
    }, [dashActiveFichaje]);

    const handleStopTask = async () => {
        setStopping(true);
        try {
            const { data, error } = await supabase.rpc('stop_task_timer');
            if (error) throw error;

            await logActivity({
                action: 'stop_task',
                entityType: 'task_timer',
                entityId: data?.id,
                entityName: dashActiveTask?.comunidades?.nombre_cdad || 'Todas las comunidades',
                details: {
                    duration: formatDashElapsed(data?.duration_seconds || 0),
                    nota: dashActiveTask?.nota || null,
                },
            });

            toast.success('Tarea finalizada');
            setDashActiveTask(null);
            setDashElapsed(0);
            window.dispatchEvent(new Event('taskTimerChanged'));
            await fetchActiveTask();
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Error al parar la tarea';
            toast.error(msg);
        } finally {
            setStopping(false);
        }
    };

    const handleClockIn = async () => {
        setFichajeLoading(true);
        try {
            const { error } = await supabase.rpc('clock_in', { _note: 'Fichaje rápido (Navbar)' });
            if (error) throw error;

            await logActivity({
                action: 'clock_in',
                entityType: 'fichaje',
                details: { note: 'Fichaje rápido (Navbar)' }
            });

            toast.success('Fichaje de entrada registrado');
            window.dispatchEvent(new Event('fichajeChanged'));
            await fetchActiveFichaje();
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Error al fichar entrada';
            toast.error(msg);
        } finally {
            setFichajeLoading(false);
        }
    };

    const handleClockOut = async () => {
        setFichajeLoading(true);
        try {
            const { error } = await supabase.rpc('clock_out');
            if (error) throw error;

            let durationText = '';
            if (dashActiveFichaje) {
                const start = new Date(dashActiveFichaje.start_at).getTime();
                const end = Date.now();
                const diff = Math.floor((end - start) / 1000);
                durationText = formatDashElapsed(diff);
            }

            await logActivity({
                action: 'clock_out',
                entityType: 'fichaje',
                details: { duration: durationText }
            });

            toast.success('Fichaje de salida registrado');
            setDashActiveFichaje(null);
            setFichajeElapsed(0);
            window.dispatchEvent(new Event('fichajeChanged'));
            await fetchActiveFichaje();
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Error al fichar salida';
            toast.error(msg);
        } finally {
            setFichajeLoading(false);
        }
    };

    const fetchStats = async () => {
        const [com, inc, mor, sofia] = await Promise.all([
            supabase.from('comunidades').select('id', { count: 'exact', head: true }),
            supabase.from('incidencias').select('id', { count: 'exact', head: true }).eq('resuelto', false).or('estado.neq.Resuelto,estado.is.null'),
            supabase.from('morosidad').select('id', { count: 'exact', head: true }).eq('estado', 'Pendiente'),
            supabase.from('incidencias_serincobot').select('id', { count: 'exact', head: true }).eq('resuelto', false),
        ]);

        setStats({
            comunidades: com.count || 0,
            incidencias: (inc.count || 0) + (sofia.count || 0),
            morosidad: mor.count || 0,
        });
    };

    const formatDashElapsed = (s: number) => {
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    };

    return (
        <nav aria-label="Panel de control" className="flex flex-col gap-2 w-full md:flex-row md:items-center md:justify-end md:gap-x-6">
            {showStartTaskModal && (
                <StartTaskModal
                    onClose={() => setShowStartTaskModal(false)}
                    onStarted={() => { setShowStartTaskModal(false); fetchActiveTask(); }}
                />
            )}
            
            {/* Timer row — stacks vertically on mobile, inline on desktop */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto md:flex-nowrap">
                {/* Quick-Start Fichaje */}
                <div className="flex items-center min-w-0">
                    {dashActiveFichaje ? (
                        <div className="flex items-center gap-1.5 sm:gap-2 bg-yellow-50 border border-yellow-200 pl-2 sm:pl-3 pr-1 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm shadow-sm" role="status" aria-label="Fichaje activo">
                            <Timer className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-600 animate-pulse flex-shrink-0" aria-hidden="true" />
                            <span className="hidden sm:inline font-mono font-bold text-yellow-700 tabular-nums">{formatDashElapsed(fichajeElapsed)}</span>
                            <div className="flex items-center ml-0.5 sm:ml-1 border-l border-yellow-200 pl-1.5 sm:pl-2">
                                <a href="/dashboard/fichaje" className="px-1.5 sm:px-2 py-1 text-[10px] sm:text-xs text-yellow-700 hover:bg-yellow-100 rounded transition whitespace-nowrap" aria-label="Ver fichaje">Ver →</a>
                                <button
                                    onClick={handleClockOut}
                                    disabled={fichajeLoading}
                                    aria-label="Fichar salida"
                                    className="flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-1 ml-0.5 sm:ml-1 text-[10px] sm:text-xs font-bold bg-neutral-900 text-white hover:bg-neutral-800 rounded transition disabled:opacity-50"
                                >
                                    {fichajeLoading ? (
                                        <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <Square className="w-3 h-3" aria-hidden="true" />
                                    )}
                                    <span className="hidden xs:inline">Salir</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={handleClockIn}
                            disabled={fichajeLoading}
                            aria-label="Fichar entrada"
                            className="flex items-center gap-1.5 sm:gap-2 bg-yellow-400 hover:bg-yellow-500 text-neutral-950 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition shadow-sm disabled:opacity-50"
                        >
                            {fichajeLoading ? (
                                <div className="w-3.5 h-3.5 border-2 border-neutral-900/30 border-t-neutral-900 rounded-full animate-spin" />
                            ) : (
                                <Play className="w-3 h-3 sm:w-3.5 sm:h-3.5" aria-hidden="true" />
                            )}
                            <span className="hidden sm:inline">Fichar</span> Entrada
                        </button>
                    )}
                </div>

                {/* Quick-Start Task Timer */}
                <div className="flex items-center ml-auto md:ml-0 min-w-0">
                    {dashActiveTask ? (
                        <div className="flex items-center gap-1.5 sm:gap-2 bg-yellow-50 border border-yellow-200 pl-2 sm:pl-3 pr-1 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm shadow-sm" role="status" aria-label="Tarea activa">
                            <Timer className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-600 animate-pulse flex-shrink-0" aria-hidden="true" />
                            <span className="hidden sm:inline font-mono font-bold text-yellow-700 tabular-nums">{formatDashElapsed(dashElapsed)}</span>
                            <div className="flex items-center ml-0.5 sm:ml-1 border-l border-yellow-200 pl-1.5 sm:pl-2">
                                <span className="px-1.5 sm:px-2 font-semibold text-yellow-800 hidden lg:inline-block max-w-[160px] xl:max-w-[200px] truncate text-xs">
                                    {dashActiveTask.comunidades 
                                        ? `${dashActiveTask.comunidades.codigo} – ${dashActiveTask.comunidades.nombre_cdad}`
                                        : 'TODAS'
                                    }
                                </span>
                                <a href="/dashboard/cronometraje" className="px-1.5 sm:px-2 py-1 text-[10px] sm:text-xs text-yellow-700 hover:bg-yellow-100 rounded transition whitespace-nowrap" aria-label="Ver cronometraje">Ver →</a>
                                <button 
                                    onClick={handleStopTask}
                                    disabled={stopping}
                                    aria-label="Parar tarea"
                                    className="flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-1 ml-0.5 sm:ml-1 text-[10px] sm:text-xs font-bold bg-neutral-900 text-white hover:bg-neutral-800 rounded transition disabled:opacity-50"
                                >
                                    {stopping ? (
                                        <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <Square className="w-3 h-3" aria-hidden="true" />
                                    )}
                                    <span className="hidden xs:inline">Parar</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowStartTaskModal(true)}
                            aria-label="Empezar tarea"
                            className="flex items-center gap-1.5 sm:gap-2 bg-yellow-400 hover:bg-yellow-500 text-neutral-950 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition shadow-sm"
                        >
                            <Play className="w-3 h-3 sm:w-3.5 sm:h-3.5" aria-hidden="true" />
                            <span className="hidden sm:inline">Empezar</span> Tarea
                        </button>
                    )}
                </div>
            </div>

            {/* Stats — collapses to compact badges on mobile */}
            <div className="flex items-center gap-3 sm:gap-4 md:gap-6 text-[10px] sm:text-xs md:text-sm justify-end">
                <div className="flex items-center gap-1.5 text-neutral-600" aria-label={`${stats.comunidades} comunidades`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" aria-hidden="true"></span>
                    <span className="font-medium hidden sm:inline">Comunidades:</span>
                    <span className="font-medium sm:hidden">Cdad:</span>
                    <span className="font-bold text-neutral-900">{stats.comunidades}</span>
                </div>
                <div className="flex items-center gap-1.5 text-neutral-600" aria-label={`${stats.incidencias} tickets abiertos`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" aria-hidden="true"></span>
                    <span className="font-medium hidden sm:inline">Tickets:</span>
                    <span className="font-medium sm:hidden">Tck:</span>
                    <span className="font-bold text-neutral-900">{stats.incidencias}</span>
                </div>
                <div className="flex items-center gap-1.5 text-neutral-600" aria-label={`${stats.morosidad} deudas pendientes`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 flex-shrink-0" aria-hidden="true"></span>
                    <span className="font-medium hidden sm:inline">Deudas:</span>
                    <span className="font-medium sm:hidden">Deu:</span>
                    <span className="font-bold text-neutral-900">{stats.morosidad}</span>
                </div>
            </div>
        </nav>
    );
}
