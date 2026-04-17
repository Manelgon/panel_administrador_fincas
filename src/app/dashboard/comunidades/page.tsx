'use client';

import { createPortal } from 'react-dom';
import { Trash2, X, Edit2, Plus, Check, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useCRUDPage } from '@/hooks/useCRUDPage';
import DataTable, { Column } from '@/components/DataTable';
import DeleteConfirmationModal from '@/components/DeleteConfirmationModal';
import PageHeader from '@/components/PageHeader';
import FilterBar from '@/components/FilterBar';
import FormModal from '@/components/FormModal';
import FormSection from '@/components/FormSection';
import FormField from '@/components/FormField';
import ImportComunidadesModal from '@/components/ImportComunidadesModal';
import SearchableSelect from '@/components/SearchableSelect';
import { Comunidad, DeleteCredentials } from '@/lib/schemas';
import { useState } from 'react';

const defaultFormData = {
    codigo: '',
    nombre_cdad: '',
    direccion: '',
    cp: '',
    ciudad: '',
    provincia: '',
    cif: '',
    tipo: 'comunidad de propietarios' as string,
};

type FormData = typeof defaultFormData;

export default function ComunidadesPage() {
    const [showImportModal, setShowImportModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const crud = useCRUDPage<Comunidad, FormData>({
        entityType: 'comunidad',
        entityLabel: 'comunidad',
        tableName: 'comunidades',
        defaultFormData,
        orderBy: { column: 'id', ascending: true },
        nameField: 'nombre_cdad',
        onAfterSave: () => window.dispatchEvent(new Event('communitiesChanged')),
        onAfterDelete: () => window.dispatchEvent(new Event('communitiesChanged')),
    });

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        let finalCodigo = crud.formData.codigo.trim();

        if (!crud.editingId) {
            const numericCodes = crud.data
                .map(c => parseInt(c.codigo, 10))
                .filter(n => !isNaN(n));
            finalCodigo = numericCodes.length > 0
                ? (Math.max(...numericCodes) + 1).toString()
                : '1';
        } else if (/^\d+$/.test(finalCodigo)) {
            finalCodigo = parseInt(finalCodigo, 10).toString();
        }

        const dataToSubmit = { ...crud.formData, codigo: finalCodigo };

        await crud.handleSubmit(dataToSubmit, () => {
            const errors: Record<string, string> = {};
            if (!dataToSubmit.codigo?.trim()) errors.codigo = 'El código de la comunidad es obligatorio';
            if (!dataToSubmit.nombre_cdad?.trim()) errors.nombre_cdad = 'El nombre de la comunidad es obligatorio';
            return errors;
        });
    };

    const updateField = (field: keyof FormData, value: string) => {
        crud.setFormData({ ...crud.formData, [field]: value });
        crud.setFormErrors(prev => ({ ...prev, [field]: '' }));
    };

    const inputClass = (field?: string) =>
        `w-full rounded-lg border bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400 focus:bg-white transition ${field && crud.formErrors[field] ? 'border-red-400' : 'border-neutral-200'}`;

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
        { key: 'tipo', label: 'Tipo', render: (row) => <span className="capitalize">{row.tipo}</span> },
        { key: 'nombre_cdad', label: 'Nombre' },
        { key: 'direccion', label: 'Dirección', defaultVisible: false },
        { key: 'cp', label: 'CP', defaultVisible: false },
        { key: 'ciudad', label: 'Ciudad' },
        { key: 'provincia', label: 'Provincia', defaultVisible: false },
        { key: 'cif', label: 'CIF' },
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
                title="Gestión de Comunidades"
                showForm={crud.showForm}
                onToggleForm={() => crud.showForm ? crud.closeForm() : crud.openNewForm()}
                newButtonLabel="Nueva Comunidad"
                newButtonShortLabel="Nueva"
                extraButtons={
                    <button
                        onClick={() => setShowImportModal(true)}
                        className="border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 px-3 py-2 rounded-xl flex items-center gap-1.5 transition font-semibold text-sm shadow-sm"
                    >
                        <Upload className="w-4 h-4 flex-shrink-0" />
                        <span className="hidden sm:inline">Importar CSV/Excel</span>
                        <span className="sm:hidden">Importar</span>
                    </button>
                }
            />

            <FilterBar
                value={crud.filterEstado}
                onChange={(v) => crud.setFilterEstado(v as 'all' | 'activo' | 'inactivo')}
                options={[
                    { value: 'activo', label: 'Activas', activeClass: 'bg-yellow-400 text-neutral-950' },
                    { value: 'inactivo', label: 'Inactivas', activeClass: 'bg-neutral-900 text-white' },
                    { value: 'all', label: 'Todas', activeClass: 'bg-neutral-900 text-white' },
                ]}
            />

            {/* Import Modal */}
            {crud.portalReady && showImportModal && createPortal(
                <ImportComunidadesModal
                    onClose={() => setShowImportModal(false)}
                    onImported={() => { crud.fetchData(); }}
                />,
                document.body
            )}

            <FormModal
                isOpen={crud.showForm}
                portalReady={crud.portalReady}
                onClose={crud.closeForm}
                onSubmit={handleFormSubmit}
                title={crud.editingId ? 'Editar Comunidad' : 'Nueva Comunidad'}
                subtitle="Complete los datos de la comunidad"
                editingId={crud.editingId}
                submitLabel={crud.editingId ? 'Guardar Cambios' : 'Guardar Comunidad'}
                formId="comunidad-form"
            >
                <FormSection title="Identificación">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-x-4 gap-y-3">
                        <FormField label="Tipo" required className="sm:col-span-7 md:col-span-8">
                            <SearchableSelect
                                value={crud.formData.tipo}
                                onChange={(val) => crud.setFormData({ ...crud.formData, tipo: String(val) })}
                                options={[
                                    { value: "comunidad de propietarios", label: "Comunidad de Propietarios" },
                                    { value: "trasteros y aparcamientos", label: "Trasteros y Aparcamientos" },
                                ]}
                                placeholder="Seleccionar tipo..."
                            />
                        </FormField>
                        <FormField label="CIF" className="sm:col-span-5 md:col-span-4">
                            <input type="text" placeholder="H12345678" className={inputClass()} value={crud.formData.cif} onChange={e => updateField('cif', e.target.value)} />
                        </FormField>
                        <FormField label="Nombre Comunidad" required error={crud.formErrors.nombre_cdad} className="sm:col-span-12">
                            <input required type="text" placeholder="Edificio Central" className={inputClass('nombre_cdad')} value={crud.formData.nombre_cdad} onChange={e => updateField('nombre_cdad', e.target.value)} />
                        </FormField>
                    </div>
                </FormSection>

                <FormSection title="Ubicación">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-x-4 gap-y-3">
                        <FormField label="Dirección" className="sm:col-span-6">
                            <input type="text" placeholder="C/ Mayor 123" className={inputClass()} value={crud.formData.direccion} onChange={e => updateField('direccion', e.target.value)} />
                        </FormField>
                        <FormField label="CP" className="sm:col-span-6">
                            <input type="text" placeholder="29001" className={inputClass()} value={crud.formData.cp} onChange={e => updateField('cp', e.target.value)} />
                        </FormField>
                        <FormField label="Ciudad" className="sm:col-span-6">
                            <input type="text" placeholder="Málaga" className={inputClass()} value={crud.formData.ciudad} onChange={e => updateField('ciudad', e.target.value)} />
                        </FormField>
                        <FormField label="Provincia" className="sm:col-span-6">
                            <input type="text" placeholder="Málaga" className={inputClass()} value={crud.formData.provincia} onChange={e => updateField('provincia', e.target.value)} />
                        </FormField>
                    </div>
                </FormSection>
            </FormModal>

            <DataTable
                data={crud.filteredData}
                columns={columns}
                keyExtractor={(row) => row.id}
                storageKey="comunidades"
                loading={crud.loading}
                emptyMessage="No hay comunidades registradas"
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
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
                                <h2 className="text-xl font-black text-neutral-900 tracking-tight">{crud.selectedDetail.nombre_cdad}</h2>
                                <p className="text-xs text-neutral-500 mt-0.5">
                                    {crud.selectedDetail.activo ? 'Comunidad activa' : 'Comunidad inactiva'} · Código {crud.selectedDetail.codigo}
                                </p>
                            </div>
                            <button onClick={crud.closeDetail} className="p-2 rounded-xl hover:bg-neutral-100 text-neutral-400 hover:text-neutral-900 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                            <FormSection title="Datos Generales">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <div className="lg:col-span-2">
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Nombre de la Comunidad</label>
                                        <div className={readonlyClass}>{crud.selectedDetail.nombre_cdad}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Código Interno</label>
                                        <div className={`${readonlyClass} font-semibold`}>{crud.selectedDetail.codigo}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Tipo</label>
                                        <div className={`${readonlyClass} capitalize`}>{crud.selectedDetail.tipo}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">CIF</label>
                                        <div className={readonlyClass}>{crud.selectedDetail.cif || '—'}</div>
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

                        <div className="px-6 py-4 bg-white border-t border-neutral-100 flex items-center justify-between shrink-0 flex-wrap">
                            <button
                                onClick={() => { crud.handleDeleteClick(crud.selectedDetail!.id); crud.closeDetail(); }}
                                className="px-4 py-2 text-sm font-bold text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all flex items-center gap-2"
                            >
                                <Trash2 className="w-4 h-4" />
                                Eliminar
                            </button>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => { crud.handleEdit(crud.selectedDetail!); crud.closeDetail(); }}
                                    className="px-6 py-3 text-sm font-bold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl transition-all"
                                >
                                    Editar
                                </button>
                                <button
                                    onClick={() => { crud.toggleActive(crud.selectedDetail!.id, crud.selectedDetail!.activo); crud.setSelectedDetail({ ...crud.selectedDetail!, activo: !crud.selectedDetail!.activo }); }}
                                    className="px-8 py-3 text-sm font-black text-neutral-900 bg-yellow-400 hover:bg-yellow-500 rounded-xl transition-all shadow-sm flex items-center gap-2 hover:shadow-md hover:-translate-y-0.5"
                                >
                                    {crud.selectedDetail.activo ? <><X className="w-4 h-4" /> Desactivar</> : <><Plus className="w-4 h-4" /> Activar</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            <DeleteConfirmationModal
                isOpen={crud.showDeleteModal}
                onClose={() => { crud.setShowDeleteModal(false); }}
                onConfirm={crud.handleConfirmDelete}
                itemType="comunidad"
                isDeleting={crud.isDeleting}
            />
        </div>
    );
}
