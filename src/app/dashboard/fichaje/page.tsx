'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'react-hot-toast';
import { Clock, Play, Square, Calendar } from 'lucide-react';
import { logActivity } from '@/lib/logActivity';
import { useGlobalLoading } from '@/lib/globalLoading';
import EmployeeResume from '@/components/fichaje/EmployeeResume';
import VacationDashboard from '@/components/vacations/VacationDashboard';

interface TimeEntry {
    id: number;
    start_at: string;
    end_at: string | null;
    note: string | null;
    created_at: string;
}

export default function FichajePage() {
    const { withLoading } = useGlobalLoading();
    const [loading, setLoading] = useState(true);
    const [currentSession, setCurrentSession] = useState<TimeEntry | null>(null);
    const [history, setHistory] = useState<TimeEntry[]>([]);
    const [monthlySeconds, setMonthlySeconds] = useState(0);
    const [note, setNote] = useState('');
    const [elapsedTime, setElapsedTime] = useState(0);
    const [activeTab, setActiveTab] = useState<'daily' | 'resume' | 'vacations'>('daily');

    useEffect(() => {
        fetchData();

        const handleFichajeChange = () => fetchData();
        window.addEventListener('fichajeChanged', handleFichajeChange);
        return () => window.removeEventListener('fichajeChanged', handleFichajeChange);
    }, []);

    // Live timer effect
    useEffect(() => {
        let interval: NodeJS.Timeout;

        if (currentSession && !currentSession.end_at) {
            interval = setInterval(() => {
                const start = new Date(currentSession.start_at).getTime();
                const now = Date.now();
                const diff = Math.floor((now - start) / 1000);
                setElapsedTime(diff);
            }, 1000);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [currentSession]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                await Promise.all([
                    fetchCurrentSession(session.user.id),
                    fetchHistory(session.user.id),
                    fetchMonthlyHours(session.user.id)
                ]);
            }
        } catch (error) {
            console.error("Error fetching data:", error);
            toast.error("Error cargando datos");
        } finally {
            setLoading(false);
        }
    };

    const fetchCurrentSession = async (userId: string) => {
        const { data, error } = await supabase
            .from('time_entries')
            .select('*')
            .eq('user_id', userId) // STRICTLY OWN
            .is('end_at', null)
            .order('start_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error('Error fetching current session:', error);
        } else {
            setCurrentSession(data);
            if (data) {
                // Calculate initial elapsed time
                const start = new Date(data.start_at).getTime();
                const now = Date.now();
                const diff = Math.floor((now - start) / 1000);
                setElapsedTime(diff);
            }
        }
    };

    const fetchHistory = async (userId: string) => {
        const { data } = await supabase
            .from('time_entries')
            .select('*')
            .eq('user_id', userId) // STRICTLY OWN
            .order('start_at', { ascending: false })
            .limit(100);

        if (data) setHistory(data);
    };

    const fetchMonthlyHours = async (userId: string) => {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { data } = await supabase
            .from('time_entries')
            .select('start_at, end_at')
            .eq('user_id', userId) // STRICTLY OWN
            .gte('start_at', startOfMonth.toISOString());

        if (data) {
            let totalSec = 0;
            data.forEach(entry => {
                const start = new Date(entry.start_at).getTime();
                // If end_at is null, calculate vs Now (so it counts current session)
                const end = entry.end_at ? new Date(entry.end_at).getTime() : Date.now();
                totalSec += (end - start) / 1000;
            });
            setMonthlySeconds(totalSec);
        }
    };

    const handleClockIn = async () => {
        await withLoading(async () => {
            try {
                const { data, error } = await supabase.rpc('clock_in', { _note: note || null });

                if (error) throw error;

                await logActivity({
                    action: 'clock_in',
                    entityType: 'fichaje',
                    details: { note: note || 'Sin nota' }
                });

                toast.success('Fichaje de entrada registrado');
                setNote('');
                window.dispatchEvent(new Event('fichajeChanged'));
                await fetchData();
            } catch (error: any) {
                toast.error(error.message || 'Error al fichar entrada');
            }
        }, 'Fichando entrada...');
    };

    const handleClockOut = async () => {
        await withLoading(async () => {
            try {
                const { data, error } = await supabase.rpc('clock_out');

                if (error) throw error;

                // Calculate duration for log
                let durationText = '';
                if (currentSession) {
                    const start = new Date(currentSession.start_at).getTime();
                    const end = Date.now();
                    const diff = Math.floor((end - start) / 1000);
                    durationText = formatDuration(diff);
                }

                await logActivity({
                    action: 'clock_out',
                    entityType: 'fichaje',
                    details: { duration: durationText }
                });

                toast.success('Fichaje de salida registrado');
                window.dispatchEvent(new Event('fichajeChanged'));
                await fetchData();
            } catch (error: any) {
                toast.error(error.message || 'Error al fichar salida');
            }
        }, 'Fichando salida...');
    };

    const formatSecondsToHoursMinutes = (totalSeconds: number) => {
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        return `${h}h ${m}m`;
    };

    const formatDuration = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const calculateDuration = (start: string, end: string | null) => {
        const startTime = new Date(start).getTime();
        const endTime = end ? new Date(end).getTime() : Date.now();
        return Math.floor((endTime - startTime) / 1000);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-neutral-500">Cargando...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-xl font-bold text-neutral-900">
                    Control de Fichaje
                </h1>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('daily')}
                    className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'daily' ? 'border-yellow-400 text-yellow-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    Fichaje Diario
                </button>
                <button
                    onClick={() => setActiveTab('resume')}
                    className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'resume' ? 'border-yellow-400 text-yellow-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    Resumen Mensual
                </button>
                <button
                    onClick={() => setActiveTab('vacations')}
                    className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'vacations' ? 'border-yellow-400 text-yellow-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    Vacaciones
                </button>
            </div>

            {activeTab === 'daily' ? (
                <>
                    {/* Current Session Card */}
                    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                        {currentSession ? (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-neutral-500">Sesión en curso</p>
                                        <p className="text-lg font-semibold text-neutral-900">
                                            Entrada: {new Date(currentSession.start_at).toLocaleTimeString('es-ES')}
                                        </p>
                                        {currentSession.note && (
                                            <p className="text-sm text-neutral-600 mt-1">Nota: {currentSession.note}</p>
                                        )}
                                    </div>
                                    <div className="text-center">
                                        <p className="text-3xl font-bold text-yellow-600 font-mono">
                                            {formatDuration(elapsedTime)}
                                        </p>
                                        <p className="text-xs text-neutral-500 mt-1">Tiempo transcurrido</p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleClockOut}
                                    className="w-full bg-neutral-900 hover:bg-neutral-800 text-white px-4 py-3 rounded-md flex items-center justify-center gap-2 transition font-semibold"
                                >
                                    <Square className="w-5 h-5" />
                                    Fichar Salida
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <p className="text-center text-neutral-500">No hay sesión activa</p>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Nota (opcional)
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 border rounded-lg mb-3"
                                        placeholder="Ej: Trabajo en proyecto X..."
                                        value={note}
                                        onChange={(e) => setNote(e.target.value)}
                                    />
                                </div>
                                <button
                                    onClick={handleClockIn}
                                    className="w-full bg-yellow-400 hover:bg-yellow-500 text-neutral-950 px-4 py-3 rounded-md flex items-center justify-center gap-2 transition font-semibold"
                                >
                                    <Play className="w-5 h-5" />
                                    Fichar Entrada
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Monthly Summary */}
                    <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 p-6 rounded-xl border border-yellow-200">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Calendar className="w-8 h-8 text-yellow-600" />
                                <div>
                                    <p className="text-sm text-neutral-600">Total este mes</p>
                                    <p className="text-2xl font-bold text-neutral-900">
                                        {formatSecondsToHoursMinutes(monthlySeconds)}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-neutral-500">
                                    {new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* History */}
                    <div className="bg-white rounded-xl shadow-md border border-gray-100">
                        <div className="px-6 py-4 border-b border-gray-100">
                            <h2 className="font-semibold text-neutral-900">Historial de Fichajes</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-neutral-50 text-xs text-neutral-600 uppercase">
                                    <tr>
                                        <th className="px-6 py-3 text-left">Fecha</th>
                                        <th className="px-6 py-3 text-left">Entrada</th>
                                        <th className="px-6 py-3 text-left">Salida</th>
                                        <th className="px-6 py-3 text-left">Duración</th>
                                        <th className="px-6 py-3 text-left">Nota</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {history.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-8 text-center text-neutral-500">
                                                No hay fichajes registrados
                                            </td>
                                        </tr>
                                    ) : (
                                        history.map((entry) => (
                                            <tr key={entry.id} className="hover:bg-neutral-50 transition-colors">
                                                <td className="px-6 py-3 text-sm text-neutral-900">
                                                    {new Date(entry.start_at).toLocaleDateString('es-ES')}
                                                </td>
                                                <td className="px-6 py-3 text-sm text-neutral-900">
                                                    {new Date(entry.start_at).toLocaleTimeString('es-ES')}
                                                </td>
                                                <td className="px-6 py-3 text-sm text-neutral-900">
                                                    {entry.end_at ? (
                                                        new Date(entry.end_at).toLocaleTimeString('es-ES')
                                                    ) : (
                                                        <span className="inline-flex items-center gap-2 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold">
                                                            En curso
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-3 text-sm font-mono text-neutral-900">
                                                    {formatDuration(calculateDuration(entry.start_at, entry.end_at))}
                                                </td>
                                                <td className="px-6 py-3 text-sm text-neutral-600">
                                                    {entry.note || '-'}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : activeTab === 'resume' ? (
                <EmployeeResume />
            ) : (
                <VacationDashboard />
            )}
        </div>
    );
}
