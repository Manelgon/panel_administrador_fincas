'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Archive, ArchiveRestore, ExternalLink, Trash2 } from 'lucide-react';
import DataTable, { Column } from '@/components/DataTable';
import DeleteConfirmationModal from '@/components/DeleteConfirmationModal';
import FilterBar from '@/components/FilterBar';
import PageHeader from '@/components/PageHeader';
import SearchableSelect from '@/components/SearchableSelect';
import { supabase } from '@/lib/supabaseClient';
import { logActivity } from '@/lib/logActivity';
import { borrarEntidad, progreso } from '@/lib/checklists';
import NuevoChecklistModal, { ComunidadOpcion } from './NuevoChecklistModal';

export interface ChecklistsPreselect {
    comunidadId?: number;
    openForm?: boolean;
}

interface FilaBD {
    id: number;
    nombre: string;
    descripcion: string;
    activo: boolean;
    created_at: string;
    comunidad_id: number;
    comunidades: { codigo: string | null; nombre_cdad: string } | null;
    checklist_plantillas: { nombre: string } | null;
    checklist_items: { parent_id: number | null; hecho: boolean }[];
}

interface ChecklistFila {
    id: number;
    nombre: string;
    descripcion: string;
    activo: boolean;
    created_at: string;
    comunidad_id: number;
    comunidad: string;
    plantilla: string;
    hechas: number;
    total: number;
    pct: number;
}

const FILTROS = [
    { value: 'activo', label: 'Activos', activeClass: 'bg-yellow-400 text-neutral-950' },
    { value: 'inactivo', label: 'Archivados', activeClass: 'bg-neutral-900 text-white' },
    { value: 'all', label: 'Todos', activeClass: 'bg-neutral-900 text-white' },
];

const etiquetaComunidad = (c: { codigo: string | null; nombre_cdad: string } | null) =>
    c ? (c.codigo ? `${c.codigo} - ${c.nombre_cdad}` : c.nombre_cdad) : '—';

export default function ChecklistsTab({ preselect }: { preselect?: ChecklistsPreselect }) {
    const router = useRouter();
    const [filas, setFilas] = useState<ChecklistFila[]>([]);
    const [comunidades, setComunidades] = useState<ComunidadOpcion[]>([]);
    const [cargando, setCargando] = useState(true);
    const [filtroEstado, setFiltroEstado] = useState('activo');
    const [filtroComunidad, setFiltroComunidad] = useState<number | ''>(preselect?.comunidadId ?? '');
    const [modalNuevo, setModalNuevo] = useState(Boolean(preselect?.openForm));
    const [aBorrar, setABorrar] = useState<ChecklistFila | null>(null);
    const [borrando, setBorrando] = useState(false);

    const cargar = useCallback(async () => {
        const { data, error } = await supabase
            .from('checklists')
            .select('id, nombre, descripcion, activo, created_at, comunidad_id, comunidades(codigo, nombre_cdad), checklist_plantillas(nombre), checklist_items(parent_id, hecho)')
            .order('created_at', { ascending: false });
        if (error) {
            console.error(error);
            toast.error('No se pudieron cargar los checklists');
        } else {
            setFilas(((data as unknown as FilaBD[]) || []).map(f => ({
                id: f.id,
                nombre: f.nombre,
                descripcion: f.descripcion,
                activo: f.activo,
                created_at: f.created_at,
                comunidad_id: f.comunidad_id,
                comunidad: etiquetaComunidad(f.comunidades),
                plantilla: f.checklist_plantillas?.nombre ?? '',
                ...progreso(f.checklist_items),
            })));
        }
        setCargando(false);
    }, []);

    useEffect(() => {
        cargar();
        supabase
            .from('comunidades')
            .select('id, codigo, nombre_cdad')
            .eq('activo', true)
            .order('codigo')
            .then(({ data }) => setComunidades((data || []).map(c => ({ id: c.id, nombre: etiquetaComunidad(c) }))));
    }, [cargar]);

    const visibles = useMemo(() => filas.filter(f =>
        (filtroEstado === 'all' || (filtroEstado === 'activo') === f.activo) &&
        (filtroComunidad === '' || f.comunidad_id === filtroComunidad),
    ), [filas, filtroEstado, filtroComunidad]);

    const alternarArchivo = async (fila: ChecklistFila) => {
        const { error } = await supabase.from('checklists').update({ activo: !fila.activo }).eq('id', fila.id);
        if (error) {
            toast.error('No se pudo cambiar el estado');
            return;
        }
        await logActivity({
            action: 'toggle_active',
            entityType: 'checklist',
            entityId: fila.id,
            entityName: `${fila.nombre} - ${fila.comunidad}`,
            details: { activo: !fila.activo },
        });
        toast.success(fila.activo ? 'Checklist archivado' : 'Checklist reactivado');
        cargar();
    };

    const confirmarBorrado = async (credenciales: { email: string; password: string }) => {
        if (!aBorrar) return;
        setBorrando(true);
        try {
            await borrarEntidad('checklist', aBorrar.id, credenciales);
            toast.success('Checklist eliminado');
            setABorrar(null);
            cargar();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'No se pudo eliminar');
        } finally {
            setBorrando(false);
        }
    };

    const columns: Column<ChecklistFila>[] = [
        {
            key: 'comunidad',
            label: 'Comunidad',
            hideable: false,
            getSearchValue: row => [row.comunidad, row.nombre, row.plantilla, row.descripcion].join(' '),
            render: row => (
                <div className="flex items-start gap-3">
                    <span className="mt-1 h-3.5 w-1.5 rounded-full bg-yellow-400" />
                    <span className="font-semibold">{row.comunidad}</span>
                </div>
            ),
        },
        { key: 'nombre', label: 'Checklist', render: row => <span className="font-medium">{row.nombre}</span> },
        { key: 'plantilla', label: 'Plantilla', render: row => row.plantilla || <span className="text-neutral-400">En blanco</span> },
        {
            key: 'pct',
            label: 'Progreso',
            render: row => (
                <div className="flex items-center gap-2 min-w-[140px]">
                    <div className="flex-1 h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                        <div
                            className={`h-full rounded-full ${row.pct === 100 ? 'bg-green-500' : 'bg-yellow-400'}`}
                            style={{ width: `${row.pct}%` }}
                        />
                    </div>
                    <span className="text-xs font-semibold text-neutral-600 tabular-nums">{row.hechas}/{row.total}</span>
                </div>
            ),
        },
        {
            key: 'created_at',
            label: 'Creado',
            render: row => new Date(row.created_at).toLocaleDateString('es-ES'),
        },
        {
            key: 'activo',
            label: 'Estado',
            render: row => (
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${row.activo ? 'bg-yellow-400 text-neutral-950' : 'bg-neutral-900 text-white'}`}>
                    {row.activo ? 'Activo' : 'Archivado'}
                </span>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Checklists de comunidades"
                onToggleForm={() => setModalNuevo(true)}
                newButtonLabel="Nuevo checklist"
                newButtonShortLabel="Nuevo"
            />

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <FilterBar value={filtroEstado} onChange={setFiltroEstado} options={FILTROS} />
                <div className="w-full sm:w-72 sm:ml-auto">
                    <SearchableSelect
                        options={[{ value: '', label: 'Todas las comunidades' }, ...comunidades.map(c => ({ value: c.id, label: c.nombre }))]}
                        value={filtroComunidad}
                        onChange={v => setFiltroComunidad(v === '' ? '' : Number(v))}
                        placeholder="Filtrar por comunidad"
                    />
                </div>
            </div>

            <DataTable
                data={visibles}
                columns={columns}
                keyExtractor={row => row.id}
                storageKey="checklists"
                loading={cargando}
                emptyMessage="No hay checklists. Crea el primero con «Nuevo checklist»."
                onRowClick={row => router.push(`/dashboard/checklists/${row.id}`)}
                rowActions={row => [
                    { label: 'Abrir', icon: <ExternalLink className="w-4 h-4" />, onClick: () => router.push(`/dashboard/checklists/${row.id}`) },
                    {
                        label: row.activo ? 'Archivar' : 'Reactivar',
                        icon: row.activo ? <Archive className="w-4 h-4" /> : <ArchiveRestore className="w-4 h-4" />,
                        onClick: alternarArchivo,
                        variant: row.activo ? 'warning' : 'success',
                    },
                    { label: 'Eliminar', icon: <Trash2 className="w-4 h-4" />, onClick: setABorrar, variant: 'danger', separator: true },
                ]}
            />

            <NuevoChecklistModal
                isOpen={modalNuevo}
                comunidades={comunidades}
                comunidadInicial={preselect?.comunidadId ?? (filtroComunidad || undefined)}
                onClose={() => setModalNuevo(false)}
                onCreado={id => router.push(`/dashboard/checklists/${id}`)}
            />

            <DeleteConfirmationModal
                isOpen={aBorrar !== null}
                onClose={() => setABorrar(null)}
                onConfirm={confirmarBorrado}
                itemType="checklist"
                description={aBorrar ? `Se eliminará "${aBorrar.nombre}" de ${aBorrar.comunidad} con todas sus tareas. Si solo quieres quitarlo de la vista, mejor archívalo.` : undefined}
                isDeleting={borrando}
            />
        </div>
    );
}
