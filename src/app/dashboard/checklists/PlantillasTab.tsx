'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Archive, ArchiveRestore, Pencil, Trash2 } from 'lucide-react';
import DataTable, { Column } from '@/components/DataTable';
import DeleteConfirmationModal from '@/components/DeleteConfirmationModal';
import FilterBar from '@/components/FilterBar';
import PageHeader from '@/components/PageHeader';
import { supabase } from '@/lib/supabaseClient';
import { logActivity } from '@/lib/logActivity';
import { borrarEntidad } from '@/lib/checklists';
import CabeceraModal from '@/components/checklists/CabeceraModal';

interface FilaBD {
    id: number;
    nombre: string;
    descripcion: string;
    activo: boolean;
    checklist_plantilla_items: { parent_id: number | null }[];
    checklists: { id: number }[];
}

export interface PlantillaFila {
    id: number;
    nombre: string;
    descripcion: string;
    activo: boolean;
    tareas: number;
    subtareas: number;
    usos: number;
}

const FILTROS = [
    { value: 'activo', label: 'Activas', activeClass: 'bg-yellow-400 text-neutral-950' },
    { value: 'inactivo', label: 'Archivadas', activeClass: 'bg-neutral-900 text-white' },
    { value: 'all', label: 'Todas', activeClass: 'bg-neutral-900 text-white' },
];

export default function PlantillasTab() {
    const router = useRouter();
    const [filas, setFilas] = useState<PlantillaFila[]>([]);
    const [cargando, setCargando] = useState(true);
    const [filtroEstado, setFiltroEstado] = useState('activo');
    const [modalNueva, setModalNueva] = useState(false);
    const [aBorrar, setABorrar] = useState<PlantillaFila | null>(null);
    const [borrando, setBorrando] = useState(false);

    const cargar = useCallback(async () => {
        const { data, error } = await supabase
            .from('checklist_plantillas')
            .select('id, nombre, descripcion, activo, checklist_plantilla_items(parent_id), checklists(id)')
            .order('nombre');
        if (error) {
            console.error(error);
            toast.error('No se pudieron cargar las plantillas');
        } else {
            setFilas(((data as unknown as FilaBD[]) || []).map(f => ({
                id: f.id,
                nombre: f.nombre,
                descripcion: f.descripcion,
                activo: f.activo,
                tareas: f.checklist_plantilla_items.filter(i => i.parent_id === null).length,
                subtareas: f.checklist_plantilla_items.filter(i => i.parent_id !== null).length,
                usos: f.checklists.length,
            })));
        }
        setCargando(false);
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    const visibles = useMemo(
        () => filas.filter(f => filtroEstado === 'all' || (filtroEstado === 'activo') === f.activo),
        [filas, filtroEstado],
    );

    const abrir = (row: PlantillaFila) => router.push(`/dashboard/checklists/plantillas/${row.id}`);

    const alternarArchivo = async (fila: PlantillaFila) => {
        const { error } = await supabase.from('checklist_plantillas').update({ activo: !fila.activo }).eq('id', fila.id);
        if (error) {
            toast.error('No se pudo cambiar el estado');
            return;
        }
        await logActivity({
            action: 'toggle_active',
            entityType: 'checklist_plantilla',
            entityId: fila.id,
            entityName: fila.nombre,
            details: { activo: !fila.activo },
        });
        toast.success(fila.activo ? 'Plantilla archivada' : 'Plantilla reactivada');
        cargar();
    };

    const confirmarBorrado = async (credenciales: { email: string; password: string }) => {
        if (!aBorrar) return;
        setBorrando(true);
        try {
            await borrarEntidad('checklist_plantilla', aBorrar.id, credenciales);
            toast.success('Plantilla eliminada');
            setABorrar(null);
            cargar();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'No se pudo eliminar');
        } finally {
            setBorrando(false);
        }
    };

    const columns: Column<PlantillaFila>[] = [
        {
            key: 'nombre',
            label: 'Plantilla',
            hideable: false,
            getSearchValue: row => `${row.nombre} ${row.descripcion}`,
            render: row => (
                <div className="flex items-start gap-3">
                    <span className="mt-1 h-3.5 w-1.5 rounded-full bg-yellow-400" />
                    <div>
                        <p className="font-semibold">{row.nombre}</p>
                        {row.descripcion && <p className="text-xs text-neutral-500">{row.descripcion}</p>}
                    </div>
                </div>
            ),
        },
        { key: 'tareas', label: 'Tareas', align: 'center' },
        { key: 'subtareas', label: 'Subtareas', align: 'center' },
        { key: 'usos', label: 'Checklists creados', align: 'center' },
        {
            key: 'activo',
            label: 'Estado',
            render: row => (
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${row.activo ? 'bg-yellow-400 text-neutral-950' : 'bg-neutral-900 text-white'}`}>
                    {row.activo ? 'Activa' : 'Archivada'}
                </span>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Plantillas de checklist"
                onToggleForm={() => setModalNueva(true)}
                newButtonLabel="Nueva plantilla"
                newButtonShortLabel="Nueva"
            />

            <FilterBar value={filtroEstado} onChange={setFiltroEstado} options={FILTROS} />

            <DataTable
                data={visibles}
                columns={columns}
                keyExtractor={row => row.id}
                storageKey="checklist-plantillas"
                loading={cargando}
                emptyMessage="No hay plantillas."
                onRowClick={abrir}
                rowActions={row => [
                    { label: 'Editar tareas', icon: <Pencil className="w-4 h-4" />, onClick: abrir },
                    {
                        label: row.activo ? 'Archivar' : 'Reactivar',
                        icon: row.activo ? <Archive className="w-4 h-4" /> : <ArchiveRestore className="w-4 h-4" />,
                        onClick: alternarArchivo,
                        variant: row.activo ? 'warning' : 'success',
                    },
                    { label: 'Eliminar', icon: <Trash2 className="w-4 h-4" />, onClick: setABorrar, variant: 'danger', separator: true },
                ]}
            />

            <CabeceraModal
                isOpen={modalNueva}
                tipo="plantilla"
                registro={null}
                onClose={() => setModalNueva(false)}
                onGuardada={id => router.push(`/dashboard/checklists/plantillas/${id}`)}
            />

            <DeleteConfirmationModal
                isOpen={aBorrar !== null}
                onClose={() => setABorrar(null)}
                onConfirm={confirmarBorrado}
                itemType="plantilla"
                description={aBorrar ? `Se eliminará la plantilla "${aBorrar.nombre}". Los ${aBorrar.usos} checklists ya creados con ella se conservan.` : undefined}
                isDeleting={borrando}
            />
        </div>
    );
}
