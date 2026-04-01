'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'react-hot-toast';
import { Plus, Trash2, X, Edit2, Phone, Mail, MapPin, Building2, CreditCard, Clock, Loader2, Check, AlertCircle } from 'lucide-react';
import DeleteConfirmationModal from '@/components/DeleteConfirmationModal';
import DataTable, { Column } from '@/components/DataTable';
import { logActivity } from '@/lib/logActivity';
import { useGlobalLoading } from '@/lib/globalLoading';

interface Proveedor {
    id: number;
    nombre: string;
    telefono: string;
    email: string;
    cif: string;
    direccion: string;
    cp: string;
    ciudad: string;
    provincia: string;
    activo: boolean;
}

export default function ProveedoresPage() {
    const { withLoading } = useGlobalLoading();
    const [proveedores, setProveedores] = useState<Proveedor[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteEmail, setDeleteEmail] = useState('');
    const [deletePassword, setDeletePassword] = useState('');
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Detail Modal
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedDetailProveedor, setSelectedDetailProveedor] = useState<Proveedor | null>(null);

    const [formData, setFormData] = useState({
        nombre: '',
        telefono: '',
        email: '',
        cif: '',
        direccion: '',
        cp: '',
        ciudad: '',
        provincia: ''
    });

    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    const [filterEstado, setFilterEstado] = useState<'all' | 'activo' | 'inactivo'>('activo');

    const filteredProveedores = proveedores.filter(p => {
        if (filterEstado === 'all') return true;
        if (filterEstado === 'activo') return p.activo;
        if (filterEstado === 'inactivo') return !p.activo;
        return true;
    });

    useEffect(() => {
        fetchProveedores();
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

    const fetchProveedores = async () => {
        try {
            const { data, error } = await supabase
                .from('proveedores')
                .select('*')
                .order('nombre', { ascending: true });

            if (error) throw error;
            setProveedores(data || []);
        } catch (error: any) {
            toast.error('Error cargando proveedores');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const errors: Record<string, string> = {};
        if (!formData.nombre?.trim()) errors.nombre = 'El nombre del proveedor es obligatorio';
        const phoneRegex = /^\d{9}$/;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (formData.telefono && !phoneRegex.test(formData.telefono)) errors.telefono = 'El teléfono debe tener exactamente 9 dígitos';
        if (formData.email && !emailRegex.test(formData.email)) errors.email = 'El formato del email no es válido';
        if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
        setFormErrors({});

        const label = editingId ? 'Actualizando proveedor...' : 'Creando proveedor...';
        await withLoading(async () => {
            if (editingId) {
                try {
                    const { error } = await supabase.from('proveedores').update(formData).eq('id', editingId);
                    if (error) throw error;
                    toast.success('Proveedor actualizado correctamente');
                    await logActivity({ action: 'update', entityType: 'proveedor', entityId: editingId, entityName: formData.nombre, details: { email: formData.email } });
                    setShowForm(false); setFormErrors({}); setEditingId(null);
                    setFormData({ nombre: '', telefono: '', email: '', cif: '', direccion: '', cp: '', ciudad: '', provincia: '' });
                    fetchProveedores();
                } catch (error: any) {
                    toast.error('Error al actualizar: ' + error.message);
                }
            } else {
                try {
                    const { error } = await supabase.from('proveedores').insert([{ ...formData, activo: true }]).select();
                    if (error) throw error;
                    toast.success('Proveedor creado correctamente');
                    await logActivity({ action: 'create', entityType: 'proveedor', entityName: formData.nombre, details: { email: formData.email } });
                    setShowForm(false); setFormErrors({});
                    setFormData({ nombre: '', telefono: '', email: '', cif: '', direccion: '', cp: '', ciudad: '', provincia: '' });
                    fetchProveedores();
                } catch (error: any) {
                    toast.error('Error al crear: ' + (error.message || 'Error desconocido'));
                }
            }
        }, label);
    };

    const handleDeleteClick = (id: number) => {
        setDeleteId(id);
        setShowDeleteModal(true);
        setDeletePassword('');
    };

    const handleConfirmDelete = async ({ email, password }: any) => {
        if (deleteId === null || !email || !password) return;

        await withLoading(async () => {
            setIsDeleting(true);
            try {
                const res = await fetch('/api/admin/universal-delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: deleteId, email, password, type: 'proveedor' })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Error al eliminar');

                toast.success('Proveedor eliminado correctamente');
                const deleted = proveedores.find(p => p.id === deleteId);
                setProveedores(proveedores.filter(p => p.id !== deleteId));
                await logActivity({ action: 'delete', entityType: 'proveedor', entityId: deleteId, entityName: deleted?.nombre, details: { deleted_by_admin: email } });
                setShowDeleteModal(false);
                setDeleteId(null);
            } catch (error: any) {
                toast.error(error.message);
            } finally {
                setIsDeleting(false);
            }
        }, 'Eliminando proveedor...');
    };

    const toggleActive = async (id: number, currentStatus: boolean) => {
        await withLoading(async () => {
            try {
                const { error } = await supabase.from('proveedores').update({ activo: !currentStatus }).eq('id', id);
                if (error) throw error;
                toast.success(currentStatus ? 'Proveedor desactivado' : 'Proveedor activado');
                setProveedores(prev => prev.map(p => p.id === id ? { ...p, activo: !currentStatus } : p));
                const proveedor = proveedores.find(p => p.id === id);
                await logActivity({ action: 'toggle_active', entityType: 'proveedor', entityId: id, entityName: proveedor?.nombre, details: { activo: !currentStatus } });
            } catch (error: any) {
                toast.error('Error al actualizar estado');
            }
        }, currentStatus ? 'Desactivando proveedor...' : 'Activando proveedor...');
    };

    const handleEdit = (proveedor: Proveedor) => {
        setEditingId(proveedor.id);
        setFormData({
            nombre: proveedor.nombre,
            telefono: proveedor.telefono || '',
            email: proveedor.email || '',
            cif: proveedor.cif || '',
            direccion: proveedor.direccion || '',
            cp: proveedor.cp || '',
            ciudad: proveedor.ciudad || '',
            provincia: proveedor.provincia || ''
        });
        setShowForm(true);
    };

    const columns: Column<Proveedor>[] = [
        {
            key: 'id',
            label: 'ID',
            render: (row) => <span className="text-neutral-500 font-mono text-xs">#{row.id}</span>,
        },
        {
            key: 'nombre',
            label: 'Nombre',
            render: (row) => (
                <div className="flex items-start gap-3">
                    <span className="mt-1 h-3.5 w-1.5 rounded-full bg-yellow-400" />
                    <span className="font-semibold">{row.nombre}</span>
                </div>
            ),
        },
        {
            key: 'telefono',
            label: 'Teléfono',
            render: (row) => (
                <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-neutral-400" />
                    <span>{row.telefono || '-'}</span>
                </div>
            )
        },
        {
            key: 'email',
            label: 'Email',
            render: (row) => (
                <div className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-neutral-400" />
                    <span>{row.email || '-'}</span>
                </div>
            )
        },
        {
            key: 'cif',
            label: 'CIF',
        },
        {
            key: 'ciudad',
            label: 'Ciudad',
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
            <div className="flex justify-between items-center">
                <h1 className="text-xl font-bold text-neutral-900">Gestión de Proveedores</h1>
                <button
                    onClick={() => {
                        setShowForm(!showForm);
                        if (showForm) {
                            setEditingId(null);
                            setFormErrors({});
                            setFormData({ nombre: '', telefono: '', email: '', cif: '', direccion: '', cp: '', ciudad: '', provincia: '' });
                        }
                    }}
                    className="bg-yellow-400 hover:bg-yellow-500 text-neutral-950 px-4 py-2 rounded-xl flex items-center gap-2 transition font-semibold text-sm shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    {showForm ? 'Cancelar' : 'Nuevo Proveedor'}
                </button>
            </div>

            <div className="flex gap-2">
                <button
                    onClick={() => setFilterEstado('activo')}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition ${filterEstado === 'activo' ? 'bg-yellow-400 text-neutral-950' : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'}`}
                >
                    Activos
                </button>
                <button
                    onClick={() => setFilterEstado('inactivo')}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition ${filterEstado === 'inactivo' ? 'bg-neutral-900 text-white' : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'}`}
                >
                    Inactivos
                </button>
                <button
                    onClick={() => setFilterEstado('all')}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition ${filterEstado === 'all' ? 'bg-neutral-900 text-white' : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'}`}
                >
                    Todos
                </button>
            </div>

            {portalReady && showForm && createPortal(
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex justify-center items-center p-4 sm:p-6">
                    <div
                        className="bg-white w-full max-w-4xl rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[95vh] animate-in fade-in zoom-in duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-white shrink-0">
                            <div>
                                <h2 className="text-xl font-black text-neutral-900 tracking-tight">
                                    {editingId ? 'Editar Proveedor' : 'Nuevo Proveedor'}
                                </h2>
                                <p className="text-xs text-neutral-500 mt-0.5">
                                    {editingId ? 'Modifique los datos del proveedor' : 'Complete los datos para registrar un nuevo proveedor'}
                                </p>
                            </div>
                            <button
                                onClick={() => { setShowForm(false); setFormErrors({}); }}
                                className="p-2 rounded-xl hover:bg-neutral-100 text-neutral-400 hover:text-neutral-900 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            <form id="proveedor-form" onSubmit={handleSubmit} className="space-y-6">

                                {/* Sección: Identificación */}
                                <div>
                                    <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-4 border-b border-yellow-400">Identificación</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        <div className="lg:col-span-2">
                                            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Nombre / Razón Social <span className="text-red-500">*</span></label>
                                            <input required type="text" placeholder="Servicios Integrales S.L." className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30 focus:border-yellow-400 transition-all ${formErrors.nombre ? 'border-red-400' : 'border-neutral-200'}`} value={formData.nombre} onChange={e => { setFormData({ ...formData, nombre: e.target.value }); setFormErrors(prev => ({ ...prev, nombre: '' })); }} />
                                            {formErrors.nombre && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.nombre}</p>}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">CIF</label>
                                            <input type="text" placeholder="B12345678" pattern="[A-Za-z0-9]{1,9}" maxLength={9} className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30 focus:border-yellow-400 transition-all uppercase" value={formData.cif} onChange={e => { const value = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase(); setFormData({ ...formData, cif: value }); }} />
                                        </div>
                                    </div>
                                </div>

                                {/* Sección: Contacto */}
                                <div>
                                    <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-4 border-b border-yellow-400">Contacto</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Teléfono</label>
                                            <input type="tel" placeholder="600 000 000" className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30 focus:border-yellow-400 transition-all ${formErrors.telefono ? 'border-red-400' : 'border-neutral-200'}`} value={formData.telefono} onChange={e => { setFormData({ ...formData, telefono: e.target.value }); setFormErrors(prev => ({ ...prev, telefono: '' })); }} />
                                            {formErrors.telefono && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.telefono}</p>}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Email</label>
                                            <input type="email" placeholder="admin@servicios.com" className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30 focus:border-yellow-400 transition-all ${formErrors.email ? 'border-red-400' : 'border-neutral-200'}`} value={formData.email} onChange={e => { setFormData({ ...formData, email: e.target.value }); setFormErrors(prev => ({ ...prev, email: '' })); }} />
                                            {formErrors.email && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.email}</p>}
                                        </div>
                                    </div>
                                </div>

                                {/* Sección: Ubicación */}
                                <div>
                                    <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-4 border-b border-yellow-400">Ubicación</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        <div className="lg:col-span-3">
                                            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Dirección</label>
                                            <input type="text" placeholder="Polígono Industrial Nave 4" className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30 focus:border-yellow-400 transition-all" value={formData.direccion} onChange={e => setFormData({ ...formData, direccion: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">CP</label>
                                            <input type="text" placeholder="29001" className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30 focus:border-yellow-400 transition-all" value={formData.cp} onChange={e => setFormData({ ...formData, cp: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Ciudad</label>
                                            <input type="text" placeholder="Málaga" className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30 focus:border-yellow-400 transition-all" value={formData.ciudad} onChange={e => setFormData({ ...formData, ciudad: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Provincia</label>
                                            <input type="text" placeholder="Málaga" className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30 focus:border-yellow-400 transition-all" value={formData.provincia} onChange={e => setFormData({ ...formData, provincia: e.target.value })} />
                                        </div>
                                    </div>
                                </div>

                            </form>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 bg-white border-t border-neutral-100 flex items-center justify-end gap-3 shrink-0">
                            <button
                                type="button"
                                onClick={() => { setShowForm(false); setFormErrors({}); }}
                                className="px-6 py-3 text-sm font-bold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                form="proveedor-form"
                                type="submit"
                                className="px-8 py-3 text-sm font-black text-neutral-900 bg-yellow-400 hover:bg-yellow-500 rounded-xl transition-all shadow-sm flex items-center gap-2 hover:shadow-md hover:-translate-y-0.5"
                            >
                                <Plus className="w-4 h-4" />
                                {editingId ? 'Guardar Cambios' : 'Crear Proveedor'}
                            </button>
                        </div>
                    </div>
                </div>
            , document.body)}

            <DataTable
                data={filteredProveedores}
                columns={columns}
                keyExtractor={(row) => row.id}
                storageKey="proveedores"
                loading={loading}
                emptyMessage="No hay proveedores registrados"
                onRowClick={(row) => {
                    setSelectedDetailProveedor(row);
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
            {portalReady && showDetailModal && selectedDetailProveedor && createPortal(
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex justify-center items-center p-4 sm:p-6"
                >
                    <div
                        className="bg-white w-full max-w-3xl rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[95vh] animate-in fade-in zoom-in duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-white shrink-0">
                            <div>
                                <h2 className="text-xl font-black text-neutral-900 tracking-tight">
                                    {selectedDetailProveedor.nombre}
                                </h2>
                                <p className="text-xs text-neutral-500 mt-0.5">
                                    {selectedDetailProveedor.activo ? 'Proveedor activo' : 'Proveedor inactivo'} · Ref #{selectedDetailProveedor.id}
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

                            {/* Identificación */}
                            <div>
                                <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-4 border-b border-yellow-400">Identificación</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <div className="lg:col-span-2">
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Nombre / Razón Social</label>
                                        <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">{selectedDetailProveedor.nombre}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">CIF</label>
                                        <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">{selectedDetailProveedor.cif || '—'}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Contacto */}
                            <div>
                                <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-4 border-b border-yellow-400">Contacto</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Teléfono</label>
                                        <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">{selectedDetailProveedor.telefono || '—'}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Email</label>
                                        <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">{selectedDetailProveedor.email || '—'}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Ubicación */}
                            <div>
                                <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-4 border-b border-yellow-400">Ubicación</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <div className="lg:col-span-3">
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Dirección</label>
                                        <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">{selectedDetailProveedor.direccion || '—'}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">CP</label>
                                        <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">{selectedDetailProveedor.cp || '—'}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Ciudad</label>
                                        <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">{selectedDetailProveedor.ciudad || '—'}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Provincia</label>
                                        <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">{selectedDetailProveedor.provincia || '—'}</div>
                                    </div>
                                </div>
                            </div>

                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 bg-white border-t border-neutral-100 flex items-center justify-between shrink-0">
                            <button
                                onClick={() => { handleDeleteClick(selectedDetailProveedor.id); setShowDetailModal(false); }}
                                className="px-4 py-2 text-sm font-bold text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all flex items-center gap-2"
                            >
                                <Trash2 className="w-4 h-4" />
                                Eliminar
                            </button>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => { handleEdit(selectedDetailProveedor); setShowDetailModal(false); }}
                                    className="px-6 py-3 text-sm font-bold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl transition-all"
                                >
                                    Editar
                                </button>
                                <button
                                    onClick={() => { toggleActive(selectedDetailProveedor.id, selectedDetailProveedor.activo); setSelectedDetailProveedor({ ...selectedDetailProveedor, activo: !selectedDetailProveedor.activo }); }}
                                    className="px-8 py-3 text-sm font-black text-neutral-900 bg-yellow-400 hover:bg-yellow-500 rounded-xl transition-all shadow-sm flex items-center gap-2 hover:shadow-md hover:-translate-y-0.5"
                                >
                                    {selectedDetailProveedor.activo ? <><X className="w-4 h-4" /> Desactivar</> : <><Plus className="w-4 h-4" /> Activar</>}
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
                itemType="proveedor"
                isDeleting={isDeleting}
            />
        </div>
    );
}
