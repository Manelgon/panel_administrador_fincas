'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { logActivity } from '@/lib/logActivity';
import { useGlobalLoading } from '@/lib/globalLoading';
import { toast } from 'react-hot-toast';
import { Timer, Play, Square, Plus, BarChart2, Clock, Building, Trash2, FileText, User, X } from 'lucide-react';
import SearchableSelect from '@/components/SearchableSelect';
import StartTaskModal from '@/components/cronometraje/StartTaskModal';
import AddOldTaskModal from '@/components/cronometraje/AddOldTaskModal';
import TaskDetailModal from '@/components/cronometraje/TaskDetailModal';
import DeleteConfirmationModal from '@/components/DeleteConfirmationModal';
import DataTable, { Column } from '@/components/DataTable';
import * as htmlToImage from 'html-to-image';

interface TaskTimer {
    id: number;
    user_id: string;
    comunidad_id: number;
    nota: string | null;
    start_at: string;
    end_at: string | null;
    duration_seconds: number | null;
    is_manual: boolean;
    tipo_tarea: string | null;
    created_at: string;
    comunidades?: { nombre_cdad: string; codigo: string };
    profiles?: { nombre: string };
}

interface Community {
    id: string;
    nombre_cdad: string;
    codigo: string;
}

function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDurationShort(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

export default function CronometrajePage() {
    const { withLoading } = useGlobalLoading();
    const [activeTask, setActiveTask] = useState<TaskTimer | null>(null);
    const [history, setHistory] = useState<TaskTimer[]>([]);
    const [communities, setCommunities] = useState<Community[]>([]);
    const [elapsed, setElapsed] = useState(0);
    const [loading, setLoading] = useState(true);
    const [stopping, setStopping] = useState(false);
    const [showStartModal, setShowStartModal] = useState(false);
    const [showAddOldModal, setShowAddOldModal] = useState(false);
    const [periodFilter, setPeriodFilter] = useState<string>('all');
    const [globalCommunityFilter, setGlobalCommunityFilter] = useState<string>('all');
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const [selectedTask, setSelectedTask] = useState<TaskTimer | null>(null);
    const [taskToDelete, setTaskToDelete] = useState<TaskTimer | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [generatingPDF, setGeneratingPDF] = useState(false);
    const [generatingXLS, setGeneratingXLS] = useState(false);
    const [showPDFOptionsModal, setShowPDFOptionsModal] = useState(false);
    const [reportIncludeCharts, setReportIncludeCharts] = useState(true);
    const [reportCommunity, setReportCommunity] = useState<string>('all');
    const [reportDateFrom, setReportDateFrom] = useState<string>('');
    const [reportDateTo, setReportDateTo] = useState<string>('');

    const handleDeleteTask = async (credentials: { email: string; password: string }) => {
        if (!taskToDelete) return;
        await withLoading(async () => {
            setIsDeleting(true);
            try {
                const res = await fetch('/api/admin/universal-delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: taskToDelete.id, type: 'task_timer', email: credentials.email, password: credentials.password }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Error al eliminar');
                toast.success('Tarea eliminada correctamente');
                setTaskToDelete(null);
                setSelectedTask(null);
                await fetchData();
            } catch (err: any) {
                toast.error(err.message);
            } finally {
                setIsDeleting(false);
            }
        }, 'Eliminando tarea...');
    };

    const fetchData = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const [{ data: active }, { data: hist }, { data: comms }] = await Promise.all([
            supabase
                .from('task_timers')
                .select('*, comunidades(nombre_cdad, codigo), profiles(nombre)')
                .eq('user_id', user.id)
                .is('end_at', null)
                .order('start_at', { ascending: false })
                .maybeSingle(),

            supabase
                .from('task_timers')
                .select('*, tipo_tarea, comunidades(nombre_cdad, codigo), profiles(nombre)')
                .not('end_at', 'is', null)
                .order('start_at', { ascending: false })
                .limit(500),

            supabase
                .from('comunidades')
                .select('id, nombre_cdad, codigo')
                .order('codigo', { ascending: true }),
        ]);

        setActiveTask(active || null);
        setHistory(hist || []);
        setCommunities(comms || []);
        setLoading(false);

        if (active) {
            const diff = Math.floor((Date.now() - new Date(active.start_at).getTime()) / 1000);
            setElapsed(diff);
        }
    }, []);

    useEffect(() => {
        fetchData();

        const handleTaskChange = () => fetchData();
        window.addEventListener('taskTimerChanged', handleTaskChange);
        return () => window.removeEventListener('taskTimerChanged', handleTaskChange);
    }, [fetchData]);

    // Live chrono tick
    useEffect(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (activeTask) {
            intervalRef.current = setInterval(() => {
                setElapsed(prev => prev + 1);
            }, 1000);
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [activeTask]);

    const handleStop = async () => {
        await withLoading(async () => {
            setStopping(true);
            try {
                const { data, error } = await supabase.rpc('stop_task_timer');
                if (error) throw error;
                await logActivity({
                    action: 'stop_task',
                    entityType: 'task_timer',
                    entityId: data?.id,
                    entityName: (activeTask?.comunidades as any)?.nombre_cdad || 'Comunidad',
                    details: { duration: formatDurationShort(data?.duration_seconds || 0), nota: activeTask?.nota || null },
                });
                toast.success('Tarea finalizada');
                setActiveTask(null);
                setElapsed(0);
                window.dispatchEvent(new Event('taskTimerChanged'));
                await fetchData();
            } catch (error: any) {
                toast.error(error.message || 'Error al parar la tarea');
            } finally {
                setStopping(false);
            }
        }, 'Finalizando tarea...');
    };

    // ---- Filtered Data (by period + global community filter) ----
    const filteredData = (() => {
        let data = [...history];
        if (periodFilter !== 'all') {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - parseInt(periodFilter));
            data = data.filter(t => new Date(t.start_at) >= cutoff);
        }
        if (globalCommunityFilter !== 'all') {
            data = data.filter(t => String(t.comunidad_id) === globalCommunityFilter || t.comunidad_id === null);
        }
        return data;
    })();

    const allUsers = (() => {
        const userMap = new Map<string, string>();
        history.forEach(t => {
            if (t.user_id && t.profiles?.nombre) {
                userMap.set(t.user_id, t.profiles.nombre);
            }
        });
        return Array.from(userMap.entries()).map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre));
    })();

    const filteredHistory = filteredData;

    // ---- Build report data from modal filters ----
    const buildReportData = (community: string, dateFrom: string, dateTo: string) => {
        let data = [...history];
        if (community !== 'all') {
            data = data.filter(t => String(t.comunidad_id) === community || t.comunidad_id === null);
        }
        if (dateFrom) {
            data = data.filter(t => new Date(t.start_at) >= new Date(dateFrom));
        }
        if (dateTo) {
            data = data.filter(t => new Date(t.start_at) <= new Date(dateTo + 'T23:59:59'));
        }
        return data;
    };

    // ---- Open report modal pre-filling from current table filters ----
    const openReportModal = () => {
        setReportCommunity(globalCommunityFilter);
        if (periodFilter !== 'all') {
            const from = new Date();
            from.setDate(from.getDate() - parseInt(periodFilter));
            setReportDateFrom(from.toISOString().slice(0, 10));
        } else {
            setReportDateFrom('');
        }
        setReportDateTo('');
        setShowPDFOptionsModal(true);
    };

    // ---- PDF Report Generator ----
    const generatePDFReport = async (includeCharts: boolean, community: string, dateFrom: string, dateTo: string) => {
        await withLoading(async () => {
        setGeneratingPDF(true);
        try {
            const { default: jsPDF } = await import('jspdf');
            const { default: autoTable } = await import('jspdf-autotable');

            const reportData = buildReportData(community, dateFrom, dateTo);

            if (reportData.length === 0) {
                toast.error('No hay tareas con los filtros seleccionados');
                return;
            }

            const doc = new jsPDF('landscape', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();

            let currentY = 18;

            // Fetch and add banner logo — usa header de company_settings, fallback al public
            try {
                let headerUrl = '/logo-retenciones.png';
                try {
                    const settingsRes = await fetch('/api/admin/company-settings');
                    if (settingsRes.ok) {
                        const settingsJson = await settingsRes.json();
                        if (settingsJson.urls?.header_url) headerUrl = settingsJson.urls.header_url;
                    }
                } catch { /* usa fallback */ }
                const response = await fetch(headerUrl);
                const blob = await response.blob();
                const base64Logo = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(blob);
                });
                const imgProps = doc.getImageProperties(base64Logo);
                const bannerHeight = (imgProps.height * pageWidth) / imgProps.width;
                doc.addImage(base64Logo, 'PNG', 0, 0, pageWidth, bannerHeight);
                currentY = bannerHeight + 10;
            } catch (err) {
                console.warn('Could not load logo for PDF header', err);
            }

            // Title
            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.text('Informe de Cronometraje de Tareas', pageWidth / 2, currentY, { align: 'center' });
            currentY += 8;

            // Filters info
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            const communityLabel = community === 'all' ? 'Todas las comunidades' : communities.find(c => String(c.id) === community)?.nombre_cdad || community;
            const periodParts: string[] = [];
            if (dateFrom) periodParts.push(`Desde: ${new Date(dateFrom).toLocaleDateString('es-ES')}`);
            if (dateTo) periodParts.push(`Hasta: ${new Date(dateTo).toLocaleDateString('es-ES')}`);
            const periodLabel = periodParts.length > 0 ? periodParts.join('  –  ') : 'Todo el periodo';
            doc.text(`${periodLabel}  |  Comunidad: ${communityLabel}  |  Generado: ${new Date().toLocaleDateString('es-ES')}`, pageWidth / 2, currentY, { align: 'center' });
            currentY += 10;

            // Summary stats
            const rptTotalSeconds = reportData.reduce((acc, t) => acc + (t.duration_seconds || 0), 0);
            const rptTotalTasks = reportData.length;
            const rptAvg = rptTotalTasks > 0 ? Math.round(rptTotalSeconds / rptTotalTasks) : 0;

            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('Resumen', 14, currentY);
            currentY += 6;
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(`Total tareas: ${rptTotalTasks}  |  Tiempo total: ${formatDuration(rptTotalSeconds)}  |  Media por tarea: ${formatDuration(rptAvg)}`, 14, currentY);
            currentY += 10;

            // Helper: capture a DOM element as image and add to PDF
            const captureAndAdd = async (elementId: string, title: string, maxH: number = 80) => {
                const el = document.getElementById(elementId);
                if (!el) return;
                try {
                    const dataUrl = await htmlToImage.toPng(el, { quality: 0.95, backgroundColor: '#ffffff', pixelRatio: 2 });
                    if (dataUrl && dataUrl.startsWith('data:image')) {
                        const imgProps = doc.getImageProperties(dataUrl);
                        const chartW = pageWidth - 28;
                        let chartH = (imgProps.height / imgProps.width) * chartW;
                        if (chartH > maxH) chartH = maxH;
                        if (currentY + chartH + 14 > pageHeight - 10) {
                            doc.addPage();
                            currentY = 18;
                        }
                        doc.setFontSize(12);
                        doc.setFont('helvetica', 'bold');
                        doc.text(title, 14, currentY);
                        currentY += 5;
                        doc.addImage(dataUrl, 'PNG', 14, currentY, chartW, chartH);
                        currentY += chartH + 10;
                    }
                } catch (err) {
                    console.warn(`Error capturing ${elementId}:`, err);
                }
            };

            await captureAndAdd('crono-kpi-cards', 'Indicadores Clave', 40);

            if (includeCharts) {
                await captureAndAdd('crono-chart-gestor', 'Rendimiento por Gestor', 90);
                await captureAndAdd('crono-chart-weekly', 'Evolución Semanal de Horas', 90);
                await captureAndAdd('crono-dist-type-chart', 'Distribución por Tipo de Tarea', 100);
                await captureAndAdd('crono-stats-chart', 'Estadísticas de Tiempo por Comunidad', 90);
            }

            if (currentY + 20 > pageHeight - 10) {
                doc.addPage();
                currentY = 18;
            }
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('Detalle de Tareas', 14, currentY);

            const taskRows = reportData.map(t => [
                new Date(t.start_at).toLocaleDateString('es-ES'),
                t.profiles?.nombre || '–',
                t.comunidades ? `${(t.comunidades as any).codigo} – ${(t.comunidades as any).nombre_cdad}` : 'TODAS',
                t.nota || '–',
                t.duration_seconds ? formatDuration(t.duration_seconds) : '–',
                t.is_manual ? 'Manual' : 'Real',
            ]);

            autoTable(doc, {
                startY: currentY + 4,
                head: [['Fecha', 'Usuario', 'Comunidad', 'Nota', 'Duración', 'Tipo']],
                body: taskRows,
                styles: { fontSize: 8, cellPadding: 2 },
                headStyles: { fillColor: [234, 179, 8] },
                columnStyles: { 3: { cellWidth: 60 } },
                margin: { left: 14, right: 14 },
            });

            const today = new Date().toISOString().slice(0, 10);
            doc.save(`informe_cronometraje_${today}.pdf`);
            toast.success('PDF descargado correctamente');
        } catch (err: unknown) {
            console.error('Error generating PDF:', err);
            toast.error('Error al generar el PDF');
        } finally {
            setGeneratingPDF(false);
        }
        }, 'Generando PDF...');
    };

    // ---- XLS Report Generator ----
    const generateXLSReport = async (community: string, dateFrom: string, dateTo: string) => {
        await withLoading(async () => {
        setGeneratingXLS(true);
        try {
            const { utils, writeFile } = await import('xlsx');
            const reportData = buildReportData(community, dateFrom, dateTo);

            if (reportData.length === 0) {
                toast.error('No hay tareas con los filtros seleccionados');
                return;
            }

            const rows = reportData.map(t => ({
                Fecha: new Date(t.start_at).toLocaleDateString('es-ES'),
                Usuario: t.profiles?.nombre || '–',
                Comunidad: t.comunidades ? `${(t.comunidades as any).codigo} – ${(t.comunidades as any).nombre_cdad}` : 'TODAS',
                'Tipo de tarea': t.tipo_tarea || '–',
                Nota: t.nota || '–',
                Duración: t.duration_seconds ? formatDuration(t.duration_seconds) : '–',
                Tipo: t.is_manual ? 'Manual' : 'Real',
            }));

            const ws = utils.json_to_sheet(rows);
            const wb = utils.book_new();
            utils.book_append_sheet(wb, ws, 'Cronometraje');

            const today = new Date().toISOString().slice(0, 10);
            writeFile(wb, `informe_cronometraje_${today}.xlsx`);
            toast.success('Excel descargado correctamente');
        } catch (err: unknown) {
            console.error('Error generating XLS:', err);
            toast.error('Error al generar el Excel');
        } finally {
            setGeneratingXLS(false);
        }
        }, 'Generando Excel...');
    };


    // ---- Statistics ----
    const statsData = (() => {
        const totalCommunities = communities.length;
        if (totalCommunities === 0) return [];

        let totalSharedSeconds = 0;
        const secMap = new Map<number, number>();

        filteredData.forEach(t => {
            if (t.duration_seconds) {
                if (t.comunidad_id === null) {
                    totalSharedSeconds += t.duration_seconds;
                } else {
                    secMap.set(t.comunidad_id, (secMap.get(t.comunidad_id) || 0) + t.duration_seconds);
                }
            }
        });

        const perCommShare = totalCommunities > 0 ? Math.floor(totalSharedSeconds / totalCommunities) : 0;

        const filteredComms = globalCommunityFilter === 'all' 
            ? communities 
            : communities.filter(c => String(c.id) === globalCommunityFilter);

        return filteredComms.map(c => {
            const specificSec = secMap.get(Number(c.id)) || 0;
            return {
                name: `${c.codigo}`,
                fullName: `${c.codigo} - ${c.nombre_cdad}`,
                seconds: specificSec + perCommShare,
                isDistributed: perCommShare > 0,
            };
        }).filter(c => c.seconds > 0)
          .sort((a, b) => b.seconds - a.seconds);
    })();

    const totalSecAll = statsData.reduce((acc, d) => acc + d.seconds, 0);


    // ---- KPI Stats ----
    const totalTasks = filteredData.length;
    const avgSeconds = totalTasks > 0 ? Math.round(totalSecAll / totalTasks) : 0;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-6 h-6 border-2 border-yellow-400/40 border-t-yellow-400 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-10">
            {/* Modals */}
            {showStartModal && (
                <StartTaskModal
                    onClose={() => setShowStartModal(false)}
                    onStarted={fetchData}
                />
            )}
            {showAddOldModal && (
                <AddOldTaskModal
                    onClose={() => setShowAddOldModal(false)}
                    onAdded={fetchData}
                />
            )}

            {/* Task Detail Modal */}
            {selectedTask && (
                <TaskDetailModal
                    task={selectedTask}
                    onClose={() => setSelectedTask(null)}
                    onDeleteClick={() => { setTaskToDelete(selectedTask); setSelectedTask(null); }}
                    numCommunities={communities.length}
                />
            )}

            {/* Delete Confirmation Modal */}
            <DeleteConfirmationModal
                isOpen={!!taskToDelete}
                onClose={() => setTaskToDelete(null)}
                onConfirm={handleDeleteTask}
                title="Eliminar Tarea"
                description="Esta acción eliminará permanentemente el registro de la tarea. Para confirmar, ingresa credenciales de administrador."
                itemType="tarea"
                isDeleting={isDeleting}
            />


            {/* Report Config Modal */}
            {showPDFOptionsModal && (
                <div
                    className="fixed inset-0 bg-black/50 z-[150] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => setShowPDFOptionsModal(false)}
                >
                    <div
                        className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
                            <div>
                                <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-yellow-500" />
                                    Configurar Informe
                                </h2>
                                <p className="text-xs text-neutral-500 mt-0.5">Selecciona qué incluir en el informe</p>
                            </div>
                            <button
                                onClick={() => setShowPDFOptionsModal(false)}
                                className="p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-full transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-5">
                            {/* Community */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">Comunidad</label>
                                <SearchableSelect
                                    options={[
                                        { value: 'all', label: 'Todas las comunidades' },
                                        ...communities.map(c => ({ value: String(c.id), label: `${c.codigo} – ${c.nombre_cdad}` }))
                                    ]}
                                    value={reportCommunity}
                                    onChange={(val) => setReportCommunity(val ? String(val) : 'all')}
                                    placeholder="Todas las comunidades"
                                />
                            </div>

                            {/* Date range */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">Rango de fechas</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <span className="text-xs text-neutral-500">Desde</span>
                                        <input
                                            type="date"
                                            value={reportDateFrom}
                                            onChange={e => setReportDateFrom(e.target.value)}
                                            className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-xs text-neutral-500">Hasta</span>
                                        <input
                                            type="date"
                                            value={reportDateTo}
                                            onChange={e => setReportDateTo(e.target.value)}
                                            className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Include charts (PDF only) */}
                            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-neutral-200 hover:bg-neutral-50 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={reportIncludeCharts}
                                    onChange={e => setReportIncludeCharts(e.target.checked)}
                                    className="mt-0.5 w-4 h-4 rounded border-neutral-300 accent-yellow-500"
                                />
                                <div>
                                    <p className="text-sm font-semibold text-neutral-800">Incluir gráficas en PDF</p>
                                    <p className="text-xs text-neutral-500 mt-0.5">Añade capturas de los gráficos visibles al PDF.</p>
                                </div>
                            </label>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-neutral-100 flex items-center justify-between gap-3 bg-neutral-50/50">
                            <button
                                onClick={() => setShowPDFOptionsModal(false)}
                                className="px-4 py-2 text-sm font-semibold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={async () => {
                                        setShowPDFOptionsModal(false);
                                        await generateXLSReport(reportCommunity, reportDateFrom, reportDateTo);
                                    }}
                                    disabled={generatingXLS || generatingPDF}
                                    className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-neutral-700 bg-white border border-neutral-200 hover:bg-neutral-50 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                                >
                                    {generatingXLS ? (
                                        <div className="w-3.5 h-3.5 border-2 border-neutral-400/40 border-t-neutral-600 rounded-full animate-spin" />
                                    ) : (
                                        <FileText className="w-3.5 h-3.5 text-green-600" />
                                    )}
                                    Excel
                                </button>
                                <button
                                    onClick={async () => {
                                        setShowPDFOptionsModal(false);
                                        await generatePDFReport(reportIncludeCharts, reportCommunity, reportDateFrom, reportDateTo);
                                    }}
                                    disabled={generatingPDF || generatingXLS}
                                    className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-neutral-900 bg-yellow-400 hover:bg-yellow-500 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                                >
                                    {generatingPDF ? (
                                        <div className="w-3.5 h-3.5 border-2 border-neutral-400/40 border-t-neutral-800 rounded-full animate-spin" />
                                    ) : (
                                        <FileText className="w-3.5 h-3.5" />
                                    )}
                                    {generatingPDF ? 'Generando...' : 'PDF'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-neutral-900 tracking-tight">
                        Cronometraje de Tareas
                    </h1>
                    <p className="text-neutral-500 text-sm mt-0.5">Registra el tiempo dedicado a cada comunidad.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={() => setShowAddOldModal(true)}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white border border-neutral-200 hover:border-neutral-300 text-neutral-700 rounded-lg transition shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        Añadir Tarea Antigua
                    </button>
                    <button
                        onClick={() => setShowStartModal(true)}
                        disabled={!!activeTask}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-yellow-400 hover:bg-yellow-500 text-neutral-950 rounded-lg transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Play className="w-4 h-4" />
                        Empezar Tarea
                    </button>
                </div>
            </div>

            {/* Active Task Card */}
            {activeTask ? (
                <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-2xl p-6 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <p className="text-xs font-semibold text-yellow-600 uppercase tracking-wider">⏱ Tarea en curso</p>
                            <div className="flex items-center gap-2">
                                <Building className="w-4 h-4 text-neutral-500" />
                                <p className="text-sm font-semibold text-neutral-800">
                                    {activeTask.comunidades 
                                        ? `${(activeTask.comunidades as any).codigo} – ${(activeTask.comunidades as any).nombre_cdad}`
                                        : <span className="text-orange-600">TODAS LAS COMUNIDADES</span>
                                    }
                                </p>
                            </div>
                            {activeTask.nota && (
                                <p className="text-sm text-neutral-600 italic">"{activeTask.nota}"</p>
                            )}
                            <p className="text-xs text-neutral-500">
                                Iniciada: {new Date(activeTask.start_at).toLocaleTimeString('es-ES')}
                            </p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-center">
                                <p className="text-4xl font-bold text-neutral-900 font-mono tabular-nums tracking-tight">
                                    {formatDuration(elapsed)}
                                </p>
                                <p className="text-xs text-neutral-500 mt-1">Tiempo transcurrido</p>
                            </div>
                            <button
                                onClick={handleStop}
                                disabled={stopping}
                                className="flex items-center gap-2 px-5 py-3 bg-neutral-900 hover:bg-neutral-800 text-white font-bold rounded-xl transition shadow-sm disabled:opacity-50"
                            >
                                {stopping ? (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <Square className="w-4 h-4" />
                                )}
                                Parar Tarea
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-white border border-neutral-200 rounded-2xl p-6 text-center shadow-sm">
                    <div className="w-12 h-12 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Timer className="w-5 h-5 text-neutral-400" />
                    </div>
                    <p className="text-sm text-neutral-500">No hay ninguna tarea en curso.</p>
                    <button
                        onClick={() => setShowStartModal(true)}
                        className="mt-3 inline-flex items-center gap-2 px-4 py-2 text-sm font-bold bg-yellow-400 hover:bg-yellow-500 text-neutral-950 rounded-lg transition"
                    >
                        <Play className="w-4 h-4" />
                        Empezar Tarea
                    </button>
                </div>
            )}

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" id="crono-kpi-cards">
                <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-1">
                        <Clock className="w-4 h-4 text-yellow-500" />
                        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Total Horas</p>
                    </div>
                    <p className="text-2xl font-bold text-neutral-900">{formatDuration(totalSecAll)}</p>
                </div>
                <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-1">
                        <BarChart2 className="w-4 h-4 text-amber-500" />
                        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Tareas Realizadas</p>
                    </div>
                    <p className="text-2xl font-bold text-neutral-900">{totalTasks}</p>
                </div>
                <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-1">
                        <Timer className="w-4 h-4 text-orange-500" />
                        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Media por Tarea</p>
                    </div>
                    <p className="text-2xl font-bold text-neutral-900">{avgSeconds > 0 ? formatDuration(avgSeconds) : '00:00:00'}</p>
                </div>
            </div>


            {/* History Table */}
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-neutral-100">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-neutral-400" />
                            <h2 className="text-base font-bold text-neutral-800">Historial de Tareas</h2>
                            <span className="text-xs bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded-full">
                                {filteredHistory.length} registros
                            </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {/* Period filter */}
                            <div className="flex items-center bg-neutral-100 rounded-lg overflow-hidden">
                                {[{ label: 'Todo', value: 'all' }, { label: '30 días', value: '30' }, { label: '90 días', value: '90' }].map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setPeriodFilter(opt.value)}
                                        className={`px-3 py-1.5 text-xs font-medium transition ${
                                            periodFilter === opt.value
                                                ? 'bg-yellow-400 text-neutral-900 font-bold'
                                                : 'text-neutral-600 hover:bg-neutral-200'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                            {/* Community filter */}
                            <div className="min-w-[180px]">
                                <SearchableSelect
                                    options={[
                                        { value: 'all', label: 'Todas las comunidades' },
                                        ...communities.map(c => ({ value: String(c.id), label: `${c.codigo} – ${c.nombre_cdad}` }))
                                    ]}
                                    value={globalCommunityFilter}
                                    onChange={(val) => setGlobalCommunityFilter(val ? String(val) : 'all')}
                                    placeholder="Todas las comunidades"
                                />
                            </div>
                            {/* Download button */}
                            <button
                                onClick={openReportModal}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-yellow-400 hover:bg-yellow-500 text-neutral-900 rounded-lg transition shadow-sm"
                            >
                                <FileText className="w-3.5 h-3.5" />
                                Descargar
                            </button>
                        </div>
                    </div>
                </div>
                <div className="p-4">
                    <DataTable<TaskTimer>
                        data={filteredHistory}
                        storageKey="cronometraje-historial-v2"
                        keyExtractor={(row) => row.id}
                        emptyMessage="No hay tareas registradas todavía."
                        onRowClick={(row) => setSelectedTask(row)}
                        columns={[
                            {
                                key: 'start_at',
                                label: 'Fecha',
                                sortable: true,
                                render: (row) => (
                                    <span className="text-neutral-700 whitespace-nowrap">
                                        {new Date(row.start_at).toLocaleDateString('es-ES')}
                                    </span>
                                ),
                                getSearchValue: (row) => new Date(row.start_at).toLocaleDateString('es-ES'),
                            },
                            {
                                key: 'user_name',
                                label: 'Gestor',
                                sortable: true,
                                render: (row) => (
                                    <span className="text-neutral-800 font-medium flex items-center gap-1.5">
                                        <User className="w-3.5 h-3.5 text-neutral-400" />
                                        {row.profiles?.nombre || '–'}
                                    </span>
                                ),
                                getSearchValue: (row) => row.profiles?.nombre || '',
                            },
                            {
                                key: 'comunidad',
                                label: 'Comunidad',
                                sortable: true,
                                render: (row) => (
                                    <span className="text-neutral-900 font-medium whitespace-nowrap">
                                        {row.comunidades
                                            ? `${(row.comunidades as any).codigo} – ${(row.comunidades as any).nombre_cdad}`
                                            : <span className="text-orange-600 font-bold">TODAS LAS COMUNIDADES</span>
                                        }
                                    </span>
                                ),
                                getSearchValue: (row) =>
                                    row.comunidades
                                        ? `${(row.comunidades as any).codigo} ${(row.comunidades as any).nombre_cdad}`
                                        : 'TODAS LAS COMUNIDADES',
                            },
                            {
                                key: 'tipo_tarea',
                                label: 'Tipo',
                                sortable: true,
                                render: (row) => {
                                    const tipo = row.tipo_tarea as string | null;
                                    if (!tipo) return <span className="text-neutral-300">–</span>;
                                    const base = tipo.startsWith('Otros:') ? 'Otros' : tipo;
                                    const colorMap: Record<string, string> = {
                                        'Documentación': 'bg-blue-50 text-blue-700',
                                        'Contabilidad': 'bg-green-50 text-green-700',
                                        'Incidencias': 'bg-red-50 text-red-700',
                                        'Jurídico': 'bg-purple-50 text-purple-700',
                                        'Reunión': 'bg-cyan-50 text-cyan-700',
                                        'Contestar emails': 'bg-yellow-50 text-yellow-700',
                                        'Llamada': 'bg-violet-50 text-violet-700',
                                        'Otros': 'bg-orange-50 text-orange-700',
                                    };
                                    const color = colorMap[base] ?? 'bg-neutral-100 text-neutral-600';
                                    return (
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${color}`} title={tipo}>
                                            {tipo.length > 20 ? tipo.slice(0, 18) + '…' : tipo}
                                        </span>
                                    );
                                },
                                getSearchValue: (row) => (row.tipo_tarea as string | null) || '',
                            },
                            {
                                key: 'nota',
                                label: 'Nota',
                                sortable: true,
                                render: (row) => (
                                    <span className="text-neutral-600 max-w-xs truncate block">
                                        {row.nota || <span className="text-neutral-300">–</span>}
                                    </span>
                                ),
                            },
                            {
                                key: 'duration_seconds',
                                label: 'Duración',
                                sortable: true,
                                align: 'center',
                                render: (row) => {
                                    const isShared = !row.comunidad_id;
                                    const duration = row.duration_seconds || 0;
                                    const numComms = communities.length || 1;
                                    const share = isShared ? duration / numComms : null;

                                    return (
                                        <div className="flex flex-col items-center">
                                            <span className="font-mono text-neutral-900">
                                                {duration ? formatDuration(duration) : '–'}
                                            </span>
                                            {share !== null && (
                                                <span className="text-[10px] text-orange-600 font-semibold whitespace-nowrap">
                                                    Atribuido: {formatDuration(Math.round(share))}
                                                </span>
                                            )}
                                        </div>
                                    );
                                },
                            },
                        ] as Column<TaskTimer>[]}
                        rowActions={(row) => [
                            {
                                label: 'Eliminar',
                                icon: <Trash2 className="w-3.5 h-3.5" />,
                                onClick: (r) => setTaskToDelete(r),
                                variant: 'danger',
                            },
                        ]}
                    />
                </div>
            </div>
        </div>
    );
}
