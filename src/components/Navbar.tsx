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
    const [showClockOutConfirm, setShowClockOutConfirm] = useState(false);

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
        <nav aria-label="Panel de control" className="flex items-center gap-2 w-full md:justify-end md:gap-x-6">
            {showStartTaskModal && (
                <StartTaskModal
                    onClose={() => setShowStartTaskModal(false)}
                    onStarted={() => { setShowStartTaskModal(false); fetchActiveTask(); }}
                />
            )}

            {/* Modal confirmación fichaje salida */}
            {showClockOutConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowClockOutConfirm(false)}>
                    <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-neutral-900 mb-2">Cerrar fichaje</h3>
                        <p className="text-sm text-neutral-600 mb-1">
                            ¿Estás seguro de que quieres cerrar el fichaje?
                        </p>
                        {dashActiveFichaje && (
                            <p className="text-sm text-neutral-500 mb-4">
                                Tiempo registrado: <span className="font-mono font-bold text-neutral-700">{formatDashElapsed(fichajeElapsed)}</span>
                            </p>
                        )}
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setShowClockOutConfirm(false)}
                                className="px-4 py-2 text-sm font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={async () => { setShowClockOutConfirm(false); await handleClockOut(); }}
                                disabled={fichajeLoading}
                                className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition disabled:opacity-50"
                            >
                                {fichajeLoading ? 'Cerrando...' : 'Sí, cerrar fichaje'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Botones fichaje + tarea — siempre en fila */}
            <div className="flex items-center gap-2">
                {/* Quick-Start Fichaje */}
                {dashActiveFichaje ? (
                    <div className="flex items-center gap-1 bg-yellow-50 border border-yellow-200 pl-2 pr-1 py-1 rounded-lg shadow-sm" role="status" aria-label="Fichaje activo">
                        <Timer className="w-3.5 h-3.5 text-yellow-600 animate-pulse flex-shrink-0" aria-hidden="true" />
                        <span className="hidden sm:inline font-mono font-bold text-yellow-700 tabular-nums text-xs">{formatDashElapsed(fichajeElapsed)}</span>
                        <div className="flex items-center border-l border-yellow-200 pl-1 ml-1">
                            <a href="/dashboard/fichaje" className="px-1.5 py-1 text-[10px] text-yellow-700 hover:bg-yellow-100 rounded transition whitespace-nowrap" aria-label="Ver fichaje">Ver →</a>
                            <button onClick={() => setShowClockOutConfirm(true)} disabled={fichajeLoading} aria-label="Fichar salida"
                                className="flex items-center p-1 ml-0.5 bg-neutral-900 text-white hover:bg-neutral-800 rounded transition disabled:opacity-50">
                                {fichajeLoading ? <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" /> : <Square className="w-3 h-3" />}
                            </button>
                        </div>
                    </div>
                ) : (
                    <button onClick={handleClockIn} disabled={fichajeLoading} aria-label="Fichar entrada"
                        className="flex items-center gap-1.5 bg-yellow-400 hover:bg-yellow-500 text-neutral-950 px-2.5 py-1.5 rounded-lg text-xs font-bold transition shadow-sm disabled:opacity-50">
                        {fichajeLoading ? <div className="w-3.5 h-3.5 border-2 border-neutral-900/30 border-t-neutral-900 rounded-full animate-spin" /> : <Play className="w-3 h-3" aria-hidden="true" />}
                        <span className="hidden sm:inline">Fichar</span> Entrada
                    </button>
                )}

                {/* Quick-Start Task Timer */}
                {dashActiveTask ? (
                    <div className="flex items-center gap-1 bg-yellow-50 border border-yellow-200 pl-2 pr-1 py-1 rounded-lg shadow-sm" role="status" aria-label="Tarea activa">
                        <Timer className="w-3.5 h-3.5 text-yellow-600 animate-pulse flex-shrink-0" aria-hidden="true" />
                        <span className="hidden sm:inline font-mono font-bold text-yellow-700 tabular-nums text-xs">{formatDashElapsed(dashElapsed)}</span>
                        <span className="hidden lg:inline px-1.5 font-semibold text-yellow-800 max-w-[160px] truncate text-xs">
                            {dashActiveTask.comunidades ? `${dashActiveTask.comunidades.codigo} – ${dashActiveTask.comunidades.nombre_cdad}` : 'TODAS'}
                        </span>
                        <div className="flex items-center border-l border-yellow-200 pl-1 ml-1">
                            <a href="/dashboard/cronometraje" className="px-1.5 py-1 text-[10px] text-yellow-700 hover:bg-yellow-100 rounded transition whitespace-nowrap" aria-label="Ver cronometraje">Ver →</a>
                            <button onClick={handleStopTask} disabled={stopping} aria-label="Parar tarea"
                                className="flex items-center p-1 ml-0.5 bg-neutral-900 text-white hover:bg-neutral-800 rounded transition disabled:opacity-50">
                                {stopping ? <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" /> : <Square className="w-3 h-3" />}
                            </button>
                        </div>
                    </div>
                ) : (
                    <button onClick={() => setShowStartTaskModal(true)} aria-label="Empezar tarea"
                        className="flex items-center gap-1.5 bg-yellow-400 hover:bg-yellow-500 text-neutral-950 px-2.5 py-1.5 rounded-lg text-xs font-bold transition shadow-sm">
                        <Play className="w-3 h-3" aria-hidden="true" />
                        <span className="hidden sm:inline">Empezar</span> Tarea
                    </button>
                )}
            </div>

            {/* Stats — ocultas en móvil, visibles desde sm */}
            <div className="hidden sm:flex items-center gap-4 md:gap-6 text-xs md:text-sm ml-auto md:ml-0">
                <div className="flex items-center gap-1.5 text-neutral-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0"></span>
                    <span className="font-medium hidden md:inline">Comunidades:</span>
                    <span className="font-medium md:hidden">Cdad:</span>
                    <span className="font-bold text-neutral-900">{stats.comunidades}</span>
                </div>
                <div className="flex items-center gap-1.5 text-neutral-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0"></span>
                    <span className="font-medium hidden md:inline">Tickets:</span>
                    <span className="font-medium md:hidden">Tck:</span>
                    <span className="font-bold text-neutral-900">{stats.incidencias}</span>
                </div>
                <div className="flex items-center gap-1.5 text-neutral-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 flex-shrink-0"></span>
                    <span className="font-medium hidden md:inline">Deudas:</span>
                    <span className="font-medium md:hidden">Deu:</span>
                    <span className="font-bold text-neutral-900">{stats.morosidad}</span>
                </div>
            </div>
        </nav>
    );
}
