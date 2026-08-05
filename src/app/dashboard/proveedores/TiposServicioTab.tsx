'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Edit2, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabaseClient';
import { useCRUDPage } from '@/hooks/useCRUDPage';
import { normalizarNombreTipo } from '@/hooks/useTiposServicio';
import DataTable, { Column } from '@/components/DataTable';
import PageHeader from '@/components/PageHeader';
import FilterBar from '@/components/FilterBar';
import FormModal from '@/components/FormModal';
import FormSection from '@/components/FormSection';
import FormField from '@/components/FormField';

interface TipoServicio {
    id: number;
    nombre: string;
    activo: boolean;
}

// Fila con el nº de contratos aplanado para que la columna sea ordenable
type TipoFila = TipoServicio & { usos: number };

const defaultFormData = { nombre: '' };
type FormData = typeof defaultFormData;

// Catálogo de tipos de servicio, abierto a todo el equipo.
// Los contratos guardan el NOMBRE del tipo, no un id: al renombrar hay que
// actualizar también los contratos afectados para no desincronizar nada.
export default function TiposServicioTab() {
    const crud = useCRUDPage<TipoServicio, FormData>({
        entityType: 'tipo_servicio',
        entityLabel: 'tipo de servicio',
        tableName: 'tipos_servicio_contrato',
        defaultFormData,
        orderBy: { column: 'nombre', ascending: true },
        nameField: 'nombre',
    });

    const [usos, setUsos] = useState<Map<string, number>>(new Map());

    const cargarUsos = async () => {
        const { data } = await supabase.from('contratos').select('tipo_servicio');
        const map = new Map<string, number>();
        for (const c of data || []) {
            if (c.tipo_servicio) map.set(c.tipo_servicio, (map.get(c.tipo_servicio) || 0) + 1);
        }
        setUsos(map);
    };

    useEffect(() => { cargarUsos(); }, []);

    const filas: TipoFila[] = useMemo(
        () => crud.filteredData.map(t => ({ ...t, usos: usos.get(t.nombre) || 0 })),
        [crud.filteredData, usos]
    );

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const limpio = crud.formData.nombre.replace(/\s+/g, ' ').trim();
        const nombreAnterior = crud.editingId
            ? crud.data.find(t => t.id === crud.editingId)?.nombre
            : undefined;

        const ok = await crud.handleSubmit({ nombre: limpio }, () => {
            const errors: Record<string, string> = {};
            if (!limpio) {
                errors.nombre = 'El nombre es obligatorio';
                return errors;
            }
            const duplicado = crud.data.find(t =>
                t.id !== crud.editingId && normalizarNombreTipo(t.nombre) === normalizarNombreTipo(limpio)
            );
            if (duplicado) errors.nombre = `Ya existe el tipo "${duplicado.nombre}"`;
            return errors;
        });

        // El contrato guarda el nombre: si cambia, hay que propagarlo
        if (ok && nombreAnterior && nombreAnterior !== limpio) {
            const afectados = usos.get(nombreAnterior) || 0;
            if (afectados > 0) {
                const { error } = await supabase
                    .from('contratos')
                    .update({ tipo_servicio: limpio })
                    .eq('tipo_servicio', nombreAnterior);
                if (error) {
                    toast.error('El tipo se renombró, pero no se pudieron actualizar los contratos');
                } else {
                    toast.success(`Actualizado en ${afectados} contrato(s)`);
                }
            }
            cargarUsos();
        }
    };

    const inputClass = (field?: string) =>
        `w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30 focus:border-yellow-400 transition-all ${field && crud.formErrors[field] ? 'border-red-400' : 'border-neutral-200'}`;

    const columns: Column<TipoFila>[] = [
        {
            key: 'nombre',
            label: 'Tipo de servicio',
            hideable: false,
            render: (row) => (
                <div className="flex items-start gap-3">
                    <span className="mt-1 h-3.5 w-1.5 rounded-full bg-yellow-400" />
                    <span className="font-semibold">{row.nombre}</span>
                </div>
            ),
        },
        {
            key: 'usos',
            label: 'Contratos',
            render: (row) => row.usos > 0 ? (
                <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-neutral-100 text-neutral-700">{row.usos}</span>
            ) : (
                <span className="text-neutral-300">Sin uso</span>
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

    return (
        <div className="space-y-6">
            <PageHeader
                title="Tipos de Servicio"
                showForm={crud.showForm}
                onToggleForm={() => crud.showForm ? crud.closeForm() : crud.openNewForm()}
                newButtonLabel="Nuevo Tipo"
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
                title={crud.editingId ? 'Renombrar Tipo de Servicio' : 'Nuevo Tipo de Servicio'}
                subtitle={crud.editingId
                    ? 'Los contratos que usan este tipo se actualizarán automáticamente'
                    : 'Estará disponible al crear o editar contratos'}
                editingId={crud.editingId}
                submitLabel={crud.editingId ? 'Guardar Cambios' : 'Crear Tipo'}
                formId="tipo-servicio-form"
                maxWidth="max-w-lg"
            >
                <FormSection title="Datos del tipo">
                    <FormField label="Nombre" required error={crud.formErrors.nombre}>
                        <input
                            required
                            autoFocus
                            type="text"
                            placeholder="Ascensores"
                            className={inputClass('nombre')}
                            value={crud.formData.nombre}
                            onChange={e => {
                                crud.setFormData({ nombre: e.target.value });
                                crud.setFormErrors(prev => ({ ...prev, nombre: '' }));
                            }}
                        />
                    </FormField>
                </FormSection>
            </FormModal>

            <DataTable
                data={filas}
                columns={columns}
                keyExtractor={(row) => row.id}
                storageKey="tipos_servicio"
                loading={crud.loading}
                emptyMessage="No hay tipos de servicio registrados"
                rowActions={(row) => [
                    { label: 'Renombrar', icon: <Edit2 className="w-4 h-4" />, onClick: (r) => crud.handleEdit(r) },
                    {
                        label: row.activo ? 'Desactivar' : 'Activar',
                        icon: row.activo ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />,
                        onClick: (r) => crud.toggleActive(r.id, r.activo),
                        variant: row.activo ? 'warning' : 'success',
                    },
                ]}
            />

            <p className="text-xs text-neutral-500">
                Al renombrar un tipo se actualizan automáticamente los contratos que lo usaban. Desactivar un tipo lo retira del desplegable de nuevos contratos, pero no afecta a los contratos ya existentes.
            </p>
        </div>
    );
}
