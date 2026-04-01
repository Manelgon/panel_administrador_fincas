'use client';

import { useState, useEffect } from 'react';
import { useGlobalLoading } from '@/lib/globalLoading';
import { createPortal } from 'react-dom';
import { Plus, Mail, Building, FileText, Loader2, Download, ExternalLink, CheckCircle2, AlertCircle, Trash2, ChevronUp, ChevronDown, Filter, CreditCard, TicketCheck, Eye, Clock, X, BarChart2, ChevronRight } from 'lucide-react';
import DeleteConfirmationModal from '@/components/DeleteConfirmationModal';
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabaseClient';

interface Folder {
    name?: string;
    displayName?: string;
    id: string;
}

interface HistoricalReport {
    id: string;
    community_id: string;
    community_name: string;
    title: string;
    period_start: string;
    period_end: string;
    pdf_path: string;
    created_at: string;
}

export default function InformesComunidadPage() {
    const { withLoading } = useGlobalLoading();
    // State for folders (generator)
    const [folders, setFolders] = useState<Folder[]>([]);
    const [selectedFolder, setSelectedFolder] = useState<string>('');
    const [fechaInicio, setFechaInicio] = useState<string>('');
    const [fechaFin, setFechaFin] = useState<string>('');
    const [isAdmin, setIsAdmin] = useState(false);

    // Section selections
    const [includeEmails, setIncludeEmails] = useState(true);
    const [includeDebts, setIncludeDebts] = useState(true);
    const [includeTickets, setIncludeTickets] = useState(true);
    const [includeCronometraje, setIncludeCronometraje] = useState(true);

    // Filters per section
    const [ticketFilter, setTicketFilter] = useState<'all' | 'pending'>('all');
    const [debtFilter, setDebtFilter] = useState<'all' | 'pending'>('all');
    const [includeCharts, setIncludeCharts] = useState(true);

    // History State
    const [historicalReports, setHistoricalReports] = useState<HistoricalReport[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [filterCommunity, setFilterCommunity] = useState<string>('all');
    const [sortConfig, setSortConfig] = useState<{ key: keyof HistoricalReport; direction: 'asc' | 'desc' }>({
        key: 'created_at',
        direction: 'desc'
    });

    // UI State
    const [isGenerating, setIsGenerating] = useState(false);
    const [loadingFolders, setLoadingFolders] = useState(false);
    const [showGenerator, setShowGenerator] = useState(false);

    // Deletion
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [reportToDelete, setReportToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    const [successModal, setSuccessModal] = useState<{
        open: boolean;
        pdfUrl: string;
        community: string;
    }>({ open: false, pdfUrl: '', community: '' });

    const [portalReady, setPortalReady] = useState(false);
    useEffect(() => setPortalReady(true), []);

    useEffect(() => {
        const checkRole = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                const { data } = await supabase
                    .from('profiles')
                    .select('rol')
                    .eq('user_id', session.user.id)
                    .single();
                if (data?.rol === 'admin') setIsAdmin(true);
            }
        };
        checkRole();
        fetchHistory();

        // Set default dates
        const end = new Date();
        const start = new Date();
        start.setMonth(start.getMonth() - 1);
        setFechaFin(end.toISOString().split('T')[0]);
        setFechaInicio(start.toISOString().split('T')[0]);
    }, []);

    const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
            const { data, error } = await supabase
                .from('email_reports')
                .select('*')
                .ilike('title', 'Informe Global%')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setHistoricalReports(data || []);
        } catch (error) {
            console.error(error);
            setHistoricalReports([]);
        } finally {
            setLoadingHistory(false);
        }
    };

    const fetchFolders = async () => {
        setLoadingFolders(true);
        try {
            const response = await fetch('/api/onedrive/folders');
            if (!response.ok) throw new Error('Error al cargar comunidades');
            const data = await response.json();
            setFolders(data || []);
            setShowGenerator(true);
        } catch (error) {
            console.error(error);
            toast.error('No se pudieron cargar las carpetas de Outlook');
        } finally {
            setLoadingFolders(false);
        }
    };

    const handleGenerateReport = async () => {
        const errors: Record<string, string> = {};
        if (!selectedFolder || !fechaInicio || !fechaFin) errors.config = 'Debes completar comunidad y fechas';
        const hasSection = includeEmails || includeDebts || includeTickets || includeCronometraje;
        if (!hasSection) errors.sections = 'Debes seleccionar al menos una sección';
        if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
        setFormErrors({});

        await withLoading(async () => {
        setIsGenerating(true);
        try {
            const folder = folders.find(f => f.id === selectedFolder);
            const communityName = folder?.displayName || folder?.name || 'Comunidad';

            // Call the combined report API
            const response = await fetch('/api/dashboard/community-report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    communityId: selectedFolder,
                    communityName: communityName,
                    communityCode: selectedFolder,
                    includeEmails,
                    includeDebts,
                    includeTickets,
                    includeCronometraje,
                    ticketFilter,
                    debtFilter,
                    includeCharts,
                    startDate: fechaInicio,
                    endDate: fechaFin,
                    saveToHistory: true
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Error al generar el informe');
            }

            const data = await response.json();

            setSuccessModal({
                open: true,
                pdfUrl: data.pdfUrl,
                community: communityName
            });

            // Refresh history
            fetchHistory();
            setShowGenerator(false);

        } catch (error: any) {
            console.error(error);
            toast.error(error.message || 'Error en el proceso');
        } finally {
            setIsGenerating(false);
        }
        }, 'Generando informe de comunidad...');
    };

    const handleViewPdf = async (path: string) => {
        try {
            const { data, error } = await supabase.storage
                .from('documentos')
                .createSignedUrl(path, 3600);
            if (error) throw error;
            window.open(data.signedUrl, '_blank');
        } catch (error) {
            toast.error('No se pudo abrir el PDF');
        }
    };

    const handleDownloadPdf = async (path: string, fileName: string) => {
        try {
            const { data, error } = await supabase.storage
                .from('documentos')
                .createSignedUrl(path, 3600);
            if (error) throw error;
            const res = await fetch(data.signedUrl);
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            toast.error('No se pudo descargar el PDF');
        }
    };

    const handleDeleteReport = (id: string) => {
        setReportToDelete(id);
        setShowDeleteModal(true);
    };

    const handleConfirmDelete = async ({ email, password }: any) => {
        if (!reportToDelete) return;
        await withLoading(async () => {
            setIsDeleting(true);
            try {
                const response = await fetch('/api/reports/email/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: reportToDelete, email, password })
                });
                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || 'Error al eliminar');
                }
                toast.success('Informe eliminado');
                setShowDeleteModal(false);
                setReportToDelete(null);
                fetchHistory();
            } catch (error: any) {
                toast.error(error.message);
            } finally {
                setIsDeleting(false);
            }
        }, 'Eliminando informe...');
    };

    const requestSort = (key: keyof HistoricalReport) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key: keyof HistoricalReport) => {
        if (sortConfig.key !== key) return <ChevronUp className="w-3 h-3 text-neutral-300" />;
        return sortConfig.direction === 'asc'
            ? <ChevronUp className="w-3 h-3 text-yellow-500" />
            : <ChevronDown className="w-3 h-3 text-yellow-500" />;
    };

    const communitiesList = Array.from(new Set(historicalReports.map(r => r.community_name))).sort();
    const sortedAndFilteredReports = [...historicalReports]
        .filter(r => filterCommunity === 'all' || r.community_name === filterCommunity)
        .sort((a, b) => {
            const aValue = a[sortConfig.key];
            const bValue = b[sortConfig.key];
            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

    return (
        <div className="space-y-6 md:space-y-8 pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-neutral-900 tracking-tight flex items-center gap-2">
                        <Building className="w-6 h-6 text-yellow-500" /> Informes de Comunidad
                    </h1>
                    <p className="text-neutral-500 text-sm">Informes globales combinados (Emails, Deudas, Tickets, Cronometraje).</p>
                </div>
                <button
                    onClick={fetchFolders}
                    disabled={loadingFolders || isGenerating}
                    className="bg-yellow-400 text-neutral-900 px-5 py-2.5 rounded-lg text-sm font-bold shadow-sm hover:bg-yellow-500 transition flex items-center gap-2 disabled:opacity-50"
                >
                    {loadingFolders ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Nuevo Informe Global
                </button>
            </div>

            {/* History Table — always visible */}
            <div className="space-y-6">
                {/* Filters */}
                <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-xl border border-neutral-200">
                    <div className="flex items-center gap-2 text-sm text-neutral-500 mr-2">
                        <Filter className="w-4 h-4" /> Filtrar por:
                    </div>
                    <select
                        value={filterCommunity}
                        onChange={(e) => setFilterCommunity(e.target.value)}
                        className="bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-yellow-400"
                    >
                        <option value="all">Todas las comunidades</option>
                        {communitiesList.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>

                {/* Table */}
                <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[700px]">
                        <thead className="bg-neutral-50 border-b border-neutral-200">
                            <tr>
                                <th className="px-6 py-4 text-[10px] font-bold text-neutral-400 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('created_at')}>
                                    <div className="flex items-center gap-1">Fecha {getSortIcon('created_at')}</div>
                                </th>
                                <th className="px-6 py-4 text-[10px] font-bold text-neutral-400 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('community_name')}>
                                    <div className="flex items-center gap-1">Comunidad {getSortIcon('community_name')}</div>
                                </th>
                                <th className="px-6 py-4 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Periodo</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Contenido</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-neutral-400 uppercase tracking-wider text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                            {loadingHistory ? (
                                <tr><td colSpan={5} className="px-6 py-12 text-center text-neutral-400"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Cargando...</td></tr>
                            ) : sortedAndFilteredReports.length === 0 ? (
                                <tr><td colSpan={5} className="px-6 py-12 text-center text-neutral-400">No hay informes globales generados aún.</td></tr>
                            ) : (
                                sortedAndFilteredReports.map((report) => (
                                    <tr key={report.id} className="hover:bg-neutral-50 transition-colors">
                                        <td className="px-6 py-4 text-sm font-medium text-neutral-900">
                                            <div className="flex flex-col">
                                                <span>{new Date(report.created_at).toLocaleDateString()}</span>
                                                <span className="text-[10px] text-neutral-400 font-normal">{new Date(report.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-neutral-700">
                                            <div className="flex items-center gap-2">
                                                <Building className="w-4 h-4 text-yellow-500" />
                                                {report.community_name}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-neutral-500">{new Date(report.period_start).toLocaleDateString()} al {new Date(report.period_end).toLocaleDateString()}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-neutral-600">
                                                    {report.title.replace('Informe Global: ', '')}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => handleViewPdf(report.pdf_path)} className="p-1.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors" title="Ver Online"><Eye className="w-4 h-4" /></button>
                                                <button onClick={() => handleDownloadPdf(report.pdf_path, report.title)} className="p-1.5 rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors" title="Descargar"><Download className="w-4 h-4" /></button>
                                                {isAdmin && (
                                                    <button onClick={() => handleDeleteReport(report.id)} className="p-1.5 rounded-full bg-red-50 text-red-600 hover:bg-red-100 transition-colors" title="Borrar"><Trash2 className="w-4 h-4" /></button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Generator Modal */}
            {portalReady && showGenerator && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm" onClick={() => { setShowGenerator(false); setFormErrors({}); }} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-8 space-y-8 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center">
                            <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                                <Plus className="w-5 h-5 text-yellow-500" /> Nuevo Informe Global de Comunidad
                            </h2>
                            <button onClick={() => { setShowGenerator(false); setFormErrors({}); }} className="p-1.5 rounded-full text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-neutral-700">Comunidad (Carpeta de Outlook)</label>
                                <select
                                    value={selectedFolder}
                                    onChange={(e) => { setSelectedFolder(e.target.value); setFormErrors(prev => ({ ...prev, config: '' })); }}
                                    className={`w-full bg-neutral-50 border rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-yellow-400 ${formErrors.config ? 'border-red-400' : 'border-neutral-200'}`}
                                >
                                    <option value="">Selecciona una comunidad...</option>
                                    {folders.map(f => <option key={f.id} value={f.id}>{f.displayName || f.name}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-neutral-700">Desde</label>
                                    <input type="date" value={fechaInicio} onChange={(e) => { setFechaInicio(e.target.value); setFormErrors(prev => ({ ...prev, config: '' })); }} className={`w-full bg-neutral-50 border rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-yellow-400 ${formErrors.config ? 'border-red-400' : 'border-neutral-200'}`} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-neutral-700">Hasta</label>
                                    <input type="date" value={fechaFin} onChange={(e) => { setFechaFin(e.target.value); setFormErrors(prev => ({ ...prev, config: '' })); }} className={`w-full bg-neutral-50 border rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-yellow-400 ${formErrors.config ? 'border-red-400' : 'border-neutral-200'}`} />
                                </div>
                            </div>
                            {formErrors.config && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500 col-span-full"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.config}</p>}
                        </div>

                        {/* Secciones */}
                        <div className="space-y-3">
                            <p className="text-sm font-semibold text-neutral-700">Contenido del informe</p>

                            {/* Tickets */}
                            <div className={`rounded-xl border-2 transition-all ${includeTickets ? 'border-yellow-400 bg-yellow-50' : formErrors.sections ? 'border-red-300' : 'border-neutral-100 bg-neutral-50'}`}>
                                <label className="flex items-center gap-3 p-4 cursor-pointer">
                                    <input type="checkbox" checked={includeTickets} onChange={e => { setIncludeTickets(e.target.checked); setFormErrors(prev => ({ ...prev, sections: '' })); }} className="w-4 h-4 accent-yellow-500" />
                                    <TicketCheck className={`w-5 h-5 ${includeTickets ? 'text-yellow-600' : 'text-neutral-400'}`} />
                                    <span className="text-sm font-semibold text-neutral-800">Tickets / Incidencias</span>
                                </label>
                                {includeTickets && (
                                    <div className="px-4 pb-4 flex gap-3 flex-wrap">
                                        <label className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-all ${ticketFilter === 'all' ? 'border-yellow-400 bg-yellow-100 text-yellow-800' : 'border-neutral-200 text-neutral-500'}`}>
                                            <input type="radio" name="ticketFilter" value="all" checked={ticketFilter === 'all'} onChange={() => setTicketFilter('all')} className="sr-only" />
                                            Todos los tickets
                                        </label>
                                        <label className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-all ${ticketFilter === 'pending' ? 'border-yellow-400 bg-yellow-100 text-yellow-800' : 'border-neutral-200 text-neutral-500'}`}>
                                            <input type="radio" name="ticketFilter" value="pending" checked={ticketFilter === 'pending'} onChange={() => setTicketFilter('pending')} className="sr-only" />
                                            Solo pendientes
                                        </label>
                                    </div>
                                )}
                            </div>

                            {/* Deudas */}
                            <div className={`rounded-xl border-2 transition-all ${includeDebts ? 'border-yellow-400 bg-yellow-50' : formErrors.sections ? 'border-red-300' : 'border-neutral-100 bg-neutral-50'}`}>
                                <label className="flex items-center gap-3 p-4 cursor-pointer">
                                    <input type="checkbox" checked={includeDebts} onChange={e => { setIncludeDebts(e.target.checked); setFormErrors(prev => ({ ...prev, sections: '' })); }} className="w-4 h-4 accent-yellow-500" />
                                    <CreditCard className={`w-5 h-5 ${includeDebts ? 'text-yellow-600' : 'text-neutral-400'}`} />
                                    <span className="text-sm font-semibold text-neutral-800">Deudas / Morosidad</span>
                                </label>
                                {includeDebts && (
                                    <div className="px-4 pb-4 flex gap-3 flex-wrap">
                                        <label className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-all ${debtFilter === 'all' ? 'border-yellow-400 bg-yellow-100 text-yellow-800' : 'border-neutral-200 text-neutral-500'}`}>
                                            <input type="radio" name="debtFilter" value="all" checked={debtFilter === 'all'} onChange={() => setDebtFilter('all')} className="sr-only" />
                                            Todas las deudas
                                        </label>
                                        <label className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-all ${debtFilter === 'pending' ? 'border-yellow-400 bg-yellow-100 text-yellow-800' : 'border-neutral-200 text-neutral-500'}`}>
                                            <input type="radio" name="debtFilter" value="pending" checked={debtFilter === 'pending'} onChange={() => setDebtFilter('pending')} className="sr-only" />
                                            Solo pendientes
                                        </label>
                                    </div>
                                )}
                            </div>

                            {/* Emails + Cronometraje en fila */}
                            <div className="grid grid-cols-2 gap-3">
                                <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${includeEmails ? 'border-yellow-400 bg-yellow-50' : formErrors.sections ? 'border-red-300' : 'border-neutral-100 bg-neutral-50'}`}>
                                    <input type="checkbox" checked={includeEmails} onChange={e => { setIncludeEmails(e.target.checked); setFormErrors(prev => ({ ...prev, sections: '' })); }} className="w-4 h-4 accent-yellow-500" />
                                    <Mail className={`w-5 h-5 ${includeEmails ? 'text-yellow-600' : 'text-neutral-400'}`} />
                                    <span className="text-sm font-semibold text-neutral-800">Emails</span>
                                </label>
                                <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${includeCronometraje ? 'border-yellow-400 bg-yellow-50' : formErrors.sections ? 'border-red-300' : 'border-neutral-100 bg-neutral-50'}`}>
                                    <input type="checkbox" checked={includeCronometraje} onChange={e => { setIncludeCronometraje(e.target.checked); setFormErrors(prev => ({ ...prev, sections: '' })); }} className="w-4 h-4 accent-yellow-500" />
                                    <Clock className={`w-5 h-5 ${includeCronometraje ? 'text-yellow-600' : 'text-neutral-400'}`} />
                                    <span className="text-sm font-semibold text-neutral-800">Cronometraje</span>
                                </label>
                            </div>

                            {formErrors.sections && <p className="flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.sections}</p>}
                        </div>

                        {/* Opciones adicionales */}
                        <div className="border-t border-neutral-100 pt-5 space-y-3">
                            <p className="text-sm font-semibold text-neutral-700">Opciones adicionales</p>
                            <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${includeCharts ? 'border-yellow-400 bg-yellow-50' : 'border-neutral-100 bg-neutral-50'}`}>
                                <input type="checkbox" checked={includeCharts} onChange={e => setIncludeCharts(e.target.checked)} className="w-4 h-4 accent-yellow-500" />
                                <BarChart2 className={`w-5 h-5 ${includeCharts ? 'text-yellow-600' : 'text-neutral-400'}`} />
                                <div>
                                    <p className="text-sm font-semibold text-neutral-800">Incluir gráficos visuales</p>
                                    <p className="text-xs text-neutral-500">Gráficos de estado, urgencia y distribución en cada sección</p>
                                </div>
                            </label>
                        </div>

                        <button
                            onClick={handleGenerateReport}
                            disabled={isGenerating || !selectedFolder}
                            className="w-full bg-neutral-900 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-neutral-800 transition shadow-lg disabled:opacity-50"
                        >
                            {isGenerating ? <><Loader2 className="w-5 h-5 animate-spin" /> Generando Informe Global...</> : <><CheckCircle2 className="w-5 h-5 text-yellow-400" /> Generar Informe Combinado</>}
                        </button>
                    </div>
                </div>
            , document.body)}

            {/* Deletion Modal */}
            <DeleteConfirmationModal
                isOpen={showDeleteModal}
                onClose={() => {
                    setShowDeleteModal(false);
                    setReportToDelete(null);
                }}
                onConfirm={handleConfirmDelete}
                itemType="informe"
                isDeleting={isDeleting}
                description="Se eliminará permanentemente tanto el registro histórico como el archivo PDF del servidor."
            />

            {/* Success Modal — portal so it covers navbar */}
            {portalReady && successModal.open && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-neutral-900/70 backdrop-blur-sm" onClick={() => setSuccessModal({ ...successModal, open: false })} />
                    <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center space-y-6 animate-in zoom-in-95 duration-200">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                            <CheckCircle2 className="w-10 h-10 text-green-600" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-neutral-900">¡Informe Global Generado!</h3>
                            <p className="text-neutral-500 mt-2">El informe de <strong>{successModal.community}</strong> ha sido generado correctamente.</p>
                        </div>
                        <div className="flex flex-col gap-3">
                            <button onClick={async () => {
                                try {
                                    const res = await fetch(successModal.pdfUrl);
                                    const blob = await res.blob();
                                    const blobUrl = window.URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = blobUrl;
                                    a.download = `Informe_Global_${successModal.community}.pdf`;
                                    document.body.appendChild(a);
                                    a.click();
                                    window.URL.revokeObjectURL(blobUrl);
                                    document.body.removeChild(a);
                                } catch {
                                    toast.error('No se pudo descargar el PDF');
                                }
                            }} className="bg-neutral-900 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-neutral-800 transition">
                                <Download className="w-4 h-4" /> Descargar PDF
                            </button>
                            <button onClick={() => setSuccessModal({ ...successModal, open: false })} className="text-neutral-400 text-sm font-medium hover:text-neutral-600 mt-2">Cerrar</button>
                        </div>
                    </div>
                </div>
            , document.body)}

            {/* Global Blocking Loader — portal so it covers navbar */}
            {portalReady && isGenerating && createPortal(
                <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-neutral-900/80 backdrop-blur-md">
                    <div className="relative w-24 h-24 mb-6">
                        <div className="absolute inset-0 border-4 border-yellow-400/20 rounded-full" />
                        <div className="absolute inset-0 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                        <Building className="absolute inset-0 m-auto w-10 h-10 text-yellow-400 animate-pulse" />
                    </div>
                    <div className="text-center space-y-2">
                        <h3 className="text-xl font-bold text-white tracking-tight">Generando Informe de Comunidad</h3>
                        <p className="text-neutral-400 text-sm max-w-xs px-6">
                            Estamos recopilando datos y generando tu PDF certificado.
                            {includeEmails && " Procesando emails con IA..."}
                            {" "}Por favor, no cierres esta ventana.
                        </p>
                    </div>
                </div>
            , document.body)}
        </div>
    );
}
