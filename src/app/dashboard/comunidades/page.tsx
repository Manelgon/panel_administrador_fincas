
'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'react-hot-toast';
import { Plus, Trash2, X, Edit2, Eye, MapPin, Hash, Building2, Clock, Loader2, Upload, Check, AlertCircle } from 'lucide-react';
import DeleteConfirmationModal from '@/components/DeleteConfirmationModal';
import DataTable, { Column } from '@/components/DataTable';
import { logActivity } from '@/lib/logActivity';
import { Comunidad, comunidadFormSchema, validateForm, DeleteCredentials } from '@/lib/schemas';
import { useGlobalLoading } from '@/lib/globalLoading';
import ImportComunidadesModal from '@/components/ImportComunidadesModal';
import SearchableSelect from '@/components/SearchableSelect';

export default function ComunidadesPage() {
    const { withLoading } = useGlobalLoading();
    const [comunidades, setComunidades] = useState<Comunidad[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteEmail, setDeleteEmail] = useState('');
    const [deletePassword, setDeletePassword] = useState('');
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);

    // Detail Modal
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedDetailComunidad, setSelectedDetailComunidad] = useState<Comunidad | null>(null);

    const [formData, setFormData] = useState({
        codigo: '',
        nombre_cdad: '',
        direccion: '',
        cp: '',
        ciudad: '',
        provincia: '',
        cif: '',
        tipo: 'comunidad de propietarios' as 'comunidad de propietarios' | 'trasteros y aparcamientos'
    });

    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    const [filterEstado, setFilterEstado] = useState<'all' | 'activo' | 'inactivo'>('activo');
    const [searchTerm, setSearchTerm] = useState('');

    const filteredComunidades = comunidades.filter(c => {
        if (filterEstado === 'all') return true;
        if (filterEstado === 'activo') return c.activo;
        if (filterEstado === 'inactivo') return !c.activo;
        return true;
    });

    useEffect(() => {
        fetchComunidades();
    }, []);

    // Portal ready (client-only)
    const [portalReady, setPortalReady] = useState(false);
    useEffect(() => setPortalReady(true), []);

    // Prevent body scroll when any modal is open
    useEffect(() => {
        if (showForm || showDetailModal || showDeleteModal) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [showForm, showDetailModal, showDeleteModal]);

    const fetchComunidades = async () => {
        try {
            const { data, error } = await supabase
                .from('comunidades')
                .select('*')
                .order('id', { ascending: true });

            if (error) throw error;
            setComunidades(data || []);
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Error cargando comunidades';
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        let finalCodigo = formData.codigo.trim();

        if (!editingId) {
            // Generación automática del código para NUEVAS comunidades
            const numericCodes = comunidades
                .map(c => parseInt(c.codigo, 10))
                .filter(n => !isNaN(n));
            
            finalCodigo = numericCodes.length > 0
                ? (Math.max(...numericCodes) + 1).toString()
                : '1';
        } else {
            // Normalizar código si se editase (aunque ahora está oculto)
            if (/^\d+$/.test(finalCodigo)) {
                finalCodigo = parseInt(finalCodigo, 10).toString();
            }
        }

        const dataToSubmit = { ...formData, codigo: finalCodigo };

        const errors: Record<string, string> = {};
        if (!dataToSubmit.codigo?.trim()) errors.codigo = 'El código de la comunidad es obligatorio';
        if (!dataToSubmit.nombre_cdad?.trim()) errors.nombre_cdad = 'El nombre de la comunidad es obligatorio';
        if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
        setFormErrors({});

        const label = editingId ? 'Actualizando comunidad...' : 'Creando comunidad...';
        await withLoading(async () => {
            if (editingId) {
                // Update existing
                try {
                    const { data: updatedData, error } = await supabase
                        .from('comunidades')
                        .update(dataToSubmit)
                        .eq('id', editingId)
                        .select();

                    if (error) throw error;
                    if (!updatedData || updatedData.length === 0) {
                        toast.error('No se pudo actualizar. Verifica permisos o que el registro exista.');
                        return;
                    }

                    toast.success('Comunidad actualizada correctamente');

                    await logActivity({
                        action: 'update',
                        entityType: 'comunidad',
                        entityId: editingId,
                        entityName: dataToSubmit.nombre_cdad,
                        details: { codigo: dataToSubmit.codigo }
                    });

                    setShowForm(false);
                    setFormErrors({});
                    setEditingId(null);
                    setFormData({ codigo: '', nombre_cdad: '', direccion: '', cp: '', ciudad: '', provincia: '', cif: '', tipo: 'comunidad de propietarios' });
                    window.dispatchEvent(new Event('communitiesChanged'));
                    fetchComunidades();
                } catch (error: unknown) {
                    console.error('Error al actualizar comunidad:', error);
                    const msg = error instanceof Error ? error.message : (error as { message?: string })?.message || 'Error al actualizar';
                    toast.error('Error al actualizar: ' + msg);
                }
            } else {
                // Create new
                try {
                    const { data, error } = await supabase
                        .from('comunidades')
                        .insert([{ ...dataToSubmit, activo: true }])
                        .select();

                    if (error) {
                        console.error('Supabase error:', error);
                        if (error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('unique')) {
                            toast.error('El código de comunidad ya existe. Por favor, usa un código diferente.');
                            return;
                        }
                        throw error;
                    }

                    toast.success('Comunidad creada correctamente');

                    await logActivity({
                        action: 'create',
                        entityType: 'comunidad',
                        entityName: dataToSubmit.nombre_cdad,
                        details: { codigo: dataToSubmit.codigo }
                    });

                    setShowForm(false);
                    setFormErrors({});
                    setFormData({ codigo: '', nombre_cdad: '', direccion: '', cp: '', ciudad: '', provincia: '', cif: '', tipo: 'comunidad de propietarios' });
                    window.dispatchEvent(new Event('communitiesChanged'));
                    fetchComunidades();
                } catch (error: unknown) {
                    const errObj = error as { code?: string; message?: string };
                    console.error('Error completo:', error);
                    if (errObj.code === '23505' || errObj.message?.includes('duplicate') || errObj.message?.includes('unique')) {
                        toast.error('El código de comunidad ya existe. Por favor, usa un código diferente.');
                    } else {
                        toast.error('Error al crear: ' + (errObj.message || 'Error desconocido'));
                    }
                }
            }
        }, label);
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
                    body: JSON.stringify({ id: deleteId, email, password, type: 'comunidad' })
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Error al eliminar');

                toast.success('Comunidad eliminada correctamente');
                setComunidades(comunidades.filter(c => c.id !== deleteId));
                setShowDeleteModal(false);
                setDeleteId(null);
                window.dispatchEvent(new Event('communitiesChanged'));

                const deleted = comunidades.find(c => c.id === deleteId);
                await logActivity({
                    action: 'delete',
                    entityType: 'comunidad',
                    entityId: deleteId,
                    entityName: deleted?.nombre_cdad,
                    details: { codigo: deleted?.codigo, deleted_by_admin: email }
                });
            } catch (error: unknown) {
                const msg = error instanceof Error ? error.message : 'Error al eliminar';
                toast.error(msg);
            } finally {
                setIsDeleting(false);
            }
        }, 'Eliminando comunidad...');
    };

    const toggleActive = async (id: number, currentStatus: boolean) => {
        await withLoading(async () => {
            try {
                const { error } = await supabase
                    .from('comunidades')
                    .update({ activo: !currentStatus })
                    .eq('id', id);

                if (error) throw error;

                toast.success(currentStatus ? 'Comunidad desactivada' : 'Comunidad activada');
                setComunidades(prev => prev.map(c => c.id === id ? { ...c, activo: !currentStatus } : c));
                window.dispatchEvent(new Event('communitiesChanged'));

                const comunidad = comunidades.find(c => c.id === id);
                await logActivity({
                    action: 'toggle_active',
                    entityType: 'comunidad',
                    entityId: id,
                    entityName: comunidad?.nombre_cdad,
                    details: { activo: !currentStatus }
                });
            } catch (error: unknown) {
                const msg = error instanceof Error ? error.message : 'Error al actualizar estado';
                toast.error(msg);
            }
        }, currentStatus ? 'Desactivando comunidad...' : 'Activando comunidad...');
    };

    const handleEdit = (comunidad: Comunidad) => {
        setEditingId(comunidad.id);
        setFormData({
            codigo: comunidad.codigo,
            nombre_cdad: comunidad.nombre_cdad,
            direccion: comunidad.direccion || '',
            cp: comunidad.cp || '',
            ciudad: comunidad.ciudad || '',
            provincia: comunidad.provincia || '',
            cif: comunidad.cif || '',
            tipo: comunidad.tipo || 'comunidad de propietarios',
        });
        setShowForm(true);
    };

    const columns: Column<Comunidad>[] = [
        {
            key: 'codigo',
            label: 'Código',
            render: (row) => (
                <div className="flex items-start gap-3">
                    <span className="mt-1 h-3.5 w-1.5 rounded-full bg-yellow-400" />
                    <span className="font-semibold">{row.codigo}</span>
                </div>
            ),
        },
        {
            key: 'tipo',
            label: 'Tipo',
            render: (row) => <span className="capitalize">{row.tipo}</span>,
        },
        {
            key: 'nombre_cdad',
            label: 'Nombre',
        },
        {
            key: 'direccion',
            label: 'Dirección',
            defaultVisible: false,
        },
        {
            key: 'cp',
            label: 'CP',
            defaultVisible: false,
        },
        {
            key: 'ciudad',
            label: 'Ciudad',
        },
        {
            key: 'provincia',
            label: 'Provincia',
            defaultVisible: false,
        },
        {
            key: 'cif',
            label: 'CIF',
        },
        {
            key: 'activo',
            label: 'Estado',
            render: (row) => (
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${row.activo
                    ? 'bg-yellow-400 text-neutral-950'
                    : 'bg-neutral-900 text-white'
                    }`}>
                    {row.activo ? 'Activo' : 'Inactivo'}
                </span>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center gap-3">
                <h1 className="text-xl font-bold text-neutral-900 min-w-0 truncate">Gestión de Comunidades</h1>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                        onClick={() => setShowImportModal(true)}
                        className="border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 px-3 py-2 rounded-xl flex items-center gap-1.5 transition font-semibold text-sm shadow-sm"
                    >
                        <Upload className="w-4 h-4 flex-shrink-0" />
                        <span className="hidden sm:inline">Importar CSV/Excel</span>
                        <span className="sm:hidden">Importar</span>
                    </button>
                    <button
                        onClick={() => {
                            setShowForm(!showForm);
                            if (showForm) {
                                setEditingId(null);
                                setFormErrors({});
                                setFormData({ codigo: '', nombre_cdad: '', direccion: '', cp: '', ciudad: '', provincia: '', cif: '', tipo: 'comunidad de propietarios' });
                            }
                        }}
                        className="bg-yellow-400 hover:bg-yellow-500 text-neutral-950 px-3 py-2 rounded-xl flex items-center gap-1.5 transition font-semibold text-sm shadow-sm"
                    >
                        <Plus className="w-4 h-4 flex-shrink-0" />
                        <span className="hidden sm:inline">{showForm ? 'Cancelar' : 'Nueva Comunidad'}</span>
                        <span className="sm:hidden">{showForm ? 'Cancelar' : 'Nueva'}</span>
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={() => setFilterEstado('activo')}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition ${filterEstado === 'activo' ? 'bg-yellow-400 text-neutral-950' : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'}`}
                >
                    Activas
                </button>
                <button
                    onClick={() => setFilterEstado('inactivo')}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition ${filterEstado === 'inactivo' ? 'bg-neutral-900 text-white' : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'}`}
                >
                    Inactivas
                </button>
                <button
                    onClick={() => setFilterEstado('all')}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition ${filterEstado === 'all' ? 'bg-neutral-900 text-white' : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'}`}
                >
                    Todas
                </button>
            </div>

            {/* Import Modal */}
            {portalReady && showImportModal && createPortal(
                <ImportComunidadesModal
                    onClose={() => setShowImportModal(false)}
                    onImported={() => { fetchComunidades(); }}
                />,
                document.body
            )}

            {/* Form Modal */}
            {portalReady && showForm && createPortal(
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex justify-center items-end sm:items-center sm:p-6"
                >
                    <div
                        className="bg-white w-full max-w-2xl rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[92vh] sm:max-h-[90vh] animate-in fade-in slide-in-from-bottom sm:zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex justify-between items-center px-5 py-4 border-b border-neutral-100 bg-neutral-50">
                            <div>
                                <h2 className="text-lg font-bold text-neutral-900 tracking-tight">
                                    {editingId ? 'Editar Comunidad' : 'Nueva Comunidad'}
                                </h2>
                                <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-0.5">
                                    Complete los datos de la comunidad
                                </p>
                            </div>
                            <button
                                onClick={() => { setShowForm(false); setFormErrors({}); }}
                                className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-4 sm:px-5 sm:py-4 overflow-y-auto custom-scrollbar flex-1">
                            <form id="comunidad-form" onSubmit={handleSubmit} className="space-y-4">

                                {/* Section 1: Identificación */}
                                <div>
                                    <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-3 border-b border-yellow-400">Identificación</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-x-4 gap-y-3">
                                        <div className="sm:col-span-7 md:col-span-8">
                                            <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Tipo <span className="text-red-600">*</span></label>
                                            <SearchableSelect
                                                value={formData.tipo}
                                                onChange={(val) => setFormData({ ...formData, tipo: String(val) as 'comunidad de propietarios' | 'trasteros y aparcamientos' })}
                                                options={[
                                                    { value: "comunidad de propietarios", label: "Comunidad de Propietarios" },
                                                    { value: "trasteros y aparcamientos", label: "Trasteros y Aparcamientos" }
                                                ]}
                                                placeholder="Seleccionar tipo..."
                                            />
                                        </div>
                                        <div className="sm:col-span-5 md:col-span-4">
                                            <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">CIF</label>
                                            <input type="text" placeholder="H12345678" className="w-full rounded-lg border border-neutral-200 bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400 focus:bg-white transition" value={formData.cif} onChange={e => setFormData({ ...formData, cif: e.target.value })} />
                                        </div>
                                        <div className="sm:col-span-12">
                                            <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Nombre Comunidad <span className="text-red-600">*</span></label>
                                            <input required type="text" placeholder="Edificio Central" className={`w-full rounded-lg border bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400 focus:bg-white transition ${formErrors.nombre_cdad ? 'border-red-400' : 'border-neutral-200'}`} value={formData.nombre_cdad} onChange={e => { setFormData({ ...formData, nombre_cdad: e.target.value }); setFormErrors(prev => ({ ...prev, nombre_cdad: '' })); }} />
                                            {formErrors.nombre_cdad && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.nombre_cdad}</p>}
                                        </div>
                                    </div>
                                </div>

                                {/* Section 2: Ubicación */}
                                <div>
                                    <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-3 border-b border-yellow-400">Ubicación</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-x-4 gap-y-3">
                                        <div className="sm:col-span-6">
                                            <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Dirección</label>
                                            <input type="text" placeholder="C/ Mayor 123" className="w-full rounded-lg border border-neutral-200 bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400 focus:bg-white transition" value={formData.direccion} onChange={e => setFormData({ ...formData, direccion: e.target.value })} />
                                        </div>
                                        <div className="sm:col-span-6">
                                            <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">CP</label>
                                            <input type="text" placeholder="29001" className="w-full rounded-lg border border-neutral-200 bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400 focus:bg-white transition" value={formData.cp} onChange={e => setFormData({ ...formData, cp: e.target.value })} />
                                        </div>
                                        <div className="sm:col-span-6">
                                            <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Ciudad</label>
                                            <input type="text" placeholder="Málaga" className="w-full rounded-lg border border-neutral-200 bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400 focus:bg-white transition" value={formData.ciudad} onChange={e => setFormData({ ...formData, ciudad: e.target.value })} />
                                        </div>
                                        <div className="sm:col-span-6">
                                            <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Provincia</label>
                                            <input type="text" placeholder="Málaga" className="w-full rounded-lg border border-neutral-200 bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400 focus:bg-white transition" value={formData.provincia} onChange={e => setFormData({ ...formData, provincia: e.target.value })} />
                                        </div>
                                    </div>
                                </div>

                            </form>
                        </div>

                        {/* Footer */}
                        <div className="px-5 py-3 border-t border-neutral-100 bg-neutral-50/40 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => { setShowForm(false); setFormErrors({}); }}
                                className="px-4 py-2 text-xs font-bold text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                form="comunidad-form"
                                type="submit"
                                className="px-6 py-2 bg-yellow-400 hover:bg-yellow-500 text-neutral-950 rounded-lg text-xs font-bold transition flex items-center gap-2 shadow-sm"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                {editingId ? 'Guardar Cambios' : 'Guardar Comunidad'}
                            </button>
                        </div>
                    </div>
                </div>
            , document.body)}

            <DataTable
                data={filteredComunidades}
                columns={columns}
                keyExtractor={(row) => row.id}
                storageKey="comunidades"
                loading={loading}
                emptyMessage="No hay comunidades registradas"
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                onRowClick={(row) => {
                    setSelectedDetailComunidad(row);
                    setShowDetailModal(true);
                }}
                rowActions={(row) => [
                    { label: 'Editar', icon: <Edit2 className="w-4 h-4" />, onClick: (r) => handleEdit(r) },
                    {
                        label: row.activo ? 'Desactivar' : 'Activar',
                        icon: row.activo ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />,
                        onClick: (r) => toggleActive(r.id, r.activo),
                        variant: row.activo ? 'warning' : 'success',
                    },
                    {
                        label: 'Eliminar',
                        icon: <Trash2 className="w-4 h-4" />,
                        onClick: (r) => handleDeleteClick(r.id),
                        variant: 'danger',
                        separator: true,
                    },
                ]}
            />

            {/* Detail Modal */}
            {portalReady && showDetailModal && selectedDetailComunidad && createPortal(
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex justify-center items-end sm:items-center sm:p-6"
                >
                    <div
                        className="bg-white w-full max-w-3xl rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[92vh] sm:max-h-[90vh] animate-in fade-in slide-in-from-bottom sm:zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-white shrink-0">
                            <div>
                                <h2 className="text-xl font-black text-neutral-900 tracking-tight">
                                    {selectedDetailComunidad.nombre_cdad}
                                </h2>
                                <p className="text-xs text-neutral-500 mt-0.5">
                                    {selectedDetailComunidad.activo ? 'Comunidad activa' : 'Comunidad inactiva'} · Código {selectedDetailComunidad.codigo}
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
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">

                            {/* Datos Generales */}
                            <div>
                                <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-4 border-b border-yellow-400">Datos Generales</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <div className="lg:col-span-2">
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Nombre de la Comunidad</label>
                                        <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">{selectedDetailComunidad.nombre_cdad}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Código Interno</label>
                                        <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 font-semibold">{selectedDetailComunidad.codigo}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Tipo</label>
                                        <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 capitalize">{selectedDetailComunidad.tipo}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">CIF</label>
                                        <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">{selectedDetailComunidad.cif || '—'}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Ubicación */}
                            <div>
                                <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-4 border-b border-yellow-400">Ubicación</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <div className="lg:col-span-3">
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Dirección</label>
                                        <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">{selectedDetailComunidad.direccion || '—'}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">CP</label>
                                        <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">{selectedDetailComunidad.cp || '—'}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Ciudad</label>
                                        <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">{selectedDetailComunidad.ciudad || '—'}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Provincia</label>
                                        <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">{selectedDetailComunidad.provincia || '—'}</div>
                                    </div>
                                </div>
                            </div>

                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 bg-white border-t border-neutral-100 flex items-center justify-between shrink-0">
                            <button
                                onClick={() => { handleDeleteClick(selectedDetailComunidad.id); setShowDetailModal(false); }}
                                className="px-4 py-2 text-sm font-bold text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all flex items-center gap-2"
                            >
                                <Trash2 className="w-4 h-4" />
                                Eliminar
                            </button>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => { handleEdit(selectedDetailComunidad); setShowDetailModal(false); }}
                                    className="px-6 py-3 text-sm font-bold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl transition-all"
                                >
                                    Editar
                                </button>
                                <button
                                    onClick={() => { toggleActive(selectedDetailComunidad.id, selectedDetailComunidad.activo); setSelectedDetailComunidad({ ...selectedDetailComunidad, activo: !selectedDetailComunidad.activo }); }}
                                    className="px-8 py-3 text-sm font-black text-neutral-900 bg-yellow-400 hover:bg-yellow-500 rounded-xl transition-all shadow-sm flex items-center gap-2 hover:shadow-md hover:-translate-y-0.5"
                                >
                                    {selectedDetailComunidad.activo ? <><X className="w-4 h-4" /> Desactivar</> : <><Plus className="w-4 h-4" /> Activar</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            , document.body)}

            {/* Delete Confirmation Modal */}
            <DeleteConfirmationModal
                isOpen={showDeleteModal}
                onClose={() => {
                    setShowDeleteModal(false);
                    setDeleteId(null);
                }}
                onConfirm={handleConfirmDelete}
                itemType="comunidad"
                isDeleting={isDeleting}
            />
        </div>
    );
}
