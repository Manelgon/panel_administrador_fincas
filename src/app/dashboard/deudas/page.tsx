
'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'react-hot-toast';
import { Plus, FileText, Check, Trash2, X, RotateCcw, Paperclip, Download, Loader2, Users, Pencil, Save, AlertCircle } from 'lucide-react';
import ModalActionsMenu from '@/components/ModalActionsMenu';
import DeleteConfirmationModal from '@/components/DeleteConfirmationModal';
import DataTable, { Column } from '@/components/DataTable';
import Badge from '@/components/ui/Badge';
import SearchableSelect from '@/components/SearchableSelect';
import PageHeader from '@/components/PageHeader';
import FilterBar from '@/components/FilterBar';
import FormSection from '@/components/FormSection';
import FormField from '@/components/FormField';
import { logActivity } from '@/lib/logActivity';
import TimelineChat from '@/components/TimelineChat';
import { getSecureUrl } from '@/lib/storage';
import { Morosidad, deudaFormSchema, validateForm, Profile, ComunidadOption, DeleteCredentials } from '@/lib/schemas';
import { useGlobalLoading } from '@/lib/globalLoading';

export default function MorosidadPage() {
    const { withLoading } = useGlobalLoading();
    const [morosos, setMorosos] = useState<Morosidad[]>([]);
    const [comunidades, setComunidades] = useState<ComunidadOption[]>([]);
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteEmail, setDeleteEmail] = useState('');
    const [deletePassword, setDeletePassword] = useState('');
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [filterEstado, setFilterEstado] = useState('pendiente');
    const [filterGestor, setFilterGestor] = useState('all');
    const [filterComunidad, setFilterComunidad] = useState('all');

    // Detail Modal State
    const [selectedDetailMorosidad, setSelectedDetailMorosidad] = useState<Morosidad | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [files, setFiles] = useState<File[]>([]);
    const [isUpdatingRecord, setIsUpdatingRecord] = useState(false);
    const detailFileInputRef = useRef<HTMLInputElement>(null);

    // PDF Notes Modal State
    const [showExportModal, setShowExportModal] = useState(false);
    const [pendingExportParams, setPendingExportParams] = useState<{ type: 'csv' | 'pdf', ids?: number[], includeNotes?: boolean } | null>(null);

    // Selection & Export
    const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
    const [exporting, setExporting] = useState(false);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [enviarNotificacion, setEnviarNotificacion] = useState<boolean | null>(null);
    const [notifEmail, setNotifEmail] = useState(false);
    const [notifWhatsapp, setNotifWhatsapp] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const resetForm = () => {
        setShowForm(false);
        setEditingId(null);
        setFormData({ comunidad_id: '', nombre_deudor: '', apellidos: '', telefono_deudor: '', email_deudor: '', titulo_documento: '', fecha_notificacion: '', importe: '', observaciones: '', gestor: '', documento: '', aviso: null, id_email_deuda: '' });
        setFile(null);
        setEnviarNotificacion(null);
        setNotifEmail(false);
        setNotifWhatsapp(false);
        setFormErrors({});
    };
    const [isUpdatingStatus, setIsUpdatingStatus] = useState<number | null>(null);

    const handleRowClick = (morosidad: Morosidad) => {
        setSelectedDetailMorosidad(morosidad);
        setShowDetailModal(true);
    };

    const [formData, setFormData] = useState({
        comunidad_id: '',
        nombre_deudor: '',
        apellidos: '',
        telefono_deudor: '',
        email_deudor: '',
        titulo_documento: '',
        fecha_notificacion: '',
        importe: '',
        observaciones: '',
        gestor: '',
        documento: '',
        aviso: null as string | null,
        id_email_deuda: '',
    });

    const [file, setFile] = useState<File | null>(null);

    useEffect(() => {
        fetchInitialData();

        // Subscribe to real-time changes
        const channel = supabase
            .channel('morosidad-realtime')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'morosidad' },
                () => {
                    fetchMorosidad();
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
        if (showForm || showDeleteModal || showExportModal || showDetailModal) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [showForm, showDeleteModal, showExportModal, showDetailModal]);

    const fetchInitialData = async () => {
        setLoading(true);
        await Promise.all([fetchComunidades(), fetchMorosidad(), fetchProfiles()]);
        setLoading(false);
    };

    const fetchComunidades = async () => {
        const { data } = await supabase.from('comunidades').select('id, nombre_cdad, codigo, direccion').eq('activo', true);
        if (data) setComunidades(data);
    };

    const fetchProfiles = async () => {
        const { data } = await supabase.from('profiles').select('user_id, nombre, rol').eq('activo', true);
        if (data) setProfiles(data.filter(p => !p.nombre?.toLowerCase().startsWith('sofia-bot')));
    };

    const fetchMorosidad = async () => {
        const { data, error } = await supabase
            .from('morosidad')
            .select(`
                *,
                comunidades (nombre_cdad, codigo),
                resolver:profiles!resuelto_por (nombre)
            `)
            .order('created_at', { ascending: false });

        if (error) {
            toast.error('Error cargando registros');
        } else {
            setMorosos(data || []);
        }
    };

    const handleFileUpload = async (file: File) => {
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('path', 'morosidad');
            formData.append('bucket', 'documentos');

            const res = await fetch('/api/storage/upload', { method: 'POST', body: formData });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Error al subir archivo');
            }
            const data = await res.json();
            return data.publicUrl;
        } catch (error: any) {
            toast.error('Error subiendo archivo: ' + error.message);
            console.error(error);
            return null;
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (isSubmitting) return;

        const errors: Record<string, string> = {};
        if (!formData.comunidad_id) errors.comunidad_id = 'Debes seleccionar una comunidad';
        if (!formData.nombre_deudor?.trim()) errors.nombre_deudor = 'El nombre del deudor es obligatorio';
        if (!formData.titulo_documento?.trim()) errors.titulo_documento = 'El título del documento es obligatorio';
        if (!formData.fecha_notificacion) errors.fecha_notificacion = 'La fecha de notificación es obligatoria';
        if (!formData.importe) errors.importe = 'El importe es obligatorio';
        if (notifEmail && !formData.email_deudor) errors.email_deudor = 'El email es obligatorio para notificar por Email';
        if (notifEmail && formData.email_deudor && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email_deudor)) errors.email_deudor = 'El formato del email no es válido';
        if (notifWhatsapp && !formData.telefono_deudor) errors.telefono_deudor = 'El teléfono es obligatorio para notificar por WhatsApp';
        if (notifWhatsapp && formData.telefono_deudor && !/^\d{9}$/.test(formData.telefono_deudor)) errors.telefono_deudor = 'El teléfono debe tener 9 dígitos numéricos';
        if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
        setFormErrors({});

        const label = editingId ? 'Actualizando deuda...' : 'Guardando deuda...';
        await withLoading(async () => {
            setIsSubmitting(true);
            const loadingToastId = toast.loading(label);

            let docUrl = formData.documento;
            if (file) {
                const url = await handleFileUpload(file);
                if (!url) return;
                docUrl = url;
            }

            if (editingId) {
                try {
                    const { error } = await supabase.from('morosidad').update({
                        ...formData,
                        comunidad_id: parseInt(formData.comunidad_id),
                        importe: parseFloat(formData.importe.toString().replace(',', '.')),
                        documento: docUrl,
                        id_email_deuda: formData.id_email_deuda || null,
                        gestor: formData.gestor || null,
                    }).eq('id', editingId);

                    if (error) throw error;
                    toast.success('Registro actualizado');

                    const comunidad = comunidades.find(c => c.id === parseInt(formData.comunidad_id));
                    await logActivity({
                        action: 'update', entityType: 'morosidad', entityId: editingId,
                        entityName: `${formData.nombre_deudor} ${formData.apellidos}`,
                        details: { comunidad: comunidad?.nombre_cdad, importe: formData.importe }
                    });

                    setShowForm(false); setFormErrors({}); setEditingId(null);
                    setFormData({ comunidad_id: '', nombre_deudor: '', apellidos: '', telefono_deudor: '', email_deudor: '', titulo_documento: '', fecha_notificacion: '', importe: '', observaciones: '', gestor: '', documento: '', aviso: null, id_email_deuda: '' });
                    setFile(null);
                    fetchMorosidad();
                } catch (error: any) {
                    toast.error('Error al actualizar: ' + error.message);
                } finally {
                    toast.dismiss(loadingToastId);
                    setIsSubmitting(false);
                }
            } else {
                try {
                    const now = new Date();
                    const timestamp = now.getFullYear().toString() +
                        (now.getMonth() + 1).toString().padStart(2, '0') +
                        now.getDate().toString().padStart(2, '0') + '-' +
                        now.getHours().toString().padStart(2, '0') +
                        now.getMinutes().toString().padStart(2, '0') +
                        now.getSeconds().toString().padStart(2, '0');
                    const initials = (formData.nombre_deudor || '').substring(0, 3).toUpperCase();
                    const autoRef = `DEV-${timestamp}-${initials}`;

                    const { data: newDebt, error } = await supabase.from('morosidad').insert([{
                        ...formData,
                        comunidad_id: parseInt(formData.comunidad_id),
                        importe: parseFloat(formData.importe.replace(',', '.')),
                        documento: docUrl,
                        id_email_deuda: formData.id_email_deuda || null,
                        gestor: formData.gestor || null,
                        ref: autoRef || null,
                        aviso: (!notifEmail && !notifWhatsapp) ? 0 : (notifWhatsapp && !notifEmail) ? 1 : (!notifWhatsapp && notifEmail) ? 2 : 3,
                    }]).select().single();

                    if (error) throw error;
                    toast.success('Registro de morosidad creado');

                    const comunidad = comunidades.find(c => c.id === parseInt(formData.comunidad_id));
                    await logActivity({
                        action: 'create', entityType: 'morosidad', entityId: newDebt.id,
                        entityName: `${formData.nombre_deudor} ${formData.apellidos}`,
                        details: { comunidad: comunidad?.nombre_cdad, importe: formData.importe, concepto: formData.titulo_documento }
                    });

                    // Webhook disparado por Supabase nativo (INSERT en morosidad → trigger-new-debt)

                    setShowForm(false); setFormErrors({});
                    setFormData({ comunidad_id: '', nombre_deudor: '', apellidos: '', telefono_deudor: '', email_deudor: '', titulo_documento: '', fecha_notificacion: '', importe: '', observaciones: '', gestor: '', documento: '', aviso: null, id_email_deuda: '' });
                    setEnviarNotificacion(null); setNotifEmail(false); setNotifWhatsapp(false); setFile(null);
                    fetchMorosidad();
                } catch (error: any) {
                    toast.error('Error: ' + error.message);
                } finally {
                    toast.dismiss(loadingToastId);
                    setIsSubmitting(false);
                }
            }
        }, label);
    };

    const handleDetailFileUpload = async (file: File) => {
        if (!selectedDetailMorosidad) return;

        await withLoading(async () => {
        setIsUpdatingRecord(true);
        const loadingToast = toast.loading('Subiendo archivo...');

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('path', 'morosidad');
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
            const docUrl = data.publicUrl;

            const { error: updateError } = await supabase
                .from('morosidad')
                .update({ documento: docUrl })
                .eq('id', selectedDetailMorosidad.id);

            if (updateError) throw updateError;

            setSelectedDetailMorosidad({
                ...selectedDetailMorosidad,
                documento: docUrl
            });

            setMorosos(prev => prev.map(m => m.id === selectedDetailMorosidad.id ? { ...m, documento: docUrl } : m));

            toast.success('Documento actualizado', { id: loadingToast });
        } catch (error: any) {
            console.error(error);
            toast.error('Error al subir archivo', { id: loadingToast });
        } finally {
            setIsUpdatingRecord(false);
        }
        }, 'Subiendo documento...');
    };

    const markAsPaid = async (id: number) => {
        if (isUpdatingStatus === id) return;
        await withLoading(async () => {
        setIsUpdatingStatus(id);
        try {
            const moroso = morosos.find(m => m.id === id);
            const { data: { user } } = await supabase.auth.getUser();
            const { error } = await supabase
                .from('morosidad')
                .update({
                    estado: 'Pagado',
                    fecha_pago: new Date().toISOString(),
                    resuelto_por: user?.id,
                    fecha_resuelto: new Date().toISOString()
                })
                .eq('id', id);

            if (error) throw error;

            toast.success('Marcado como pagado');

            // Webhook de resolución disparado por Supabase nativo (UPDATE en morosidad → trigger-resolved-debt)

            // Log activity
            await logActivity({
                action: 'mark_paid',
                entityType: 'morosidad',
                entityId: id,
                entityName: `${moroso?.nombre_deudor} ${moroso?.apellidos}`,
                details: {
                    comunidad: moroso?.comunidades?.nombre_cdad,
                    importe: moroso?.importe
                }
            });

            fetchMorosidad();
        } catch (error) {
            console.error(error);
            toast.error('Error al actualizar');
        } finally {
            setIsUpdatingStatus(null);
        }
        }, 'Marcando como pagado...');
    };

    const reopenDebt = async (id: number) => {
        if (isUpdatingStatus === id) return;
        await withLoading(async () => {
        setIsUpdatingStatus(id);
        try {
            const moroso = morosos.find(m => m.id === id);
            const { data: { user } } = await supabase.auth.getUser();

            const { error } = await supabase
                .from('morosidad')
                .update({
                    estado: 'Pendiente',
                    fecha_pago: null,
                    resuelto_por: null,
                    fecha_resuelto: null
                })
                .eq('id', id);

            if (error) throw error;

            toast.success('Deuda reabierta correctamente');

            // Timeline de gestión: registrar reapertura
            if (user) {
                await supabase.from('record_messages').insert([{
                    entity_type: 'morosidad',
                    entity_id: id,
                    user_id: user.id,
                    content: `🔄 Se ha reabierto la deuda.`
                }]);
            }

            await logActivity({
                action: 'update',
                entityType: 'morosidad',
                entityId: id,
                entityName: `${moroso?.nombre_deudor} ${moroso?.apellidos}`,
                details: {
                    comunidad: moroso?.comunidades?.nombre_cdad,
                    importe: moroso?.importe,
                    action: 'reopen'
                }
            });

            fetchMorosidad();
        } catch (error) {
            console.error(error);
            toast.error('Error al reabrir deuda');
        } finally {
            setIsUpdatingStatus(null);
        }
        }, 'Reabriendo deuda...');
    };

    const handleDeleteClick = (id: number) => {
        setDeleteId(id);
        setShowDeleteModal(true);
        setDeletePassword('');
    };

    const handleConfirmDelete = async ({ email, password }: DeleteCredentials) => {
        if (deleteId === null || !email || !password) return;

        await withLoading(async () => {
            setIsDeleting(true);
            try {
                const res = await fetch('/api/admin/universal-delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: deleteId, email, password, type: 'morosidad' })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Error al eliminar');

                toast.success('Registro eliminado');
                setMorosos(prev => prev.filter(m => m.id !== deleteId));

                const deleted = morosos.find(m => m.id === deleteId);
                await logActivity({
                    action: 'delete', entityType: 'morosidad', entityId: deleteId,
                    entityName: `${deleted?.nombre_deudor} ${deleted?.apellidos}`,
                    details: { comunidad: deleted?.comunidades?.nombre_cdad, importe: deleted?.importe, deleted_by_admin: email }
                });

                setShowDeleteModal(false);
                setDeleteId(null);
            } catch (error: any) {
                toast.error(error.message);
            } finally {
                setIsDeleting(false);
            }
        }, 'Eliminando deuda...');
    };

    const handleExport = async (type: 'csv' | 'pdf', idsOverride?: number[], includeNotesFromModal?: boolean) => {
        const idsToExport = (idsOverride || Array.from(selectedIds)).map(Number);
        if (idsToExport.length === 0) return;

        // If overriding IDs (from modal), imply detail view if single item
        const isDetailView = !!idsOverride && idsToExport.length === 1 && type === 'pdf';

        // Custom Modal Logic
        if (isDetailView && includeNotesFromModal === undefined) {
            setPendingExportParams({ type, ids: idsToExport });
            setShowExportModal(true);
            return;
        }

        const includeNotes = includeNotesFromModal !== undefined ? includeNotesFromModal : false;

        const label = type === 'pdf' ? 'Generando PDF...' : 'Exportando CSV...';
        await withLoading(async () => {
        setExporting(true);
        try {
            const res = await fetch('/api/morosidad/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ids: idsToExport,
                    type,
                    layout: isDetailView ? 'detail' : 'list',
                    includeNotes
                })
            });

            if (!res.ok) throw new Error('Export failed');

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;

            // Filename Logic
            const now = new Date();
            const dateStr = `${now.getDate().toString().padStart(2, '0')}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getFullYear()}`;

            if (isDetailView) {
                // "DEV_id_fecha"
                a.download = `DEV_${idsToExport[0]}_${dateStr}.pdf`;
            } else {
                a.download = `listado_deudas_${dateStr}.${type === 'csv' ? 'csv' : 'pdf'}`;
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

    const handleEdit = (moroso: Morosidad) => {
        setEditingId(moroso.id);
        setFormData({
            comunidad_id: moroso.comunidad_id.toString(),
            nombre_deudor: moroso.nombre_deudor,
            apellidos: moroso.apellidos || '',
            telefono_deudor: moroso.telefono_deudor || '',
            email_deudor: moroso.email_deudor || '',
            titulo_documento: moroso.titulo_documento,
            fecha_notificacion: moroso.fecha_notificacion ? moroso.fecha_notificacion.split('T')[0] : '',
            importe: moroso.importe.toString(),
            observaciones: moroso.observaciones || '',
            gestor: moroso.gestor || '',
            documento: moroso.documento || '',
            aviso: moroso.aviso || null,
            id_email_deuda: moroso.id_email_deuda || '',
        });
        setShowForm(true);
    };

    const columns: Column<Morosidad>[] = [
        {
            key: 'id',
            label: 'ID',
        },
        {
            key: 'ref',
            label: 'Ref',
            render: (row) => <span className="font-medium text-neutral-600">{row.ref || '-'}</span>,
        },
        {
            key: 'codigo',
            label: 'Código',
            render: (row) => (
                <div className="flex items-start gap-3">
                    <span className={`mt-1 h-3.5 w-1.5 rounded-full ${row.estado === 'Pendiente' ? 'bg-yellow-400' : 'bg-neutral-900'}`} />
                    <span className="font-semibold">{row.comunidades?.codigo || '-'}</span>
                </div>
            ),
        },
        {
            key: 'comunidades',
            label: 'Comunidad',
            render: (row) => row.comunidades?.nombre_cdad || '-',
        },
        {
            key: 'nombre_deudor',
            label: 'Nombre',
        },
        {
            key: 'apellidos',
            label: 'Apellidos',
            defaultVisible: false,
        },
        {
            key: 'telefono_deudor',
            label: 'Teléfono',
            defaultVisible: false,
        },
        {
            key: 'email_deudor',
            label: 'Email',
            defaultVisible: false,
        },
        {
            key: 'titulo_documento',
            label: 'Concepto',
        },
        {
            key: 'documento',
            label: 'Adjuntos',
            render: (row) => (
                <div className="flex justify-center">
                    {row.documento ? (
                        <a
                            href={getSecureUrl(row.documento)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-full bg-yellow-50 text-yellow-600 hover:bg-yellow-100 transition-colors"
                            title="Ver Documento"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <FileText className="w-4 h-4" />
                        </a>
                    ) : (
                        <span className="text-neutral-400">-</span>
                    )}
                </div>
            ),
        },
        {
            key: 'importe',
            label: 'Importe',
            render: (row) => <span className="font-bold">{row.importe}€</span>,
        },
        {
            key: 'observaciones',
            label: 'Observaciones',
            render: (row) => (
                <div className="max-w-xs truncate" title={row.observaciones}>
                    {row.observaciones || '-'}
                </div>
            ),
            defaultVisible: false,
        },
        {
            key: 'estado',
            label: 'Estado',
            render: (row) => (
                <Badge variant={
                    row.estado === 'Pagado' ? 'success' :
                    row.estado === 'En disputa' ? 'neutral' :
                    'warning'
                }>
                    {row.estado}
                </Badge>
            ),
        },
        {
            key: 'aviso',
            label: 'Aviso',
            defaultVisible: false,
            render: (row) => {
                const v = Number(row.aviso);
                const labels: Record<number, { text: string; cls: string }> = {
                    0: { text: 'Sin aviso', cls: 'bg-neutral-100 text-neutral-500' },
                    1: { text: 'WhatsApp', cls: 'bg-green-100 text-green-700' },
                    2: { text: 'Email', cls: 'bg-blue-100 text-blue-700' },
                    3: { text: 'Ambos', cls: 'bg-indigo-100 text-indigo-700' },
                };
                const label = labels[v];
                return label
                    ? <span className={`${label.cls} px-2 py-0.5 rounded-full text-[10px] font-bold`}>{label.text}</span>
                    : <span className="text-neutral-400">-</span>;
            },
        },
        {
            key: 'fecha_notificacion',
            label: 'Fecha Notificación',
            render: (row) => row.fecha_notificacion ? new Date(row.fecha_notificacion).toLocaleDateString() : '-',
            defaultVisible: false,
        },
        {
            key: 'gestor',
            label: 'Gestor',
            // Lookup name from profiles if gestor contains a UUID
            render: (row) => {
                if (!row.gestor) return '-';
                const p = profiles.find(p => p.user_id === row.gestor);
                // If found, show name. If not found (maybe legacy data or deleted), show raw value or fallback
                return p ? p.nombre : (row.gestor.length > 20 ? 'Usuario desconocido' : row.gestor);
            },
            defaultVisible: false,
        },
        {
            key: 'fecha_pago',
            label: 'Fecha Pago',
            render: (row) => row.fecha_pago ? new Date(row.fecha_pago).toLocaleDateString() : '-',
            defaultVisible: false,
        },
        {
            key: 'resuelto_por',
            label: 'Resuelto Por',
            render: (row) => row.resolver?.nombre || '-',
            defaultVisible: false,
        },
        {
            key: 'created_at',
            label: 'Fecha Creación',
            render: (row) => new Date(row.created_at).toLocaleDateString(),
            defaultVisible: false,
        },
        {
            key: 'fecha_resuelto',
            label: 'Fecha Resuelto',
            render: (row) => row.fecha_resuelto ? new Date(row.fecha_resuelto).toLocaleDateString() : '-',
            defaultVisible: false,
        },
    ];

    const filteredMorosidad = morosos.filter(m => {
        const matchesEstado = filterEstado === 'pendiente' ? m.estado !== 'Pagado' :
            filterEstado === 'resuelto' ? m.estado === 'Pagado' : true;

        const matchesGestor = filterGestor === 'all' ? true : m.gestor === filterGestor;
        const matchesComunidad = filterComunidad === 'all' ? true : m.comunidad_id === Number(filterComunidad);

        return matchesEstado && matchesGestor && matchesComunidad;
    });

    return (
        <div className="space-y-6">
            <PageHeader
                title="Gestión de Deudas"
                showForm={showForm}
                onToggleForm={() => showForm ? resetForm() : setShowForm(true)}
                newButtonLabel="Registrar Deuda"
                newButtonShortLabel="Deuda"
            />

            {/* Filters */}
            <div className="flex flex-col gap-3">
                <FilterBar
                    value={filterEstado}
                    onChange={(v) => setFilterEstado(v)}
                    options={[
                        { value: 'pendiente', label: 'Pendientes', activeClass: 'bg-yellow-400 text-neutral-950' },
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
                        className="bg-white w-full max-w-5xl rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[92dvh] sm:max-h-[90dvh] animate-in fade-in slide-in-from-bottom sm:zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-white shrink-0">
                            <div>
                                <h2 className="text-xl font-black text-neutral-900 tracking-tight">
                                    {editingId ? 'Editar Deuda' : 'Nueva Deuda'}
                                </h2>
                                <p className="text-xs text-neutral-500 mt-0.5">
                                    {editingId ? 'Modifique los datos de la deuda' : 'Complete los datos para registrar una nueva deuda'}
                                </p>
                            </div>
                            <button onClick={resetForm} className="p-2 hover:bg-neutral-100 rounded-xl transition-colors text-neutral-400 hover:text-neutral-700">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                            <form id="morosidad-form" onSubmit={handleSubmit} className="space-y-6">

                                {/* Sección: Identificación del Deudor */}
                                <FormSection title="Identificación del Deudor">
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <div className="md:col-span-4">
                                            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2 block">
                                                Comunidad <span className="text-red-500">*</span>
                                            </label>
                                            <SearchableSelect
                                                value={formData.comunidad_id}
                                                onChange={(val) => { setFormData({ ...formData, comunidad_id: String(val) }); setFormErrors(prev => ({ ...prev, comunidad_id: '' })); }}
                                                options={comunidades.map(cd => ({
                                                    value: String(cd.id),
                                                    label: cd.codigo ? `${cd.codigo} - ${cd.nombre_cdad}` : cd.nombre_cdad
                                                }))}
                                                placeholder="Selecciona una comunidad..."
                                                disabled={isSubmitting}
                                            />
                                            {formErrors.comunidad_id && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.comunidad_id}</p>}
                                        </div>

                                        <div className="md:col-span-2">
                                            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2 block">
                                                Nombre <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Juan"
                                                className={`w-full bg-white border text-neutral-900 text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-400/20 focus:border-amber-400 transition-all placeholder:text-neutral-400 ${formErrors.nombre_deudor ? 'border-red-400' : 'border-neutral-200'}`}
                                                value={formData.nombre_deudor}
                                                onChange={e => { setFormData({ ...formData, nombre_deudor: e.target.value }); setFormErrors(prev => ({ ...prev, nombre_deudor: '' })); }}
                                                disabled={isSubmitting}
                                            />
                                            {formErrors.nombre_deudor && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.nombre_deudor}</p>}
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2 block">
                                                Apellidos
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="García Pérez"
                                                className="w-full bg-white border border-neutral-200 text-neutral-900 text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-400/20 focus:border-amber-400 transition-all placeholder:text-neutral-400"
                                                value={formData.apellidos}
                                                onChange={e => setFormData({ ...formData, apellidos: e.target.value })}
                                                disabled={isSubmitting}
                                            />
                                        </div>

                                        <div className="md:col-span-2">
                                            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2 block">
                                                Teléfono {enviarNotificacion && !formData.email_deudor && <span className="text-red-500">*</span>}
                                            </label>
                                            <input
                                                type="tel"
                                                placeholder="600000000"
                                                className={`w-full bg-white border text-neutral-900 text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 transition-all placeholder:text-neutral-400 ${formErrors.telefono_deudor || formErrors.contacto ? 'border-red-400 focus:ring-red-400/20 focus:border-red-400' : enviarNotificacion && !formData.telefono_deudor && !formData.email_deudor ? 'border-red-300 focus:ring-red-400/20 focus:border-red-400' : 'border-neutral-200 focus:ring-amber-400/20 focus:border-amber-400'}`}
                                                value={formData.telefono_deudor}
                                                onChange={e => { setFormData({ ...formData, telefono_deudor: e.target.value }); setFormErrors(prev => ({ ...prev, telefono_deudor: '', contacto: '' })); }}
                                                disabled={isSubmitting}
                                            />
                                            {formErrors.telefono_deudor && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.telefono_deudor}</p>}
                                            {formErrors.contacto && !formErrors.telefono_deudor && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.contacto}</p>}
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2 block">
                                                Email {enviarNotificacion && !formData.telefono_deudor && <span className="text-red-500">*</span>}
                                            </label>
                                            <input
                                                type="email"
                                                placeholder="ejemplo@correo.com"
                                                className={`w-full bg-white border text-neutral-900 text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 transition-all placeholder:text-neutral-400 ${formErrors.email_deudor || formErrors.contacto ? 'border-red-400 focus:ring-red-400/20 focus:border-red-400' : enviarNotificacion && !formData.email_deudor && !formData.telefono_deudor ? 'border-red-300 focus:ring-red-400/20 focus:border-red-400' : 'border-neutral-200 focus:ring-amber-400/20 focus:border-amber-400'}`}
                                                value={formData.email_deudor}
                                                onChange={e => { setFormData({ ...formData, email_deudor: e.target.value }); setFormErrors(prev => ({ ...prev, email_deudor: '', contacto: '' })); }}
                                                disabled={isSubmitting}
                                            />
                                            {formErrors.email_deudor && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.email_deudor}</p>}
                                        </div>
                                    </div>
                                </FormSection>

                                {/* Sección: Datos de la Deuda */}
                                <FormSection title="Datos de la Deuda">
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <div className="md:col-span-4">
                                            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2 block">
                                                Título Documento <span className="text-red-500">*</span>
                                            </label>
                                            <SearchableSelect
                                                value={formData.titulo_documento}
                                                onChange={(val) => { setFormData({ ...formData, titulo_documento: String(val) }); setFormErrors(prev => ({ ...prev, titulo_documento: '' })); }}
                                                options={[{ value: 'Recibo Comunidad', label: 'Recibo comunidad' }]}
                                                placeholder="Tipo..."
                                                disabled={isSubmitting}
                                            />
                                            {formErrors.titulo_documento && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.titulo_documento}</p>}
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2 block">
                                                Fecha Notificación <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="date"
                                                className={`w-full bg-white border text-neutral-900 text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-400/20 focus:border-amber-400 transition-all ${formErrors.fecha_notificacion ? 'border-red-400' : 'border-neutral-200'}`}
                                                value={formData.fecha_notificacion}
                                                onChange={e => { setFormData({ ...formData, fecha_notificacion: e.target.value }); setFormErrors(prev => ({ ...prev, fecha_notificacion: '' })); }}
                                                disabled={isSubmitting}
                                            />
                                            {formErrors.fecha_notificacion && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.fecha_notificacion}</p>}
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2 block">
                                                Importe (€) <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                placeholder="0,00"
                                                className={`w-full bg-white border text-neutral-900 text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-400/20 focus:border-amber-400 transition-all placeholder:text-neutral-400 ${formErrors.importe ? 'border-red-400' : 'border-neutral-200'}`}
                                                value={formData.importe}
                                                onChange={e => { const val = e.target.value.replace(',', '.'); if (/^\d*\.?\d*$/.test(val) || val === '') { setFormData({ ...formData, importe: e.target.value }); setFormErrors(prev => ({ ...prev, importe: '' })); } }}
                                                disabled={isSubmitting}
                                            />
                                            {formErrors.importe && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.importe}</p>}
                                        </div>
                                        <div className="md:col-span-4">
                                            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2 block">
                                                Gestor
                                            </label>
                                            <SearchableSelect
                                                value={formData.gestor}
                                                onChange={(val) => setFormData({ ...formData, gestor: String(val) })}
                                                options={profiles.map(profile => ({ value: profile.user_id, label: `${profile.nombre} (${profile.rol})` }))}
                                                placeholder="Gestor..."
                                                disabled={isSubmitting}
                                            />
                                        </div>
                                        <div className="md:col-span-4">
                                            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2 block">
                                                Observaciones
                                            </label>
                                            <textarea
                                                placeholder="Notas adicionales sobre la deuda..."
                                                rows={3}
                                                className="w-full bg-white border border-neutral-200 text-neutral-900 text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-400/20 focus:border-amber-400 transition-all placeholder:text-neutral-400 resize-none"
                                                value={formData.observaciones}
                                                onChange={e => setFormData({ ...formData, observaciones: e.target.value })}
                                                disabled={isSubmitting}
                                            />
                                        </div>
                                    </div>
                                </FormSection>

                                {/* Sección: Archivos */}
                                <FormSection title="Archivos">
                                    <div>
                                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2 block">
                                            Adjuntar Documento
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="file"
                                                className="w-full bg-white border border-neutral-200 text-neutral-900 text-sm rounded-xl px-4 py-[9px] focus:outline-none focus:ring-2 focus:ring-amber-400/20 focus:border-amber-400 transition-all file:mr-4 file:py-1 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-neutral-100 file:text-neutral-700 hover:file:bg-neutral-200 cursor-pointer"
                                                onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
                                                disabled={isSubmitting}
                                            />
                                            {uploading && <span className="absolute right-4 top-3 text-xs font-bold text-amber-500 uppercase tracking-widest animate-pulse">Subiendo...</span>}
                                        </div>
                                    </div>
                                </FormSection>

                                {/* Sección: Notificación */}
                                <FormSection title="Notificación al Propietario">
                                    <div className="flex flex-col gap-3">
                                        {/* Checkboxes de canal */}
                                        <div className="bg-white border border-neutral-200 rounded-xl p-4">
                                            <label className="text-xs font-bold text-neutral-900 uppercase tracking-widest block mb-2">
                                                Canal de notificación
                                            </label>
                                            <div className="flex flex-col sm:flex-row gap-3">
                                                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                                    <input
                                                        type="checkbox"
                                                        checked={notifEmail}
                                                        disabled={isSubmitting}
                                                        onChange={e => {
                                                            setNotifEmail(e.target.checked);
                                                            setEnviarNotificacion(e.target.checked || notifWhatsapp ? true : false);
                                                            setFormErrors(prev => ({ ...prev, enviarNotificacion: '', contacto: '' }));
                                                        }}
                                                        className="w-4 h-4 rounded accent-yellow-400"
                                                    />
                                                    <span className="text-xs font-semibold text-neutral-700">Notificar por Email</span>
                                                </label>
                                                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                                    <input
                                                        type="checkbox"
                                                        checked={notifWhatsapp}
                                                        disabled={isSubmitting}
                                                        onChange={e => {
                                                            setNotifWhatsapp(e.target.checked);
                                                            setEnviarNotificacion(notifEmail || e.target.checked ? true : false);
                                                            setFormErrors(prev => ({ ...prev, enviarNotificacion: '', contacto: '' }));
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
                                                {formData.email_deudor ? (
                                                    <div className="flex items-center gap-2 px-3 py-2 bg-neutral-100 border border-neutral-200 rounded-xl cursor-not-allowed">
                                                        <span className="text-sm text-neutral-500 font-medium flex-1 select-none">{formData.email_deudor}</span>
                                                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest shrink-0">Del cliente</span>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <input
                                                            type="email"
                                                            placeholder="ejemplo@correo.com"
                                                            disabled={isSubmitting}
                                                            className={`w-full bg-white border text-neutral-900 text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 transition-all placeholder:text-neutral-400 ${formErrors.email_deudor ? 'border-red-400 focus:ring-red-400/20 focus:border-red-400' : 'border-neutral-200 focus:ring-amber-400/20 focus:border-amber-400'}`}
                                                            value={formData.email_deudor}
                                                            onChange={e => { setFormData({ ...formData, email_deudor: e.target.value }); setFormErrors(prev => ({ ...prev, email_deudor: '' })); }}
                                                        />
                                                        {formErrors.email_deudor && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.email_deudor}</p>}
                                                    </>
                                                )}
                                            </div>
                                        )}
                                        {notifWhatsapp && (
                                            <div>
                                                <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">
                                                    Teléfono para notificación <span className="text-red-500">*</span>
                                                </label>
                                                {formData.telefono_deudor ? (
                                                    <div className="flex items-center gap-2 px-3 py-2 bg-neutral-100 border border-neutral-200 rounded-xl cursor-not-allowed">
                                                        <span className="text-sm text-neutral-500 font-medium flex-1 select-none">{formData.telefono_deudor}</span>
                                                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest shrink-0">Del cliente</span>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <input
                                                            type="tel"
                                                            placeholder="600000000"
                                                            disabled={isSubmitting}
                                                            className={`w-full bg-white border text-neutral-900 text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 transition-all placeholder:text-neutral-400 ${formErrors.telefono_deudor ? 'border-red-400 focus:ring-red-400/20 focus:border-red-400' : 'border-neutral-200 focus:ring-amber-400/20 focus:border-amber-400'}`}
                                                            value={formData.telefono_deudor}
                                                            onChange={e => { setFormData({ ...formData, telefono_deudor: e.target.value }); setFormErrors(prev => ({ ...prev, telefono_deudor: '' })); }}
                                                        />
                                                        {formErrors.telefono_deudor && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.telefono_deudor}</p>}
                                                    </>
                                                )}
                                            </div>
                                        )}
                                        {formErrors.contacto && (
                                            <p className="flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.contacto}</p>
                                        )}
                                    </div>
                                </FormSection>
                            </form>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-white border-t border-neutral-100">
                            <button
                                type="button"
                                onClick={resetForm}
                                className="px-6 py-3 text-xs font-black uppercase tracking-[0.15em] text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                form="morosidad-form"
                                type="submit"
                                disabled={
                                    isSubmitting || 
                                    uploading || 
                                    !formData.comunidad_id || 
                                    !formData.nombre_deudor || 
                                    !formData.titulo_documento ||
                                    !formData.fecha_notificacion ||
                                    !formData.importe ||
                                    !!(notifEmail && !formData.email_deudor) ||
                                    !!(notifWhatsapp && !formData.telefono_deudor)
                                }
                                className="h-12 px-8 bg-amber-400 hover:bg-amber-500 text-neutral-950 font-black text-xs uppercase tracking-[0.15em] rounded-xl transition-all shadow-lg shadow-amber-200/50 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                            >
                                {isSubmitting || uploading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        PROCESANDO...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4" />
                                        {editingId ? 'GUARDAR CAMBIOS' : 'REGISTRAR DEUDA'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            , document.body)}



            {(() => {
                return (
                    <>
                        {/* Export Notes Modal */}
                        {showExportModal && (
                            <div
                                className="fixed inset-0 bg-black/60 z-[10000] flex items-end sm:items-center sm:justify-center sm:p-4 backdrop-blur-[6px]"
                                onClick={() => {
                                    setShowExportModal(false);
                                    setPendingExportParams(null);
                                }}
                            >
                                <div
                                    className="bg-white rounded-t-2xl sm:rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.22)] border border-neutral-200/70 w-full max-w-sm overflow-hidden max-h-[92dvh] flex flex-col animate-in fade-in slide-in-from-bottom sm:zoom-in-95 duration-200"
                                    onClick={e => e.stopPropagation()}
                                >
                                    <div className="px-6 py-5 border-b border-neutral-100 bg-gradient-to-r from-neutral-50 to-white">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-xl bg-yellow-400 flex items-center justify-center shadow-sm">
                                                <Download className="w-4.5 h-4.5 text-neutral-900" />
                                            </div>
                                            <div>
                                                <h3 className="text-base font-bold text-neutral-900">Exportar PDF</h3>
                                                <p className="text-xs text-neutral-400">Opciones de exportación</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-6">
                                        <p className="text-sm text-neutral-600 mb-6">
                                            ¿Desea incluir las notas de gestión en el documento PDF?
                                        </p>
                                        <div className="flex flex-col gap-2.5">
                                            <button
                                                onClick={() => {
                                                    const params = pendingExportParams;
                                                    setPendingExportParams(null);
                                                    setShowExportModal(false);
                                                    if (params) { handleExport(params.type, params.ids, true); }
                                                }}
                                                className="w-full py-2.5 bg-yellow-400 text-neutral-950 rounded-xl font-bold text-sm hover:bg-yellow-500 transition shadow-sm"
                                            >
                                                Sí, incluir notas
                                            </button>
                                            <button
                                                onClick={() => {
                                                    const params = pendingExportParams;
                                                    setPendingExportParams(null);
                                                    setShowExportModal(false);
                                                    if (params) { handleExport(params.type, params.ids, false); }
                                                }}
                                                className="w-full py-2.5 bg-neutral-100 text-neutral-700 rounded-xl font-bold text-sm hover:bg-neutral-200 transition"
                                            >
                                                No, sin notas
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setPendingExportParams(null);
                                                    setShowExportModal(false);
                                                }}
                                                className="w-full py-2.5 text-neutral-400 hover:text-neutral-600 text-sm font-medium transition"
                                            >
                                                Cancelar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <DataTable
                            data={filteredMorosidad}
                            columns={columns}
                            keyExtractor={(row) => row.id}
                            storageKey="morosidad"
                            loading={loading}
                            emptyMessage="No hay registros de morosidad en esta vista"
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
                            rowActions={(row) => [
                                {
                                    label: 'Editar',
                                    icon: <Pencil className="w-4 h-4" />,
                                    onClick: (r) => handleEdit(r),
                                    hidden: row.estado === 'Pagado',
                                },
                                {
                                    label: 'Marcar como Pagado',
                                    icon: <Check className="w-4 h-4" />,
                                    onClick: (r) => markAsPaid(r.id),
                                    disabled: isUpdatingStatus === row.id,
                                    variant: 'success',
                                    hidden: row.estado === 'Pagado',
                                },
                                {
                                    label: 'Reabrir deuda',
                                    icon: <RotateCcw className="w-4 h-4" />,
                                    onClick: (r) => reopenDebt(r.id),
                                    disabled: isUpdatingStatus === row.id,
                                    hidden: row.estado !== 'Pagado',
                                },
                                {
                                    label: 'Eliminar',
                                    icon: <Trash2 className="w-4 h-4" />,
                                    onClick: (r) => handleDeleteClick(r.id),
                                    variant: 'danger',
                                    separator: true,
                                },
                            ]}
                            selectable={true}
                            selectedKeys={selectedIds}
                            onSelectionChange={(keys) => setSelectedIds(keys)}
                        />
                    </>
                );
            })()}

            {/* Delete Confirmation Modal */}
            <DeleteConfirmationModal
                isOpen={showDeleteModal}
                onClose={() => {
                    setShowDeleteModal(false);
                    setDeleteId(null);
                }}
                onConfirm={handleConfirmDelete}
                itemType="registro de deuda"
                isDeleting={isDeleting}
            />

            {/* Detail Modal - Rediseño Administrativo */}
            {portalReady && showDetailModal && selectedDetailMorosidad && createPortal(
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex justify-center items-end sm:items-center sm:p-6"
                >
                    <div
                        className="bg-white w-full max-w-4xl rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[92dvh] sm:max-h-[90dvh] animate-in fade-in slide-in-from-bottom sm:zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-white shrink-0">
                            <div>
                                <h2 className="text-xl font-black text-neutral-900 tracking-tight">
                                    {selectedDetailMorosidad.nombre_deudor} {selectedDetailMorosidad.apellidos || ''}
                                </h2>
                                <p className="text-xs text-neutral-500 mt-0.5">
                                    Deuda #{selectedDetailMorosidad.id} · Registrado el {new Date(selectedDetailMorosidad.created_at).toLocaleDateString('es-ES')}
                                    {selectedDetailMorosidad.estado === 'Pagado' && selectedDetailMorosidad.fecha_resuelto && (
                                        <> · Pagado el {new Date(selectedDetailMorosidad.fecha_resuelto).toLocaleDateString('es-ES')}</>
                                    )}
                                </p>
                            </div>
                            <button
                                onClick={() => setShowDetailModal(false)}
                                className="p-2 rounded-xl hover:bg-neutral-100 text-neutral-400 hover:text-neutral-900 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Hidden file input */}
                        <input
                            type="file"
                            className="hidden"
                            ref={detailFileInputRef}
                            onChange={(e) => { if (e.target.files && e.target.files.length > 0) handleDetailFileUpload(e.target.files[0]); }}
                        />

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar">

                            {/* Deudor */}
                            <FormSection title="Información del Deudor">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Nombre</label>
                                        <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">{selectedDetailMorosidad.nombre_deudor}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Apellidos</label>
                                        <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">{selectedDetailMorosidad.apellidos || '—'}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Teléfono</label>
                                        <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">{selectedDetailMorosidad.telefono_deudor || '—'}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Email</label>
                                        <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">{selectedDetailMorosidad.email_deudor || '—'}</div>
                                    </div>
                                    <div className="lg:col-span-2">
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Comunidad</label>
                                        <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">{selectedDetailMorosidad.comunidades?.nombre_cdad || '—'}</div>
                                    </div>
                                </div>
                            </FormSection>

                            {/* Deuda */}
                            <FormSection title="Datos de la Deuda">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <div className="lg:col-span-2">
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Concepto</label>
                                        <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">{selectedDetailMorosidad.titulo_documento}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Importe</label>
                                        <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm font-semibold text-neutral-900">{selectedDetailMorosidad.importe}€</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Estado</label>
                                        <div className={`w-full rounded-lg border px-3 py-2.5 text-sm font-semibold ${selectedDetailMorosidad.estado === 'Pagado' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-yellow-200 bg-yellow-50 text-yellow-700'}`}>
                                            {selectedDetailMorosidad.estado}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Referencia</label>
                                        <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm font-semibold text-indigo-700">{selectedDetailMorosidad.ref || '—'}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Gestor</label>
                                        <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">
                                            {(() => {
                                                if (!selectedDetailMorosidad.gestor) return '—';
                                                const p = profiles.find(p => p.user_id === selectedDetailMorosidad.gestor);
                                                return p ? p.nombre : (selectedDetailMorosidad.gestor.length > 20 ? 'Usuario desconocido' : selectedDetailMorosidad.gestor);
                                            })()}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">F. Notificación</label>
                                        <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">{selectedDetailMorosidad.fecha_notificacion ? new Date(selectedDetailMorosidad.fecha_notificacion).toLocaleDateString('es-ES') : '—'}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">F. Pago</label>
                                        <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">{selectedDetailMorosidad.fecha_pago ? new Date(selectedDetailMorosidad.fecha_pago).toLocaleDateString('es-ES') : '—'}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Aviso</label>
                                        <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">{selectedDetailMorosidad.aviso || '—'}</div>
                                    </div>
                                    {selectedDetailMorosidad.observaciones && (
                                        <div className="sm:col-span-2 lg:col-span-3">
                                            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Observaciones</label>
                                            <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 whitespace-pre-wrap">{selectedDetailMorosidad.observaciones}</div>
                                        </div>
                                    )}
                                </div>
                            </FormSection>

                            {/* Documentación */}
                            {selectedDetailMorosidad.documento && (
                                <FormSection title="Documentación">
                                    <a
                                        href={getSecureUrl(selectedDetailMorosidad.documento)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition"
                                    >
                                        <Paperclip className="w-3.5 h-3.5" />
                                        Ver documento adjunto
                                    </a>
                                </FormSection>
                            )}

                            {/* Chat de Gestores */}
                            <FormSection title="Chat de Gestores">
                                <TimelineChat entityType="morosidad" entityId={selectedDetailMorosidad.id} />
                            </FormSection>

                        </div>

                        {/* Footer */}
                        <div className="px-4 py-3 bg-white border-t border-neutral-100 flex items-center justify-between shrink-0 gap-2">
                            <ModalActionsMenu actions={[
                                { label: 'Eliminar', icon: <Trash2 className="w-4 h-4" />, onClick: () => { handleDeleteClick(selectedDetailMorosidad.id); setShowDetailModal(false); }, variant: 'danger' },
                                { label: isUpdatingRecord ? 'Subiendo…' : 'Adjuntar', icon: isUpdatingRecord ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />, onClick: () => detailFileInputRef.current?.click(), disabled: isUpdatingRecord },
                                { label: exporting ? 'Generando…' : 'PDF', icon: exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />, onClick: () => handleExport('pdf', [selectedDetailMorosidad.id]), disabled: exporting },
                            ]} />
                            {selectedDetailMorosidad.estado !== 'Pagado' ? (
                                <button
                                    onClick={() => { markAsPaid(selectedDetailMorosidad.id); setShowDetailModal(false); }}
                                    className="px-5 py-2.5 text-sm font-black text-neutral-900 bg-yellow-400 hover:bg-yellow-500 rounded-xl transition-all shadow-sm flex items-center gap-2 whitespace-nowrap"
                                >
                                    <Check className="w-4 h-4" />
                                    <span className="hidden sm:inline">Marcar como </span>Pagado
                                </button>
                            ) : (
                                <button
                                    onClick={() => { reopenDebt(selectedDetailMorosidad.id); setShowDetailModal(false); }}
                                    className="px-5 py-2.5 text-sm font-black text-neutral-600 border border-neutral-200 hover:bg-neutral-50 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap"
                                >
                                    <RotateCcw className="w-4 h-4" />
                                    <span className="hidden sm:inline">Reabrir </span>Deuda
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            , document.body)}
        </div>
    );
}
