'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'react-hot-toast';
import { Check, RotateCcw, Paperclip, Trash2, X, FileText, Download, Loader2, Building, Users, Clock, UserCog, Save, Pause, CalendarClock } from 'lucide-react';
import ModalActionsMenu from '@/components/ModalActionsMenu';
import DeleteConfirmationModal from '@/components/DeleteConfirmationModal';
import DataTable, { Column } from '@/components/DataTable';
import SearchableSelect from '@/components/SearchableSelect';
import { logActivity } from '@/lib/logActivity';
import TimelineChat from '@/components/TimelineChat';
import { getSecureUrl } from '@/lib/storage';
import { useGlobalLoading } from '@/lib/globalLoading';

interface Incidencia {
    id: number;
    comunidad_id: number;
    nombre_cliente: string;
    telefono: string;
    email: string;
    mensaje: string;
    urgencia?: string;
    resuelto: boolean;
    created_at: string;
    timestamp?: string;
    comunidades?: { nombre_cdad: string; codigo?: string };

    // New fields
    quien_lo_recibe?: string;
    comunidad?: string;
    codigo?: string;
    gestor_asignado?: string;
    gestor?: { nombre: string };
    receptor?: { nombre: string };
    sentimiento?: string;
    categoria?: string;
    nota_gestor?: string;
    nota_propietario?: string;
    todas_notas_propietario?: string;
    dia_resuelto?: string;
    resuelto_por?: string;
    resolver?: { nombre: string };
    adjuntos?: string[];
    aviso?: string | boolean;
    id_email_gestion?: string;
    estado?: string;
    fecha_recordatorio?: string;
}

export default function SofiaPage() {
    const { withLoading } = useGlobalLoading();
    const [incidencias, setIncidencias] = useState<Incidencia[]>([]);
    const [comunidades, setComunidades] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isLocal, setIsLocal] = useState(true);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const local = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            setIsLocal(local);
            if (!local) {
                window.location.href = '/dashboard';
            }
        }
    }, []);

    const [filterEstado, setFilterEstado] = useState('pendiente');
    const [filterGestor, setFilterGestor] = useState('all');
    const [filterComunidad, setFilterComunidad] = useState('all');

    // Selection & Export
    const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
    const [exporting, setExporting] = useState(false);

    const [profiles, setProfiles] = useState<any[]>([]);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState<number | null>(null);

    // Delete state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<number | null>(null);
    const [deleteEmail, setDeleteEmail] = useState('');
    const [deletePassword, setDeletePassword] = useState('');
    const [isReassigning, setIsReassigning] = useState(false);
    const [newGestorId, setNewGestorId] = useState('');
    const [newComunidadId, setNewComunidadId] = useState<number | ''>('');
    const [isUpdatingGestor, setIsUpdatingGestor] = useState(false);
    const [showReassignSuccessModal, setShowReassignSuccessModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Aplazar state
    const [showAplazarModal, setShowAplazarModal] = useState(false);
    const [aplazarIncidenciaId, setAplazarIncidenciaId] = useState<number | null>(null);
    const [aplazarDate, setAplazarDate] = useState('');

    // Detail Modal State
    const [selectedDetailIncidencia, setSelectedDetailIncidencia] = useState<Incidencia | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [isUpdatingRecord, setIsUpdatingRecord] = useState(false);
    const detailFileInputRef = useRef<HTMLInputElement>(null);

    // PDF Notes Modal State
    const [showExportModal, setShowExportModal] = useState(false);
    const [pendingExportParams, setPendingExportParams] = useState<{ type: 'csv' | 'pdf', ids?: number[], includeNotes?: boolean } | null>(null);

    const handleRowClick = (incidencia: Incidencia) => {
        setSelectedDetailIncidencia(incidencia);

        // Check if the IDs or Codes coming from Sofia DB exist in our Panel DB lists
        const communityMatch = comunidades.find(c =>
            (c.id === incidencia.comunidad_id) ||
            (incidencia.codigo && c.codigo === incidencia.codigo)
        );
        const gestorMatch = profiles.find(p => p.user_id === incidencia.gestor_asignado);

        setNewComunidadId(communityMatch ? communityMatch.id : '');
        setNewGestorId(gestorMatch ? (incidencia.gestor_asignado || '') : '');
        setShowDetailModal(true);
    };

    useEffect(() => {
        fetchInitialData();

        // Subscribe to real-time changes in secondary Supabase
        const channel = supabase
            .channel('sofia-realtime')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'incidencias_serincobot' },
                () => {
                    fetchIncidencias();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Prevent body scroll when any modal is open
    useEffect(() => {
        if (showDeleteModal || showExportModal || showDetailModal || showAplazarModal) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [showDeleteModal, showExportModal, showDetailModal, showAplazarModal]);

    const fetchInitialData = async () => {
        setLoading(true);
        // Metadata from primary, tickets from secondary
        const [cdads, profs] = await Promise.all([fetchComunidades(), fetchProfiles()]);
        await fetchIncidencias(cdads || [], profs || []);
        setLoading(false);
    };

    const fetchProfiles = async () => {
        const { data } = await supabase.from('profiles').select('user_id, nombre, rol').eq('activo', true);
        if (data) {
            const filtered = data.filter(p => p.nombre !== 'Sofia-Bot');
            setProfiles(filtered);
            return filtered;
        }
        return [];
    };

    const fetchComunidades = async () => {
        const { data } = await supabase.from('comunidades').select('id, nombre_cdad, codigo').eq('activo', true);
        if (data) {
            setComunidades(data);
            return data;
        }
        return [];
    };

    const fetchIncidencias = async (passedComunidades?: any[], passedProfiles?: any[]) => {
        const currentComunidades = passedComunidades || comunidades;
        const currentProfiles = passedProfiles || profiles;

        console.log('Fetching incidencias from secondary...', (supabase as any).supabaseUrl);
        // Fetch from secondary Supabase
        const { data, error } = await supabase
            .from('incidencias_serincobot')
            .select('*');

        if (error) {
            toast.error('Error cargando datos de Sofia');
            console.error('Sofia fetch error:', error);
        } else {
            if (data && data.length > 0) {
                console.log('Sofia schema sample keys:', Object.keys(data[0]));
            }
            // Sort in memory if created_at is missing or use a fallback
            const dataToSort = data || [];
            // Many tables use 'id' or another numeric field if created_at is missing
            const sortedData = [...dataToSort].sort((a: any, b: any) => (b.created_at || b.id || 0) - (a.created_at || a.id || 0));

            // Map data and enrich with metadata from primary Supabase (profiles, comunidades)
            const formattedData = sortedData.map((item: any) => {
                // Secondary DB fallbacks (Case-insensitive discovery)
                const findValue = (regex: RegExp) => {
                    const key = Object.keys(item).find(k => regex.test(k));
                    return key ? item[key] : null;
                };

                const rawBuilding = item.comunidad || findValue(/comunida/i) || findValue(/edificio/i) || '';
                const rawDate = item.created_at || findValue(/solicitud/i) || findValue(/fecha/i) || findValue(/created/i) || '';
                const rawGestor = item.gestor_asignado || item.gestor || findValue(/gestor/i) || '';

                const cdad = currentComunidades.find((c: any) =>
                    (c.id === item.comunidad_id) ||
                    (item.codigo && c.codigo === item.codigo)
                );
                const gestorProf = currentProfiles.find((p: any) => p.user_id === rawGestor);
                const receptorProf = currentProfiles.find((p: any) => p.user_id === item.quien_lo_recibe);
                const resolverProf = currentProfiles.find((p: any) => p.user_id === item.resuelto_por);

                return {
                    ...item,
                    comunidades: cdad ? { nombre_cdad: cdad.nombre_cdad, codigo: cdad.codigo } : undefined,
                    comunidad: cdad?.nombre_cdad || rawBuilding || '',
                    created_at: item.timestamp || rawDate,
                    codigo: item.codigo || cdad?.codigo || '',
                    gestor: gestorProf ? { nombre: gestorProf.nombre } : undefined,
                    receptor: receptorProf ? { nombre: receptorProf.nombre } : undefined,
                    resolver: resolverProf ? { nombre: resolverProf.nombre } : undefined,
                    resuelto_por: item.resuelto_por // Ensure UUID is kept
                };
            });
            setIncidencias(formattedData);
        }
    };

    const handleDetailFileUpload = async (files: FileList) => {
        if (!selectedDetailIncidencia) return;

        setIsUpdatingRecord(true);
        await withLoading(async () => {
            const loadingToast = toast.loading('Subiendo archivos...');
            try {
                const newUrls: string[] = [];
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    const fileExt = file.name.split('.').pop();
                    const fileName = `${Math.random()}.${fileExt}`;
                    const filePath = `sofia/${fileName}`;

                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('path', 'sofia');
                    formData.append('bucket', 'documentos');

                    const res = await fetch('/api/storage/upload', {
                        method: 'POST',
                        body: formData
                    });

                    if (!res.ok) {
                        const error = await res.json();
                        throw new Error(error.error || 'Error al subir archivo');
                    }

                    const data = await res.json();
                    newUrls.push(data.publicUrl);
                }

                const currentAdjuntos = selectedDetailIncidencia.adjuntos || [];
                const updatedAdjuntos = [...currentAdjuntos, ...newUrls];

                const { error: updateError } = await supabase
                    .from('incidencias_serincobot')
                    .update({ adjuntos: updatedAdjuntos })
                    .eq('id', selectedDetailIncidencia.id);

                if (updateError) throw updateError;

                setSelectedDetailIncidencia({
                    ...selectedDetailIncidencia,
                    adjuntos: updatedAdjuntos
                });

                setIncidencias(prev => prev.map(i => i.id === selectedDetailIncidencia.id ? { ...i, adjuntos: updatedAdjuntos } : i));

                await logActivity({
                    action: 'update',
                    entityType: 'sofia_incidencia',
                    entityId: selectedDetailIncidencia.id,
                    entityName: `Sofia - ${selectedDetailIncidencia.nombre_cliente}`,
                    details: {
                        id: selectedDetailIncidencia.id,
                        action: 'adjuntar_archivos',
                        archivos_nuevos: newUrls.length,
                        total_archivos: updatedAdjuntos.length
                    }
                });

                toast.success('Archivos añadidos', { id: loadingToast });
            } catch (error: any) {
                console.error(error);
                toast.error('Error al subir archivos', { id: loadingToast });
            } finally {
                setIsUpdatingRecord(false);
            }
        }, 'Subiendo archivos...');
    };

    const handleDeleteAttachment = async (urlToDelete: string) => {
        if (!selectedDetailIncidencia) return;

        const isConfirmed = window.confirm('¿Estás seguro de que deseas eliminar este documento?');
        if (!isConfirmed) return;

        setIsUpdatingRecord(true);
        await withLoading(async () => {
            const loadingToast = toast.loading('Eliminando archivo...');
            try {
                const updatedAdjuntos = (selectedDetailIncidencia.adjuntos || []).filter(url => url !== urlToDelete);

                const { error: updateError } = await supabase
                    .from('incidencias_serincobot')
                    .update({ adjuntos: updatedAdjuntos })
                    .eq('id', selectedDetailIncidencia.id);

                if (updateError) throw updateError;

                setSelectedDetailIncidencia({
                    ...selectedDetailIncidencia,
                    adjuntos: updatedAdjuntos
                });

                setIncidencias(prev => prev.map(i => i.id === selectedDetailIncidencia.id ? { ...i, adjuntos: updatedAdjuntos } : i));

                await logActivity({
                    action: 'update',
                    entityType: 'sofia_incidencia',
                    entityId: selectedDetailIncidencia.id,
                    entityName: `Sofia - ${selectedDetailIncidencia.nombre_cliente}`,
                    details: {
                        id: selectedDetailIncidencia.id,
                        action: 'eliminar_archivo',
                        url: urlToDelete
                    }
                });

                toast.success('Archivo eliminado', { id: loadingToast });
            } catch (error: any) {
                console.error(error);
                toast.error('Error al eliminar archivo', { id: loadingToast });
            } finally {
                setIsUpdatingRecord(false);
            }
        }, 'Eliminando archivo...');
    };

    const toggleResuelto = async (id: number, currentStatus: boolean) => {
        if (isUpdatingStatus === id) return;
        setIsUpdatingStatus(id);
        await withLoading(async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();

                const updatePayload: any = {
                    resuelto: !currentStatus,
                    dia_resuelto: !currentStatus ? new Date().toISOString() : null,
                    resuelto_por: !currentStatus ? (user?.id || 'manual_user') : null,
                    estado: !currentStatus ? 'Resuelto' : 'Pendiente',
                    fecha_recordatorio: null
                };

                const { error } = await supabase
                    .from('incidencias_serincobot')
                    .update(updatePayload)
                    .eq('id', id);

                if (error) throw error;

                toast.success(currentStatus ? 'Marcado como pendiente' : 'Marcado como resuelto');

                const currentProfile = profiles.find(p => p.user_id === user?.id);
                setIncidencias(prev => prev.map(i => i.id === id ? {
                    ...i,
                    resuelto: !currentStatus,
                    estado: !currentStatus ? 'Resuelto' : 'Pendiente',
                    fecha_recordatorio: undefined,
                    dia_resuelto: !currentStatus ? new Date().toISOString() : undefined,
                    resuelto_por: !currentStatus ? user?.id : undefined,
                    resolver: !currentStatus ? { nombre: currentProfile?.nombre || 'Tú' } : undefined
                } : i));

                if (selectedDetailIncidencia?.id === id) {
                    setSelectedDetailIncidencia({
                        ...selectedDetailIncidencia,
                        resuelto: !currentStatus,
                        estado: !currentStatus ? 'Resuelto' : 'Pendiente',
                        fecha_recordatorio: undefined,
                        dia_resuelto: !currentStatus ? new Date().toISOString() : undefined,
                        resuelto_por: !currentStatus ? user?.id : undefined,
                        resolver: !currentStatus ? { nombre: currentProfile?.nombre || 'Tú' } : undefined
                    });
                }

                const incidencia = incidencias.find(i => i.id === id);
                await logActivity({
                    action: 'update',
                    entityType: 'sofia_incidencia',
                    entityId: id,
                    entityName: `Sofia - ${incidencia?.nombre_cliente}`,
                    details: { id, comunidad: incidencia?.comunidades?.nombre_cdad, resuelto: !currentStatus }
                });

                setShowDetailModal(false);
            } catch (error: any) {
                console.error('Error toggling resuelto:', error);
                toast.error(`Error al actualizar estado: ${error.message || 'Error desconocido'}`);
            } finally {
                setIsUpdatingStatus(null);
            }
        }, currentStatus ? 'Reabriendo ticket...' : 'Resolviendo ticket...');
    };

    const openAplazarModal = (id: number) => {
        setAplazarIncidenciaId(id);
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setAplazarDate(tomorrow.toISOString().slice(0, 10));
        setShowAplazarModal(true);
    };

    const aplazarTicket = async () => {
        if (!aplazarIncidenciaId || !aplazarDate) return;

        await withLoading(async () => {
            const loadingToast = toast.loading('Aplazando ticket...');
            try {
                const { data: { user } } = await supabase.auth.getUser();

                const { error } = await supabase
                    .from('incidencias_serincobot')
                    .update({
                        estado: 'Aplazado',
                        resuelto: false,
                        fecha_recordatorio: aplazarDate
                    })
                    .eq('id', aplazarIncidenciaId);

                if (error) throw error;

                const fechaFormateada = new Date(aplazarDate + 'T00:00:00').toLocaleDateString('es-ES', {
                    day: '2-digit', month: '2-digit', year: 'numeric'
                });

                if (user) {
                    await supabase.from('record_messages').insert([{
                        entity_type: 'sofia_incidencia',
                        entity_id: aplazarIncidenciaId,
                        user_id: user.id,
                        content: `⏸️ Ticket aplazado hasta el ${fechaFormateada}`
                    }]);
                }

                await logActivity({
                    action: 'update',
                    entityType: 'sofia_incidencia',
                    entityId: aplazarIncidenciaId,
                    entityName: `Sofia - Aplazado hasta ${fechaFormateada}`,
                    details: { id: aplazarIncidenciaId, action: 'aplazar', fecha_recordatorio: aplazarDate }
                });

                setIncidencias(prev => prev.map(i => i.id === aplazarIncidenciaId ? {
                    ...i, estado: 'Aplazado' as any, resuelto: false, fecha_recordatorio: aplazarDate
                } : i));

                if (selectedDetailIncidencia?.id === aplazarIncidenciaId) {
                    setSelectedDetailIncidencia({
                        ...selectedDetailIncidencia,
                        estado: 'Aplazado',
                        resuelto: false,
                        fecha_recordatorio: aplazarDate
                    });
                }

                setShowAplazarModal(false);
                setAplazarIncidenciaId(null);
                setAplazarDate('');

                toast.success(`Ticket aplazado hasta ${fechaFormateada}`, { id: loadingToast });
            } catch (error: any) {
                console.error('Error aplazando ticket:', error);
                toast.error('Error al aplazar ticket', { id: loadingToast });
            }
        }, 'Aplazando ticket...');
    };

    const handleExport = async (type: 'csv' | 'pdf', idsOverride?: number[], includeNotesFromModal?: boolean) => {
        const idsToExport = idsOverride || Array.from(selectedIds);
        if (idsToExport.length === 0) return;

        const isDetailView = !!idsOverride && idsToExport.length === 1 && type === 'pdf';

        if (isDetailView && includeNotesFromModal === undefined) {
            setPendingExportParams({ type, ids: idsOverride });
            setShowExportModal(true);
            return;
        }

        const includeNotes = includeNotesFromModal !== undefined ? includeNotesFromModal : false;

        setExporting(true);
        await withLoading(async () => {
            try {
                const res = await fetch('/api/incidencias/export', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ids: idsToExport,
                        type,
                        layout: isDetailView ? 'detail' : 'list',
                        includeNotes,
                        table: 'incidencias_serincobot',
                        isSecondary: true
                    })
                });

                if (!res.ok) {
                    const errData = await res.json();
                    throw new Error(errData.error || 'Export failed');
                }

                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;

                const now = new Date();
                const dateStr = `${now.getDate().toString().padStart(2, '0')}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getFullYear()}`;

                if (isDetailView) {
                    a.download = `sofia_ticket_${idsToExport[0]}_${dateStr}.pdf`;
                } else {
                    a.download = `listado_sofia_${dateStr}.${type === 'csv' ? 'csv' : 'pdf'}`;
                }

                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);

                toast.success('Exportación completada');
            } catch (error) {
                console.error(error);
                toast.error('Error al exportar');
            } finally {
                setExporting(false);
            }
        }, 'Generando exportación...');
    };

    const handleDeleteClick = (id: number) => {
        setItemToDelete(id);
        setDeleteEmail('');
        setDeletePassword('');
        setShowDeleteModal(true);
    };

    const handleConfirmDelete = async ({ email, password }: any) => {
        if (!itemToDelete || !email || !password) return;

        setIsDeleting(true);
        await withLoading(async () => {
            try {
                const res = await fetch('/api/admin/universal-delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: itemToDelete,
                        email,
                        password,
                        type: 'sofia_incidencia',
                        table: 'incidencias_serincobot',
                        isSecondary: true
                    })
                });

                const data = await res.json();

                if (!res.ok) {
                    throw new Error(data.error || 'Error al eliminar');
                }

                toast.success('Incidencia eliminada correctamente');
                setIncidencias(prev => prev.filter(i => i.id !== itemToDelete));
                setShowDeleteModal(false);

                await logActivity({
                    action: 'delete',
                    entityType: 'sofia_incidencia',
                    entityId: itemToDelete,
                    entityName: `Sofia Deleted`,
                    details: { id: itemToDelete, deleted_by_admin: email }
                });

            } catch (error: any) {
                toast.error(error.message);
            } finally {
                setIsDeleting(false);
            }
        }, 'Eliminando incidencia...');
    };

    const handleUpdateGestor = async () => {
        if (!selectedDetailIncidencia || !newGestorId || !newComunidadId) {
            toast.error('Selecciona una comunidad y un gestor');
            return;
        }

        setIsUpdatingGestor(true);
        await withLoading(async () => {
            const loadingToast = toast.loading('Transfiriendo ticket a gestión...');
            try {
                const res = await fetch('/api/sofia/transfer', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sofiaId: selectedDetailIncidencia.id,
                        gestorId: newGestorId,
                        comunidadId: newComunidadId
                    })
                });

                const data = await res.json();

                if (!res.ok) {
                    const err = new Error(data.error || 'Error al transferir ticket') as any;
                    err.details = data.details;
                    throw err;
                }

                toast.success('Ticket transferido a Gestión de Tickets', { id: loadingToast });

                setIncidencias(prev => prev.filter(inc => inc.id !== selectedDetailIncidencia.id));
                setShowDetailModal(false);
                setSelectedDetailIncidencia(null);
                setIsReassigning(false);
                setNewGestorId('');
                setNewComunidadId('');

            } catch (error: any) {
                console.error('Error transferring ticket:', error);
                const errorMessage = error.message || 'Error al reasignar gestor';
                toast.error(errorMessage, { id: loadingToast });
                if (error.details) {
                    console.error('Detailed DB Error:', error.details);
                }
            } finally {
                setIsUpdatingGestor(false);
            }
        }, 'Transfiriendo ticket...');
    };

    const filteredIncidencias = incidencias.filter(inc => {
        let matchesEstado = true;
        if (filterEstado === 'pendiente') matchesEstado = !inc.resuelto && inc.estado !== 'Aplazado';
        else if (filterEstado === 'resuelto') matchesEstado = inc.resuelto;
        else if (filterEstado === 'aplazado') matchesEstado = inc.estado === 'Aplazado';

        const matchesGestor = filterGestor === 'all' ? true : inc.gestor_asignado === filterGestor;
        const matchesComunidad = filterComunidad === 'all' ? true : inc.comunidad_id === Number(filterComunidad);

        return matchesEstado && matchesGestor && matchesComunidad;
    });

    const columns: Column<Incidencia>[] = [
        { key: 'id', label: 'ID' },
        {
            key: 'codigo',
            label: 'Código',
            render: (row) => (
                <div className="flex items-start gap-3">
                    <span className={`mt-1 h-3.5 w-1.5 rounded-full ${row.resuelto ? 'bg-neutral-900' : row.estado === 'Aplazado' ? 'bg-orange-400' : 'bg-yellow-400'}`} />
                    <span className="font-semibold">{row.codigo || '-'}</span>
                </div>
            ),
        },
        {
            key: 'comunidad',
            label: 'Edificio',
            render: (row) => row.comunidad || '-',
        },
        {
            key: 'urgencia',
            label: 'Urgencia',
            render: (row) => {
                const urgency = row.urgencia?.toLowerCase() ?? '';
                const colors: Record<string, string> = {
                    alta: 'bg-red-100 text-red-700 border-red-200',
                    media: 'bg-amber-100 text-amber-700 border-amber-200',
                    baja: 'bg-emerald-100 text-emerald-700 border-emerald-200'
                };
                return (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${colors[urgency] || 'bg-neutral-100 text-neutral-600'}`}>
                        {row.urgencia || '-'}
                    </span>
                );
            }
        },
        {
            key: 'categoria',
            label: 'Categoría',
            render: (row) => <span className="text-[11px] font-medium text-neutral-600 truncate max-w-[100px] block" title={row.categoria}>{row.categoria || '-'}</span>
        },
        {
            key: 'sentimiento',
            label: 'Sentimiento',
            render: (row) => {
                const colors: Record<string, string> = {
                    positivo: 'text-emerald-600',
                    negativo: 'text-red-600',
                    neutral: 'text-neutral-400'
                };
                const sentKey = row.sentimiento?.toLowerCase() ?? '';
                return <span className={`text-[11px] font-bold uppercase ${colors[sentKey] || 'text-neutral-400'}`}>{row.sentimiento || '-'}</span>;
            }
        },
        { key: 'nombre_cliente', label: 'Cliente' },
        { key: 'telefono', label: 'Teléfono' },
        {
            key: 'email',
            label: 'Email',
            render: (row) => <span className="text-xs">{row.email || '-'}</span>,
        },
        {
            key: 'nota_propietario',
            label: 'Notas Propietario',
            render: (row) => <div className="max-w-[150px] truncate text-[11px] text-neutral-500" title={row.nota_propietario}>{row.nota_propietario || '-'}</div>
        },
        {
            key: 'nota_gestor',
            label: 'Notas Gestor',
            render: (row) => <div className="max-w-[150px] truncate text-[11px] text-neutral-500" title={row.nota_gestor}>{row.nota_gestor || '-'}</div>
        },
        {
            key: 'mensaje',
            label: 'Mensaje',
            render: (row) => (
                <div className="max-w-xs truncate text-xs" title={row.mensaje}>
                    {row.mensaje}
                </div>
            ),
        },
        {
            key: 'adjuntos',
            label: 'Adjuntos',
            render: (row) => (
                <div className="flex flex-wrap gap-1">
                    {row.adjuntos && row.adjuntos.length > 0 ? (
                        row.adjuntos.map((url, i) => (
                            <a
                                key={i}
                                href={getSecureUrl(url)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-full bg-yellow-50 text-yellow-600 hover:bg-yellow-100 transition-colors"
                            >
                                <FileText className="w-4 h-4" />
                            </a>
                        ))
                    ) : '-'}
                </div>
            ),
        },
        {
            key: 'created_at',
            label: 'Fecha',
            render: (row) => row.created_at ? new Date(row.created_at).toLocaleDateString() : '-',
        },
        {
            key: 'gestor_asignado',
            label: 'Gestor',
            render: (row) => row.gestor?.nombre || row.gestor_asignado || '-',
        },
        {
            key: 'resuelto',
            label: 'Estado',
            render: (row) => {
                if (row.estado === 'Aplazado') {
                    return (
                        <div className="flex flex-col items-start gap-1">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-200">
                                <Pause className="w-3 h-3" /> Aplazado
                            </span>
                            {row.fecha_recordatorio && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-orange-500 font-medium">
                                    <CalendarClock className="w-3 h-3" />
                                    {new Date(row.fecha_recordatorio + (row.fecha_recordatorio.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('es-ES')}
                                </span>
                            )}
                        </div>
                    );
                }
                return (
                    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${row.resuelto
                        ? 'bg-neutral-900 text-white'
                        : 'bg-yellow-400 text-neutral-950'
                        }`}
                    >
                        {row.resuelto ? 'Resuelto' : 'Pendiente'}
                    </span>
                );
            },
        },
    ];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center gap-4">
                <h1 className="text-xl font-bold text-neutral-900">Sofia - Gestión Bot</h1>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4">
                <div className="grid grid-cols-4 sm:flex sm:flex-wrap gap-2 w-full sm:w-auto">
                    {['pendiente', 'aplazado', 'resuelto', 'all'].map(status => (
                        <button
                            key={status}
                            onClick={() => setFilterEstado(status)}
                            className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                                filterEstado === status
                                    ? status === 'aplazado' ? 'bg-orange-400 text-white' : 'bg-yellow-400 text-neutral-950'
                                    : 'bg-neutral-200'
                            }`}
                        >
                            {status === 'pendiente' ? 'Pendientes' : status === 'aplazado' ? 'Aplazadas' : status === 'resuelto' ? 'Resueltas' : 'Todas'}
                        </button>
                    ))}
                </div>

                {selectedIds.size > 0 && (
                    <div className="flex gap-2 items-center">
                        <span className="text-sm font-medium text-neutral-500">{selectedIds.size} seleccionados</span>
                        <button onClick={() => handleExport('csv')} className="bg-white border px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-medium">
                            <FileText className="w-4 h-4 text-green-600" /> CSV
                        </button>
                        <button onClick={() => handleExport('pdf')} className="bg-white border px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-medium">
                            <Download className="w-4 h-4 text-red-600" /> PDF
                        </button>
                    </div>
                )}
            </div>

            <DataTable
                data={filteredIncidencias}
                columns={columns}
                keyExtractor={(row) => row.id}
                storageKey="sofia_tickets"
                loading={loading}
                emptyMessage="No hay registros de Sofia"
                selectable={true}
                selectedKeys={selectedIds}
                onSelectionChange={(keys) => setSelectedIds(keys)}
                onRowClick={handleRowClick}
                rowActions={(row) => [
                    {
                        label: row.resuelto ? 'Reabrir' : 'Resolver',
                        icon: row.resuelto ? <RotateCcw className="w-4 h-4" /> : <Check className="w-4 h-4" />,
                        onClick: (r) => toggleResuelto(r.id, r.resuelto),
                        disabled: isUpdatingStatus === row.id,
                        variant: row.resuelto ? 'default' : 'success',
                    },
                    {
                        label: 'Aplazar',
                        icon: <Pause className="w-4 h-4" />,
                        onClick: (r) => openAplazarModal(r.id),
                        hidden: row.resuelto || row.estado === 'Aplazado',
                        variant: 'warning',
                    },
                    {
                        label: 'Eliminar',
                        icon: <Trash2 className="w-4 h-4" />,
                        onClick: (r) => handleDeleteClick(r.id),
                        variant: 'danger',
                        separator: true,
                    },
                ]}
                extraFilters={
                    <div className="flex items-center gap-2">
                        <SearchableSelect
                            value={filterComunidad === 'all' ? '' : Number(filterComunidad)}
                            onChange={(val) => setFilterComunidad(val === '' ? 'all' : String(val))}
                            options={comunidades.map(c => ({ value: c.id, label: `${c.codigo || ''} - ${c.nombre_cdad}` }))}
                            placeholder="Todas las Comunidades"
                            className="w-[240px]"
                        />
                        <SearchableSelect
                            value={filterGestor === 'all' ? '' : filterGestor}
                            onChange={(val) => setFilterGestor(val === '' ? 'all' : String(val))}
                            options={profiles.map(p => ({ value: p.user_id, label: p.nombre }))}
                            placeholder="Todos los Gestores"
                            className="w-[200px]"
                        />
                    </div>
                }
            />

            {/* Detail Modal (Cloned from Incidencias) */}
            {showDetailModal && selectedDetailIncidencia && (
                <div className="fixed inset-0 bg-neutral-900/60 z-[9999] flex items-center justify-center p-0 sm:p-4 backdrop-blur-md">
                    <div className="bg-white rounded-none sm:rounded-2xl shadow-2xl w-full sm:max-w-4xl h-full sm:h-auto sm:max-h-[92dvh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <div className="px-6 py-5 border-b flex justify-between items-center bg-neutral-50/50">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-amber-400 rounded-xl flex items-center justify-center text-neutral-900">
                                    <FileText className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-neutral-900 uppercase">Sofia Ticket #{selectedDetailIncidencia.id}</h3>
                                    <p className="text-xs text-neutral-500 font-medium uppercase">Registrado el {selectedDetailIncidencia.created_at && !isNaN(new Date(selectedDetailIncidencia.created_at).getTime()) ? new Date(selectedDetailIncidencia.created_at).toLocaleString().toUpperCase() : (selectedDetailIncidencia.created_at || 'FECHA NO DISPONIBLE')}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="file" multiple className="hidden" ref={detailFileInputRef} onChange={(e) => e.target.files && handleDetailFileUpload(e.target.files)} />
                                <div className="flex bg-white rounded-lg border p-1 shadow-sm">
                                    <button onClick={() => detailFileInputRef.current?.click()} className="p-2 hover:bg-neutral-50 rounded-md border-r"><Paperclip className="w-5 h-5 text-neutral-400" /></button>
                                    <button onClick={() => handleExport('pdf', [selectedDetailIncidencia.id])} className="p-2 hover:bg-neutral-50 rounded-md border-r"><Download className="w-5 h-5 text-neutral-400" /></button>
                                    <button onClick={() => setShowDetailModal(false)} className="p-2 hover:bg-red-50 rounded-md"><X className="w-5 h-5 text-neutral-400 hover:text-red-600" /></button>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                                <div className="space-y-4">
                                    <h4 className="text-sm font-black text-neutral-900 uppercase tracking-widest border-b-2 border-neutral-900 pb-1.5">Identificación</h4>
                                    <div className="divide-y text-sm">
                                        <div className="py-2 flex justify-between items-center bg-yellow-50/50 px-3 rounded-lg mb-2 -mx-3 border border-yellow-100">
                                            <span className="font-bold text-amber-700 uppercase text-[10px]">Edificio Origen (Sofia)</span>
                                            <span className="font-black text-neutral-900 uppercase">{selectedDetailIncidencia.comunidad}</span>
                                        </div>
                                        <div className="py-2 flex justify-between items-center"><span className="font-bold text-neutral-400 uppercase">Comunidad</span>
                                            <div className="w-48">
                                                <SearchableSelect
                                                    value={newComunidadId}
                                                    onChange={(val) => setNewComunidadId(Number(val))}
                                                    options={comunidades.map(c => ({ value: c.id, label: `${c.codigo || ''} - ${c.nombre_cdad}` }))}
                                                    placeholder="Asignar Comunidad"
                                                />
                                            </div>
                                        </div>
                                        <div className="py-2 flex justify-between"><span className="font-bold text-neutral-400 uppercase">Propietario</span><span className="uppercase">{selectedDetailIncidencia.nombre_cliente}</span></div>
                                        <div className="py-2 flex justify-between"><span className="font-bold text-neutral-400 uppercase">Teléfono</span><span>{selectedDetailIncidencia.telefono}</span></div>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <h4 className="text-sm font-black text-neutral-900 uppercase tracking-widest border-b-2 border-neutral-900 pb-1.5">Gestión</h4>
                                    <div className="divide-y text-sm">
                                        <div className="py-2 flex justify-between items-center"><span className="font-bold text-neutral-400 uppercase">Gestor</span>
                                            <div className="w-48">
                                                <SearchableSelect
                                                    value={newGestorId}
                                                    onChange={(val) => setNewGestorId(String(val))}
                                                    options={profiles.map(p => ({ value: p.user_id, label: p.nombre }))}
                                                    placeholder="Asignar Gestor"
                                                />
                                            </div>
                                        </div>
                                        <div className="py-2 flex justify-between items-center">
                                            <span className="font-bold text-neutral-400 uppercase">Urgencia</span>
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold border uppercase ${selectedDetailIncidencia.urgencia?.toLowerCase() === 'alta' ? 'bg-red-100 text-red-700 border-red-200' :
                                                selectedDetailIncidencia.urgencia?.toLowerCase() === 'media' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                                    'bg-neutral-100 text-neutral-600 border-neutral-200'
                                                }`}>
                                                {selectedDetailIncidencia.urgencia || 'Media'}
                                            </span>
                                        </div>
                                        <div className="py-2 flex justify-between items-center">
                                            <span className="font-bold text-neutral-400 uppercase">Resuelto Por</span>
                                            <span className="font-medium text-neutral-900">
                                                {selectedDetailIncidencia.resolver?.nombre || selectedDetailIncidencia.resuelto_por || '-'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                                <div className="space-y-4">
                                    <h4 className="text-sm font-black text-neutral-900 uppercase tracking-widest border-b-2 border-neutral-900 pb-1.5">Análisis del Bot</h4>
                                    <div className="divide-y text-sm">
                                        <div className="py-2 flex justify-between"><span className="font-bold text-neutral-400 uppercase">Receptor</span><span className="uppercase text-amber-600 font-bold">{selectedDetailIncidencia.receptor?.nombre || selectedDetailIncidencia.quien_lo_recibe || 'Bot'}</span></div>
                                        <div className="py-2 flex justify-between"><span className="font-bold text-neutral-400 uppercase">Categoría</span><span className="font-medium">{selectedDetailIncidencia.categoria || '-'}</span></div>
                                        <div className="py-2 flex justify-between items-center">
                                            <span className="font-bold text-neutral-400 uppercase">Sentimiento</span>
                                            <span className={`font-black uppercase ${selectedDetailIncidencia.sentimiento?.toLowerCase() === 'positivo' ? 'text-emerald-600' :
                                                selectedDetailIncidencia.sentimiento?.toLowerCase() === 'negativo' ? 'text-red-600' :
                                                    'text-neutral-400'
                                                }`}>
                                                {selectedDetailIncidencia.sentimiento || 'Neutral'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <h4 className="text-sm font-black text-neutral-900 uppercase tracking-widest border-b-2 border-neutral-900 pb-1.5">Notas del Sistema</h4>
                                    <div className="space-y-3">
                                        {selectedDetailIncidencia.nota_propietario && (
                                            <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                                                <span className="block text-[10px] font-black text-blue-600 uppercase mb-1">Nota del Propietario</span>
                                                <p className="text-xs text-blue-900 leading-relaxed italic">"{selectedDetailIncidencia.nota_propietario}"</p>
                                            </div>
                                        )}
                                        {selectedDetailIncidencia.nota_gestor && (
                                            <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg">
                                                <span className="block text-[10px] font-black text-neutral-900 uppercase mb-1">Nota del Bot/Gestor</span>
                                                <p className="text-xs text-neutral-600 leading-relaxed">{selectedDetailIncidencia.nota_gestor}</p>
                                            </div>
                                        )}
                                        {!selectedDetailIncidencia.nota_propietario && !selectedDetailIncidencia.nota_gestor && (
                                            <p className="text-xs text-neutral-400 italic">No hay notas adicionales registradas.</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h4 className="text-sm font-black text-neutral-900 uppercase tracking-widest border-b-2 border-neutral-900 pb-1.5">Mensaje</h4>
                                <p className="text-neutral-800 text-base leading-relaxed uppercase">{selectedDetailIncidencia.mensaje}</p>
                            </div>

                            {/* Documentation Section */}
                            {(selectedDetailIncidencia.adjuntos && selectedDetailIncidencia.adjuntos.length > 0) && (
                                <div className="space-y-4">
                                    <h4 className="text-sm font-black text-neutral-900 uppercase tracking-widest border-l-4 border-neutral-900 pl-4">Anexos y Documentación Adjunta</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {selectedDetailIncidencia.adjuntos.map((url: string, i: number) => (
                                            <div key={i} className="group relative">
                                                <a
                                                    href={getSecureUrl(url)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center justify-between bg-white border border-neutral-200 p-4 rounded-xl hover:border-neutral-900 transition-all shadow-sm pr-12"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-lg bg-neutral-50 flex items-center justify-center text-neutral-400 group-hover:bg-neutral-900 group-hover:text-white transition-colors">
                                                            <FileText className="w-5 h-5" />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-normal text-neutral-900 truncate max-w-[150px] md:max-w-xs">
                                                                Documento Adjunto {i + 1}
                                                            </span>
                                                            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-tight">Ver archivo oficial</span>
                                                        </div>
                                                    </div>
                                                    <Download className="w-4 h-4 text-neutral-300 group-hover:text-neutral-900" />
                                                </a>
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        handleDeleteAttachment(url);
                                                    }}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-neutral-400 hover:text-red-600 transition-colors"
                                                    title="Eliminar documento"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4 pt-6">
                                <h4 className="text-sm font-black text-neutral-900 uppercase tracking-widest border-b-2 border-neutral-900 pb-2">Chat de Gestores (Sofia)</h4>
                                <TimelineChat entityType="sofia_incidencia" entityId={selectedDetailIncidencia.id} />
                            </div>
                        </div>

                        <div className="px-4 py-3 border-t bg-white flex justify-between items-center gap-2">
                            <ModalActionsMenu actions={[
                                { label: 'Eliminar', icon: <Trash2 className="w-4 h-4" />, onClick: () => { handleDeleteClick(selectedDetailIncidencia.id); setShowDetailModal(false); }, variant: 'danger' },
                                ...(!selectedDetailIncidencia.resuelto && selectedDetailIncidencia.estado !== 'Aplazado' ? [{ label: 'Aplazar', icon: <Pause className="w-4 h-4" />, onClick: () => openAplazarModal(selectedDetailIncidencia.id), variant: 'warning' as const }] : []),
                            ]} />
                            <div className="flex gap-2">
                                <button
                                    onClick={handleUpdateGestor}
                                    disabled={!newGestorId || !newComunidadId || isUpdatingGestor}
                                    className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase transition-all flex items-center gap-2 ${(!newGestorId || !newComunidadId || isUpdatingGestor) ? 'bg-neutral-100 text-neutral-400 cursor-not-allowed opacity-70' : 'bg-green-600 text-white hover:bg-green-700 active:scale-95'}`}
                                >
                                    {isUpdatingGestor ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    <span className="hidden sm:inline">Traspasar a </span>Gestión
                                </button>
                                <button onClick={() => toggleResuelto(selectedDetailIncidencia.id, selectedDetailIncidencia.resuelto)} className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase transition-all ${selectedDetailIncidencia.resuelto ? 'bg-white border-2 border-neutral-900' : 'bg-amber-400 hover:bg-amber-500'}`}>
                                    {selectedDetailIncidencia.resuelto ? <><span className="hidden sm:inline">Reabrir </span>Ticket</> : <><span className="hidden sm:inline">Resolver </span>Ticket</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modals for delete, reassign success, and export (same as incidencias but adapted) */}
            {/* ... simplified for brevity or similar to incidencias ... */}
            {/* Delete Confirmation Modal */}
            <DeleteConfirmationModal
                isOpen={showDeleteModal}
                onClose={() => {
                    setShowDeleteModal(false);
                    setItemToDelete(null);
                }}
                onConfirm={handleConfirmDelete}
                itemType="incidencia de Sofia"
                isDeleting={isDeleting}
            />

            {showReassignSuccessModal && (
                <div className="fixed inset-0 bg-neutral-900/60 z-[10000] flex items-end sm:items-center sm:justify-center sm:p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-sm p-6 text-center max-h-[92dvh] overflow-y-auto animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><Check className="w-8 h-8 text-green-600" /></div>
                        <h3 className="text-xl font-bold mb-2">Gestor Reasignado</h3>
                        <button onClick={() => setShowReassignSuccessModal(false)} className="w-full py-3 bg-neutral-900 text-white rounded-xl font-bold">Aceptar</button>
                    </div>
                </div>
            )}

            {/* Aplazar Modal */}
            {showAplazarModal && (
                <div className="fixed inset-0 bg-neutral-900/60 z-[10000] flex items-end sm:items-center sm:justify-center sm:p-4 backdrop-blur-sm">
                    <div
                        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-sm p-6 flex flex-col items-center max-h-[92dvh] overflow-y-auto animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                            <Pause className="w-8 h-8 text-orange-600" />
                        </div>
                        <h3 className="text-xl font-bold text-neutral-900 mb-2">Aplazar Ticket</h3>
                        <p className="text-neutral-500 mb-6 text-sm">Selecciona la fecha en la que quieres que el ticket vuelva a estar pendiente.</p>
                        <input
                            type="date"
                            value={aplazarDate}
                            onChange={(e) => setAplazarDate(e.target.value)}
                            min={new Date().toISOString().slice(0, 10)}
                            className="w-full border-2 border-neutral-200 rounded-xl px-4 py-3 text-sm font-medium text-neutral-900 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none transition-all mb-6"
                        />
                        <div className="flex gap-3 w-full">
                            <button
                                onClick={() => { setShowAplazarModal(false); setAplazarIncidenciaId(null); setAplazarDate(''); }}
                                className="flex-1 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-xl font-bold transition-all"
                            >Cancelar</button>
                            <button
                                onClick={aplazarTicket}
                                disabled={!aplazarDate}
                                className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                <Pause className="w-4 h-4" /> Aplazar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
