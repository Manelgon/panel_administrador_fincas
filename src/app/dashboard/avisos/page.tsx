"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'react-hot-toast';
import { CheckCheck, X, Paperclip, Loader2, Download } from 'lucide-react';
import DataTable, { Column } from '@/components/DataTable';
import { logActivity } from '@/lib/logActivity';
import { useGlobalLoading } from '@/lib/globalLoading';

interface Notification {
    id: string;
    created_at: string;
    title: string;
    body: string;
    is_read: boolean;
    entity_type: string;
    entity_id: number;
    user_id: string;
}

export default function AvisosPage() {
    const { withLoading } = useGlobalLoading();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterState, setFilterState] = useState<'all' | 'unread' | 'read'>('unread');

    // Detail Modal State
    const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [entityData, setEntityData] = useState<any>(null);
    const [loadingEntity, setLoadingEntity] = useState(false);

    const handleRowClick = async (notification: Notification) => {
        setSelectedNotification(notification);
        setShowDetailModal(true);
        setEntityData(null);

        // Auto-mark as read when opening
        if (!notification.is_read) {
            markAsRead(notification.id);
        }

        // Fetch related entity data
        if (notification.entity_type && notification.entity_id) {
            setLoadingEntity(true);
            try {
                let query;
                if (notification.entity_type === 'incidencia') {
                    query = supabase
                        .from('incidencias')
                        .select(`
                            *,
                            comunidades (nombre_cdad, codigo),
                            receptor:profiles!quien_lo_recibe (nombre),
                            gestor:profiles!gestor_asignado (nombre),
                            resolver:profiles!resuelto_por (nombre)
                        `)
                        .eq('id', notification.entity_id)
                        .single();
                } else if (notification.entity_type === 'morosidad') {
                    query = supabase
                        .from('morosidad')
                        .select(`
                            *,
                            comunidades (nombre_cdad, codigo),
                            gestor_profile:profiles!gestor (nombre),
                            resolver:profiles!resuelto_por (nombre)
                        `)
                        .eq('id', notification.entity_id)
                        .single();
                } else {
                    setLoadingEntity(false);
                    return;
                }

                const { data, error } = await query;
                if (!error && data) {
                    setEntityData(data);
                }
            } catch (error) {
                console.error('Error fetching entity:', error);
            } finally {
                setLoadingEntity(false);
            }
        }
    };

    useEffect(() => {
        fetchNotifications();
    }, []);

    const fetchNotifications = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) {
            toast.error('Error cargando avisos');
        } else {
            setNotifications(data || []);
        }
        setLoading(false);
    };

    const markAsRead = async (id: string) => {
        await withLoading(async () => {
            try {
                const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
                if (error) throw error;
                const n = notifications.find(notif => notif.id === id);
                await logActivity({ action: 'read', entityType: 'aviso', entityId: n?.entity_id, entityName: n?.title, details: { notification_id: id, id: n?.entity_id, entity_type: n?.entity_type } });
                toast.success('Marcado como leído');
                setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
            } catch (error) {
                toast.error('Error al actualizar aviso');
            }
        }, 'Marcando como leído...');
    };

    const markAllRead = async () => {
        await withLoading(async () => {
            try {
                await fetch("/api/notifications/read-all", { method: "POST" });
                toast.success('Todos marcados como leídos');
                setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            } catch (error) {
                toast.error('Error al marcar todo como leído');
            }
        }, 'Marcando todos como leídos...');
    };

    const filteredNotifications = notifications.filter(n => {
        if (filterState === 'unread') return !n.is_read;
        if (filterState === 'read') return n.is_read;
        return true;
    });

    const columns: Column<Notification>[] = [
        {
            key: 'is_read',
            label: 'Estado',
            render: (row) => (
                <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${row.is_read
                    ? 'bg-neutral-100 text-neutral-600'
                    : 'bg-yellow-400 text-neutral-950'
                    }`}>
                    {row.is_read ? 'Leído' : 'Nuevo'}
                </span>
            ),
            sortable: true
        },
        {
            key: 'created_at',
            label: 'Fecha',
            render: (row) => new Date(row.created_at).toLocaleString(),
            sortable: true
        },
        {
            key: 'title',
            label: 'Título',
            sortable: true
        },
        {
            key: 'body',
            label: 'Mensaje',
            render: (row) => (
                <div className="max-w-md truncate" title={row.body}>
                    {row.body}
                </div>
            )
        },
        {
            key: 'entity_type',
            label: 'Origen',
            render: (row) => (
                <span className="capitalize text-xs text-neutral-500">{row.entity_type} #{row.entity_id}</span>
            )
        },
    ];

    const [exporting, setExporting] = useState(false);

    const handleExport = async (notification: Notification) => {
        setExporting(true);
        await withLoading(async () => {
            try {
                const res = await fetch('/api/avisos/export', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ids: [notification.id],
                        type: 'pdf',
                        layout: 'detail'
                    })
                });

                if (!res.ok) throw new Error('Export failed');

                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;

                // Filename: AVISO_ID_DATE
                const now = new Date();
                const dateStr = `${now.getDate().toString().padStart(2, '0')}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getFullYear()}`;
                a.download = `AVISO_${notification.id.substring(0, 8)}_${dateStr}.pdf`;

                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);

                toast.success('Descarga completada');
            } catch (error) {
                console.error(error);
                toast.error('Error al descargar PDF');
            } finally {
                setExporting(false);
            }
        }, 'Generando PDF...');
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center gap-3">
                <h1 className="text-xl font-bold text-neutral-900 min-w-0 truncate">Mis Avisos</h1>
                <button
                    onClick={markAllRead}
                    className="bg-neutral-900 hover:bg-neutral-800 text-white px-3 py-2 rounded-md flex items-center gap-1.5 transition font-semibold text-sm flex-shrink-0"
                >
                    <CheckCheck className="w-4 h-4 flex-shrink-0" />
                    <span className="hidden sm:inline">Marcar todo leído</span>
                    <span className="sm:hidden">Leído</span>
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={() => setFilterState('unread')}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition ${filterState === 'unread' ? 'bg-yellow-400 text-neutral-950' : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'}`}
                >
                    No leídos
                </button>
                <button
                    onClick={() => setFilterState('read')}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition ${filterState === 'read' ? 'bg-neutral-900 text-white' : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'}`}
                >
                    Leídos
                </button>
                <button
                    onClick={() => setFilterState('all')}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition ${filterState === 'all' ? 'bg-neutral-900 text-white' : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'}`}
                >
                    Todos
                </button>
            </div>

            <DataTable
                data={filteredNotifications}
                columns={columns}
                keyExtractor={(row) => row.id}
                loading={loading}
                emptyMessage="No tienes avisos."
                storageKey='avisos-table'
                onRowClick={handleRowClick}
            />

            {/* Detail Modal */}
            {showDetailModal && selectedNotification && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex justify-center items-end sm:items-center sm:p-6"
                >
                    <div
                        className="bg-white w-full max-w-4xl rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[92vh] sm:max-h-[90vh] animate-in fade-in slide-in-from-bottom sm:zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-white shrink-0">
                            <div>
                                <h2 className="text-xl font-black text-neutral-900 tracking-tight">
                                    {selectedNotification.title}
                                </h2>
                                <p className="text-xs text-neutral-500 mt-0.5">
                                    {selectedNotification.is_read ? 'Leído' : 'Nuevo'} · {new Date(selectedNotification.created_at).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' })}
                                </p>
                            </div>
                            <button
                                onClick={() => setShowDetailModal(false)}
                                className="p-2 rounded-xl hover:bg-neutral-100 text-neutral-400 hover:text-neutral-900 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar">

                            {/* Aviso Info */}
                            <div>
                                <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-4 border-b border-yellow-400">Información del Aviso</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="sm:col-span-2">
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Asunto</label>
                                        <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">{selectedNotification.title}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Estado</label>
                                        <div className={`w-full rounded-lg border px-3 py-2.5 text-sm font-semibold ${selectedNotification.is_read ? 'border-neutral-200 bg-neutral-50 text-neutral-500' : 'border-yellow-200 bg-yellow-50 text-yellow-700'}`}>
                                            {selectedNotification.is_read ? 'Leído' : 'Nuevo'}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Origen</label>
                                        <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 capitalize">
                                            {selectedNotification.entity_type} #{selectedNotification.entity_id}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Mensaje */}
                            <div>
                                <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-4 border-b border-yellow-400">Mensaje</h3>
                                <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 whitespace-pre-wrap leading-relaxed min-h-[80px]">
                                    {selectedNotification.body}
                                </div>
                            </div>

                            {/* Loading */}
                            {loadingEntity && (
                                <div className="flex items-center justify-center py-8 text-neutral-400">
                                    <Loader2 className="w-6 h-6 animate-spin mr-2" />
                                    <span className="text-sm">Cargando detalles...</span>
                                </div>
                            )}

                            {/* Incidencia relacionada */}
                            {!loadingEntity && entityData && selectedNotification.entity_type === 'incidencia' && (
                                <div>
                                    <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-4 border-b border-yellow-400">Incidencia Relacionada</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="sm:col-span-2">
                                            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Comunidad</label>
                                            <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">
                                                {entityData.comunidades?.codigo ? `${entityData.comunidades.codigo} - ${entityData.comunidades.nombre_cdad}` : entityData.comunidades?.nombre_cdad || '—'}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Cliente</label>
                                            <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">{entityData.nombre_cliente || '—'}</div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Teléfono</label>
                                            <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">{entityData.telefono || '—'}</div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Urgencia</label>
                                            <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">{entityData.urgencia || '—'}</div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Estado</label>
                                            <div className={`w-full rounded-lg border px-3 py-2.5 text-sm font-semibold ${entityData.resuelto ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-yellow-200 bg-yellow-50 text-yellow-700'}`}>
                                                {entityData.resuelto ? 'Resuelto' : 'En trámite'}
                                            </div>
                                        </div>
                                        {entityData.gestor && (
                                            <div>
                                                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Gestor Asignado</label>
                                                <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">{entityData.gestor?.nombre || '—'}</div>
                                            </div>
                                        )}
                                        {entityData.mensaje && (
                                            <div className="sm:col-span-2">
                                                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Mensaje de la Incidencia</label>
                                                <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 whitespace-pre-wrap leading-relaxed">{entityData.mensaje}</div>
                                            </div>
                                        )}
                                        {entityData.adjuntos && entityData.adjuntos.length > 0 && (
                                            <div className="sm:col-span-2">
                                                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Adjuntos</label>
                                                <div className="flex flex-wrap gap-2">
                                                    {entityData.adjuntos.map((url: string, i: number) => (
                                                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition">
                                                            <Paperclip className="w-3.5 h-3.5" />
                                                            Adjunto {i + 1}
                                                        </a>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Deuda relacionada */}
                            {!loadingEntity && entityData && selectedNotification.entity_type === 'morosidad' && (
                                <div>
                                    <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-4 border-b border-yellow-400">Deuda Relacionada</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="sm:col-span-2">
                                            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Comunidad</label>
                                            <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">
                                                {entityData.comunidades?.codigo ? `${entityData.comunidades.codigo} - ${entityData.comunidades.nombre_cdad}` : entityData.comunidades?.nombre_cdad || '—'}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Deudor</label>
                                            <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">{`${entityData.nombre_deudor || ''} ${entityData.apellidos || ''}`.trim() || '—'}</div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Teléfono</label>
                                            <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">{entityData.telefono_deudor || '—'}</div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Concepto</label>
                                            <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">{entityData.titulo_documento || '—'}</div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Importe</label>
                                            <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm font-semibold text-neutral-900">{entityData.importe ? `${entityData.importe}€` : '—'}</div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Estado</label>
                                            <div className={`w-full rounded-lg border px-3 py-2.5 text-sm font-semibold ${entityData.estado === 'Pagado' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-yellow-200 bg-yellow-50 text-yellow-700'}`}>
                                                {entityData.estado || '—'}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Fecha de Pago</label>
                                            <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">{entityData.fecha_pago ? new Date(entityData.fecha_pago).toLocaleDateString('es-ES') : '—'}</div>
                                        </div>
                                        {entityData.observaciones && (
                                            <div className="sm:col-span-2">
                                                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Observaciones</label>
                                                <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 whitespace-pre-wrap">{entityData.observaciones}</div>
                                            </div>
                                        )}
                                        {entityData.documento && (
                                            <div className="sm:col-span-2">
                                                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Documento Adjunto</label>
                                                <a href={entityData.documento} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition">
                                                    <Paperclip className="w-3.5 h-3.5" />
                                                    Ver documento
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 bg-white border-t border-neutral-100 flex items-center justify-end gap-3 shrink-0">
                            <button
                                type="button"
                                onClick={() => handleExport(selectedNotification)}
                                disabled={exporting}
                                className="px-6 py-3 text-sm font-bold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl transition-all flex items-center gap-2 disabled:opacity-50"
                            >
                                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                Descargar PDF
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowDetailModal(false)}
                                className="px-8 py-3 text-sm font-black text-neutral-900 bg-yellow-400 hover:bg-yellow-500 rounded-xl transition-all shadow-sm flex items-center gap-2 hover:shadow-md hover:-translate-y-0.5"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
