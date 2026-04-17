'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useGlobalLoading } from '@/lib/globalLoading';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'react-hot-toast';
import { Trash2, FileText, Check, Plus, Paperclip, Download, X, RotateCcw, Building, Users, Clock, Search, Filter, Loader2, AlertCircle, Eye, RefreshCw, Send, Save, Share2, MoreHorizontal, MessageSquare, ChevronDown, UserCog, Pause, CalendarClock, Pencil } from 'lucide-react';
import ModalActionsMenu from '@/components/ModalActionsMenu';
import DeleteConfirmationModal from '@/components/DeleteConfirmationModal';
import DataTable, { Column } from '@/components/DataTable';
import Badge from '@/components/ui/Badge';
import SearchableSelect from '@/components/SearchableSelect';
import PageHeader from '@/components/PageHeader';
import FilterBar from '@/components/FilterBar';
import FormSection from '@/components/FormSection';
import { logActivity } from '@/lib/logActivity';
import TimelineChat from '@/components/TimelineChat';
import { getSecureUrl } from '@/lib/storage';
import { Incidencia, incidenciaFormSchema, validateForm, Profile, ComunidadOption, DeleteCredentials } from '@/lib/schemas';

interface ImportPreviewRecord {
    status: 'ok' | 'skip';
    comunidad_name: string;
    comunidad_matched?: string;
    motivo: string;
    mensaje: string;
    fecha: string;
    source_raw: string;
    source_mapped?: string | null;
    reason?: string;
    chat_count: number;
    comunidad_not_found?: boolean;
}
interface ImportPreviewData {
    total_parsed: number;
    to_insert: number;
    to_skip: number;
    records: ImportPreviewRecord[];
}

export default function IncidenciasPage() {
    const [incidencias, setIncidencias] = useState<Incidencia[]>([]);
    const [comunidades, setComunidades] = useState<ComunidadOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [filterEstado, setFilterEstado] = useState('pendiente');
    const [filterGestor, setFilterGestor] = useState('all');
    const [filterComunidad, setFilterComunidad] = useState('all');

    // Selection & Export
    const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
    const [exporting, setExporting] = useState(false);

    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [files, setFiles] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);
    const [enviarAviso, setEnviarAviso] = useState<boolean | null>(null);
    const [notifEmail, setNotifEmail] = useState(false);
    const [notifWhatsapp, setNotifWhatsapp] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState<number | null>(null);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [isManualDate, setIsManualDate] = useState(false);

    const resetForm = () => {
        setShowForm(false);
        setEditingId(null);
        setFormData({ comunidad_id: '', nombre_cliente: '', telefono: '', email: '', motivo_ticket: '', mensaje: '', recibido_por: '', gestor_asignado: '', proveedor: '', source: '', fecha_registro: '' });
        setFiles([]);
        setEnviarAviso(null);
        setNotifEmail(false);
        setNotifWhatsapp(false);
        setFormErrors({});
    };

    const [formData, setFormData] = useState({
        comunidad_id: '',
        nombre_cliente: '',
        telefono: '',
        email: '',
        motivo_ticket: '',
        mensaje: '',
        // urgencia removed from creation
        recibido_por: '',
        gestor_asignado: '',
        proveedor: '', // Placeholder
        source: '',
        fecha_registro: new Date().toISOString().slice(0, 10),
    });

    // Delete state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<number | null>(null);
    const [deleteEmail, setDeleteEmail] = useState('');
    const [deletePassword, setDeletePassword] = useState('');
    const [isReassigning, setIsReassigning] = useState(false);
    const [newGestorId, setNewGestorId] = useState('');
    const [isUpdatingGestor, setIsUpdatingGestor] = useState(false);
    const [showReassignSuccessModal, setShowReassignSuccessModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Detail Modal State
    const [selectedDetailIncidencia, setSelectedDetailIncidencia] = useState<Incidencia | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [isUpdatingRecord, setIsUpdatingRecord] = useState(false);
    const detailFileInputRef = useRef<HTMLInputElement>(null);
    const [importingPdf, setImportingPdf] = useState(false);
    const pdfImportInputRef = useRef<HTMLInputElement>(null);

    // PDF Notes Modal State
    const [showExportModal, setShowExportModal] = useState(false);
    const [pendingExportParams, setPendingExportParams] = useState<{ type: 'csv' | 'pdf', ids?: number[], includeNotes?: boolean } | null>(null);

    // PDF Import Preview Modal State
    const [showImportPreviewModal, setShowImportPreviewModal] = useState(false);
    const [importPreviewData, setImportPreviewData] = useState<ImportPreviewData | null>(null);
    const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
    const [importRecordEstados, setImportRecordEstados] = useState<Record<number, 'Pendiente' | 'Resuelto'>>({});
    const [importRecordComunidades, setImportRecordComunidades] = useState<Record<number, number>>({});
    const [importReceptorName, setImportReceptorName] = useState<string>('');

    // Document Delete Confirmation
    const [showDeleteDocConfirm, setShowDeleteDocConfirm] = useState(false);
    const [urlToConfirmDelete, setUrlToConfirmDelete] = useState<string | null>(null);

    // Aplazar (Postpone) Modal State
    const [showAplazarModal, setShowAplazarModal] = useState(false);
    const [aplazarIncidenciaId, setAplazarIncidenciaId] = useState<number | null>(null);
    const [aplazarDate, setAplazarDate] = useState('');

    const { withLoading } = useGlobalLoading();

    const handleRowClick = (incidencia: Incidencia) => {
        setSelectedDetailIncidencia(incidencia);
        setShowDetailModal(true);
    };

    useEffect(() => {
        fetchInitialData();

        // Subscribe to real-time changes
        const channel = supabase
            .channel('incidencias-realtime')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'incidencias' },
                () => {
                    // Re-fetch all data to ensure joined fields (profiles, etc.) are correct.
                    // This is simpler and safer than manually merging updates with joined data.
                    fetchIncidencias();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Portal ready (client-only)
    const [portalReady, setPortalReady] = useState(false);
    useEffect(() => setPortalReady(true), []);

    // Prevent body scroll when any modal is open
    useEffect(() => {
        if (showForm || showDeleteModal || showExportModal || showDetailModal || showImportPreviewModal) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [showForm, showDeleteModal, showExportModal, showDetailModal, showImportPreviewModal]);

    const fetchInitialData = async () => {
        setLoading(true);
        await Promise.all([fetchComunidades(), fetchIncidencias(), fetchProfiles()]);
        setLoading(false);
    };

    const fetchProfiles = async () => {
        const { data } = await supabase.from('profiles').select('user_id, nombre, rol').eq('activo', true);
        if (data) setProfiles(data.filter(p => !p.nombre?.toLowerCase().startsWith('sofia-bot')));
    };

    const closeImportModal = () => {
        setShowImportPreviewModal(false);
        setPendingImportFile(null);
        setImportPreviewData(null);
        setImportRecordEstados({});
        setImportRecordComunidades({});
        setImportReceptorName('');
        if (pdfImportInputRef.current) pdfImportInputRef.current.value = '';
    };

    const handleImportPdf = async (file: File) => {
        await withLoading(async () => {
            setImportingPdf(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error('No hay sesión activa');
                const receptorProfile = profiles.find(p => p.user_id === user.id);
                const payload = new FormData();
                payload.append('pdf', file);
                payload.append('receptor_id', user.id);
                const response = await fetch('/api/incidencias/import-pdf?dryRun=true', { method: 'POST', body: payload });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || 'Error al procesar el PDF');
                setPendingImportFile(file);
                setImportPreviewData(result);
                setImportReceptorName(receptorProfile?.nombre ?? user.email ?? '');
                setShowImportPreviewModal(true);
            } catch (error) {
                console.error('Error al importar PDF:', error);
                toast.error(error instanceof Error ? error.message : 'Error al procesar el PDF');
                if (pdfImportInputRef.current) pdfImportInputRef.current.value = '';
            } finally {
                setImportingPdf(false);
            }
        }, 'Procesando PDF...');
    };

    const handleConfirmImport = async () => {
        if (!pendingImportFile || !importPreviewData) return;
        setShowImportPreviewModal(false);
        await withLoading(async () => {
            setImportingPdf(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error('No hay sesión activa');

                // Build arrays: estados and comunidades_override indexed by position in 'ok' records
                // For records that were skip but got a manual comunidad assigned, treat them as ok too
                const estadosArray: string[] = [];
                const comunidadesOverride: Record<number, number> = {}; // okIndex → comunidad_id
                let okIndex = 0;
                importPreviewData.records.forEach((rec, idx) => {
                    if (rec.status === 'ok') {
                        estadosArray.push(importRecordEstados[idx] || 'Pendiente');
                        okIndex++;
                    } else if (rec.status === 'skip' && rec.comunidad_not_found && importRecordComunidades[idx]) {
                        estadosArray.push(importRecordEstados[idx] || 'Pendiente');
                        comunidadesOverride[okIndex] = importRecordComunidades[idx];
                        okIndex++;
                    }
                });

                const payload = new FormData();
                payload.append('pdf', pendingImportFile);
                payload.append('receptor_id', user.id);
                payload.append('estados', JSON.stringify(estadosArray));
                payload.append('comunidades_override', JSON.stringify(comunidadesOverride));

                const response = await fetch('/api/incidencias/import-pdf', { method: 'POST', body: payload });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || 'Error al importar el PDF');
                toast.success(
                    `PDF importado: ${result.inserted} registros insertados de ${result.total_parsed} encontrados` +
                    (result.skipped > 0 ? ` (${result.skipped} omitidos)` : '')
                );
                fetchIncidencias();
            } catch (error) {
                console.error('Error al importar PDF:', error);
                toast.error(error instanceof Error ? error.message : 'Error al importar el PDF');
            } finally {
                setImportingPdf(false);
                setPendingImportFile(null);
                setImportPreviewData(null);
                setImportRecordEstados({});
                setImportRecordComunidades({});
                if (pdfImportInputRef.current) pdfImportInputRef.current.value = '';
            }
        }, 'Importando incidencias...');
    };

    const fetchComunidades = async () => {
        const { data } = await supabase.from('comunidades').select('id, nombre_cdad, codigo').eq('activo', true);
        if (data) setComunidades(data);
    };

    const fetchIncidencias = async () => {
        const { data, error } = await supabase
            .from('incidencias')
            .select(`
                *,
                comunidades (nombre_cdad, codigo),
                receptor:profiles!quien_lo_recibe (nombre),
                gestor:profiles!gestor_asignado (nombre),
                resolver:profiles!resuelto_por (nombre)
            `)
            .order('created_at', { ascending: false })
            .limit(5000);

        if (error) {
            toast.error('Error cargando incidencias');
        } else {
            // Map data to flatten nested objects for sorting
            const formattedData = (data || []).map((item: any) => ({
                ...item,
                comunidad: item.comunidades?.nombre_cdad || '',
                codigo: item.comunidades?.codigo || ''
            }));
            setIncidencias(formattedData);
        }
    };

    const handleFileUploads = async () => {
        if (files.length === 0) return [];
        setUploading(true);
        const urls: string[] = [];
        try {
            for (const file of files) {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('path', `incidencias/${Date.now()}`); // Folder per timestamp
                formData.append('bucket', 'documentos');

                const res = await fetch('/api/storage/upload', {
                    method: 'POST',
                    body: formData
                });

                if (!res.ok) {
                    const error = await res.json();
                    console.error('Error uploading file via API:', error);
                    continue;
                }

                const data = await res.json();
                if (data.publicUrl) {
                    urls.push(data.publicUrl);
                }
            }
        } catch (error) {
            console.error('Upload error:', error);
            toast.error('Error al subir algunos archivos');
        } finally {
            setUploading(false);
        }
        return urls;
    };

    const handleEdit = (incidencia: Incidencia) => {
        setEditingId(incidencia.id);
        setFormData({
            comunidad_id: incidencia.comunidad_id?.toString() || '',
            nombre_cliente: incidencia.nombre_cliente || '',
            telefono: incidencia.telefono || '',
            email: incidencia.email || '',
            motivo_ticket: incidencia.motivo_ticket || '',
            mensaje: incidencia.mensaje || '',
            recibido_por: incidencia.quien_lo_recibe || '',
            gestor_asignado: incidencia.gestor_asignado || '',
            proveedor: '',
            source: incidencia.source || '',
            fecha_registro: incidencia.created_at ? new Date(incidencia.created_at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        });
        setIsManualDate(false);
        setEnviarAviso(false);
        setFiles([]);
        setShowForm(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Inline field validation
        const errors: Record<string, string> = {};
        if (!formData.comunidad_id) errors.comunidad_id = 'Debes seleccionar una comunidad para poder guardar';
        if (!formData.nombre_cliente?.trim()) errors.nombre_cliente = 'El nombre del propietario es obligatorio';
        if (!formData.recibido_por) errors.recibido_por = 'Debes indicar quién recibió la incidencia';
        if (!formData.gestor_asignado) errors.gestor_asignado = 'Debes asignar un gestor para poder guardar el ticket';
        if (!formData.source) errors.source = 'Debes indicar la entrada del ticket';
        if (!formData.motivo_ticket?.trim()) errors.motivo_ticket = 'El motivo del ticket es obligatorio';
        if (!formData.mensaje?.trim()) errors.mensaje = 'El mensaje de la incidencia es obligatorio';

        const phoneRegex = /^\d{9}$/;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (formData.telefono && !phoneRegex.test(formData.telefono)) errors.telefono = 'El teléfono debe tener exactamente 9 dígitos sin espacios';
        if (formData.email && !emailRegex.test(formData.email)) errors.email = 'El formato del email no es válido';
        if (!editingId && notifEmail && !formData.email) errors.email = 'El email es obligatorio para notificar por Email';
        if (!editingId && notifWhatsapp && !formData.telefono) errors.telefono = 'El teléfono es obligatorio para notificar por WhatsApp';

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return;
        }
        setFormErrors({});

        if (isSubmitting) return;

        await withLoading(async () => {
        setIsSubmitting(true);
        const loadingToastId = toast.loading(editingId ? 'Actualizando ticket...' : 'Creando ticket... espere');

        try {
            const adjuntos = await handleFileUploads();
            const comunidad = comunidades.find(c => c.id === parseInt(formData.comunidad_id));

            if (editingId) {
                const updatePayload: any = {
                    comunidad_id: parseInt(formData.comunidad_id),
                    nombre_cliente: formData.nombre_cliente,
                    telefono: formData.telefono,
                    email: formData.email,
                    motivo_ticket: formData.motivo_ticket || null,
                    mensaje: formData.mensaje,
                    quien_lo_recibe: formData.recibido_por || null,
                    gestor_asignado: formData.gestor_asignado || null,
                    source: formData.source || null,
                };

                if (formData.fecha_registro) {
                    const existing = incidencias.find(i => i.id === editingId);
                    const originalDate = existing?.created_at ? new Date(existing.created_at).toISOString().slice(0, 10) : '';
                    if (formData.fecha_registro !== originalDate) {
                        updatePayload.created_at = new Date(formData.fecha_registro).toISOString();
                    }
                }

                if (adjuntos.length > 0) {
                    const existing = incidencias.find(i => i.id === editingId);
                    updatePayload.adjuntos = [...(existing?.adjuntos || []), ...adjuntos];
                }

                const { error } = await supabase
                    .from('incidencias')
                    .update(updatePayload)
                    .eq('id', editingId);

                if (error) throw error;

                toast.success('Ticket actualizado');

                const gestorAsignado = profiles.find(p => p.user_id === formData.gestor_asignado);
                await logActivity({
                    action: 'update',
                    entityType: 'incidencia',
                    entityId: editingId,
                    entityName: `Incidencia - ${formData.nombre_cliente}`,
                    details: {
                        id: editingId,
                        action: 'edit',
                        comunidad: comunidad?.nombre_cdad,
                        mensaje: formData.mensaje,
                        asignado_a: gestorAsignado?.nombre || 'Sin asignar'
                    }
                });
            } else {
                const { data: insertedData, error } = await supabase.from('incidencias').insert([{
                    comunidad_id: parseInt(formData.comunidad_id),
                    nombre_cliente: formData.nombre_cliente,
                    telefono: formData.telefono,
                    email: formData.email,
                    motivo_ticket: formData.motivo_ticket || null,
                    mensaje: formData.mensaje,
                    quien_lo_recibe: formData.recibido_por || null,
                    // @ts-ignore
                    adjuntos: adjuntos,
                    // @ts-ignore
                    gestor_asignado: formData.gestor_asignado || null,
                    aviso: (!notifEmail && !notifWhatsapp) ? 0 : (notifWhatsapp && !notifEmail) ? 1 : (!notifWhatsapp && notifEmail) ? 2 : 3,
                    source: formData.source || null,
                    ...(formData.fecha_registro ? { created_at: new Date(formData.fecha_registro).toISOString() } : {})
                }]).select();

                if (error) throw error;

                const incidenciaId = insertedData?.[0]?.id;

                toast.success('Incidencia creada');

                const gestorAsignado = profiles.find(p => p.user_id === formData.gestor_asignado);
                const gestorAsignadoNombre = gestorAsignado?.nombre || 'Sin asignar';
                const receptorProfile = profiles.find(p => p.user_id === formData.recibido_por);
                await logActivity({
                    action: 'create',
                    entityType: 'incidencia',
                    entityId: incidenciaId,
                    entityName: `Incidencia - ${formData.nombre_cliente}`,
                    details: {
                        comunidad: comunidad?.nombre_cdad,
                        recibido_por: receptorProfile?.nombre || 'Sin especificar',
                        asignado_a: gestorAsignadoNombre,
                        entrada: formData.source || 'Sin especificar',
                    }
                });

                // Webhook disparado por Supabase nativo (INSERT en incidencias → trigger-new-ticket)
            }

            setShowForm(false);
            setEditingId(null);
            setFormData({
                comunidad_id: '',
                nombre_cliente: '',
                telefono: '',
                email: '',
                motivo_ticket: '',
                mensaje: '',
                recibido_por: '',
                gestor_asignado: '',
                proveedor: '',
                source: '',
                fecha_registro: '',
            });
            setFiles([]);
            setEnviarAviso(null);
            setNotifEmail(false);
            setNotifWhatsapp(false);
            fetchIncidencias();
        } catch (error: any) {
            toast.error('Error: ' + error.message);
        } finally {
            toast.dismiss(loadingToastId);
            setIsSubmitting(false);
        }
        }, 'Guardando incidencia...');
    };

    const handleDetailFileUpload = async (files: FileList) => {
        if (!selectedDetailIncidencia) return;

        await withLoading(async () => {
        setIsUpdatingRecord(true);
        const loadingToast = toast.loading('Subiendo archivos...');

        try {
            const newUrls: string[] = [];
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const formData = new FormData();
                formData.append('file', file);
                formData.append('path', `incidencias/${selectedDetailIncidencia.id}`);
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
                if (data.publicUrl) {
                    newUrls.push(data.publicUrl);
                }
            }

            const currentAdjuntos = selectedDetailIncidencia.adjuntos || [];
            const updatedAdjuntos = [...currentAdjuntos, ...newUrls];

            const { error: updateError } = await supabase
                .from('incidencias')
                .update({ adjuntos: updatedAdjuntos })
                .eq('id', selectedDetailIncidencia.id);

            if (updateError) throw updateError;

            setSelectedDetailIncidencia({
                ...selectedDetailIncidencia,
                adjuntos: updatedAdjuntos
            });

            setIncidencias(prev => prev.map(i => i.id === selectedDetailIncidencia.id ? { ...i, adjuntos: updatedAdjuntos } : i));

            // Log activity
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                // record_messages log
                await supabase.from('record_messages').insert([{
                    entity_type: 'incidencia',
                    entity_id: selectedDetailIncidencia.id,
                    user_id: user.id,
                    content: `📎 SE HAN ADJUNTO ${newUrls.length} NUEVOS DOCUMENTOS AL TICKET.`
                }]);
            }

            await logActivity({
                action: 'update',
                entityType: 'incidencia',
                entityId: selectedDetailIncidencia.id,
                entityName: `Incidencia - ${selectedDetailIncidencia.nombre_cliente}`,
                details: {
                    acción: 'Documentos adjuntos añadidos',
                    cantidad_nuevos: newUrls.length,
                    total_documentos: updatedAdjuntos.length,
                    comunidad: selectedDetailIncidencia.comunidades?.nombre_cdad || selectedDetailIncidencia.comunidad || 'N/A'
                }
            });

            toast.success('Archivos añadidos hoy', { id: loadingToast });
        } catch (error: any) {
            console.error(error);
            toast.error('Error al subir archivos', { id: loadingToast });
        } finally {
            setIsUpdatingRecord(false);
        }
        }, 'Subiendo archivos...');
    };

    const handleDeleteAttachment = async () => {
        if (!selectedDetailIncidencia || !urlToConfirmDelete) return;

        setShowDeleteDocConfirm(false);
        const urlToDelete = urlToConfirmDelete;
        setUrlToConfirmDelete(null);

        await withLoading(async () => {
        setIsUpdatingRecord(true);
        const loadingToast = toast.loading('Eliminando archivo...');

        try {
            // 1. Extract bucket and path from URL if it's our proxy URL
            let bucket = 'documentos';
            let path = '';

            if (urlToDelete.includes('/api/storage/view')) {
                const urlObj = new URL(urlToDelete, window.location.origin);
                bucket = urlObj.searchParams.get('bucket') || 'documentos';
                path = urlObj.searchParams.get('path') || '';
            } else if (urlToDelete.includes('.supabase.co/storage/v1/object/public/')) {
                const parts = urlToDelete.split('/object/public/')[1].split('/');
                bucket = parts[0];
                path = parts.slice(1).join('/');
            }

            // 2. Delete from storage if we have a path
            if (path) {
                const res = await fetch('/api/storage/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ bucket, path })
                });

                if (!res.ok) {
                    const error = await res.json();
                    console.warn('[Storage Delete] Could not delete file from storage:', error.error);
                }
            }

            // 3. Update database
            const currentAdjuntos = selectedDetailIncidencia.adjuntos || [];
            const updatedAdjuntos = currentAdjuntos.filter(url => url !== urlToDelete);

            const { error: updateError } = await supabase
                .from('incidencias')
                .update({ adjuntos: updatedAdjuntos })
                .eq('id', selectedDetailIncidencia.id);

            if (updateError) throw updateError;

            // 4. Update local state
            setSelectedDetailIncidencia({
                ...selectedDetailIncidencia,
                adjuntos: updatedAdjuntos
            });

            setIncidencias(prev => prev.map(i => i.id === selectedDetailIncidencia.id ? { ...i, adjuntos: updatedAdjuntos } : i));

            // Log activity
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                // record_messages log
                await supabase.from('record_messages').insert([{
                    entity_type: 'incidencia',
                    entity_id: selectedDetailIncidencia.id,
                    user_id: user.id,
                    content: `🗑️ SE HA ELIMINADO UN DOCUMENTO ADJUNTO DEL TICKET.`
                }]);
            }

            await logActivity({
                action: 'update',
                entityType: 'incidencia',
                entityId: selectedDetailIncidencia.id,
                entityName: `Incidencia - ${selectedDetailIncidencia.nombre_cliente}`,
                details: {
                    acción: 'Documento adjunto eliminado',
                    comunidad: selectedDetailIncidencia.comunidades?.nombre_cdad || selectedDetailIncidencia.comunidad || 'N/A'
                }
            });

            toast.success('Documento eliminado', { id: loadingToast });
        } catch (error: any) {
            console.error(error);
            toast.error('Error al eliminar el documento', { id: loadingToast });
        } finally {
            setIsUpdatingRecord(false);
        }
        }, 'Eliminando adjunto...');
    };

    const toggleResuelto = async (id: number, currentStatus: boolean) => {
        if (isUpdatingStatus === id) return;
        await withLoading(async () => {
        setIsUpdatingStatus(id);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const newResuelto = !currentStatus;
            const newEstado = newResuelto ? 'Resuelto' : 'Pendiente';
            const { error } = await supabase
                .from('incidencias')
                .update({
                    resuelto: newResuelto,
                    estado: newEstado,
                    dia_resuelto: newResuelto ? new Date().toISOString() : null,
                    resuelto_por: newResuelto ? user?.id : null,
                    fecha_recordatorio: null // Clear reminder if resolving/reopening
                })
                .eq('id', id);

            if (error) throw error;

            toast.success(currentStatus ? 'Marcado como pendiente' : 'Marcado como resuelto');

            setIncidencias(prev => prev.map(i => i.id === id ? {
                ...i,
                resuelto: newResuelto,
                estado: newEstado as any,
                dia_resuelto: newResuelto ? new Date().toISOString() : undefined,
                resuelto_por: newResuelto ? user?.id : undefined,
                fecha_recordatorio: undefined
            } : i));

            // Log activity
            const incidencia = incidencias.find(i => i.id === id);
            await logActivity({
                action: 'update',
                entityType: 'incidencia',
                entityId: id,
                entityName: `Incidencia - ${incidencia?.nombre_cliente}`,
                details: {
                    id: id,
                    comunidad: incidencia?.comunidades?.nombre_cdad,
                    resuelto: newResuelto,
                    estado: newEstado
                }
            });

            // Webhook de resolución disparado por Supabase nativo (UPDATE en incidencias → trigger-resolved-ticket)
        } catch (error) {
            console.error(error);
            toast.error('Error al actualizar estado');
        } finally {
            setIsUpdatingStatus(null);
        }
        }, currentStatus ? 'Reabriendo incidencia...' : 'Resolviendo incidencia...');
    };

    const reactivarDesdeAplazado = async (id: number) => {
        if (isUpdatingStatus === id) return;
        await withLoading(async () => {
            setIsUpdatingStatus(id);
            try {
                const { error } = await supabase
                    .from('incidencias')
                    .update({ estado: 'Pendiente', fecha_recordatorio: null })
                    .eq('id', id);
                if (error) throw error;
                toast.success('Ticket vuelto a Pendiente');
                setIncidencias(prev => prev.map(i => i.id === id ? { ...i, estado: 'Pendiente' as any, fecha_recordatorio: undefined } : i));
            } catch (error) {
                console.error(error);
                toast.error('Error al reactivar ticket');
            } finally {
                setIsUpdatingStatus(null);
            }
        }, 'Reactivando ticket...');
    };

    const openAplazarModal = (id: number) => {
        setAplazarIncidenciaId(id);
        // Default: tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateStr = tomorrow.toISOString().slice(0, 10); // yyyy-MM-dd
        setAplazarDate(dateStr);
        setShowAplazarModal(true);
    };

    const aplazarTicket = async () => {
        if (!aplazarIncidenciaId || !aplazarDate) return;

        await withLoading(async () => {
        const loadingToast = toast.loading('Aplazando ticket...');
        try {
            const { data: { user } } = await supabase.auth.getUser();

            const { error } = await supabase
                .from('incidencias')
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

            // Record in timeline chat
            if (user) {
                await supabase.from('record_messages').insert([{
                    entity_type: 'incidencia',
                    entity_id: aplazarIncidenciaId,
                    user_id: user.id,
                    content: `⏱️ TICKET APLAZADO HASTA: ${fechaFormateada}`
                }]);
            }

            // Log activity
            const incidencia = incidencias.find(i => i.id === aplazarIncidenciaId);
            await logActivity({
                action: 'update',
                entityType: 'incidencia',
                entityId: aplazarIncidenciaId,
                entityName: `Incidencia - ${incidencia?.nombre_cliente}`,
                details: {
                    acción: 'Ticket aplazado',
                    fecha_recordatorio: fechaFormateada,
                    comunidad: incidencia?.comunidades?.nombre_cdad || incidencia?.comunidad || 'N/A'
                }
            });

            // Optimistic update
            setIncidencias(prev => prev.map(i => i.id === aplazarIncidenciaId ? {
                ...i,
                estado: 'Aplazado' as any,
                resuelto: false,
                fecha_recordatorio: aplazarDate
            } : i));

            // Update detail modal if open
            if (selectedDetailIncidencia && selectedDetailIncidencia.id === aplazarIncidenciaId) {
                setSelectedDetailIncidencia({
                    ...selectedDetailIncidencia,
                    estado: 'Aplazado',
                    resuelto: false,
                    fecha_recordatorio: aplazarDate
                });
            }

            toast.success(`Ticket aplazado hasta ${fechaFormateada}`, { id: loadingToast });
            setShowAplazarModal(false);
            setAplazarIncidenciaId(null);
            setAplazarDate('');
        } catch (error: any) {
            console.error(error);
            toast.error('Error al aplazar el ticket', { id: loadingToast });
        }
        }, 'Aplazando ticket...');
    };

    const handleExport = async (type: 'csv' | 'pdf', idsOverride?: number[], includeNotesFromModal?: boolean) => {
        const idsToExport = idsOverride || Array.from(selectedIds);
        if (idsToExport.length === 0) return;

        // If overriding IDs (from modal), imply detail view if single item
        const isDetailView = !!idsOverride && idsToExport.length === 1 && type === 'pdf';

        // Custom Modal Logic
        if (isDetailView && includeNotesFromModal === undefined) {
            setPendingExportParams({ type, ids: idsOverride });
            setShowExportModal(true);
            return;
        }

        const includeNotes = includeNotesFromModal !== undefined ? includeNotesFromModal : false;

        const label = type === 'pdf' ? 'Generando PDF...' : 'Exportando CSV...';
        await withLoading(async () => {
        setExporting(true);
        try {
            const res = await fetch('/api/incidencias/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ids: idsToExport,
                    type,
                    layout: isDetailView ? 'detail' : 'list',
                    includeNotes
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

            // Filename Logic
            const now = new Date();
            const dateStr = `${now.getDate().toString().padStart(2, '0')}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getFullYear()}`;

            if (isDetailView) {
                a.download = `ticket_${idsToExport[0]}_${dateStr}.pdf`;
            } else {
                a.download = `listado_incidencias_${dateStr}.${type === 'csv' ? 'csv' : 'pdf'}`;
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
        }, label);
    };

    const handleDeleteClick = (id: number) => {
        setItemToDelete(id);
        setDeleteEmail('');
        setDeletePassword('');
        setShowDeleteModal(true);
    };

    const handleConfirmDelete = async ({ email, password }: any) => {
        if (!itemToDelete || !email || !password) return;

        await withLoading(async () => {
        setIsDeleting(true);
        try {
            const res = await fetch('/api/admin/universal-delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: itemToDelete,
                    email,
                    password,
                    type: 'incidencia'
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Error al eliminar');
            }

            toast.success('Incidencia eliminada correctamente');
            setIncidencias(prev => prev.filter(i => i.id !== itemToDelete));
            setShowDeleteModal(false);
            setItemToDelete(null);

            // Log delete activity
            await logActivity({
                action: 'delete',
                entityType: 'incidencia',
                entityId: itemToDelete,
                entityName: `Incidencia Deleted`,
                details: {
                    id: itemToDelete,
                    deleted_by_admin: email
                }
            });

        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsDeleting(false);
        }
        }, 'Eliminando incidencia...');
    };

    const handleUpdateGestor = async () => {
        if (!selectedDetailIncidencia || !newGestorId) return;

        await withLoading(async () => {
        setIsUpdatingGestor(true);
        try {
            // Obtener info del usuario actual
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Usuario no autenticado');

            const { error } = await supabase
                .from('incidencias')
                .update({ gestor_asignado: newGestorId })
                .eq('id', selectedDetailIncidencia.id);

            if (error) throw error;

            // toast.success('Gestor reasignado correctamente'); // Replaced by modal

            // Actualizar estado local
            const newGestorProfile = profiles.find(p => p.user_id === newGestorId);
            const oldGestorName = selectedDetailIncidencia.gestor?.nombre || 'Sin asignar';
            const newGestorName = newGestorProfile?.nombre || 'Desconocido';

            setSelectedDetailIncidencia({
                ...selectedDetailIncidencia,
                gestor_asignado: newGestorId,
                gestor: newGestorProfile ? { nombre: newGestorProfile.nombre } : selectedDetailIncidencia.gestor
            });

            // Actualizar lista principal
            setIncidencias(prev => prev.map(inc =>
                inc.id === selectedDetailIncidencia.id
                    ? { ...inc, gestor_asignado: newGestorId, gestor: newGestorProfile ? { nombre: newGestorProfile.nombre } : inc.gestor }
                    : inc
            ));

            // 1. Insertar mensaje en el Timeline (Chat)
            await supabase
                .from('record_messages')
                .insert({
                    entity_type: 'incidencia',
                    entity_id: selectedDetailIncidencia.id,
                    user_id: user.id,
                    content: `🔄 TICKET REASIGNADO\nDe: ${oldGestorName}\nA: ${newGestorName}`
                });

            // 2. Crear Notificación para el nuevo gestor
            if (newGestorId !== user.id) { // No notificarse a sí mismo si se autoasigna
                await supabase
                    .from('notifications')
                    .insert({
                        user_id: newGestorId,
                        type: 'assignment',
                        title: 'Nueva Asignación de Ticket',
                        content: `Se te ha asignado la incidencia #${selectedDetailIncidencia.id} (Reasignado por reasignación)`,
                        entity_id: selectedDetailIncidencia.id,
                        entity_type: 'incidencia',
                        link: `/dashboard/incidencias?id=${selectedDetailIncidencia.id}`,
                        is_read: false
                    });
            }

            // 3. Log de Actividad del Sistema
            const currentUserProfile = profiles.find(p => p.user_id === user.id);
            const currentUserName = currentUserProfile?.nombre || user.email || 'Desconocido';
            await logActivity({
                action: 'update',
                entityType: 'incidencia',
                entityId: selectedDetailIncidencia.id,
                entityName: `Incidencia #${selectedDetailIncidencia.id}`,
                details: {
                    change: 'reasignacion',
                    old_gestor: oldGestorName,
                    new_gestor: newGestorName,
                    by: currentUserName
                }
            });

            setIsReassigning(false);
            setNewGestorId('');
            setShowReassignSuccessModal(true);

        } catch (error: any) {
            console.error('Error updating gestor:', error);
            toast.error('Error al reasignar gestor');
        } finally {
            setIsUpdatingGestor(false);
        }
        }, 'Reasignando gestor...');
    };

    const filteredIncidencias = incidencias.filter(inc => {
        const estado = inc.estado || (inc.resuelto ? 'Resuelto' : 'Pendiente');
        const matchesEstado =
            filterEstado === 'pendiente' ? estado === 'Pendiente' :
            filterEstado === 'resuelto' ? estado === 'Resuelto' :
            filterEstado === 'aplazado' ? estado === 'Aplazado' :
            true; // 'all'

        const matchesGestor = filterGestor === 'all' ? true : inc.gestor_asignado === filterGestor;
        const matchesComunidad = filterComunidad === 'all' ? true : inc.comunidad_id === Number(filterComunidad);

        return matchesEstado && matchesGestor && matchesComunidad;
    });

    const columns: Column<Incidencia>[] = [
        {
            key: 'id',
            label: 'ID',
        },
        {
            key: 'codigo',
            label: 'Código',
            render: (row) => (
                <div className="flex items-start gap-3">
                    <span className={`mt-1 h-3.5 w-1.5 rounded-full ${(row.estado || (row.resuelto ? 'Resuelto' : 'Pendiente')) === 'Resuelto' ? 'bg-neutral-900' : (row.estado === 'Aplazado' ? 'bg-orange-400' : 'bg-yellow-400')}`} />
                    <span className="font-semibold">{row.comunidades?.codigo || '-'}</span>
                </div>
            ),
        },
        {
            key: 'comunidad',
            label: 'Comunidad',
            render: (row) => row.comunidad || (row.comunidades?.nombre_cdad) || '-',
        },
        {
            key: 'nombre_cliente',
            label: 'Cliente',
        },
        {
            key: 'telefono',
            label: 'Teléfono',
        },
        {
            key: 'email',
            label: 'Email',
            render: (row) => <span className="text-xs">{row.email || '-'}</span>,
        },
        {
            key: 'source',
            label: 'Entrada',
            render: (row) => {
                if (!row.source) return <span className="text-neutral-400">-</span>;
                const icons: Record<string, string> = {
                    'Llamada': '📞',
                    'Presencial': '🤝',
                    'Email': '📧',
                    'Whatsapp': '💬',
                    'App 360': '📱',
                    'Acuerdo Junta': '📋',
                    'Gestión Interna': '🏢',
                };
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 text-[11px] font-medium capitalize">
                        {icons[row.source] || ''} {row.source}
                    </span>
                );
            },
        },
        {
            key: 'motivo_ticket',
            label: 'Motivo Ticket',
            render: (row) => (
                <div className="max-w-xs truncate text-xs" title={row.motivo_ticket || ''}>
                    {row.motivo_ticket || '-'}
                </div>
            ),
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
            key: 'nota_gestor',
            label: 'Nota Gestor',
            defaultVisible: false,
        },
        {
            key: 'nota_propietario',
            label: 'Nota Prop.',
            defaultVisible: false,
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
                                title={`Ver adjunto ${i + 1}`}
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
            render: (row) => new Date(row.created_at).toLocaleDateString(),
        },
        {
            key: 'gestor_asignado',
            label: 'Gestor',
            render: (row) => {
                const joinedName = (row as any).gestor?.nombre;
                if (joinedName) return joinedName;
                const localProfile = profiles.find(p => p.user_id === row.gestor_asignado);
                return localProfile?.nombre || row.gestor_asignado || '-';
            },
        },
        {
            key: 'quien_lo_recibe',
            label: 'Receptor',
            render: (row) => {
                const joinedName = (row as any).receptor?.nombre;
                if (joinedName) return joinedName;
                const localProfile = profiles.find(p => p.user_id === row.quien_lo_recibe);
                return localProfile?.nombre || row.quien_lo_recibe || '-';
            },
        },
        {
            key: 'aviso',
            label: 'Aviso',
            render: (row) => {
                const v = Number(row.aviso);
                const labels: Record<number, { text: string; cls: string }> = {
                    0: { text: 'Sin aviso', cls: 'bg-neutral-100 text-neutral-500' },
                    1: { text: 'WhatsApp', cls: 'bg-green-100 text-green-700' },
                    2: { text: 'Email', cls: 'bg-blue-100 text-blue-700' },
                    3: { text: 'Ambos', cls: 'bg-indigo-100 text-indigo-700' },
                };
                const label = labels[v];
                return (
                    <div className="flex justify-center">
                        {label
                            ? <span className={`${label.cls} px-2 py-0.5 rounded-full text-[10px] font-bold`}>{label.text}</span>
                            : <span className="text-neutral-400">-</span>
                        }
                    </div>
                );
            },
        },
        {
            key: 'categoria',
            label: 'Categoría',
        },
        {
            key: 'urgencia',
            label: 'Urgencia',
            render: (row) => (
                <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${row.urgencia === 'Alta' ? 'bg-red-100 text-red-700' :
                    row.urgencia === 'Media' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-blue-100 text-blue-700'
                    }`}>
                    {row.urgencia}
                </span>
            ),
        },
        {
            key: 'sentimiento',
            label: 'Sentimiento',
        },
        {
            key: 'resuelto',
            label: 'Estado',
            render: (row) => {
                const estado = row.estado || (row.resuelto ? 'Resuelto' : 'Pendiente');
                return (
                    <div className="flex flex-col items-start gap-1">
                        <Badge variant={
                            estado === 'Resuelto' ? 'success' :
                            estado === 'Aplazado' ? 'info' :
                            'warning'
                        }>
                            {estado === 'Aplazado' && <Pause className="w-3 h-3 inline mr-0.5" />}
                            {estado}
                        </Badge>
                        {estado === 'Aplazado' && row.fecha_recordatorio && (
                            <span className="text-[10px] text-orange-500 font-medium flex items-center gap-1">
                                <CalendarClock className="w-3 h-3" />
                                {new Date(row.fecha_recordatorio).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                            </span>
                        )}
                    </div>
                );
            },
            sortable: false,
        },
        {
            key: 'dia_resuelto',
            label: 'Día Res.',
            render: (row) => row.dia_resuelto ? new Date(row.dia_resuelto).toLocaleDateString() : '-',
            defaultVisible: false,
        },
        {
            key: 'resuelto_por',
            label: 'Resuelto Por',
            render: (row) => row.resolver?.nombre || '-',
            defaultVisible: false,
        },
    ];

    return (
        <div className="space-y-6">
            <input
                ref={pdfImportInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImportPdf(file);
                }}
            />
            <PageHeader
                title="Gestión de Tickets"
                showForm={showForm}
                onToggleForm={() => {
                    setEditingId(null);
                    setFormData({ comunidad_id: '', nombre_cliente: '', telefono: '', email: '', motivo_ticket: '', mensaje: '', recibido_por: '', gestor_asignado: '', proveedor: '', source: '', fecha_registro: new Date().toISOString().slice(0, 10) });
                    setIsManualDate(false);
                    setEnviarAviso(null);
                    setFiles([]);
                    setFormErrors({});
                    setShowForm(!showForm);
                }}
                newButtonLabel="Nuevo Ticket"
                newButtonShortLabel="Ticket"
                extraButtons={
                    <button
                        onClick={() => pdfImportInputRef.current?.click()}
                        disabled={importingPdf}
                        className="bg-neutral-200 hover:bg-neutral-300 text-neutral-800 px-3 py-2 rounded-md flex items-center gap-1.5 transition font-semibold text-sm disabled:opacity-50"
                    >
                        {importingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4 flex-shrink-0" />}
                        <span className="hidden sm:inline">Importar desde PDF</span>
                        <span className="sm:hidden">Importar</span>
                    </button>
                }
            />

            {/* Filters and Actions */}
            <div className="flex flex-col gap-3">
                <FilterBar
                    value={filterEstado}
                    onChange={(v) => setFilterEstado(v)}
                    options={[
                        { value: 'pendiente', label: 'Pendientes', activeClass: 'bg-yellow-400 text-neutral-950' },
                        { value: 'aplazado', label: 'Aplazadas', activeClass: 'bg-orange-400 text-white' },
                        { value: 'resuelto', label: 'Resueltas', activeClass: 'bg-neutral-900 text-white' },
                        { value: 'all', label: 'Todas', activeClass: 'bg-neutral-900 text-white' },
                    ]}
                />

                {/* Export Actions (Visible only if selection) */}
                {selectedIds.size > 0 && (
                    <div className="flex gap-2 items-center animate-in fade-in slide-in-from-bottom-2">
                        <span className="text-sm font-medium text-neutral-500 mr-2">{selectedIds.size} seleccionados</span>

                        <button
                            onClick={() => handleExport('csv')}
                            disabled={exporting}
                            className="bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition disabled:opacity-50"
                        >
                            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4 text-green-600" />}
                            CSV
                        </button>

                        <button
                            onClick={() => handleExport('pdf')}
                            disabled={exporting}
                            className="bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition disabled:opacity-50"
                        >
                            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 text-red-600" />}
                            PDF
                        </button>
                    </div>
                )}
            </div>

            {/* Form Modal */}
            {portalReady && showForm && createPortal(
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex justify-center items-end sm:items-center sm:p-6"
                >
                    <div
                        className="bg-white w-full max-w-4xl rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[92dvh] sm:max-h-[90dvh] animate-in fade-in slide-in-from-bottom sm:zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex justify-between items-center px-5 py-4 border-b border-neutral-100 bg-neutral-50">
                            <div>
                                <h2 className="text-lg font-bold text-neutral-900 tracking-tight">
                                    {editingId ? 'Editar Ticket' : 'Nuevo Ticket'}
                                </h2>
                                <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-0.5">
                                    Complete los datos de la incidencia
                                </p>
                            </div>
                            <button
                                onClick={resetForm}
                                className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-4 sm:px-5 sm:py-4 overflow-y-auto custom-scrollbar flex-1">
                            <form id="incidencia-form" onSubmit={handleSubmit} className="space-y-4">
                                {/* Section 1: Identificación del Cliente */}
                                <div>
                                    <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-3 border-b border-yellow-400">Identificación del Cliente</h3>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
                                        <div className="md:col-span-2">
                                            <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">
                                                Comunidad <span className="text-red-500">*</span>
                                            </label>
                                            <SearchableSelect
                                                value={formData.comunidad_id}
                                                onChange={(val) => { setFormData({ ...formData, comunidad_id: String(val) }); setFormErrors(prev => ({ ...prev, comunidad_id: '' })); }}
                                                options={comunidades.map(cd => ({
                                                    value: String(cd.id),
                                                    label: cd.codigo ? `${cd.codigo} - ${cd.nombre_cdad}` : cd.nombre_cdad
                                                }))}
                                                placeholder="Buscar comunidad..."
                                            />
                                            {formErrors.comunidad_id && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.comunidad_id}</p>}
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">
                                                Nombre Propietario <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Nombre completo"
                                                className={`w-full rounded-lg border bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400 focus:bg-white transition placeholder:text-neutral-400 ${formErrors.nombre_cliente ? 'border-red-400' : 'border-neutral-200'}`}
                                                value={formData.nombre_cliente}
                                                onChange={e => { setFormData({ ...formData, nombre_cliente: e.target.value }); setFormErrors(prev => ({ ...prev, nombre_cliente: '' })); }}
                                            />
                                            {formErrors.nombre_cliente && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.nombre_cliente}</p>}
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">
                                                Teléfono Cliente
                                            </label>
                                            <input
                                                type="tel"
                                                placeholder="Ej: 600000000"
                                                className={`w-full rounded-lg border bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400 focus:bg-white transition placeholder:text-neutral-400 ${formErrors.telefono ? 'border-red-400' : 'border-neutral-200'}`}
                                                value={formData.telefono}
                                                onChange={e => { setFormData({ ...formData, telefono: e.target.value }); setFormErrors(prev => ({ ...prev, telefono: '', contacto: '' })); }}
                                            />
                                            {formErrors.telefono
                                                ? <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.telefono}</p>
                                                : <p className="mt-1 flex items-center gap-1.5 text-[10px] font-bold text-neutral-400 uppercase tracking-wider"><AlertCircle className="w-3 h-3" /> Sin espacios y sin prefijo</p>
                                            }
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">
                                                Email Cliente
                                            </label>
                                            <input
                                                type="email"
                                                placeholder="ejemplo@correo.com"
                                                className={`w-full rounded-lg border bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400 focus:bg-white transition placeholder:text-neutral-400 ${formErrors.email ? 'border-red-400' : 'border-neutral-200'}`}
                                                value={formData.email}
                                                onChange={e => { setFormData({ ...formData, email: e.target.value }); setFormErrors(prev => ({ ...prev, email: '', contacto: '' })); }}
                                            />
                                            {formErrors.email && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.email}</p>}
                                            {formErrors.contacto && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.contacto}</p>}
                                        </div>
                                    </div>
                                </div>

                                {/* Section 2: Datos de la Incidencia */}
                                <div>
                                    <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-3 border-b border-yellow-400">Datos de la Incidencia</h3>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
                                        <div className="md:col-span-2">
                                        <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">
                                                Entrada (Fuente) <span className="text-red-500">*</span>
                                            </label>
                                            <SearchableSelect
                                                value={formData.source}
                                                onChange={(val) => { setFormData({ ...formData, source: String(val) }); setFormErrors(prev => ({ ...prev, source: '' })); }}
                                                options={[
                                                    { value: 'Llamada', label: '📞 Llamada' },
                                                    { value: 'Presencial', label: '🤝 Presencial' },
                                                    { value: 'Email', label: '📧 Email' },
                                                    { value: 'Whatsapp', label: '💬 Whatsapp' },
                                                    { value: 'App 360', label: '📱 App 360' },
                                                    { value: 'Acuerdo Junta', label: '📋 Acuerdo Junta' },
                                                    { value: 'Gestión Interna', label: '🏢 Gestión Interna' },
                                                ]}
                                                placeholder="Seleccionar entrada..."
                                            />
                                            {formErrors.source && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.source}</p>}
                                        </div>
                                        <div className="md:col-span-2">
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                                                    Fecha de Registro
                                                </label>
                                                <div className="flex items-center gap-1.5">
                                                    <input
                                                        type="checkbox"
                                                        id="manual-date"
                                                        checked={isManualDate}
                                                        onChange={(e) => {
                                                            setIsManualDate(e.target.checked);
                                                            if (!e.target.checked) {
                                                                setFormData(prev => ({ ...prev, fecha_registro: new Date().toISOString().slice(0, 10) }));
                                                            }
                                                        }}
                                                        className="w-3 h-3 rounded border-neutral-300 text-yellow-500 focus:ring-yellow-400"
                                                    />
                                                    <label htmlFor="manual-date" className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest cursor-pointer hover:text-neutral-600 transition-colors">
                                                        Modificar
                                                    </label>
                                                </div>
                                            </div>
                                            <input
                                                type="date"
                                                disabled={!isManualDate}
                                                className={`w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400 transition ${!isManualDate ? 'bg-neutral-100 cursor-not-allowed opacity-70' : 'bg-neutral-50/60 focus:bg-white'}`}
                                                value={formData.fecha_registro}
                                                onChange={e => setFormData({ ...formData, fecha_registro: e.target.value })}
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">
                                                Quién lo Recibió <span className="text-red-500">*</span>
                                            </label>
                                            <SearchableSelect
                                                value={formData.recibido_por}
                                                onChange={(val) => { setFormData({ ...formData, recibido_por: String(val) }); setFormErrors(prev => ({ ...prev, recibido_por: '' })); }}
                                                options={profiles.map(p => ({
                                                    value: p.user_id,
                                                    label: p.nombre
                                                }))}
                                                placeholder="Buscar persona..."
                                            />
                                            {formErrors.recibido_por && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.recibido_por}</p>}
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">
                                                Gestor Asignado <span className="text-red-500">*</span>
                                            </label>
                                            <SearchableSelect
                                                value={formData.gestor_asignado}
                                                onChange={(val) => { setFormData({ ...formData, gestor_asignado: String(val) }); setFormErrors(prev => ({ ...prev, gestor_asignado: '' })); }}
                                                options={profiles.map(p => ({
                                                    value: p.user_id,
                                                    label: `${p.nombre} (${p.rol})`
                                                }))}
                                                placeholder="Buscar gestor..."
                                            />
                                            {formErrors.gestor_asignado && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.gestor_asignado}</p>}
                                        </div>
                                        <div className="md:col-span-4">
                                            <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">
                                                Motivo Ticket <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Motivo principal del ticket..."
                                                className={`w-full rounded-lg border bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400 focus:bg-white transition placeholder:text-neutral-400 ${formErrors.motivo_ticket ? 'border-red-400' : 'border-neutral-200'}`}
                                                value={formData.motivo_ticket}
                                                onChange={e => { setFormData({ ...formData, motivo_ticket: e.target.value }); setFormErrors(prev => ({ ...prev, motivo_ticket: '' })); }}
                                            />
                                            {formErrors.motivo_ticket && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.motivo_ticket}</p>}
                                        </div>
                                        <div className="md:col-span-4">
                                            <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">
                                                Mensaje de la Incidencia <span className="text-red-500">*</span>
                                            </label>
                                            <textarea
                                                rows={4}
                                                placeholder="Detalles sobre lo ocurrido..."
                                                className={`w-full rounded-lg border bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400 focus:bg-white transition placeholder:text-neutral-400 resize-y ${formErrors.mensaje ? 'border-red-400' : 'border-neutral-200'}`}
                                                value={formData.mensaje}
                                                onChange={e => { setFormData({ ...formData, mensaje: e.target.value }); setFormErrors(prev => ({ ...prev, mensaje: '' })); }}
                                            />
                                            {formErrors.mensaje && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.mensaje}</p>}
                                        </div>
                                    </div>
                                </div>

                                {/* Section 3: Archivos */}
                                <div>
                                    <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-3 border-b border-yellow-400">Archivos</h3>

                                    <div>
                                        <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">
                                            Adjuntar Documentos
                                        </label>
                                        <input
                                            type="file"
                                            multiple
                                            className="w-full rounded-lg border border-neutral-200 bg-neutral-50/60 text-neutral-500 text-xs px-3 py-2 cursor-pointer
                                            file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-neutral-100 file:text-neutral-700 hover:file:bg-neutral-200 transition"
                                            onChange={(e) => {
                                                if (e.target.files) {
                                                    setFiles(Array.from(e.target.files));
                                                }
                                            }}
                                        />
                                        {files.length > 0 && (
                                            <p className="mt-2 text-[10px] font-bold text-neutral-500 uppercase flex items-center gap-1.5"><Paperclip className="w-3 h-3" /> {files.length} archivos seleccionados</p>
                                        )}
                                    </div>
                                </div>

                                {/* Section: Notificación */}
                                <div>
                                    <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-3 border-b border-yellow-400">Notificación al Propietario</h3>
                                    <div className="flex flex-col gap-3">
                                        {/* Checkboxes de canal */}
                                        <div className="bg-neutral-50/60 border border-neutral-100 rounded-lg p-3">
                                            <label className="text-xs font-bold text-neutral-900 uppercase tracking-widest block mb-2">
                                                Canal de notificación
                                            </label>
                                            <div className="flex flex-col sm:flex-row gap-3">
                                                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                                    <input
                                                        type="checkbox"
                                                        checked={notifEmail}
                                                        onChange={e => {
                                                            setNotifEmail(e.target.checked);
                                                            setEnviarAviso(e.target.checked || notifWhatsapp ? true : false);
                                                            setFormErrors(prev => ({ ...prev, contacto: '' }));
                                                        }}
                                                        className="w-4 h-4 rounded accent-yellow-400"
                                                    />
                                                    <span className="text-xs font-semibold text-neutral-700">Notificar por Email</span>
                                                </label>
                                                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                                    <input
                                                        type="checkbox"
                                                        checked={notifWhatsapp}
                                                        onChange={e => {
                                                            setNotifWhatsapp(e.target.checked);
                                                            setEnviarAviso(notifEmail || e.target.checked ? true : false);
                                                            setFormErrors(prev => ({ ...prev, contacto: '' }));
                                                        }}
                                                        className="w-4 h-4 rounded accent-yellow-400"
                                                    />
                                                    <span className="text-xs font-semibold text-neutral-700">Notificar por WhatsApp</span>
                                                </label>
                                            </div>
                                            <p className="text-[10px] text-neutral-400 mt-2">Deja ambos sin marcar si no deseas notificar al propietario.</p>
                                        </div>
                                        {/* Datos de contacto para notificación */}
                                        {notifEmail && (
                                            <div>
                                                <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">
                                                    Email para notificación <span className="text-red-500">*</span>
                                                </label>
                                                {formData.email ? (
                                                    <div className="flex items-center gap-2 px-3 py-2 bg-neutral-100 border border-neutral-200 rounded-xl cursor-not-allowed">
                                                        <span className="text-sm text-neutral-500 font-medium flex-1 select-none">{formData.email}</span>
                                                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest shrink-0">Del cliente</span>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <input
                                                            type="email"
                                                            placeholder="ejemplo@correo.com"
                                                            className={`w-full bg-white border text-neutral-900 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 transition-all placeholder:text-neutral-400 ${formErrors.email ? 'border-red-400 focus:ring-red-400/20' : 'border-neutral-200 focus:ring-amber-400/20 focus:border-amber-400'}`}
                                                            value={formData.email}
                                                            onChange={e => { setFormData({ ...formData, email: e.target.value }); setFormErrors(prev => ({ ...prev, email: '' })); }}
                                                        />
                                                        {formErrors.email && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.email}</p>}
                                                    </>
                                                )}
                                            </div>
                                        )}
                                        {notifWhatsapp && (
                                            <div>
                                                <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">
                                                    Teléfono para notificación <span className="text-red-500">*</span>
                                                </label>
                                                {formData.telefono ? (
                                                    <div className="flex items-center gap-2 px-3 py-2 bg-neutral-100 border border-neutral-200 rounded-xl cursor-not-allowed">
                                                        <span className="text-sm text-neutral-500 font-medium flex-1 select-none">{formData.telefono}</span>
                                                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest shrink-0">Del cliente</span>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <input
                                                            type="tel"
                                                            placeholder="600000000"
                                                            className={`w-full bg-white border text-neutral-900 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 transition-all placeholder:text-neutral-400 ${formErrors.telefono ? 'border-red-400 focus:ring-red-400/20' : 'border-neutral-200 focus:ring-amber-400/20 focus:border-amber-400'}`}
                                                            value={formData.telefono}
                                                            onChange={e => { setFormData({ ...formData, telefono: e.target.value }); setFormErrors(prev => ({ ...prev, telefono: '' })); }}
                                                        />
                                                        {formErrors.telefono && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.telefono}</p>}
                                                    </>
                                                )}
                                            </div>
                                        )}
                                        {formErrors.contacto && (
                                            <p className="flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.contacto}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Section: Proveedor */}
                                <div>
                                    <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-3 border-b border-yellow-400">Proveedor</h3>

                                    <div>
                                        <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">
                                            Enviar email a Proveedor
                                        </label>
                                        <select
                                            disabled
                                            className="w-full rounded-lg border border-neutral-200 bg-neutral-100 px-3 py-2 text-sm text-neutral-400 outline-none cursor-not-allowed"
                                            value={formData.proveedor}
                                            onChange={e => setFormData({ ...formData, proveedor: e.target.value })}
                                        >
                                            <option value="">Próximamente disponible...</option>
                                        </select>
                                    </div>
                                </div>
                            </form>
                        </div>

                        {/* Footer */}
                        {/* Footer */}
                        <div className="px-5 py-3 border-t border-neutral-100 bg-neutral-50/40 flex justify-end gap-2 flex-wrap">
                            <button
                                type="button"
                                onClick={resetForm}
                                className="px-4 py-2 text-xs font-bold text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                form="incidencia-form"
                                type="submit"
                                disabled={
                                    isSubmitting ||
                                    uploading ||
                                    !formData.nombre_cliente ||
                                    !formData.comunidad_id ||
                                    !formData.mensaje ||
                                    !!(notifEmail && !formData.email) ||
                                    !!(notifWhatsapp && !formData.telefono) ||
                                    !!(formData.telefono && !/^\d{9}$/.test(formData.telefono)) ||
                                    !!(formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
                                }
                                className="px-6 py-2 bg-yellow-400 hover:bg-yellow-500 text-neutral-950 rounded-lg text-xs font-bold transition disabled:opacity-50 flex items-center gap-2 shadow-sm"
                            >
                                {isSubmitting || uploading ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        Procesando...
                                    </>
                                ) : (
                                    <>
                                        <Plus className="w-3.5 h-3.5" />
                                        {editingId ? 'Guardar Cambios' : 'Registrar Ticket'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            , document.body)}

            {/* Delete Confirmation Modal */}
            <DeleteConfirmationModal
                isOpen={showDeleteModal}
                onClose={() => {
                    setShowDeleteModal(false);
                    setItemToDelete(null);
                }}
                onConfirm={handleConfirmDelete}
                itemType="incidencia"
                isDeleting={isDeleting}
            />

            {/* Export Notes Modal */}
            {portalReady && showExportModal && createPortal(
                <div
                    className="fixed inset-0 bg-black/50 z-[10000] flex items-end sm:items-center sm:justify-center sm:p-4 backdrop-blur-sm"
                    onClick={() => {
                        setShowExportModal(false);
                        setPendingExportParams(null);
                    }}
                >
                    <div
                        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-sm p-6 relative overflow-hidden max-h-[92dvh] overflow-y-auto"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="text-center">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Exportar PDF</h3>
                            <p className="text-sm text-gray-600 mb-8 px-2">
                                ¿Desea incluir las notas de gestión en el documento PDF?
                            </p>

                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={() => {
                                        const params = pendingExportParams;
                                        setPendingExportParams(null);
                                        setShowExportModal(false);
                                        if (params) {
                                            handleExport(params.type, params.ids, true);
                                        }
                                    }}
                                    className="w-full py-3 bg-yellow-400 text-neutral-950 rounded-full font-bold hover:bg-yellow-500 transition shadow-md"
                                >
                                    SÍ
                                </button>
                                <button
                                    onClick={() => {
                                        const params = pendingExportParams;
                                        setPendingExportParams(null);
                                        setShowExportModal(false);
                                        if (params) {
                                            handleExport(params.type, params.ids, false);
                                        }
                                    }}
                                    className="w-full py-3 bg-gray-200 text-red-600 rounded-full font-bold hover:bg-gray-300 transition"
                                >
                                    NO
                                </button>
                                <button
                                    onClick={() => {
                                        setPendingExportParams(null);
                                        setShowExportModal(false);
                                    }}
                                    className="w-full py-3 bg-gray-200 text-gray-700 rounded-full font-bold hover:bg-gray-300 transition"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            , document.body)}

            <DataTable
                data={filteredIncidencias}
                columns={columns}
                keyExtractor={(row) => row.id}
                storageKey="incidencias"
                loading={loading}
                emptyMessage="No hay incidencias en esta vista"
                selectable={true}
                selectedKeys={selectedIds}
                onSelectionChange={(keys) => setSelectedIds(keys)}
                onRowClick={handleRowClick}
                extraFilters={
                    <>
                        <SearchableSelect
                            value={filterComunidad === 'all' ? '' : Number(filterComunidad)}
                            onChange={(val) => setFilterComunidad(val === '' ? 'all' : String(val))}
                            options={comunidades.map(c => ({ value: c.id, label: `${c.codigo || ''} - ${c.nombre_cdad}` }))}
                            placeholder="Todas las Comunidades"
                            className="w-[200px]"
                        />
                        <SearchableSelect
                            value={filterGestor === 'all' ? '' : filterGestor}
                            onChange={(val) => setFilterGestor(val === '' ? 'all' : String(val))}
                            options={profiles.map(p => ({ value: p.user_id, label: p.nombre }))}
                            placeholder="Todos los Gestores"
                            className="w-[170px]"
                        />
                    </>
                }
                rowActions={(row) => {
                    const estado = row.estado || (row.resuelto ? 'Resuelto' : 'Pendiente');
                    return [
                        { label: 'Editar', icon: <Pencil className="w-4 h-4" />, onClick: (r) => handleEdit(r) },
                        {
                            label: estado === 'Resuelto' ? 'Reabrir' : (estado === 'Aplazado' ? 'Volver a Pendiente' : 'Resolver'),
                            icon: estado === 'Resuelto' ? <RotateCcw className="w-4 h-4" /> : <Check className="w-4 h-4" />,
                            onClick: (r) => estado === 'Aplazado' ? reactivarDesdeAplazado(r.id) : toggleResuelto(r.id, r.resuelto),
                            disabled: isUpdatingStatus === row.id,
                            variant: estado === 'Resuelto' ? 'default' : 'success',
                        },
                        {
                            label: 'Aplazar',
                            icon: <Pause className="w-4 h-4" />,
                            onClick: (r) => openAplazarModal(r.id),
                            hidden: estado === 'Resuelto' || estado === 'Aplazado',
                            variant: 'warning',
                        },
                        {
                            label: 'Eliminar',
                            icon: <Trash2 className="w-4 h-4" />,
                            onClick: (r) => handleDeleteClick(r.id),
                            variant: 'danger',
                            separator: true,
                        },
                    ];
                }}
            />

            {/* Detail Modal */}
            {portalReady && showDetailModal && selectedDetailIncidencia && createPortal(
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex justify-center items-end sm:items-center sm:p-6"
                >
                    <div
                        className="bg-white w-full max-w-4xl rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[92dvh] sm:max-h-[90dvh] animate-in fade-in slide-in-from-bottom sm:zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-white shrink-0">
                            <div>
                                <h2 className="text-xl font-black text-neutral-900 tracking-tight">
                                    {selectedDetailIncidencia.nombre_cliente || 'Sin nombre'} · Ticket #{selectedDetailIncidencia.id}
                                </h2>
                                <p className="text-xs text-neutral-500 mt-0.5">
                                    Registrado el {new Date(selectedDetailIncidencia.created_at).toLocaleDateString('es-ES')}
                                    {selectedDetailIncidencia.resuelto && selectedDetailIncidencia.dia_resuelto && (
                                        <> · Resuelto el {new Date(selectedDetailIncidencia.dia_resuelto as string).toLocaleDateString('es-ES')}</>
                                    )}
                                </p>
                                <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                                    {/* Estado */}
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${selectedDetailIncidencia.resuelto ? 'bg-emerald-100 text-emerald-700' : selectedDetailIncidencia.estado === 'Aplazado' ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${selectedDetailIncidencia.resuelto ? 'bg-emerald-500' : selectedDetailIncidencia.estado === 'Aplazado' ? 'bg-orange-500' : 'bg-amber-500'}`} />
                                        {selectedDetailIncidencia.resuelto ? 'Resuelto' : selectedDetailIncidencia.estado === 'Aplazado' ? 'Aplazado' : 'En trámite'}
                                    </span>
                                    {/* Prioridad */}
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${selectedDetailIncidencia.urgencia === 'Alta' ? 'bg-red-100 text-red-700' : selectedDetailIncidencia.urgencia === 'Media' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${selectedDetailIncidencia.urgencia === 'Alta' ? 'bg-red-500' : selectedDetailIncidencia.urgencia === 'Media' ? 'bg-orange-500' : 'bg-blue-400'}`} />
                                        {selectedDetailIncidencia.urgencia || 'Baja'}
                                    </span>
                                    {/* Sentimiento */}
                                    {selectedDetailIncidencia.sentimiento && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-700">
                                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                                            {selectedDetailIncidencia.sentimiento}
                                        </span>
                                    )}
                                    {/* Aviso */}
                                    {(() => {
                                        const v = Number(selectedDetailIncidencia.aviso);
                                        const labels: Record<number, { text: string; dot: string; cls: string }> = {
                                            0: { text: 'Sin aviso', dot: 'bg-neutral-400', cls: 'bg-neutral-100 text-neutral-500' },
                                            1: { text: 'WhatsApp', dot: 'bg-green-500', cls: 'bg-green-100 text-green-700' },
                                            2: { text: 'Email', dot: 'bg-blue-500', cls: 'bg-blue-100 text-blue-700' },
                                            3: { text: 'Ambos', dot: 'bg-indigo-500', cls: 'bg-indigo-100 text-indigo-700' },
                                        };
                                        const label = labels[v] ?? { text: '-', dot: 'bg-neutral-400', cls: 'bg-neutral-100 text-neutral-500' };
                                        return (
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${label.cls}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${label.dot}`} />
                                                Aviso: {label.text}
                                            </span>
                                        );
                                    })()}
                                </div>
                            </div>
                            <button
                                onClick={() => setShowDetailModal(false)}
                                className="p-2 rounded-xl hover:bg-neutral-100 text-neutral-400 hover:text-neutral-900 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* File input hidden */}
                        <input
                            type="file"
                            multiple
                            className="hidden"
                            ref={detailFileInputRef}
                            onChange={(e) => {
                                if (e.target.files && e.target.files.length > 0) {
                                    handleDetailFileUpload(e.target.files);
                                }
                            }}
                        />

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar">

                            {/* Sección 1: Identificación del Cliente */}
                            <FormSection title="Identificación del Cliente">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <div className="lg:col-span-2">
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Comunidad</label>
                                        <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">
                                            {selectedDetailIncidencia.comunidad || selectedDetailIncidencia.comunidades?.nombre_cdad || '—'}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Propietario</label>
                                        <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">
                                            {selectedDetailIncidencia.nombre_cliente || '—'}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Teléfono</label>
                                        <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">
                                            {selectedDetailIncidencia.telefono || '—'}
                                        </div>
                                    </div>
                                    <div className="lg:col-span-2">
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Email</label>
                                        <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">
                                            {selectedDetailIncidencia.email || '—'}
                                        </div>
                                    </div>
                                </div>
                            </FormSection>

                            {/* Sección 2: Datos de la Incidencia */}
                            <FormSection title="Datos de la Incidencia">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Clasificación</label>
                                        <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">
                                            {selectedDetailIncidencia.categoria || '—'}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Entrada</label>
                                        <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">
                                            {selectedDetailIncidencia.source || '—'}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Recepción inicial</label>
                                        <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">
                                            {(selectedDetailIncidencia as any).receptor?.nombre || selectedDetailIncidencia.quien_lo_recibe || 'Automática'}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Responsable asignado</label>
                                        <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 flex items-center justify-between gap-2">
                                            <span>{(selectedDetailIncidencia as any).gestor?.nombre || selectedDetailIncidencia.gestor_asignado || 'Pendiente'}</span>
                                            {!isReassigning && (
                                                <button
                                                    onClick={() => { setNewGestorId(selectedDetailIncidencia.gestor_asignado || ''); setIsReassigning(true); }}
                                                    className="p-1 bg-yellow-400 hover:bg-yellow-500 text-neutral-950 rounded border border-yellow-500 transition-all shrink-0"
                                                    title="Reasignar gestor"
                                                >
                                                    <UserCog className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                        {isReassigning && (
                                            <div className="flex items-center gap-2 mt-2 animate-in fade-in slide-in-from-top-1">
                                                <div className="flex-1">
                                                    <SearchableSelect
                                                        value={newGestorId}
                                                        onChange={(val) => setNewGestorId(String(val))}
                                                        options={profiles.map(p => ({ value: p.user_id, label: `${p.nombre} (${p.rol})` }))}
                                                        placeholder="Nuevo gestor..."
                                                        className="text-xs"
                                                    />
                                                </div>
                                                <button
                                                    onClick={handleUpdateGestor}
                                                    disabled={!newGestorId || isUpdatingGestor}
                                                    className="p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors disabled:opacity-50"
                                                >
                                                    {isUpdatingGestor ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                                </button>
                                                <button
                                                    onClick={() => { setIsReassigning(false); setNewGestorId(''); }}
                                                    disabled={isUpdatingGestor}
                                                    className="p-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors disabled:opacity-50"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="sm:col-span-2 lg:col-span-3">
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Motivo del ticket</label>
                                        <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">
                                            {selectedDetailIncidencia.motivo_ticket || '—'}
                                        </div>
                                    </div>
                                    {selectedDetailIncidencia.mensaje && (
                                        <div className="sm:col-span-2 lg:col-span-3">
                                            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Mensaje</label>
                                            <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 whitespace-pre-wrap">
                                                {selectedDetailIncidencia.mensaje}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </FormSection>

                            {/* Sección 3: Documentación */}
                            {selectedDetailIncidencia.adjuntos && selectedDetailIncidencia.adjuntos.length > 0 && (
                                <FormSection title="Documentación">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {selectedDetailIncidencia.adjuntos.map((url: string, i: number) => (
                                            <div key={i} className="flex items-center justify-between bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2.5">
                                                <div className="flex items-center gap-2">
                                                    <FileText className="w-4 h-4 text-neutral-400 shrink-0" />
                                                    <span className="text-sm text-neutral-700 truncate max-w-[180px]">Documento adjunto {i + 1}</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <a
                                                        href={getSecureUrl(url)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-1.5 hover:bg-neutral-200 rounded text-neutral-400 hover:text-neutral-900 transition-colors"
                                                        title="Ver / Descargar"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                    </a>
                                                    <button
                                                        onClick={(e) => { e.preventDefault(); setUrlToConfirmDelete(url); setShowDeleteDocConfirm(true); }}
                                                        disabled={isUpdatingRecord}
                                                        className="p-1.5 hover:bg-red-50 rounded text-neutral-400 hover:text-red-600 transition-colors disabled:opacity-50"
                                                        title="Eliminar documento"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </FormSection>
                            )}

                            {/* Sección 4: Chat de Gestores */}
                            <FormSection title="Chat de Gestores">
                                <TimelineChat entityType="incidencia" entityId={selectedDetailIncidencia.id} />
                            </FormSection>

                        </div>

                        {/* Footer */}
                        <div className="px-4 py-3 bg-white border-t border-neutral-100 flex items-center justify-between shrink-0 gap-2">
                            <ModalActionsMenu actions={[
                                { label: 'Eliminar', icon: <Trash2 className="w-4 h-4" />, onClick: () => { handleDeleteClick(selectedDetailIncidencia.id); setShowDetailModal(false); }, variant: 'danger' },
                                { label: isUpdatingRecord ? 'Subiendo…' : 'Adjuntar', icon: isUpdatingRecord ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />, onClick: () => detailFileInputRef.current?.click(), disabled: isUpdatingRecord },
                                { label: exporting ? 'Generando…' : 'PDF', icon: exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />, onClick: () => handleExport('pdf', [selectedDetailIncidencia.id]), disabled: exporting },
                                ...((selectedDetailIncidencia.estado || (selectedDetailIncidencia.resuelto ? 'Resuelto' : 'Pendiente')) === 'Pendiente' ? [{ label: 'Aplazar', icon: <Pause className="w-4 h-4" />, onClick: () => openAplazarModal(selectedDetailIncidencia.id), variant: 'warning' as const }] : []),
                            ]} />
                            <div className="flex items-center gap-2">
                                {selectedDetailIncidencia.estado === 'Aplazado' && (
                                    <div className="px-3 py-1.5 text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-200 rounded-xl flex items-center gap-1.5">
                                        <CalendarClock className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">Hasta </span>{selectedDetailIncidencia.fecha_recordatorio ? new Date(selectedDetailIncidencia.fecha_recordatorio).toLocaleDateString('es-ES') : '...'}
                                    </div>
                                )}
                                {selectedDetailIncidencia.resuelto ? (
                                    <button
                                        onClick={() => { toggleResuelto(selectedDetailIncidencia.id, selectedDetailIncidencia.resuelto); setSelectedDetailIncidencia({ ...selectedDetailIncidencia, resuelto: false, estado: 'Pendiente', dia_resuelto: undefined, fecha_recordatorio: undefined }); }}
                                        className="px-5 py-2.5 text-sm font-black text-neutral-600 border border-neutral-200 hover:bg-neutral-50 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap"
                                    >
                                        <RotateCcw className="w-4 h-4" />
                                        <span className="hidden sm:inline">Reabrir </span>Ticket
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => { toggleResuelto(selectedDetailIncidencia.id, selectedDetailIncidencia.resuelto); setShowDetailModal(false); }}
                                        className="px-5 py-2.5 text-sm font-black text-neutral-900 bg-yellow-400 hover:bg-yellow-500 rounded-xl transition-all shadow-sm flex items-center gap-2 whitespace-nowrap"
                                    >
                                        <Check className="w-4 h-4" />
                                        <span className="hidden sm:inline">Resolver </span>Ticket
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            , document.body)}
            {/* Reassign Success Modal */}
            {portalReady && showReassignSuccessModal && createPortal(
                <div
                    className="fixed inset-0 bg-neutral-900/60 z-[10000] flex items-end sm:items-center sm:justify-center sm:p-4 backdrop-blur-sm animate-in fade-in duration-200"
                >
                    <div
                        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-sm p-6 relative flex flex-col items-center text-center max-h-[92dvh] overflow-y-auto animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
                    >
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                            <Check className="w-8 h-8 text-green-600" />
                        </div>
                        <h3 className="text-xl font-bold text-neutral-900 mb-2">
                            Gestor Reasignado
                        </h3>
                        <p className="text-neutral-500 mb-6">
                            La incidencia ha sido reasignada al nuevo gestor correctamente.
                        </p>
                        <button
                            onClick={() => setShowReassignSuccessModal(false)}
                            className="w-full py-3 bg-neutral-900 hover:bg-black text-white rounded-xl font-bold transition-transform active:scale-[0.98]"
                        >
                            Aceptar
                        </button>
                    </div>
                </div>
            , document.body)}
            {/* Document Delete Confirmation Modal */}
            {portalReady && showDeleteDocConfirm && createPortal(
                <div
                    className="fixed inset-0 bg-neutral-900/60 z-[10000] flex items-end sm:items-center sm:justify-center sm:p-4 backdrop-blur-sm animate-in fade-in duration-200"
                >
                    <div
                        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-sm p-6 relative flex flex-col items-center text-center max-h-[92dvh] overflow-y-auto animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
                    >
                        <div className="w-16 h-16 bg-yellow-50 rounded-full flex items-center justify-center mb-4">
                            <Trash2 className="w-8 h-8 text-yellow-600" />
                        </div>
                        <h3 className="text-xl font-bold text-neutral-900 mb-2">
                            ¿Eliminar documento?
                        </h3>
                        <p className="text-neutral-500 mb-6">
                            Esta acción no se puede deshacer. El archivo será eliminado permanentemente del sistema.
                        </p>
                        <div className="flex gap-3 w-full">
                            <button
                                onClick={() => {
                                    setShowDeleteDocConfirm(false);
                                    setUrlToConfirmDelete(null);
                                }}
                                className="flex-1 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-xl font-bold transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDeleteAttachment}
                                className="flex-1 py-3 bg-yellow-400 hover:bg-yellow-500 text-neutral-900 rounded-xl font-bold transition-transform active:scale-[0.98] shadow-lg shadow-yellow-100"
                            >
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            , document.body)}
            {/* PDF Import Preview Modal */}
            {portalReady && showImportPreviewModal && importPreviewData && createPortal(
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex justify-center items-center p-4 sm:p-6 overflow-y-auto">
                    <div
                        className="bg-white w-full max-w-[95vw] rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[95dvh] animate-in fade-in zoom-in duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex justify-between items-center px-5 py-4 border-b border-neutral-100 bg-neutral-50 flex-shrink-0">
                            <div>
                                <h2 className="text-lg font-bold text-neutral-900 tracking-tight">Importar desde PDF</h2>
                                <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-0.5">
                                    Revisa los registros antes de confirmar
                                </p>
                            </div>
                            <button
                                onClick={closeImportModal}
                                className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="px-5 py-4 overflow-y-auto custom-scrollbar flex-1 space-y-4">

                            {/* Resumen de conteos */}
                            <div>
                                <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-3 border-b border-yellow-400">Resumen</h3>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 text-center">
                                        <div className="text-xl font-bold text-neutral-900">{importPreviewData.total_parsed}</div>
                                        <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-1">Total PDF</div>
                                    </div>
                                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                                        <div className="text-xl font-bold text-green-700">
                                            {importPreviewData.to_insert + Object.keys(importRecordComunidades).length}
                                        </div>
                                        <div className="text-[10px] font-bold text-green-500 uppercase tracking-widest mt-1">Se importan</div>
                                    </div>
                                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                                        <div className="text-xl font-bold text-amber-700">
                                            {importPreviewData.to_skip - Object.keys(importRecordComunidades).length}
                                        </div>
                                        <div className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mt-1">Se omiten</div>
                                    </div>
                                </div>
                            </div>

                            {/* Opciones de estado */}
                            <div className="flex items-center justify-between border-b border-yellow-400 pb-2 mb-3">
                                <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest leading-none">Acciones Masivas</h3>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const newEstados: Record<number, 'Pendiente' | 'Resuelto'> = {};
                                            importPreviewData.records.forEach((rec, idx) => {
                                                if (rec.status === 'ok') newEstados[idx] = 'Resuelto';
                                            });
                                            setImportRecordEstados(newEstados);
                                        }}
                                        className="text-[10px] font-bold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 px-2 py-1 rounded transition-colors"
                                    >
                                        Marcar todos Resuelto
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setImportRecordEstados({})}
                                        className="text-[10px] font-bold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 px-2 py-1 rounded transition-colors"
                                    >
                                        Marcar todos Pendiente
                                    </button>
                                </div>
                            </div>

                            {/* Tabla de registros */}
                            <div>
                                <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-3 border-b border-yellow-400">
                                    Detalle de registros
                                </h3>
                                <div className="border border-neutral-200 rounded-lg overflow-hidden">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="bg-neutral-50 border-b border-neutral-200">
                                                <th className="text-left px-3 py-2 text-[10px] font-bold text-neutral-500 uppercase tracking-widest w-6"></th>
                                                <th className="text-left px-3 py-2 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Comunidad</th>
                                                <th className="text-left px-3 py-2 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Entrada</th>
                                                <th className="text-left px-3 py-2 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Origen</th>
                                                <th className="text-left px-3 py-2 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Mensaje</th>
                                                <th className="text-left px-3 py-2 text-[10px] font-bold text-neutral-500 uppercase tracking-widest whitespace-nowrap">Fecha</th>
                                                <th className="text-left px-3 py-2 text-[10px] font-bold text-neutral-500 uppercase tracking-widest whitespace-nowrap">Quien lo recibe</th>
                                                <th className="text-left px-3 py-2 text-[10px] font-bold text-neutral-500 uppercase tracking-widest whitespace-nowrap">Gestor asignado</th>
                                                <th className="text-left px-3 py-2 text-[10px] font-bold text-neutral-500 uppercase tracking-widest whitespace-nowrap">Timeline</th>
                                                <th className="text-left px-3 py-2 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {importPreviewData.records.map((rec, idx) => {
                                                const isResuelto = importRecordEstados[idx] === 'Resuelto';
                                                return (
                                                    <tr
                                                        key={idx}
                                                        className={`border-b border-neutral-100 last:border-0 ${rec.status === 'ok' ? 'bg-white hover:bg-neutral-50/60' : 'bg-amber-50/40'}`}
                                                    >
                                                        {/* Estado icon */}
                                                        <td className="px-3 py-2.5">
                                                            <span className={`w-4 h-4 rounded flex items-center justify-center ${rec.status === 'ok' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                                                {rec.status === 'ok'
                                                                    ? <Check className="w-2.5 h-2.5" strokeWidth={3} />
                                                                    : <AlertCircle className="w-2.5 h-2.5" />}
                                                            </span>
                                                        </td>
                                                        {/* Comunidad */}
                                                        <td className="px-3 py-2.5 font-semibold text-neutral-800 max-w-[180px]">
                                                            {rec.status === 'skip' && rec.comunidad_not_found ? (
                                                                <div>
                                                                    <span className="block text-[10px] text-amber-700 font-bold truncate mb-1" title={rec.comunidad_name}>{rec.comunidad_name}</span>
                                                                    <select
                                                                        value={importRecordComunidades[idx] ?? ''}
                                                                        onChange={e => {
                                                                            const val = e.target.value;
                                                                            setImportRecordComunidades(prev => {
                                                                                const next = { ...prev };
                                                                                if (val) next[idx] = Number(val);
                                                                                else delete next[idx];
                                                                                return next;
                                                                            });
                                                                        }}
                                                                        className="w-full text-[10px] border border-amber-300 rounded px-1.5 py-1 bg-white text-neutral-700 focus:border-yellow-400 outline-none"
                                                                    >
                                                                        <option value="">— Asignar comunidad —</option>
                                                                        {comunidades.map(c => (
                                                                            <option key={c.id} value={c.id}>{c.nombre_cdad}</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <span className="block truncate">{rec.comunidad_matched ?? rec.comunidad_name}</span>
                                                                    {rec.status === 'skip' && (
                                                                        <span className="block text-[10px] text-amber-700 font-bold mt-0.5 truncate">{rec.reason}</span>
                                                                    )}
                                                                </>
                                                            )}
                                                        </td>
                                                        {/* Entrada */}
                                                        <td className="px-3 py-2.5 whitespace-nowrap">
                                                            {rec.source_mapped
                                                                ? <span className="bg-neutral-100 text-neutral-600 rounded px-1.5 py-0.5 font-bold text-[10px] uppercase tracking-wide">{rec.source_mapped}</span>
                                                                : <span className="text-neutral-300">—</span>}
                                                        </td>
                                                        {/* Origen */}
                                                        <td className="px-3 py-2.5 text-neutral-600 max-w-[160px]">
                                                            <span className="block truncate">{rec.motivo}</span>
                                                        </td>
                                                        {/* Mensaje */}
                                                        <td className="px-3 py-2.5 text-neutral-400 max-w-[200px]">
                                                            <span className="block truncate">{rec.mensaje}</span>
                                                        </td>
                                                        {/* Fecha */}
                                                        <td className="px-3 py-2.5 text-neutral-400 whitespace-nowrap font-medium">
                                                            {rec.fecha.replace('T', ' ').slice(0, 16)}
                                                        </td>
                                                        {/* Quien lo recibe */}
                                                        <td className="px-3 py-2.5 whitespace-nowrap">
                                                            <span className="text-xs font-medium text-neutral-700">{importReceptorName}</span>
                                                        </td>
                                                        {/* Gestor asignado */}
                                                        <td className="px-3 py-2.5 whitespace-nowrap">
                                                            <span className="text-xs font-medium text-neutral-700">{importReceptorName}</span>
                                                        </td>
                                                        {/* Timeline count */}
                                                        <td className="px-3 py-2.5 whitespace-nowrap">
                                                            {rec.chat_count > 0 ? (
                                                                <span className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5">
                                                                    <MessageSquare className="w-3 h-3" />
                                                                    {rec.chat_count}
                                                                </span>
                                                            ) : (
                                                                <span className="text-neutral-300 text-[10px]">—</span>
                                                            )}
                                                        </td>
                                                        {/* Estado toggle */}
                                                        <td className="px-3 py-2.5">
                                                            {rec.status === 'ok' || (rec.status === 'skip' && rec.comunidad_not_found && importRecordComunidades[idx]) ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setImportRecordEstados(prev => ({
                                                                        ...prev,
                                                                        [idx]: isResuelto ? 'Pendiente' : 'Resuelto'
                                                                    }))}
                                                                    className={`flex items-center gap-1.5 rounded text-[10px] font-bold px-2 py-1 transition-colors whitespace-nowrap ${
                                                                        isResuelto
                                                                            ? 'bg-neutral-900 text-white hover:bg-neutral-700'
                                                                            : 'bg-white border border-neutral-200 text-neutral-500 hover:bg-neutral-50'
                                                                    }`}
                                                                >
                                                                    <div className={`w-3 h-3 rounded-sm flex items-center justify-center shrink-0 ${isResuelto ? 'bg-white/20' : 'border border-neutral-300'}`}>
                                                                        {isResuelto && <Check className="w-2 h-2 text-white" strokeWidth={4} />}
                                                                    </div>
                                                                    {isResuelto ? 'Resuelto' : 'Pendiente'}
                                                                </button>
                                                            ) : (
                                                                <span className="text-neutral-300 text-[10px]">—</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-5 py-3 border-t border-neutral-100 bg-neutral-50/40 flex justify-end gap-2 flex-shrink-0 flex-wrap">
                            <button
                                type="button"
                                onClick={closeImportModal}
                                className="px-4 py-2 text-xs font-bold text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmImport}
                                disabled={importPreviewData.to_insert + Object.keys(importRecordComunidades).length === 0}
                                className="px-6 py-2 bg-yellow-400 hover:bg-yellow-500 text-neutral-950 rounded-lg text-xs font-bold transition disabled:opacity-50 flex items-center gap-2 shadow-sm"
                            >
                                <FileText className="w-3.5 h-3.5" />
                                Importar {importPreviewData.to_insert + Object.keys(importRecordComunidades).length} registros
                            </button>
                        </div>
                    </div>
                </div>
            , document.body)}
            {/* Aplazar Date Picker Modal */}
            {portalReady && showAplazarModal && createPortal(
                <div
                    className="fixed inset-0 bg-neutral-900/60 z-[10000] flex items-end sm:items-center sm:justify-center sm:p-4 backdrop-blur-sm animate-in fade-in duration-200"
                >
                    <div
                        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-sm p-6 relative flex flex-col items-center text-center max-h-[92dvh] overflow-y-auto animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                            <Pause className="w-8 h-8 text-orange-600" />
                        </div>
                        <h3 className="text-xl font-bold text-neutral-900 mb-2">
                            Aplazar Ticket
                        </h3>
                        <p className="text-neutral-500 mb-6 text-sm">
                            Selecciona la fecha en la que quieres que el ticket vuelva a estar pendiente.
                        </p>
                        <input
                            type="date"
                            value={aplazarDate}
                            onChange={(e) => setAplazarDate(e.target.value)}
                            min={new Date().toISOString().slice(0, 10)}
                            className="w-full border-2 border-neutral-200 rounded-xl px-4 py-3 text-sm font-medium text-neutral-900 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none transition-all mb-6"
                        />
                        <div className="flex gap-3 w-full">
                            <button
                                onClick={() => {
                                    setShowAplazarModal(false);
                                    setAplazarIncidenciaId(null);
                                    setAplazarDate('');
                                }}
                                className="flex-1 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-xl font-bold transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={aplazarTicket}
                                disabled={!aplazarDate}
                                className="flex-1 py-3 bg-orange-400 hover:bg-orange-500 text-white rounded-xl font-bold transition-transform active:scale-[0.98] shadow-lg shadow-orange-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                <Pause className="w-4 h-4" />
                                Aplazar
                            </button>
                        </div>
                    </div>
                </div>
            , document.body)}

            {/* Global Blocking Loader — cubre toda la pantalla mientras se parsea el PDF */}
            {portalReady && importingPdf && createPortal(
                <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-neutral-900/80 backdrop-blur-md">
                    <div className="relative w-24 h-24 mb-6">
                        <div className="absolute inset-0 border-4 border-yellow-400/20 rounded-full" />
                        <div className="absolute inset-0 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                        <FileText className="absolute inset-0 m-auto w-10 h-10 text-yellow-400 animate-pulse" />
                    </div>
                    <div className="text-center space-y-2">
                        <h3 className="text-xl font-bold text-white tracking-tight">Procesando PDF</h3>
                        <p className="text-neutral-400 text-sm max-w-xs px-6">
                            Analizando y extrayendo los registros del informe. Por favor, no cierres esta ventana.
                        </p>
                    </div>
                </div>
            , document.body)}
        </div>
    );
}
