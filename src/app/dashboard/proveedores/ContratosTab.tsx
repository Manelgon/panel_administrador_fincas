'use client';

import { useEffect, useMemo, useState } from 'react';
import { Building2, Check, Edit2, Trash2, Truck, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabaseClient';
import { useCRUDPage } from '@/hooks/useCRUDPage';
import DataTable, { Column } from '@/components/DataTable';
import DeleteConfirmationModal from '@/components/DeleteConfirmationModal';
import ModalActionsMenu from '@/components/ModalActionsMenu';
import PageHeader from '@/components/PageHeader';
import FilterBar from '@/components/FilterBar';
import FormModal from '@/components/FormModal';
import FormSection from '@/components/FormSection';
import FormField from '@/components/FormField';
import SearchableSelect from '@/components/SearchableSelect';
import ContratoPreavisoBadge from '@/components/ContratoPreavisoBadge';
import { TIPOS_SERVICIO_CONTRATO } from '@/lib/tiposServicioContrato';

interface Contrato {
    id: number;
    comunidad_id: number | null;
    proveedor_id: number | null;
    tipo_servicio: string | null;
    num_poliza: string | null;
    descripcion: string | null;
    fecha_alta: string | null;
    fecha_vencimiento: string | null;
    fecha_preaviso: string | null;
    activo: boolean;
    comunidades: { nombre_cdad: string } | null;
    proveedores: { nombre: string } | null;
}

const defaultFormData = {
    comunidad_id: '' as string | number,
    proveedor_id: '' as string | number,
    tipo_servicio: '',
    num_poliza: '',
    descripcion: '',
    fecha_alta: '',
    fecha_vencimiento: '',
    fecha_preaviso: '',
};

type FormData = typeof defaultFormData;

export interface ContratosPreselect {
    comunidadId?: number;
    proveedorId?: number;
    openForm?: boolean;
}

interface OpcionRef {
    id: number;
    nombre: string;
}

function formatFecha(fecha: string | null): string {
    if (!fecha) return '—';
    return new Date(fecha + 'T00:00:00').toLocaleDateString('es-ES');
}

export default function ContratosTab({ preselect }: { preselect?: ContratosPreselect }) {
    const crud = useCRUDPage<Contrato, FormData>({
        entityType: 'contrato',
        entityLabel: 'contrato',
        tableName: 'contratos',
        defaultFormData,
        orderBy: { column: 'fecha_vencimiento', ascending: true },
        selectQuery: '*, comunidades(nombre_cdad), proveedores(nombre)',
        nameField: 'tipo_servicio',
    });

    // Catálogos para selects y filtros
    const [comunidades, setComunidades] = useState<OpcionRef[]>([]);
    const [proveedores, setProveedores] = useState<OpcionRef[]>([]);

    useEffect(() => {
        const fetchRefs = async () => {
            const [com, prov] = await Promise.all([
                supabase.from('comunidades').select('id, nombre_cdad').eq('activo', true).order('nombre_cdad'),
                supabase.from('proveedores').select('id, nombre').eq('activo', true).order('nombre'),
            ]);
            setComunidades((com.data || []).map(c => ({ id: c.id, nombre: c.nombre_cdad })));
            setProveedores((prov.data || []).map(p => ({ id: p.id, nombre: p.nombre })));
        };
        fetchRefs();
    }, []);

    // Filtros por comunidad / proveedor (se combinan con el de estado del hook)
    const [filterComunidad, setFilterComunidad] = useState<number | ''>('');
    const [filterProveedor, setFilterProveedor] = useState<number | ''>('');

    // Preselección por deep-link (ficha de Comunidad / Proveedor)
    const [preselectApplied, setPreselectApplied] = useState(false);
    useEffect(() => {
        if (!preselect || preselectApplied) return;
        if (preselect.comunidadId) setFilterComunidad(preselect.comunidadId);
        if (preselect.proveedorId) setFilterProveedor(preselect.proveedorId);
        if (preselect.openForm) {
            crud.setFormData({
                ...defaultFormData,
                comunidad_id: preselect.comunidadId ?? '',
                proveedor_id: preselect.proveedorId ?? '',
            });
            crud.setShowForm(true);
        }
        setPreselectApplied(true);
    }, [preselect, preselectApplied, crud]);

    const filteredData = useMemo(() => {
        return crud.filteredData.filter(c => {
            if (filterComunidad !== '' && c.comunidad_id !== filterComunidad) return false;
            if (filterProveedor !== '' && c.proveedor_id !== filterProveedor) return false;
            return true;
        });
    }, [crud.filteredData, filterComunidad, filterProveedor]);

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const f = crud.formData;
        const dataToSubmit = {
            comunidad_id: f.comunidad_id === '' ? null : Number(f.comunidad_id),
            proveedor_id: f.proveedor_id === '' ? null : Number(f.proveedor_id),
            tipo_servicio: f.tipo_servicio,
            num_poliza: f.num_poliza?.trim() || null,
            descripcion: f.descripcion?.trim() || null,
            fecha_alta: f.fecha_alta || null,
            fecha_vencimiento: f.fecha_vencimiento || null,
            fecha_preaviso: f.fecha_preaviso || null,
        };
        await crud.handleSubmit(dataToSubmit, () => {
            const errors: Record<string, string> = {};
            if (f.comunidad_id === '') errors.comunidad_id = 'Selecciona la comunidad';
            if (f.proveedor_id === '') errors.proveedor_id = 'Selecciona el proveedor';
            if (!f.tipo_servicio) errors.tipo_servicio = 'Selecciona el tipo de servicio';
            if (f.fecha_alta && f.fecha_vencimiento && f.fecha_vencimiento < f.fecha_alta) {
                errors.fecha_vencimiento = 'El vencimiento no puede ser anterior al alta';
            }
            if (f.fecha_preaviso && f.fecha_vencimiento && f.fecha_preaviso > f.fecha_vencimiento) {
                errors.fecha_preaviso = 'El preaviso debe ser anterior o igual al vencimiento';
            }
            return errors;
        });
    };

    const updateField = (field: keyof FormData, value: string | number) => {
        crud.setFormData({ ...crud.formData, [field]: value });
        crud.setFormErrors(prev => ({ ...prev, [field]: '' }));
    };

    const inputClass = (field?: string) =>
        `w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30 focus:border-yellow-400 transition-all ${field && crud.formErrors[field] ? 'border-red-400' : 'border-neutral-200'}`;

    const columns: Column<Contrato>[] = [
        {
            key: 'comunidad',
            label: 'Comunidad',
            render: (row) => (
                <div className="flex items-start gap-3">
                    <span className="mt-1 h-3.5 w-1.5 rounded-full bg-yellow-400" />
                    <span className="font-semibold">{row.comunidades?.nombre_cdad || '—'}</span>
                </div>
            ),
        },
        {
            key: 'proveedor',
            label: 'Proveedor',
            render: (row) => <span>{row.proveedores?.nombre || '—'}</span>,
        },
        { key: 'tipo_servicio', label: 'Servicio', render: (row) => row.tipo_servicio || '—' },
        { key: 'num_poliza', label: 'Nº Póliza', defaultVisible: false, render: (row) => row.num_poliza || '—' },
        { key: 'fecha_alta', label: 'Alta', render: (row) => formatFecha(row.fecha_alta) },
        { key: 'fecha_vencimiento', label: 'Vencimiento', render: (row) => formatFecha(row.fecha_vencimiento) },
        {
            key: 'preaviso',
            label: 'Preaviso',
            render: (row) => (
                <div className="flex items-center gap-2">
                    <span>{formatFecha(row.fecha_preaviso)}</span>
                    {row.activo && <ContratoPreavisoBadge fechaPreaviso={row.fecha_preaviso} />}
                </div>
            ),
        },
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

    const readonlyClass = 'w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900';

    return (
        <div className="space-y-6">
            <PageHeader
                title="Contratos con Proveedores"
                showForm={crud.showForm}
                onToggleForm={() => crud.showForm ? crud.closeForm() : crud.openNewForm()}
                newButtonLabel="Nuevo Contrato"
                newButtonShortLabel="Nuevo"
            />

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <FilterBar
                    value={crud.filterEstado}
                    onChange={(v) => crud.setFilterEstado(v as 'all' | 'activo' | 'inactivo')}
                />
                <div className="flex flex-col sm:flex-row gap-3 sm:ml-auto w-full sm:w-auto">
                    <div className="w-full sm:w-64">
                        <SearchableSelect
                            options={[{ value: '', label: 'Todas las comunidades' }, ...comunidades.map(c => ({ value: c.id, label: c.nombre }))]}
                            value={filterComunidad}
                            onChange={(v) => setFilterComunidad(v === '' ? '' : Number(v))}
                            placeholder="Filtrar por comunidad"
                        />
                    </div>
                    <div className="w-full sm:w-64">
                        <SearchableSelect
                            options={[{ value: '', label: 'Todos los proveedores' }, ...proveedores.map(p => ({ value: p.id, label: p.nombre }))]}
                            value={filterProveedor}
                            onChange={(v) => setFilterProveedor(v === '' ? '' : Number(v))}
                            placeholder="Filtrar por proveedor"
                        />
                    </div>
                </div>
            </div>

            <FormModal
                isOpen={crud.showForm}
                portalReady={crud.portalReady}
                onClose={crud.closeForm}
                onSubmit={handleFormSubmit}
                title={crud.editingId ? 'Editar Contrato' : 'Nuevo Contrato'}
                subtitle={crud.editingId ? 'Modifique los datos del contrato' : 'Complete los datos para registrar un nuevo contrato'}
                editingId={crud.editingId}
                submitLabel={crud.editingId ? 'Guardar Cambios' : 'Crear Contrato'}
                formId="contrato-form"
                maxWidth="max-w-4xl"
            >
                <FormSection title="Partes">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField label="Comunidad" required error={crud.formErrors.comunidad_id}>
                            <SearchableSelect
                                options={comunidades.map(c => ({ value: c.id, label: c.nombre }))}
                                value={crud.formData.comunidad_id}
                                onChange={(v) => updateField('comunidad_id', v)}
                                placeholder="Seleccionar comunidad..."
                            />
                        </FormField>
                        <FormField label="Proveedor" required error={crud.formErrors.proveedor_id}>
                            <SearchableSelect
                                options={proveedores.map(p => ({ value: p.id, label: p.nombre }))}
                                value={crud.formData.proveedor_id}
                                onChange={(v) => updateField('proveedor_id', v)}
                                placeholder="Seleccionar proveedor..."
                            />
                        </FormField>
                    </div>
                </FormSection>

                <FormSection title="Servicio">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField label="Tipo de servicio" required error={crud.formErrors.tipo_servicio}>
                            <SearchableSelect
                                options={TIPOS_SERVICIO_CONTRATO.map(t => ({ value: t, label: t }))}
                                value={crud.formData.tipo_servicio}
                                onChange={(v) => updateField('tipo_servicio', String(v))}
                                placeholder="Seleccionar tipo..."
                            />
                        </FormField>
                        <FormField label="Nº de póliza">
                            <input
                                type="text"
                                placeholder="5000086454"
                                className={inputClass()}
                                value={crud.formData.num_poliza}
                                onChange={e => updateField('num_poliza', e.target.value)}
                            />
                        </FormField>
                        <FormField label="Descripción / Observaciones" className="sm:col-span-2">
                            <textarea
                                rows={3}
                                placeholder="Detalles del contrato, condiciones, bloque..."
                                className={inputClass()}
                                value={crud.formData.descripcion}
                                onChange={e => updateField('descripcion', e.target.value)}
                            />
                        </FormField>
                    </div>
                </FormSection>

                <FormSection title="Fechas">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <FormField label="Fecha de alta">
                            <input type="date" className={inputClass()} value={crud.formData.fecha_alta} onChange={e => updateField('fecha_alta', e.target.value)} />
                        </FormField>
                        <FormField label="Fecha de vencimiento" error={crud.formErrors.fecha_vencimiento}>
                            <input type="date" className={inputClass('fecha_vencimiento')} value={crud.formData.fecha_vencimiento} onChange={e => updateField('fecha_vencimiento', e.target.value)} />
                        </FormField>
                        <FormField label="Fecha de preaviso" error={crud.formErrors.fecha_preaviso}>
                            <input type="date" className={inputClass('fecha_preaviso')} value={crud.formData.fecha_preaviso} onChange={e => updateField('fecha_preaviso', e.target.value)} />
                        </FormField>
                    </div>
                </FormSection>
            </FormModal>

            <DataTable
                data={filteredData}
                columns={columns}
                keyExtractor={(row) => row.id}
                storageKey="contratos"
                loading={crud.loading}
                emptyMessage="No hay contratos registrados"
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
                                <h2 className="text-xl font-black text-neutral-900 tracking-tight">{crud.selectedDetail.tipo_servicio || 'Contrato'}</h2>
                                <p className="text-xs text-neutral-500 mt-0.5">
                                    {crud.selectedDetail.activo ? 'Contrato activo' : 'Contrato inactivo'} · Ref #{crud.selectedDetail.id}
                                </p>
                            </div>
                            <button onClick={crud.closeDetail} className="p-2 rounded-xl hover:bg-neutral-100 text-neutral-400 hover:text-neutral-900 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                            <FormSection title="Partes">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5 flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> Comunidad</label>
                                        <div className={readonlyClass}>{crud.selectedDetail.comunidades?.nombre_cdad || '—'}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5 flex items-center gap-1.5"><Truck className="w-3.5 h-3.5" /> Proveedor</label>
                                        <div className={readonlyClass}>{crud.selectedDetail.proveedores?.nombre || '—'}</div>
                                    </div>
                                </div>
                            </FormSection>

                            <FormSection title="Servicio">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Tipo de servicio</label>
                                        <div className={readonlyClass}>{crud.selectedDetail.tipo_servicio || '—'}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Nº de póliza</label>
                                        <div className={readonlyClass}>{crud.selectedDetail.num_poliza || '—'}</div>
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Descripción / Observaciones</label>
                                        <div className={`${readonlyClass} whitespace-pre-wrap`}>{crud.selectedDetail.descripcion || '—'}</div>
                                    </div>
                                </div>
                            </FormSection>

                            <FormSection title="Fechas">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Alta</label>
                                        <div className={readonlyClass}>{formatFecha(crud.selectedDetail.fecha_alta)}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Vencimiento</label>
                                        <div className={readonlyClass}>{formatFecha(crud.selectedDetail.fecha_vencimiento)}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Preaviso</label>
                                        <div className={`${readonlyClass} flex items-center gap-2`}>
                                            {formatFecha(crud.selectedDetail.fecha_preaviso)}
                                            {crud.selectedDetail.activo && <ContratoPreavisoBadge fechaPreaviso={crud.selectedDetail.fecha_preaviso} />}
                                        </div>
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
                                {crud.selectedDetail.activo ? <>Desactivar</> : <>Activar</>}
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
                itemType="contrato"
                isDeleting={crud.isDeleting}
            />
        </div>
    );
}
