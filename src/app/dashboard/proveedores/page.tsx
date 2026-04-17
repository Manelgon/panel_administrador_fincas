'use client';

import { Phone, Mail, Trash2, X, Edit2, Plus, Check } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useCRUDPage } from '@/hooks/useCRUDPage';
import DataTable, { Column } from '@/components/DataTable';
import DeleteConfirmationModal from '@/components/DeleteConfirmationModal';
import ModalActionsMenu from '@/components/ModalActionsMenu';
import PageHeader from '@/components/PageHeader';
import FilterBar from '@/components/FilterBar';
import FormModal from '@/components/FormModal';
import FormSection from '@/components/FormSection';
import FormField from '@/components/FormField';

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

const defaultFormData = {
    nombre: '',
    telefono: '',
    email: '',
    cif: '',
    direccion: '',
    cp: '',
    ciudad: '',
    provincia: '',
};

type FormData = typeof defaultFormData;

export default function ProveedoresPage() {
    const crud = useCRUDPage<Proveedor, FormData>({
        entityType: 'proveedor',
        entityLabel: 'proveedor',
        tableName: 'proveedores',
        defaultFormData,
        orderBy: { column: 'nombre', ascending: true },
        nameField: 'nombre',
    });

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await crud.handleSubmit(crud.formData, () => {
            const errors: Record<string, string> = {};
            if (!crud.formData.nombre?.trim()) errors.nombre = 'El nombre del proveedor es obligatorio';
            const phoneRegex = /^\d{9}$/;
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (crud.formData.telefono && !phoneRegex.test(crud.formData.telefono)) errors.telefono = 'El teléfono debe tener exactamente 9 dígitos';
            if (crud.formData.email && !emailRegex.test(crud.formData.email)) errors.email = 'El formato del email no es válido';
            return errors;
        });
    };

    const updateField = (field: keyof FormData, value: string) => {
        crud.setFormData({ ...crud.formData, [field]: value });
        crud.setFormErrors(prev => ({ ...prev, [field]: '' }));
    };

    const inputClass = (field?: string) =>
        `w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30 focus:border-yellow-400 transition-all ${field && crud.formErrors[field] ? 'border-red-400' : 'border-neutral-200'}`;

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
            ),
        },
        {
            key: 'email',
            label: 'Email',
            render: (row) => (
                <div className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-neutral-400" />
                    <span>{row.email || '-'}</span>
                </div>
            ),
        },
        { key: 'cif', label: 'CIF' },
        { key: 'ciudad', label: 'Ciudad' },
        {
            key: 'activo',
            label: 'Estado',
            render: (row) => (
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${row.activo ? 'bg-yellow-400 text-neutral-950' : 'bg-neutral-900 text-white'}`}>
                    {row.activo ? 'Activo' : 'Inactivo'}
                </span>
            ),
        },
    ];

    const readonlyClass = "w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900";

    return (
        <div className="space-y-6">
            <PageHeader
                title="Gestión de Proveedores"
                showForm={crud.showForm}
                onToggleForm={() => crud.showForm ? crud.closeForm() : crud.openNewForm()}
                newButtonLabel="Nuevo Proveedor"
                newButtonShortLabel="Nuevo"
            />

            <FilterBar
                value={crud.filterEstado}
                onChange={(v) => crud.setFilterEstado(v as 'all' | 'activo' | 'inactivo')}
            />

            <FormModal
                isOpen={crud.showForm}
                portalReady={crud.portalReady}
                onClose={crud.closeForm}
                onSubmit={handleFormSubmit}
                title={crud.editingId ? 'Editar Proveedor' : 'Nuevo Proveedor'}
                subtitle={crud.editingId ? 'Modifique los datos del proveedor' : 'Complete los datos para registrar un nuevo proveedor'}
                editingId={crud.editingId}
                submitLabel={crud.editingId ? 'Guardar Cambios' : 'Crear Proveedor'}
                formId="proveedor-form"
                maxWidth="max-w-4xl"
            >
                <FormSection title="Identificación">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <FormField label="Nombre / Razón Social" required error={crud.formErrors.nombre} className="lg:col-span-2">
                            <input required type="text" placeholder="Servicios Integrales S.L." className={inputClass('nombre')} value={crud.formData.nombre} onChange={e => updateField('nombre', e.target.value)} />
                        </FormField>
                        <FormField label="CIF">
                            <input type="text" placeholder="B12345678" pattern="[A-Za-z0-9]{1,9}" maxLength={9} className={`${inputClass()} uppercase`} value={crud.formData.cif} onChange={e => updateField('cif', e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase())} />
                        </FormField>
                    </div>
                </FormSection>

                <FormSection title="Contacto">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField label="Teléfono" error={crud.formErrors.telefono}>
                            <input type="tel" placeholder="600 000 000" className={inputClass('telefono')} value={crud.formData.telefono} onChange={e => updateField('telefono', e.target.value)} />
                        </FormField>
                        <FormField label="Email" error={crud.formErrors.email}>
                            <input type="email" placeholder="admin@servicios.com" className={inputClass('email')} value={crud.formData.email} onChange={e => updateField('email', e.target.value)} />
                        </FormField>
                    </div>
                </FormSection>

                <FormSection title="Ubicación">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <FormField label="Dirección" className="lg:col-span-3">
                            <input type="text" placeholder="Polígono Industrial Nave 4" className={inputClass()} value={crud.formData.direccion} onChange={e => updateField('direccion', e.target.value)} />
                        </FormField>
                        <FormField label="CP">
                            <input type="text" placeholder="29001" className={inputClass()} value={crud.formData.cp} onChange={e => updateField('cp', e.target.value)} />
                        </FormField>
                        <FormField label="Ciudad">
                            <input type="text" placeholder="Málaga" className={inputClass()} value={crud.formData.ciudad} onChange={e => updateField('ciudad', e.target.value)} />
                        </FormField>
                        <FormField label="Provincia">
                            <input type="text" placeholder="Málaga" className={inputClass()} value={crud.formData.provincia} onChange={e => updateField('provincia', e.target.value)} />
                        </FormField>
                    </div>
                </FormSection>
            </FormModal>

            <DataTable
                data={crud.filteredData}
                columns={columns}
                keyExtractor={(row) => row.id}
                storageKey="proveedores"
                loading={crud.loading}
                emptyMessage="No hay proveedores registrados"
                onRowClick={(row) => crud.openDetail(row)}
                rowActions={(row) => [
                    { label: 'Editar', icon: <Edit2 className="w-4 h-4" />, onClick: (r) => crud.handleEdit(r) },
                    {
                        label: row.activo ? 'Desactivar' : 'Activar',
                        icon: row.activo ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />,
                        onClick: (r) => crud.toggleActive(r.id, r.activo),
                        variant: row.activo ? 'warning' : 'success',
                    },
                    {
                        label: 'Eliminar',
                        icon: <Trash2 className="w-4 h-4" />,
                        onClick: (r) => crud.handleDeleteClick(r.id),
                        variant: 'danger',
                        separator: true,
                    },
                ]}
            />

            {/* Detail Modal */}
            {crud.portalReady && crud.showDetailModal && crud.selectedDetail && createPortal(
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex justify-center items-end sm:items-center sm:p-6">
                    <div
                        className="bg-white w-full max-w-3xl rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[92dvh] sm:max-h-[90dvh] animate-in fade-in slide-in-from-bottom sm:zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-white shrink-0">
                            <div>
                                <h2 className="text-xl font-black text-neutral-900 tracking-tight">{crud.selectedDetail.nombre}</h2>
                                <p className="text-xs text-neutral-500 mt-0.5">
                                    {crud.selectedDetail.activo ? 'Proveedor activo' : 'Proveedor inactivo'} · Ref #{crud.selectedDetail.id}
                                </p>
                            </div>
                            <button onClick={crud.closeDetail} className="p-2 rounded-xl hover:bg-neutral-100 text-neutral-400 hover:text-neutral-900 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                            <FormSection title="Identificación">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <div className="lg:col-span-2">
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Nombre / Razón Social</label>
                                        <div className={readonlyClass}>{crud.selectedDetail.nombre}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">CIF</label>
                                        <div className={readonlyClass}>{crud.selectedDetail.cif || '—'}</div>
                                    </div>
                                </div>
                            </FormSection>

                            <FormSection title="Contacto">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Teléfono</label>
                                        <div className={readonlyClass}>{crud.selectedDetail.telefono || '—'}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Email</label>
                                        <div className={readonlyClass}>{crud.selectedDetail.email || '—'}</div>
                                    </div>
                                </div>
                            </FormSection>

                            <FormSection title="Ubicación">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <div className="lg:col-span-3">
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Dirección</label>
                                        <div className={readonlyClass}>{crud.selectedDetail.direccion || '—'}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">CP</label>
                                        <div className={readonlyClass}>{crud.selectedDetail.cp || '—'}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Ciudad</label>
                                        <div className={readonlyClass}>{crud.selectedDetail.ciudad || '—'}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Provincia</label>
                                        <div className={readonlyClass}>{crud.selectedDetail.provincia || '—'}</div>
                                    </div>
                                </div>
                            </FormSection>
                        </div>

                        <div className="px-4 py-3 bg-white border-t border-neutral-100 flex items-center justify-between shrink-0 gap-2">
                            <ModalActionsMenu actions={[
                                { label: 'Eliminar', icon: <Trash2 className="w-4 h-4" />, onClick: () => { crud.handleDeleteClick(crud.selectedDetail!.id); crud.closeDetail(); }, variant: 'danger' },
                                { label: 'Editar', icon: <Edit2 className="w-4 h-4" />, onClick: () => { crud.handleEdit(crud.selectedDetail!); crud.closeDetail(); } },
                            ]} />
                            <button
                                onClick={() => { crud.toggleActive(crud.selectedDetail!.id, crud.selectedDetail!.activo); crud.setSelectedDetail({ ...crud.selectedDetail!, activo: !crud.selectedDetail!.activo }); }}
                                className="px-5 py-2.5 text-sm font-black text-neutral-900 bg-yellow-400 hover:bg-yellow-500 rounded-xl transition-all shadow-sm flex items-center gap-2 whitespace-nowrap"
                            >
                                {crud.selectedDetail.activo ? <><X className="w-4 h-4" /><span className="hidden sm:inline">Des</span>activar</> : <><Plus className="w-4 h-4" /> Activar</>}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            <DeleteConfirmationModal
                isOpen={crud.showDeleteModal}
                onClose={() => { crud.setShowDeleteModal(false); }}
                onConfirm={crud.handleConfirmDelete}
                itemType="proveedor"
                isDeleting={crud.isDeleting}
            />
        </div>
    );
}
