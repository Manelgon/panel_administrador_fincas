'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'react-hot-toast';
import { Plus, Pencil, Trash2, Check, X, FileCheck, UserCheck, Upload, FileText, Send, AlertTriangle } from 'lucide-react';
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
    JD:  { label: 'JD',  cls: 'bg-teal-100 text-teal-700' },
};

const BOOL_FIELDS: { key: keyof Reunion; label: string; readonly?: boolean }[] = [
    // Documentos
    { key: 'estado_cuentas', label: 'Est. Cuentas', readonly: true },
    { key: 'pto_ordinario',  label: 'Pto. Ord.',    readonly: true },
    { key: 'pto_extra',      label: 'Pto. Extra',   readonly: true },
    { key: 'morosos',        label: 'Morosos',      readonly: true },
    // Método de Envío
    { key: 'citacion_email', label: 'Cit. @',       readonly: true },
    { key: 'citacion_carta', label: 'Cit. Carta',   readonly: true },
    { key: 'acta_email',     label: 'Acta @',       readonly: true },
    { key: 'acta_carta',     label: 'Acta Carta',   readonly: true },
    // Seguimiento
    { key: 'redactar_acta',  label: 'Acta',         readonly: true },
    { key: 'vb_pendiente',   label: 'Vº Bº Presi',  readonly: true },
    { key: 'pasar_acuerdos', label: 'Acuerdos',     readonly: true },
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
    const [envioConfirm, setEnvioConfirm] = useState<{ reunion: Reunion; faltantes: string[] } | null>(null);
    const [isEnviando, setIsEnviando] = useState(false);

    // Filtros
    const [filterResuelto, setFilterResuelto] = useState<'pendiente' | 'resuelto' | 'all'>('pendiente');
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
        if (filterResuelto === 'pendiente' && r.resuelto) return false;
        if (filterResuelto === 'resuelto' && !r.resuelto) return false;
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
        ...BOOL_FIELDS.map(({ key, label, readonly: ro }) => ({
            key,
            label,
            align: 'center' as const,
            render: (r: Reunion) => {
                const locked = ro || r.enviado || r.resuelto;
                return (
                    <button
                        onClick={(e) => { e.stopPropagation(); if (!locked) handleToggle(r, key); }}
                        disabled={locked}
                        className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                            r[key]
                                ? locked ? 'bg-green-400 text-white cursor-not-allowed' : 'bg-green-500 text-white hover:bg-green-600'
                                : locked ? 'bg-neutral-100 text-neutral-200 cursor-not-allowed' : 'bg-neutral-100 text-neutral-300 hover:bg-neutral-200'
                        }`}
                    >
                        {r[key] ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                    </button>
                );
            },
        })),
        {
            key: 'enviado',
            label: 'Enviado',
            align: 'center' as const,
            render: (r: Reunion) => r.enviado
                ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">Sí</span>
                : <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 text-neutral-400">No</span>,
        },
    ];

    const handleAccion = async (reunion: Reunion, field: 'pasar_acuerdos' | 'vb_pendiente' | 'redactar_acta') => {
        if (reunion[field]) return; // Ya está marcado
        setReuniones(prev => prev.map(r => r.id === reunion.id ? { ...r, [field]: true } : r));
        const { error } = await supabase.from('reuniones').update({ [field]: true }).eq('id', reunion.id);
        if (error) {
            toast.error('Error al actualizar');
            setReuniones(prev => prev.map(r => r.id === reunion.id ? { ...r, [field]: false } : r));
        } else {
            const label = field === 'pasar_acuerdos' ? 'Acuerdos pasados' : field === 'vb_pendiente' ? 'Visto bueno registrado' : 'Acta redactada';
            toast.success(label);
        }
    };

    const handleEnviado = (reunion: Reunion) => {
        if (reunion.enviado) return;
        const faltantes = [
            !reunion.redactar_acta && 'Redactar Acta',
            !reunion.vb_pendiente && 'Vº Bº Pendiente',
            !reunion.pasar_acuerdos && 'Pasar Acuerdos',
        ].filter(Boolean) as string[];
        setEnvioConfirm({ reunion, faltantes });
    };

    const confirmarEnvio = async () => {
        if (!envioConfirm) return;
        setIsEnviando(true);
        const { reunion } = envioConfirm;
        const update: Record<string, boolean> = { enviado: true, resuelto: true };
        if (!reunion.redactar_acta) update.redactar_acta = true;
        if (!reunion.vb_pendiente) update.vb_pendiente = true;
        if (!reunion.pasar_acuerdos) update.pasar_acuerdos = true;
        setReuniones(prev => prev.map(r => r.id === reunion.id ? { ...r, ...update } : r));
        const { error } = await supabase.from('reuniones').update(update).eq('id', reunion.id);
        if (error) {
            toast.error('Error al actualizar');
            setReuniones(prev => prev.map(r => r.id === reunion.id ? { ...r, enviado: false, resuelto: false } : r));
        } else {
            toast.success('Acta enviada — reunión marcada como resuelta');
        }
        setIsEnviando(false);
        setEnvioConfirm(null);
    };

    const rowActions = (r: Reunion): RowAction<Reunion>[] => [
        {
            label: r.redactar_acta ? 'Redactar Acta ✓' : 'Redactar Acta',
            icon: <FileText className="w-3.5 h-3.5" />,
            variant: r.redactar_acta ? 'success' : 'default',
            disabled: r.redactar_acta,
            onClick: (row) => handleAccion(row, 'redactar_acta'),
        },
        {
            label: r.vb_pendiente ? 'Vº Bº Presi ✓' : 'Vº Bº Presi',
            icon: <UserCheck className="w-3.5 h-3.5" />,
            variant: r.vb_pendiente ? 'success' : 'default',
            disabled: r.vb_pendiente,
            onClick: (row) => handleAccion(row, 'vb_pendiente'),
        },
        {
            label: r.pasar_acuerdos ? 'Pasar Acuerdos ✓' : 'Pasar Acuerdos',
            icon: <FileCheck className="w-3.5 h-3.5" />,
            variant: r.pasar_acuerdos ? 'success' : 'default',
            disabled: r.pasar_acuerdos,
            onClick: (row) => handleAccion(row, 'pasar_acuerdos'),
        },
        {
            label: r.enviado ? 'Enviado ✓' : 'Enviado',
            icon: <Send className="w-3.5 h-3.5" />,
            variant: r.enviado ? 'success' : 'default',
            disabled: r.enviado,
            onClick: (row) => handleEnviado(row),
            separator: true,
        },
        {
            label: 'Editar',
            icon: <Pencil className="w-3.5 h-3.5" />,
            disabled: r.enviado || r.resuelto,
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
                <option value="JD">JD — Junta Directiva</option>
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
        <div className="space-y-6">
            <div className="flex justify-between items-center gap-3">
                <h1 className="text-xl font-bold text-neutral-900 min-w-0 truncate">Reuniones y Actas</h1>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                        onClick={() => setShowImportModal(true)}
                        className="border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 px-3 py-2 rounded-xl flex items-center gap-1.5 transition font-semibold text-sm shadow-sm"
                    >
                        <Upload className="w-4 h-4 flex-shrink-0" />
                        <span className="hidden sm:inline">Importar Excel</span>
                        <span className="sm:hidden">Importar</span>
                    </button>
                    <button
                        onClick={() => { setEditingId(null); setShowForm(true); }}
                        className="bg-yellow-400 hover:bg-yellow-500 text-neutral-950 px-3 py-2 rounded-xl flex items-center gap-1.5 transition font-semibold text-sm shadow-sm"
                    >
                        <Plus className="w-4 h-4 flex-shrink-0" />
                        <span className="hidden sm:inline">Nueva Reunión</span>
                        <span className="sm:hidden">Nueva</span>
                    </button>
                </div>
            </div>

            {/* Tabs Pendientes / Resueltas / Todas */}
            <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-2">
                <button
                    onClick={() => setFilterResuelto('pendiente')}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition ${filterResuelto === 'pendiente' ? 'bg-amber-400 text-neutral-950' : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'}`}
                >
                    Pendientes
                </button>
                <button
                    onClick={() => setFilterResuelto('resuelto')}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition ${filterResuelto === 'resuelto' ? 'bg-green-500 text-white' : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'}`}
                >
                    Resueltas
                </button>
                <button
                    onClick={() => setFilterResuelto('all')}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition ${filterResuelto === 'all' ? 'bg-neutral-900 text-white' : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'}`}
                >
                    Todas
                </button>
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

            {/* Modal Confirmar Envío */}
            {envioConfirm && createPortal(
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-end sm:items-center sm:justify-center sm:p-4">
                    <div
                        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="mb-5 text-center">
                            <div className={`mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-3 ${envioConfirm.faltantes.length > 0 ? 'bg-amber-50' : 'bg-green-50'}`}>
                                {envioConfirm.faltantes.length > 0
                                    ? <AlertTriangle className="w-7 h-7 text-amber-500" />
                                    : <Send className="w-7 h-7 text-green-500" />
                                }
                            </div>
                            <h3 className="text-lg font-black text-neutral-900 tracking-tight">
                                {envioConfirm.faltantes.length > 0 ? 'Tareas pendientes' : 'Confirmar envío'}
                            </h3>
                            {envioConfirm.faltantes.length > 0 ? (
                                <div className="mt-2 text-sm text-neutral-600">
                                    <p className="mb-2">Las siguientes tareas no están completadas:</p>
                                    <ul className="text-left inline-block space-y-1">
                                        {envioConfirm.faltantes.map(f => (
                                            <li key={f} className="flex items-center gap-2 text-amber-700 font-semibold">
                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                                                {f}
                                            </li>
                                        ))}
                                    </ul>
                                    <p className="mt-3 text-neutral-500">¿Quieres marcarlas como completadas y enviar el acta?</p>
                                </div>
                            ) : (
                                <p className="mt-2 text-sm text-neutral-500">¿Confirmas que quieres enviar el acta?</p>
                            )}
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setEnvioConfirm(null)}
                                disabled={isEnviando}
                                className="flex-1 h-11 border border-neutral-200 text-neutral-600 rounded-xl hover:bg-neutral-50 font-bold text-xs uppercase tracking-widest transition"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmarEnvio}
                                disabled={isEnviando}
                                className={`flex-1 h-11 rounded-xl font-black text-xs uppercase tracking-widest transition disabled:opacity-50 flex items-center justify-center gap-2 text-white ${envioConfirm.faltantes.length > 0 ? 'bg-amber-500 hover:bg-amber-600' : 'bg-green-600 hover:bg-green-700'}`}
                            >
                                {isEnviando ? <><Send className="w-4 h-4 animate-pulse" />Enviando...</> : <><Send className="w-4 h-4" />Enviar Acta</>}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
