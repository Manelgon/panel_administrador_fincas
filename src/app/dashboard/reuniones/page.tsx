'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'react-hot-toast';
import { Plus, Pencil, Trash2, Check, X, FileCheck, UserCheck, Upload } from 'lucide-react';
import DataTable, { Column, RowAction } from '@/components/DataTable';
import SearchableSelect from '@/components/SearchableSelect';
import DeleteConfirmationModal from '@/components/DeleteConfirmationModal';
import { logActivity } from '@/lib/logActivity';
import { Reunion, ComunidadOption } from '@/lib/schemas';
import ReunionFormModal from './ReunionFormModal';
import ImportReunionesModal from '@/components/ImportReunionesModal';

const TIPO_LABELS: Record<string, { label: string; cls: string }> = {
    JGO: { label: 'JGO', cls: 'bg-blue-100 text-blue-700' },
    JGE: { label: 'JGE', cls: 'bg-orange-100 text-orange-700' },
    JV:  { label: 'JV',  cls: 'bg-purple-100 text-purple-700' },
};

const BOOL_FIELDS: { key: keyof Reunion; label: string }[] = [
    { key: 'estado_cuentas', label: 'Est. Cuentas' },
    { key: 'pto_ordinario',  label: 'Pto. Ord.' },
    { key: 'pto_extra',      label: 'Pto. Extra' },
    { key: 'morosos',        label: 'Morosos' },
    { key: 'citacion_email', label: 'Cit. @' },
    { key: 'citacion_carta', label: 'Cit. Carta' },
    { key: 'redactar_acta',  label: 'Acta' },
    { key: 'vb_pendiente',   label: 'Vº Bº Pdt.' },
    { key: 'acta_email',     label: 'Acta @' },
    { key: 'acta_carta',     label: 'Acta Carta' },
    { key: 'pasar_acuerdos', label: 'Acuerdos' },
];

export default function ReunionesPage() {
    const [reuniones, setReuniones] = useState<Reunion[]>([]);
    const [comunidades, setComunidades] = useState<ComunidadOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showImportModal, setShowImportModal] = useState(false);

    // Filtros
    const [filterTipo, setFilterTipo] = useState('all');
    const [filterComunidad, setFilterComunidad] = useState('all');
    const [filterAnio, setFilterAnio] = useState('all');

    useEffect(() => {
        fetchAll();
    }, []);

    const fetchAll = async () => {
        setLoading(true);
        await Promise.all([fetchReuniones(), fetchComunidades()]);
        setLoading(false);
    };

    const fetchReuniones = async () => {
        const { data, error } = await supabase
            .from('reuniones')
            .select('*, comunidades(nombre_cdad, codigo)')
            .order('fecha_reunion', { ascending: false });
        if (error) {
            toast.error('Error cargando reuniones');
        } else {
            const formatted = (data || []).map((r: any) => ({
                ...r,
                comunidad: r.comunidades?.nombre_cdad || '',
                codigo: r.comunidades?.codigo || '',
            }));
            setReuniones(formatted);
        }
    };

    const fetchComunidades = async () => {
        const { data } = await supabase
            .from('comunidades')
            .select('id, nombre_cdad, codigo')
            .eq('activo', true)
            .order('codigo', { ascending: true });
        if (data) setComunidades(data);
    };

    const handleToggle = async (reunion: Reunion, field: keyof Reunion) => {
        const newVal = !reunion[field];
        setReuniones(prev =>
            prev.map(r => r.id === reunion.id ? { ...r, [field]: newVal } : r)
        );
        const { error } = await supabase
            .from('reuniones')
            .update({ [field]: newVal })
            .eq('id', reunion.id);
        if (error) {
            toast.error('Error al actualizar');
            setReuniones(prev =>
                prev.map(r => r.id === reunion.id ? { ...r, [field]: !newVal } : r)
            );
        }
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        setIsDeleting(true);
        const target = reuniones.find(r => r.id === deleteId);
        const { error } = await supabase.from('reuniones').delete().eq('id', deleteId);
        if (error) {
            toast.error('Error al eliminar la reunión');
        } else {
            toast.success('Reunión eliminada');
            await logActivity({ action: 'delete', entityType: 'reunion', entityId: deleteId, entityName: `${target?.tipo} - ${target?.comunidad}` });
            setReuniones(prev => prev.filter(r => r.id !== deleteId));
        }
        setIsDeleting(false);
        setShowDeleteModal(false);
        setDeleteId(null);
    };

    // Años únicos para el filtro
    const anios = Array.from(new Set(reuniones.map(r => r.fecha_reunion?.slice(0, 4)).filter(Boolean))).sort((a, b) => b.localeCompare(a));

    // Filtrado
    const filtered = reuniones.filter(r => {
        if (filterTipo !== 'all' && r.tipo !== filterTipo) return false;
        if (filterComunidad !== 'all' && String(r.comunidad_id) !== filterComunidad) return false;
        if (filterAnio !== 'all' && r.fecha_reunion?.slice(0, 4) !== filterAnio) return false;
        return true;
    });

    const columns: Column<Reunion>[] = [
        {
            key: 'comunidad',
            label: 'Comunidad',
            sortable: true,
            render: (r) => (
                <div className="font-semibold text-neutral-900 text-xs">
                    {r.codigo ? <span className="text-neutral-400 mr-1">{r.codigo}</span> : null}
                    {r.comunidad}
                </div>
            ),
        },
        {
            key: 'fecha_reunion',
            label: 'Fecha',
            sortable: true,
            render: (r) => (
                <span className="text-xs text-neutral-700">
                    {r.fecha_reunion ? new Date(r.fecha_reunion + 'T00:00:00').toLocaleDateString('es-ES') : '-'}
                </span>
            ),
        },
        {
            key: 'tipo',
            label: 'Tipo',
            sortable: true,
            align: 'center',
            render: (r) => {
                const t = TIPO_LABELS[r.tipo] ?? { label: r.tipo, cls: 'bg-neutral-100 text-neutral-700' };
                return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${t.cls}`}>{t.label}</span>;
            },
        },
        ...BOOL_FIELDS.map(({ key, label }) => ({
            key,
            label,
            align: 'center' as const,
            render: (r: Reunion) => (
                <button
                    onClick={(e) => { e.stopPropagation(); handleToggle(r, key); }}
                    className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                        r[key]
                            ? 'bg-green-500 text-white hover:bg-green-600'
                            : 'bg-neutral-100 text-neutral-300 hover:bg-neutral-200'
                    }`}
                >
                    {r[key] ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                </button>
            ),
        })),
    ];

    const handleAccion = async (reunion: Reunion, field: 'pasar_acuerdos' | 'vb_pendiente') => {
        if (reunion[field]) return; // Ya está marcado
        setReuniones(prev => prev.map(r => r.id === reunion.id ? { ...r, [field]: true } : r));
        const { error } = await supabase.from('reuniones').update({ [field]: true }).eq('id', reunion.id);
        if (error) {
            toast.error('Error al actualizar');
            setReuniones(prev => prev.map(r => r.id === reunion.id ? { ...r, [field]: false } : r));
        } else {
            const label = field === 'pasar_acuerdos' ? 'Acuerdos pasados' : 'Visto bueno registrado';
            toast.success(label);
        }
    };

    const rowActions = (r: Reunion): RowAction<Reunion>[] => [
        {
            label: r.pasar_acuerdos ? 'Acuerdos ✓' : 'Pasar Acuerdo',
            icon: <FileCheck className="w-3.5 h-3.5" />,
            variant: r.pasar_acuerdos ? 'success' : 'default',
            disabled: r.pasar_acuerdos,
            onClick: (row) => handleAccion(row, 'pasar_acuerdos'),
        },
        {
            label: r.vb_pendiente ? 'Vº Bº ✓' : 'Visto Bueno Pdte.',
            icon: <UserCheck className="w-3.5 h-3.5" />,
            variant: r.vb_pendiente ? 'success' : 'default',
            disabled: r.vb_pendiente,
            onClick: (row) => handleAccion(row, 'vb_pendiente'),
            separator: true,
        },
        {
            label: 'Editar',
            icon: <Pencil className="w-3.5 h-3.5" />,
            onClick: (row) => { setEditingId(row.id); setShowForm(true); },
        },
        {
            label: 'Eliminar',
            icon: <Trash2 className="w-3.5 h-3.5" />,
            variant: 'danger',
            onClick: (row) => { setDeleteId(row.id); setShowDeleteModal(true); },
        },
    ];

    const extraFilters = (
        <div className="flex flex-wrap gap-2">
            <select
                value={filterTipo}
                onChange={e => setFilterTipo(e.target.value)}
                className="text-xs border border-neutral-200 rounded-lg px-3 py-1.5 bg-white text-neutral-700 focus:outline-none focus:ring-2 focus:ring-[#bf4b50]/30"
            >
                <option value="all">Todos los tipos</option>
                <option value="JGO">JGO — Junta General Ordinaria</option>
                <option value="JGE">JGE — Junta General Extraordinaria</option>
                <option value="JV">JV — Junta de Vocales</option>
            </select>
            <select
                value={filterComunidad}
                onChange={e => setFilterComunidad(e.target.value)}
                className="text-xs border border-neutral-200 rounded-lg px-3 py-1.5 bg-white text-neutral-700 focus:outline-none focus:ring-2 focus:ring-[#bf4b50]/30"
            >
                <option value="all">Todas las comunidades</option>
                {comunidades.map(c => (
                    <option key={c.id} value={String(c.id)}>
                        {c.codigo ? `${c.codigo} - ` : ''}{c.nombre_cdad}
                    </option>
                ))}
            </select>
            <select
                value={filterAnio}
                onChange={e => setFilterAnio(e.target.value)}
                className="text-xs border border-neutral-200 rounded-lg px-3 py-1.5 bg-white text-neutral-700 focus:outline-none focus:ring-2 focus:ring-[#bf4b50]/30"
            >
                <option value="all">Todos los años</option>
                {anios.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
        </div>
    );

    return (
        <div className="p-4 sm:p-6 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-white tracking-tight">Reuniones</h1>
                    <p className="text-xs text-neutral-400 font-semibold uppercase tracking-widest mt-0.5">
                        Administración de juntas y reuniones
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowImportModal(true)}
                        className="border border-neutral-600 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-3 py-2 rounded-lg flex items-center gap-1.5 transition font-semibold text-xs shadow-sm"
                    >
                        <Upload className="w-4 h-4 flex-shrink-0" />
                        <span className="hidden sm:inline">Importar Excel</span>
                        <span className="sm:hidden">Importar</span>
                    </button>
                    <button
                        onClick={() => { setEditingId(null); setShowForm(true); }}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-900 rounded-lg text-xs font-bold transition shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        Nueva Reunión
                    </button>
                </div>
            </div>

            {/* Tabla */}
            <DataTable<Reunion>
                data={filtered}
                columns={columns}
                keyExtractor={r => r.id}
                storageKey="reuniones-table"
                loading={loading}
                emptyMessage="No hay reuniones registradas"
                rowActions={rowActions}
                extraFilters={extraFilters}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
            />

            {/* Modal Formulario */}
            {showForm && (
                <ReunionFormModal
                    show={showForm}
                    editingId={editingId}
                    comunidades={comunidades}
                    onClose={() => { setShowForm(false); setEditingId(null); }}
                    onSaved={fetchReuniones}
                />
            )}

            {/* Modal Importar */}
            {showImportModal && (
                <ImportReunionesModal
                    comunidades={comunidades}
                    onClose={() => setShowImportModal(false)}
                    onImported={() => { fetchReuniones(); setShowImportModal(false); }}
                />
            )}

            {/* Modal Eliminar */}
            <DeleteConfirmationModal
                isOpen={showDeleteModal}
                onClose={() => { setShowDeleteModal(false); setDeleteId(null); }}
                onConfirm={handleDelete}
                isDeleting={isDeleting}
                title="Eliminar reunión"
                description="¿Seguro que quieres eliminar esta reunión? Esta acción no se puede deshacer."
            />
        </div>
    );
}
