'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useGlobalLoading } from '@/lib/globalLoading';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'react-hot-toast';
import { Trash2, FileText, Check, Plus, Paperclip, Download, X, RotateCcw, Building, Users, Clock, Search, Filter, Loader2, AlertCircle, Eye, RefreshCw, Send, Save, Share2, MoreHorizontal, MessageSquare, ChevronDown, UserCog, Pause, CalendarClock, Pencil, Play, Wrench } from 'lucide-react';
import StartTaskFromTicketModal from '@/components/cronometraje/StartTaskFromTicketModal';
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
import AplazarModal from '../incidencias/AplazarModal';
import DeleteDocConfirmModal from '../incidencias/DeleteDocConfirmModal';
import DetailModal from '../incidencias/DetailModal';
import ExportModal from '../incidencias/ExportModal';
import ImportPreviewModal from '../incidencias/ImportPreviewModal';
import IncidenciaFormModal from '../incidencias/IncidenciaFormModal';
import { buildColumns } from '../incidencias/columns';
import type { ImportPreviewData } from '../incidencias/types';

export default function SofiaPage() {
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
    // En Sofia, los tickets vienen del bot Sofia-Bot. Mantenemos una lista completa
    // para resolver nombres en columnas (gestor/receptor), aunque excluimos al bot
    // de "profiles" (que se usa en selects de asignacion).
    const [allProfilesForLookup, setAllProfilesForLookup] = useState<Profile[]>([]);
    const [proveedores, setProveedores] = useState<{ id: number; nombre: string; telefono: string | null; email: string | null }[]>([]);
    const [files, setFiles] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);
    const [enviarAviso, setEnviarAviso] = useState<boolean | null>(null);
    const [notifEmail, setNotifEmail] = useState(false);
    const [notifWhatsapp, setNotifWhatsapp] = useState(false);
    const [notifProveedorWhatsapp, setNotifProveedorWhatsapp] = useState(false);
    const [notifProveedorEmail, setNotifProveedorEmail] = useState(false);
    const [notifProveedorNone, setNotifProveedorNone] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState<number | null>(null);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [isManualDate, setIsManualDate] = useState(false);

    const resetForm = () => {
        setShowForm(false);
        setEditingId(null);
        setFormData({ comunidad_id: '', nombre_cliente: '', telefono: '', email: '', motivo_ticket: '', mensaje: '', recibido_por: '', gestor_asignado: '', proveedor: '', source: '', fecha_registro: '', nota_gestor: '' });
        setFiles([]);
        setEnviarAviso(null);
        setNotifEmail(false);
        setNotifWhatsapp(false);
        setNotifProveedorWhatsapp(false);
        setNotifProveedorEmail(false);
        setNotifProveedorNone(false);
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
        nota_gestor: '',
    });

    // Delete state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<number | null>(null);
    const [deleteEmail, setDeleteEmail] = useState('');
    const [deletePassword, setDeletePassword] = useState('');
    const [isUpdatingGestor, setIsUpdatingGestor] = useState(false);
    const [showReassignSuccessModal, setShowReassignSuccessModal] = useState(false);
    const [showQuickReassignModal, setShowQuickReassignModal] = useState(false);
    const [quickReassignIncidencia, setQuickReassignIncidencia] = useState<Incidencia | null>(null);
    const [quickReassignNewGestorId, setQuickReassignNewGestorId] = useState('');
    // Reassign state used by DetailModal inline reassign
    const [isReassigning, setIsReassigning] = useState(false);
    const [newGestorId, setNewGestorId] = useState('');
    // Proveedor reassign (detail + quick action)
    const [isUpdatingProveedor, setIsUpdatingProveedor] = useState(false);
    const [showProveedorReassignSuccessModal, setShowProveedorReassignSuccessModal] = useState(false);
    const [showQuickReassignProveedorModal, setShowQuickReassignProveedorModal] = useState(false);
    const [quickReassignProveedorIncidencia, setQuickReassignProveedorIncidencia] = useState<Incidencia | null>(null);
    const [quickReassignNewProveedorId, setQuickReassignNewProveedorId] = useState('');
    // Notificación al reasignar proveedor
    const [quickNotifProveedorEmail, setQuickNotifProveedorEmail] = useState(false);
    const [quickNotifProveedorWhatsapp, setQuickNotifProveedorWhatsapp] = useState(false);
    const [quickNotifProveedorNone, setQuickNotifProveedorNone] = useState(false);
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

    // Start Task (Cronometraje) Modal State
    const [showStartTaskModal, setShowStartTaskModal] = useState(false);
    const [startTaskIncidencia, setStartTaskIncidencia] = useState<Incidencia | null>(null);

    const { withLoading } = useGlobalLoading();

    const handleRowClick = (incidencia: Incidencia) => {
        setSelectedDetailIncidencia(incidencia);
        setShowDetailModal(true);
    };

    useEffect(() => {
        fetchInitialData();

        // Subscribe to real-time changes
        const channel = supabase
            .channel('sofia-realtime')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'incidencias_serincobot' },
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
        // Cargar primero los lookups en paralelo y luego enriquecer las incidencias con ellos
        const [cdads, profs, provs] = await Promise.all([
            fetchComunidades(),
            fetchProfiles(),
            fetchProveedores(),
        ]);
        await fetchIncidencias(cdads, profs, provs);
        setLoading(false);
    };

    const fetchProveedores = async () => {
        const { data } = await supabase.from('proveedores').select('id, nombre, telefono, email').eq('activo', true).order('nombre');
        if (data) {
            setProveedores(data);
            return data;
        }
        return [];
    };

    const fetchProfiles = async () => {
        // En Sofia, los tickets vienen del bot y su receptor/gestor inicial es Sofia-Bot.
        // El bot SI es asignable aqui, asi que cargamos TODOS los perfiles tanto para
        // resolucion de nombres como para los selects de asignacion.
        const { data } = await supabase.from('profiles').select('user_id, nombre, rol, activo');
        if (data) {
            setAllProfilesForLookup(data);
            setProfiles(data);
            return data;
        }
        return [];
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
                payload.append('isSecondary', 'true');
                payload.append('table', 'incidencias_serincobot');
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
                payload.append('isSecondary', 'true');
                payload.append('table', 'incidencias_serincobot');

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
        if (data) {
            setComunidades(data);
            return data;
        }
        return [];
    };

    const fetchIncidencias = async (
        passedComunidades?: { id: number; nombre_cdad: string; codigo: string }[],
        passedProfiles?: Profile[],
        passedProveedores?: { id: number; nombre: string }[]
    ) => {
        // Sofia tabla puede no tener FKs hacia comunidades/profiles/proveedores,
        // asi que cargamos sin joins y enriquecemos en memoria.
        const { data, error } = await supabase
            .from('incidencias_serincobot')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5000);

        if (error) {
            console.error('Sofia fetch error:', error);
            toast.error('Error cargando incidencias');
            return;
        }

        const currentComunidades = passedComunidades || comunidades;
        // Para resolver nombres usamos la lista completa (incluye Sofia-Bot e inactivos).
        const currentProfiles = passedProfiles || allProfilesForLookup;
        const currentProveedores = passedProveedores || proveedores;

        const formattedData = (data || []).map((item: any) => {
            const cdad = currentComunidades.find((c: any) =>
                c.id === item.comunidad_id ||
                (item.codigo && c.codigo === item.codigo)
            );
            const gestorProf = currentProfiles.find((p: any) => p.user_id === item.gestor_asignado);
            const receptorProf = currentProfiles.find((p: any) => p.user_id === item.quien_lo_recibe);
            const resolverProf = currentProfiles.find((p: any) => p.user_id === item.resuelto_por);
            const prov = currentProveedores.find((pr: any) => pr.id === item.proveedor_id);

            return {
                ...item,
                comunidades: cdad ? { nombre_cdad: cdad.nombre_cdad, codigo: cdad.codigo } : undefined,
                comunidad: cdad?.nombre_cdad || item.comunidad || '',
                codigo: cdad?.codigo || item.codigo || '',
                gestor: gestorProf ? { nombre: gestorProf.nombre } : undefined,
                receptor: receptorProf ? { nombre: receptorProf.nombre } : undefined,
                resolver: resolverProf ? { nombre: resolverProf.nombre } : undefined,
                proveedor: prov ? { nombre: prov.nombre } : undefined,
            };
        });
        setIncidencias(formattedData);
    };

    const handleFileUploads = async () => {
        if (files.length === 0) return [];
        setUploading(true);
        const urls: string[] = [];
        try {
            for (const file of files) {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('path', `sofia/${Date.now()}`); // Folder per timestamp
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
            proveedor: incidencia.proveedor_id ? String(incidencia.proveedor_id) : '',
            source: incidencia.source || '',
            fecha_registro: incidencia.created_at ? new Date(incidencia.created_at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
            nota_gestor: incidencia.nota_gestor || '',
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
        if (formData.proveedor && !notifProveedorEmail && !notifProveedorWhatsapp && !notifProveedorNone) errors.notificacion_proveedor = 'Debes seleccionar una opción de notificación para el proveedor';

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
                    proveedor_id: formData.proveedor ? parseInt(formData.proveedor) : null,
                    source: formData.source || null,
                    nota_gestor: formData.nota_gestor || null,
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
                    .from('incidencias_serincobot')
                    .update(updatePayload)
                    .eq('id', editingId);

                if (error) throw error;

                toast.success('Ticket actualizado');

                const gestorAsignado = profiles.find(p => p.user_id === formData.gestor_asignado);
                await logActivity({
                    action: 'update',
                    entityType: 'sofia_incidencia',
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
                const { data: insertedData, error } = await supabase.from('incidencias_serincobot').insert([{
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
                    proveedor_id: formData.proveedor ? parseInt(formData.proveedor) : null,
                    aviso_proveedor: (!notifProveedorEmail && !notifProveedorWhatsapp) ? 0 : (notifProveedorWhatsapp && !notifProveedorEmail) ? 1 : (!notifProveedorWhatsapp && notifProveedorEmail) ? 2 : 3,
                    source: formData.source || null,
                    nota_gestor: formData.nota_gestor || null,
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
                    entityType: 'sofia_incidencia',
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
                nota_gestor: '',
            });
            setFiles([]);
            setEnviarAviso(null);
            setNotifEmail(false);
            setNotifWhatsapp(false);
            setNotifProveedorWhatsapp(false);
            setNotifProveedorEmail(false);
            setNotifProveedorNone(false);
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
                formData.append('path', `sofia/${selectedDetailIncidencia.id}`);
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
                .from('incidencias_serincobot')
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
                    entity_type: 'sofia_incidencia',
                    entity_id: selectedDetailIncidencia.id,
                    user_id: user.id,
                    content: `📎 SE HAN ADJUNTO ${newUrls.length} NUEVOS DOCUMENTOS AL TICKET.`
                }]);
            }

            await logActivity({
                action: 'update',
                entityType: 'sofia_incidencia',
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
                .from('incidencias_serincobot')
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
                    entity_type: 'sofia_incidencia',
                    entity_id: selectedDetailIncidencia.id,
                    user_id: user.id,
                    content: `🗑️ SE HA ELIMINADO UN DOCUMENTO ADJUNTO DEL TICKET.`
                }]);
            }

            await logActivity({
                action: 'update',
                entityType: 'sofia_incidencia',
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
                .from('incidencias_serincobot')
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
                entityType: 'sofia_incidencia',
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
                    .from('incidencias_serincobot')
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

            // Record in timeline chat
            if (user) {
                await supabase.from('record_messages').insert([{
                    entity_type: 'sofia_incidencia',
                    entity_id: aplazarIncidenciaId,
                    user_id: user.id,
                    content: `⏱️ TICKET APLAZADO HASTA: ${fechaFormateada}`
                }]);
            }

            // Log activity
            const incidencia = incidencias.find(i => i.id === aplazarIncidenciaId);
            await logActivity({
                action: 'update',
                entityType: 'sofia_incidencia',
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

            // Filename Logic
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
            setItemToDelete(null);

            // Log delete activity
            await logActivity({
                action: 'delete',
                entityType: 'sofia_incidencia',
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

    const reassignGestor = async (targetIncidencia: Incidencia, gestorId: string) => {
        await withLoading(async () => {
        setIsUpdatingGestor(true);
        try {
            // Obtener info del usuario actual
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Usuario no autenticado');

            const { error } = await supabase
                .from('incidencias_serincobot')
                .update({ gestor_asignado: gestorId })
                .eq('id', targetIncidencia.id);

            if (error) throw error;

            // Actualizar estado local
            const newGestorProfile = profiles.find(p => p.user_id === gestorId);
            const oldGestorName = targetIncidencia.gestor?.nombre || 'Sin asignar';
            const newGestorName = newGestorProfile?.nombre || 'Desconocido';

            // Si la incidencia reasignada es la abierta en el detalle, sincronizar
            if (selectedDetailIncidencia && selectedDetailIncidencia.id === targetIncidencia.id) {
                setSelectedDetailIncidencia({
                    ...selectedDetailIncidencia,
                    gestor_asignado: gestorId,
                    gestor: newGestorProfile ? { nombre: newGestorProfile.nombre } : selectedDetailIncidencia.gestor
                });
            }

            // Actualizar lista principal
            setIncidencias(prev => prev.map(inc =>
                inc.id === targetIncidencia.id
                    ? { ...inc, gestor_asignado: gestorId, gestor: newGestorProfile ? { nombre: newGestorProfile.nombre } : inc.gestor }
                    : inc
            ));

            // 1. Insertar mensaje en el Timeline (Chat)
            await supabase
                .from('record_messages')
                .insert({
                    entity_type: 'sofia_incidencia',
                    entity_id: targetIncidencia.id,
                    user_id: user.id,
                    content: `🔄 TICKET REASIGNADO\nDe: ${oldGestorName}\nA: ${newGestorName}`
                });

            // 2. Crear Notificación para el nuevo gestor
            if (gestorId !== user.id) { // No notificarse a sí mismo si se autoasigna
                await supabase
                    .from('notifications')
                    .insert({
                        user_id: gestorId,
                        type: 'assignment',
                        title: 'Nueva Asignación de Ticket',
                        content: `Se te ha asignado la incidencia #${targetIncidencia.id} (Reasignado por reasignación)`,
                        entity_id: targetIncidencia.id,
                        entity_type: 'sofia_incidencia',
                        link: `/dashboard/incidencias?id=${targetIncidencia.id}`,
                        is_read: false
                    });
            }

            // 3. Log de Actividad del Sistema
            const currentUserProfile = profiles.find(p => p.user_id === user.id);
            const currentUserName = currentUserProfile?.nombre || user.email || 'Desconocido';
            await logActivity({
                action: 'update',
                entityType: 'sofia_incidencia',
                entityId: targetIncidencia.id,
                entityName: `Incidencia #${targetIncidencia.id}`,
                details: {
                    change: 'reasignacion',
                    old_gestor: oldGestorName,
                    new_gestor: newGestorName,
                    by: currentUserName
                }
            });

            setShowQuickReassignModal(false);
            setQuickReassignIncidencia(null);
            setQuickReassignNewGestorId('');
            setShowReassignSuccessModal(true);

        } catch (error: any) {
            console.error('Error updating gestor:', error);
            toast.error('Error al reasignar gestor');
        } finally {
            setIsUpdatingGestor(false);
        }
        }, 'Reasignando gestor...');
    };

    const handleQuickReassignSubmit = async () => {
        if (!quickReassignIncidencia || !quickReassignNewGestorId) return;
        await reassignGestor(quickReassignIncidencia, quickReassignNewGestorId);
    };

    const addNotaGestor = async (texto: string) => {
        if (!selectedDetailIncidencia || !texto.trim()) return;
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const autor = profiles.find(p => p.user_id === user?.id)?.nombre
                || allProfilesForLookup.find(p => p.user_id === user?.id)?.nombre
                || 'Usuario';
            const fecha = new Date().toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            const nuevaEntrada = `[${fecha} - ${autor}] ${texto.trim()}`;
            const notaActual = (selectedDetailIncidencia.nota_gestor || '').trim();
            const notaNueva = notaActual ? `${nuevaEntrada}\n\n${notaActual}` : nuevaEntrada;

            const { error } = await supabase
                .from('incidencias_serincobot')
                .update({ nota_gestor: notaNueva })
                .eq('id', selectedDetailIncidencia.id);

            if (error) throw error;

            setSelectedDetailIncidencia({ ...selectedDetailIncidencia, nota_gestor: notaNueva });
            setIncidencias(prev => prev.map(i => i.id === selectedDetailIncidencia.id ? { ...i, nota_gestor: notaNueva } : i));
            toast.success('Nota añadida');
        } catch (error: any) {
            toast.error('Error al añadir nota: ' + (error.message || 'desconocido'));
        }
    };

    // Used by DetailModal's inline reassign UI
    const handleUpdateGestorFromDetail = async () => {
        if (!selectedDetailIncidencia || !newGestorId) return;
        await reassignGestor(selectedDetailIncidencia, newGestorId);
        setIsReassigning(false);
        setNewGestorId('');
    };

    const reassignProveedor = async (
        targetIncidencia: Incidencia,
        proveedorId: string,
        opts: { notifEmail: boolean; notifWhatsapp: boolean }
    ) => {
        await withLoading(async () => {
        setIsUpdatingProveedor(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Usuario no autenticado');

            const proveedorIdNum = proveedorId ? parseInt(proveedorId) : null;
            const avisoProveedor = !proveedorIdNum
                ? 0
                : (!opts.notifEmail && !opts.notifWhatsapp)
                    ? 0
                    : (opts.notifWhatsapp && !opts.notifEmail)
                        ? 1
                        : (!opts.notifWhatsapp && opts.notifEmail)
                            ? 2
                            : 3;

            const { error } = await supabase
                .from('incidencias_serincobot')
                .update({ proveedor_id: proveedorIdNum, aviso_proveedor: avisoProveedor })
                .eq('id', targetIncidencia.id);

            if (error) throw error;

            const newProveedor = proveedorIdNum ? proveedores.find(p => p.id === proveedorIdNum) : null;
            const oldProveedorName = (targetIncidencia as any).proveedor?.nombre || 'Sin asignar';
            const newProveedorName = newProveedor?.nombre || 'Sin asignar';
            const avisoLabel = avisoProveedor === 0 ? 'Sin aviso' : avisoProveedor === 1 ? 'WhatsApp' : avisoProveedor === 2 ? 'Email' : 'Email + WhatsApp';

            // Si la incidencia reasignada es la abierta en el detalle, sincronizar
            if (selectedDetailIncidencia && selectedDetailIncidencia.id === targetIncidencia.id) {
                setSelectedDetailIncidencia({
                    ...selectedDetailIncidencia,
                    proveedor_id: proveedorIdNum,
                    aviso_proveedor: avisoProveedor,
                    proveedor: newProveedor ? { nombre: newProveedor.nombre } : null,
                } as unknown as Incidencia);
            }

            // Actualizar lista principal
            setIncidencias(prev => prev.map(inc =>
                inc.id === targetIncidencia.id
                    ? ({ ...inc, proveedor_id: proveedorIdNum, aviso_proveedor: avisoProveedor, proveedor: newProveedor ? { nombre: newProveedor.nombre } : null } as unknown as Incidencia)
                    : inc
            ));

            // 1. Insertar mensaje en el Timeline (Chat)
            await supabase
                .from('record_messages')
                .insert({
                    entity_type: 'sofia_incidencia',
                    entity_id: targetIncidencia.id,
                    user_id: user.id,
                    content: `🔧 PROVEEDOR REASIGNADO\nDe: ${oldProveedorName}\nA: ${newProveedorName}\nAviso: ${avisoLabel}`
                });

            // 2. Log de Actividad del Sistema
            const currentUserProfile = profiles.find(p => p.user_id === user.id);
            const currentUserName = currentUserProfile?.nombre || user.email || 'Desconocido';
            await logActivity({
                action: 'update',
                entityType: 'sofia_incidencia',
                entityId: targetIncidencia.id,
                entityName: `Incidencia #${targetIncidencia.id}`,
                details: {
                    change: 'reasignacion_proveedor',
                    old_proveedor: oldProveedorName,
                    new_proveedor: newProveedorName,
                    aviso_proveedor: avisoLabel,
                    by: currentUserName
                }
            });

            setShowQuickReassignProveedorModal(false);
            setQuickReassignProveedorIncidencia(null);
            setQuickReassignNewProveedorId('');
            setQuickNotifProveedorEmail(false);
            setQuickNotifProveedorWhatsapp(false);
            setQuickNotifProveedorNone(false);
            setShowProveedorReassignSuccessModal(true);

        } catch (error: any) {
            console.error('Error updating proveedor:', error);
            toast.error('Error al reasignar proveedor');
        } finally {
            setIsUpdatingProveedor(false);
        }
        }, 'Reasignando proveedor...');
    };

    const handleQuickReassignProveedorSubmit = async () => {
        if (!quickReassignProveedorIncidencia) return;
        await reassignProveedor(quickReassignProveedorIncidencia, quickReassignNewProveedorId, {
            notifEmail: quickNotifProveedorEmail,
            notifWhatsapp: quickNotifProveedorWhatsapp,
        });
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

    const columns: Column<Incidencia>[] = buildColumns(profiles, 'yellow');

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
                title="Sofía Local"
                showForm={showForm}
                onToggleForm={() => {
                    setEditingId(null);
                    setFormData({ comunidad_id: '', nombre_cliente: '', telefono: '', email: '', motivo_ticket: '', mensaje: '', recibido_por: '', gestor_asignado: '', proveedor: '', source: '', fecha_registro: new Date().toISOString().slice(0, 10), nota_gestor: '' });
                    setIsManualDate(false);
                    setEnviarAviso(null);
                    setNotifEmail(false);
                    setNotifWhatsapp(false);
                    setNotifProveedorEmail(false);
                    setNotifProveedorWhatsapp(false);
                    setNotifProveedorNone(false);
                    setFiles([]);
                    setFormErrors({});
                    setShowForm(!showForm);
                }}
                newButtonLabel="Nuevo Ticket"
                newButtonShortLabel="Ticket"
                disableNewButton={true}
                disabledTooltip="Los tickets de Sofía se registran automáticamente"
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
            <IncidenciaFormModal
                accent="yellow"
                show={showForm}
                editingId={editingId}
                formData={formData}
                formErrors={formErrors}
                files={files}
                uploading={uploading}
                isSubmitting={isSubmitting}
                isManualDate={isManualDate}
                enviarAviso={enviarAviso}
                notifEmail={notifEmail}
                notifWhatsapp={notifWhatsapp}
                notifProveedorEmail={notifProveedorEmail}
                notifProveedorWhatsapp={notifProveedorWhatsapp}
                comunidades={comunidades}
                profiles={profiles}
                extraProfiles={allProfilesForLookup}
                proveedores={proveedores}
                onChange={(field, value) => setFormData(prev => ({ ...prev, [field]: value }))}
                onFilesChange={(f) => setFiles(f)}
                onSubmit={handleSubmit}
                onClose={resetForm}
                setEnviarAviso={setEnviarAviso}
                setNotifEmail={setNotifEmail}
                setNotifWhatsapp={setNotifWhatsapp}
                setNotifProveedorEmail={setNotifProveedorEmail}
                setNotifProveedorWhatsapp={setNotifProveedorWhatsapp}
                setIsManualDate={setIsManualDate}
                setFormErrors={setFormErrors}
            />

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
            <ExportModal
                show={showExportModal}
                pendingExportParams={pendingExportParams}
                onConfirm={(includeNotes) => {
                    const params = pendingExportParams;
                    setPendingExportParams(null);
                    setShowExportModal(false);
                    if (params) {
                        handleExport(params.type, params.ids, includeNotes);
                    }
                }}
                onClose={() => {
                    setPendingExportParams(null);
                    setShowExportModal(false);
                }}
            />

            <DataTable
                data={filteredIncidencias}
                columns={columns}
                keyExtractor={(row) => row.id}
                storageKey="sofia"
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
                        {
                            label: 'Empezar tarea',
                            icon: <Play className="w-4 h-4" />,
                            onClick: (r) => { setStartTaskIncidencia(r); setShowStartTaskModal(true); },
                            hidden: estado !== 'Pendiente',
                            variant: 'info',
                        },
                        {
                            label: 'Aplazar',
                            icon: <Pause className="w-4 h-4" />,
                            onClick: (r) => openAplazarModal(r.id),
                            hidden: estado === 'Resuelto' || estado === 'Aplazado',
                            variant: 'warning',
                        },
                        {
                            label: estado === 'Resuelto' ? 'Reabrir' : (estado === 'Aplazado' ? 'Volver a Pendiente' : 'Resolver'),
                            icon: estado === 'Resuelto' ? <RotateCcw className="w-4 h-4" /> : <Check className="w-4 h-4" />,
                            onClick: (r) => estado === 'Aplazado' ? reactivarDesdeAplazado(r.id) : toggleResuelto(r.id, r.resuelto),
                            disabled: isUpdatingStatus === row.id,
                            variant: estado === 'Resuelto' ? 'default' : 'success',
                        },
                        { label: 'Editar', icon: <Pencil className="w-4 h-4" />, onClick: (r) => handleEdit(r) },
                        {
                            label: 'Reasignar gestor',
                            icon: <UserCog className="w-4 h-4" />,
                            onClick: (r) => {
                                setQuickReassignIncidencia(r);
                                setQuickReassignNewGestorId(r.gestor_asignado || '');
                                setShowQuickReassignModal(true);
                            },
                        },
                        {
                            label: 'Reasignar proveedor',
                            icon: <Wrench className="w-4 h-4" />,
                            onClick: (r) => {
                                setQuickReassignProveedorIncidencia(r);
                                setQuickReassignNewProveedorId(r.proveedor_id ? String(r.proveedor_id) : '');
                                setQuickNotifProveedorEmail(false);
                                setQuickNotifProveedorWhatsapp(false);
                                setQuickNotifProveedorNone(false);
                                setShowQuickReassignProveedorModal(true);
                            },
                            hidden: estado === 'Resuelto' || estado === 'Aplazado',
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
            <DetailModal
                show={showDetailModal}
                selectedDetailIncidencia={selectedDetailIncidencia}
                profiles={profiles}
                comunidades={comunidades}
                isUpdatingRecord={isUpdatingRecord}
                isUpdatingGestor={isUpdatingGestor}
                isReassigning={isReassigning}
                newGestorId={newGestorId}
                exporting={exporting}
                showReassignSuccessModal={showReassignSuccessModal}
                detailFileInputRef={detailFileInputRef}
                entityType="sofia_incidencia"
                accent="yellow"
                onClose={() => setShowDetailModal(false)}
                onDetailFileUpload={handleDetailFileUpload}
                onDeleteAttachmentRequest={(url) => { setUrlToConfirmDelete(url); setShowDeleteDocConfirm(true); }}
                onToggleResuelto={toggleResuelto}
                onDeleteClick={handleDeleteClick}
                onExport={handleExport}
                onOpenAplazar={openAplazarModal}
                onUpdateGestor={handleUpdateGestorFromDetail}
                onAddNota={addNotaGestor}
                setIsReassigning={setIsReassigning}
                setNewGestorId={setNewGestorId}
                setSelectedDetailIncidencia={setSelectedDetailIncidencia as any}
                setShowReassignSuccessModal={setShowReassignSuccessModal}
                setShowDetailModal={setShowDetailModal}
            />

            {/* Start Task From Ticket Modal */}
            {showStartTaskModal && startTaskIncidencia && (
                <StartTaskFromTicketModal
                    incidenciaId={startTaskIncidencia.id}
                    comunidadId={startTaskIncidencia.comunidad_id ?? null}
                    comunidadLabel={
                        startTaskIncidencia.comunidades
                            ? `${startTaskIncidencia.comunidades.codigo ? startTaskIncidencia.comunidades.codigo + ' - ' : ''}${startTaskIncidencia.comunidades.nombre_cdad}`
                            : (startTaskIncidencia.comunidad || undefined)
                    }
                    ticketLabel={`${startTaskIncidencia.nombre_cliente || 'Sin nombre'} · Ticket #${startTaskIncidencia.id}`}
                    onClose={() => { setShowStartTaskModal(false); setStartTaskIncidencia(null); }}
                />
            )}

            {/* Quick Reassign Gestor Modal */}
            {portalReady && showQuickReassignModal && quickReassignIncidencia && createPortal(
                <div
                    className="fixed inset-0 bg-neutral-900/60 z-[10000] flex items-end sm:items-center sm:justify-center sm:p-4 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => { if (!isUpdatingGestor) { setShowQuickReassignModal(false); setQuickReassignIncidencia(null); setQuickReassignNewGestorId(''); } }}
                >
                    <div
                        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-md p-6 relative max-h-[92dvh] overflow-visible animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-yellow-50 rounded-full flex items-center justify-center shrink-0">
                                <UserCog className="w-6 h-6 text-yellow-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-neutral-900">Reasignar gestor</h3>
                                <p className="text-xs text-neutral-500">
                                    Ticket #{quickReassignIncidencia.id} · Actual: {quickReassignIncidencia.gestor?.nombre || 'Sin asignar'}
                                </p>
                            </div>
                        </div>

                        <div className="mb-6">
                            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Nuevo gestor</label>
                            <SearchableSelect
                                value={quickReassignNewGestorId}
                                onChange={(val) => setQuickReassignNewGestorId(String(val))}
                                options={profiles.map(p => ({ value: p.user_id, label: `${p.nombre} (${p.rol})` }))}
                                placeholder="Selecciona un gestor..."
                            />
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => { setShowQuickReassignModal(false); setQuickReassignIncidencia(null); setQuickReassignNewGestorId(''); }}
                                disabled={isUpdatingGestor}
                                className="flex-1 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-xl font-bold transition-all disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleQuickReassignSubmit}
                                disabled={!quickReassignNewGestorId || quickReassignNewGestorId === quickReassignIncidencia.gestor_asignado || isUpdatingGestor}
                                className="flex-1 py-3 bg-yellow-400 hover:bg-yellow-500 text-neutral-900 rounded-xl font-bold transition-transform active:scale-[0.98] shadow-lg shadow-yellow-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isUpdatingGestor ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Reasignar
                            </button>
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

            {/* Quick Reassign Proveedor Modal */}
            {portalReady && showQuickReassignProveedorModal && quickReassignProveedorIncidencia && createPortal(
                <div
                    className="fixed inset-0 bg-neutral-900/60 z-[10000] flex items-end sm:items-center sm:justify-center sm:p-4 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => { if (!isUpdatingProveedor) { setShowQuickReassignProveedorModal(false); setQuickReassignProveedorIncidencia(null); setQuickReassignNewProveedorId(''); setQuickNotifProveedorEmail(false); setQuickNotifProveedorWhatsapp(false); } }}
                >
                    <div
                        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-lg p-6 relative max-h-[92dvh] overflow-y-auto animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-yellow-50 rounded-full flex items-center justify-center shrink-0">
                                <Wrench className="w-6 h-6 text-yellow-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-neutral-900">Reasignar proveedor</h3>
                                <p className="text-xs text-neutral-500">
                                    Ticket #{quickReassignProveedorIncidencia.id} · Actual: {(quickReassignProveedorIncidencia as any).proveedor?.nombre || 'Sin asignar'}
                                </p>
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Nuevo proveedor</label>
                            <SearchableSelect
                                value={quickReassignNewProveedorId ? Number(quickReassignNewProveedorId) : ''}
                                onChange={(val) => {
                                    setQuickReassignNewProveedorId(val ? String(val) : '');
                                    if (!val) { setQuickNotifProveedorEmail(false); setQuickNotifProveedorWhatsapp(false); }
                                }}
                                options={proveedores.map(p => ({ value: p.id, label: p.nombre }))}
                                placeholder="Selecciona un proveedor..."
                            />
                            <p className="text-[10px] text-neutral-400 mt-2">Deja vacío para quitar el proveedor asignado.</p>
                        </div>

                        {quickReassignNewProveedorId && (() => {
                            const selectedProvQuick = proveedores.find(p => p.id === parseInt(quickReassignNewProveedorId));
                            if (!selectedProvQuick) return null;
                            return (
                                <div className="mb-6 bg-neutral-50/60 border border-neutral-100 rounded-lg p-3">
                                    <label className="text-xs font-bold text-neutral-900 uppercase tracking-widest block mb-2">
                                        Notificar al proveedor
                                    </label>
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={quickNotifProveedorNone}
                                                onChange={e => { if (e.target.checked) { setQuickNotifProveedorNone(true); setQuickNotifProveedorEmail(false); setQuickNotifProveedorWhatsapp(false); } else { setQuickNotifProveedorNone(false); } }}
                                                className="w-4 h-4 rounded accent-yellow-400"
                                            />
                                            <span className="text-xs font-semibold text-neutral-700">No notificar</span>
                                        </label>
                                        <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={quickNotifProveedorEmail}
                                                onChange={e => { setQuickNotifProveedorEmail(e.target.checked); if (e.target.checked) setQuickNotifProveedorNone(false); }}
                                                disabled={!selectedProvQuick.email}
                                                className="w-4 h-4 rounded accent-yellow-400"
                                            />
                                            <span className={`text-xs font-semibold ${selectedProvQuick.email ? 'text-neutral-700' : 'text-neutral-400'}`}>Notificar por Email</span>
                                        </label>
                                        <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={quickNotifProveedorWhatsapp}
                                                onChange={e => { setQuickNotifProveedorWhatsapp(e.target.checked); if (e.target.checked) setQuickNotifProveedorNone(false); }}
                                                disabled={!selectedProvQuick.telefono}
                                                className="w-4 h-4 rounded accent-yellow-400"
                                            />
                                            <span className={`text-xs font-semibold ${selectedProvQuick.telefono ? 'text-neutral-700' : 'text-neutral-400'}`}>Notificar por WhatsApp</span>
                                        </label>
                                    </div>
                                    {quickNotifProveedorEmail && !selectedProvQuick.email && (
                                        <p className="text-[10px] text-amber-500 font-medium mt-1.5">Este proveedor no tiene email registrado.</p>
                                    )}
                                    {quickNotifProveedorWhatsapp && !selectedProvQuick.telefono && (
                                        <p className="text-[10px] text-amber-500 font-medium mt-1.5">Este proveedor no tiene teléfono registrado.</p>
                                    )}
                                </div>
                            );
                        })()}

                        <div className="flex gap-3">
                            <button
                                onClick={() => { setShowQuickReassignProveedorModal(false); setQuickReassignProveedorIncidencia(null); setQuickReassignNewProveedorId(''); setQuickNotifProveedorEmail(false); setQuickNotifProveedorWhatsapp(false); setQuickNotifProveedorNone(false); }}
                                disabled={isUpdatingProveedor}
                                className="flex-1 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-xl font-bold transition-all disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleQuickReassignProveedorSubmit}
                                disabled={isUpdatingProveedor || (!!quickReassignNewProveedorId && !quickNotifProveedorNone && !quickNotifProveedorEmail && !quickNotifProveedorWhatsapp)}
                                className="flex-1 py-3 bg-yellow-400 hover:bg-yellow-500 text-neutral-900 rounded-xl font-bold transition-transform active:scale-[0.98] shadow-lg shadow-yellow-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isUpdatingProveedor ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Reasignar
                            </button>
                        </div>
                    </div>
                </div>
            , document.body)}

            {/* Proveedor Reassign Success Modal */}
            {portalReady && showProveedorReassignSuccessModal && createPortal(
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
                            Proveedor Reasignado
                        </h3>
                        <p className="text-neutral-500 mb-6">
                            La incidencia ha sido reasignada al nuevo proveedor correctamente.
                        </p>
                        <button
                            onClick={() => setShowProveedorReassignSuccessModal(false)}
                            className="w-full py-3 bg-neutral-900 hover:bg-black text-white rounded-xl font-bold transition-transform active:scale-[0.98]"
                        >
                            Aceptar
                        </button>
                    </div>
                </div>
            , document.body)}

            {/* Document Delete Confirmation Modal */}
            <DeleteDocConfirmModal
                show={showDeleteDocConfirm}
                onConfirm={handleDeleteAttachment}
                onClose={() => {
                    setShowDeleteDocConfirm(false);
                    setUrlToConfirmDelete(null);
                }}
            />

            {/* PDF Import Preview Modal */}
            <ImportPreviewModal
                show={showImportPreviewModal}
                importPreviewData={importPreviewData}
                importRecordEstados={importRecordEstados}
                importRecordComunidades={importRecordComunidades}
                importReceptorName={importReceptorName}
                comunidades={comunidades}
                onClose={closeImportModal}
                onConfirm={handleConfirmImport}
                setImportRecordEstados={setImportRecordEstados}
                setImportRecordComunidades={setImportRecordComunidades}
            />

            {/* Aplazar Date Picker Modal */}
            <AplazarModal
                show={showAplazarModal}
                aplazarDate={aplazarDate}
                onDateChange={setAplazarDate}
                onConfirm={aplazarTicket}
                onClose={() => {
                    setShowAplazarModal(false);
                    setAplazarIncidenciaId(null);
                    setAplazarDate('');
                }}
            />

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
