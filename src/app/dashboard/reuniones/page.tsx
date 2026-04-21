'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'react-hot-toast';
import { Pencil, Trash2, Check, X, Upload, Send, AlertTriangle, MoreVertical, Clock, CheckCircle2 } from 'lucide-react';
import DataTable, { Column, RowAction } from '@/components/DataTable';
import SearchableSelect from '@/components/SearchableSelect';
import DeleteConfirmationModal from '@/components/DeleteConfirmationModal';
import PageHeader from '@/components/PageHeader';
import FilterBar from '@/components/FilterBar';
import { logActivity } from '@/lib/logActivity';
import { Reunion, ComunidadOption, Profile } from '@/lib/schemas';
import { useGlobalLoading } from '@/lib/globalLoading';
import ReunionFormModal from './ReunionFormModal';
import ImportReunionesModal from '@/components/ImportReunionesModal';
import ConfirmarReunionTicketsModal from './ConfirmarReunionTicketsModal';

const TIPO_LABELS: Record<string, { label: string; cls: string }> = {
    JGO: { label: 'JGO', cls: 'bg-blue-100 text-blue-700' },
    JGE: { label: 'JGE', cls: 'bg-orange-100 text-orange-700' },
    JV:  { label: 'JV',  cls: 'bg-purple-100 text-purple-700' },
    JD:  { label: 'JD',  cls: 'bg-teal-100 text-teal-700' },
};

const BOOL_FIELDS: { key: keyof Reunion; label: string; readonly?: boolean }[] = [
    // Documentos
    { key: 'estado_cuentas', label: 'Est. Cuentas' },
    { key: 'pto_ordinario',  label: 'Pto. Ord.'    },
    { key: 'informe_incidencias', label: 'Inf. Incidencias' },
    { key: 'morosos',        label: 'Morosos'      },
    // Citación
    { key: 'citacion_email', label: 'Cit. @'       },
    { key: 'citacion_carta', label: 'Cit. Carta'   },
    // Acta
    { key: 'borrador_acta',  label: 'Borrador Acta' },
    { key: 'redactar_acta',  label: 'Redactar Acta' },
    { key: 'vb_pendiente',   label: 'Vº Bº Presi'  },
    { key: 'imprimir_acta',  label: 'Imprimir Acta' },
    { key: 'acta_email',     label: 'Acta @'        },
    { key: 'acta_carta',     label: 'Acta Carta'    },
    // Cierre
    { key: 'pasar_acuerdos', label: 'Acuerdos'     },
];


export default function ReunionesPage() {
    const { withLoading } = useGlobalLoading();
    const [reuniones, setReuniones] = useState<Reunion[]>([]);
    const [comunidades, setComunidades] = useState<ComunidadOption[]>([]);
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showImportModal, setShowImportModal] = useState(false);
    const [confirmarReunion, setConfirmarReunion] = useState<Reunion | null>(null);
    const [envioConfirm, setEnvioConfirm] = useState<{ reunion: Reunion; noAplica: string[]; realizadas: string[] } | null>(null);
    const [isEnviando, setIsEnviando] = useState(false);

    // Filtros
    const [filterResuelto, setFilterResuelto] = useState<'confirmadas' | 'pendiente' | 'resuelto' | 'all'>('confirmadas');
    const [filterTipo, setFilterTipo] = useState('all');
    const [filterComunidad, setFilterComunidad] = useState('all');
    const [filterAnio, setFilterAnio] = useState('all');

    useEffect(() => {
        fetchAll();
    }, []);

    const fetchAll = async () => {
        setLoading(true);
        await Promise.all([fetchReuniones(), fetchComunidades(), fetchProfiles()]);
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

    const fetchProfiles = async () => {
        const { data } = await supabase
            .from('profiles')
            .select('user_id, nombre, rol')
            .order('nombre', { ascending: true });
        if (data) setProfiles(data);
    };

    const handleToggle = async (reunion: Reunion, field: keyof Reunion) => {
        if (!reunion.confirmada || reunion.enviado || reunion.resuelto) return;
        const current = reunion[field] as boolean | null;
        const newVal = current === null ? true : current === true ? false : null;
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
                prev.map(r => r.id === reunion.id ? { ...r, [field]: current } : r)
            );
        }
    };

    const handleConfirmar = (reunion: Reunion) => {
        if (reunion.confirmada) return;
        setConfirmarReunion(reunion);
    };

    const onReunionConfirmada = () => {
        if (!confirmarReunion) return;
        setReuniones(prev => prev.map(r => r.id === confirmarReunion.id ? { ...r, confirmada: true } : r));
        setConfirmarReunion(null);
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        await withLoading(async () => {
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
        }, 'Eliminando reunión...');
    };

    // Años únicos para el filtro
    const anios = Array.from(new Set(reuniones.map(r => r.fecha_reunion?.slice(0, 4)).filter(Boolean))).sort((a, b) => b.localeCompare(a));

    // Filtrado
    const filtered = reuniones.filter(r => {
        if (filterResuelto === 'confirmadas' && !(r.confirmada && !r.resuelto && !r.enviado)) return false;
        if (filterResuelto === 'pendiente' && r.confirmada) return false;
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
        {
            key: 'confirmada',
            label: 'Estado',
            align: 'center' as const,
            sortable: true,
            render: (r: Reunion) => {
                if (r.resuelto) {
                    return (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">
                            <Check className="w-2.5 h-2.5" />Resuelta
                        </span>
                    );
                }
                if (r.confirmada) {
                    return (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                            <CheckCircle2 className="w-2.5 h-2.5" />Confirmada
                        </span>
                    );
                }
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                        <Clock className="w-2.5 h-2.5" />Pendiente
                    </span>
                );
            },
        },
        ...BOOL_FIELDS.map(({ key, label }) => ({
            key,
            label,
            align: 'center' as const,
            render: (r: Reunion) => {
                const val = r[key] as boolean | null;
                const locked = !r.confirmada || r.enviado || r.resuelto;
                return (
                    <button
                        onClick={(e) => { e.stopPropagation(); if (!locked) handleToggle(r, key); }}
                        disabled={locked}
                        title={!r.confirmada ? 'Confirma la reunión para editar' : undefined}
                        className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                            val === true
                                ? locked ? 'bg-green-400 text-white cursor-not-allowed' : 'bg-green-500 text-white hover:bg-green-600'
                                : val === false
                                ? locked ? 'bg-red-300 text-white cursor-not-allowed' : 'bg-red-400 text-white hover:bg-red-500'
                                : locked ? 'bg-neutral-100 text-neutral-200 cursor-not-allowed' : 'bg-neutral-100 text-neutral-400 hover:bg-neutral-200'
                        }`}
                    >
                        {val === true
                            ? <Check className="w-3 h-3" />
                            : val === false
                            ? <X className="w-3 h-3" />
                            : <span className="block w-2 h-0.5 bg-current rounded-full" />}
                    </button>
                );
            },
        })),
        {
            key: 'notas',
            label: 'Notas',
            render: (r: Reunion) => (
                <div className="max-w-[120px] sm:max-w-[200px] truncate text-[10px] text-neutral-500" title={r.notas || ''}>
                    {r.notas || '-'}
                </div>
            ),
        },
        {
            key: 'enviado',
            label: 'Enviado',
            align: 'center' as const,
            render: (r: Reunion) => (
                r.enviado
                    ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">Sí</span>
                    : <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 text-neutral-400">No</span>
            ),
        },
        {
            key: 'acciones',
            label: 'Acciones',
            align: 'center' as const,
            hideable: false,
            render: () => (
                <div className="flex justify-center">
                    <button className="p-1 hover:bg-neutral-100 rounded text-neutral-400" title="Acciones">
                        <MoreVertical className="w-4 h-4" />
                    </button>
                </div>
            ),
        },
    ];

    const MANDATORY_KEYS = ['redactar_acta', 'vb_pendiente', 'pasar_acuerdos'];

    const handleEnviado = (reunion: Reunion) => {
        if (reunion.enviado) return;
        const pendientes = BOOL_FIELDS.filter(f => reunion[f.key] === null);
        const noAplica = pendientes.filter(f => !MANDATORY_KEYS.includes(f.key)).map(f => f.label);
        const realizadas = pendientes.filter(f => MANDATORY_KEYS.includes(f.key)).map(f => f.label);
        setEnvioConfirm({ reunion, noAplica, realizadas });
    };

    const confirmarEnvio = async () => {
        if (!envioConfirm) return;
        await withLoading(async () => {
            setIsEnviando(true);
            const { reunion } = envioConfirm;
            const update: Record<string, boolean | null> = { enviado: true, resuelto: true };

            // Todas las que estén pendientes (null) las marcamos como No Aplica (false) por defecto
            BOOL_FIELDS.forEach(f => {
                if (reunion[f.key] === null) {
                    update[f.key] = false;
                }
            });

            // Redactar Acta, Vº Bº Presi y Acuerdos se marcan como obligatorias en true
            const mandatoryKeys = ['redactar_acta', 'vb_pendiente', 'pasar_acuerdos'];
            mandatoryKeys.forEach(key => {
                update[key] = true;
            });

            setReuniones(prev => prev.map(r => r.id === reunion.id ? { ...r, ...update } : r));
            const { error } = await supabase.from('reuniones').update(update).eq('id', reunion.id);
            if (error) {
                toast.error('Error al actualizar');
                setReuniones(prev => prev.map(r => r.id === reunion.id ? { ...r, enviado: false, resuelto: false } : r));
            } else {
                toast.success('Acta enviada — reunión marcada como resuelta');
                await logActivity({
                    action: 'resolve',
                    entityType: 'reunion',
                    entityId: reunion.id,
                    entityName: `${reunion.tipo} - ${reunion.comunidad}`,
                    details: { fecha: reunion.fecha_reunion },
                });
            }
            setIsEnviando(false);
            setEnvioConfirm(null);
        }, 'Enviando acta...');
    };

    const rowActions = (r: Reunion): RowAction<Reunion>[] => [
        ...(!r.confirmada && !r.resuelto ? [{
            label: 'Confirmar reunión',
            icon: <CheckCircle2 className="w-3.5 h-3.5" />,
            variant: 'default' as const,
            onClick: (row: Reunion) => handleConfirmar(row),
        }] : []),
        {
            label: r.enviado ? 'Enviado ✓' : 'Enviar',
            icon: <Send className="w-3.5 h-3.5" />,
            variant: r.enviado ? 'success' : 'default',
            disabled: r.enviado || !r.confirmada,
            onClick: (row) => handleEnviado(row),
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
            separator: true,
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

    const leyenda = (
        <div className="flex items-center gap-1.5 sm:gap-2.5 text-[9px] sm:text-[10px] lg:text-xs text-neutral-500 bg-white px-2 sm:px-3 py-1.5 rounded-lg border border-neutral-200 shadow-sm w-fit">
            <span className="font-bold mr-1 hidden xl:inline">Leyenda:</span>
            <span className="flex items-center gap-1 sm:gap-1.5"><div className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded bg-neutral-100 border border-neutral-200 flex items-center justify-center text-[8px] font-bold text-neutral-400">–</div> Pendiente</span>
            <span className="flex items-center gap-1 sm:gap-1.5"><div className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded bg-green-500 flex items-center justify-center text-[8px] font-bold text-white">✓</div> Hecho</span>
            <span className="flex items-center gap-1 sm:gap-1.5"><div className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded bg-red-400 flex items-center justify-center text-[8px] font-bold text-white">✗</div> No aplica</span>
        </div>
    );

    return (
        <div className="space-y-6">
            <PageHeader
                title="Reuniones y Actas"
                onToggleForm={() => { setEditingId(null); setShowForm(true); }}
                newButtonLabel="Nueva Reunión"
                newButtonShortLabel="Nueva"
                extraButtons={
                    <button
                        onClick={() => setShowImportModal(true)}
                        className="border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 px-3 py-2 rounded-xl flex items-center gap-1.5 transition font-semibold text-sm shadow-sm"
                    >
                        <Upload className="w-4 h-4 flex-shrink-0" />
                        <span className="hidden sm:inline">Importar Excel</span>
                        <span className="sm:hidden">Importar</span>
                    </button>
                }
            />

            <FilterBar
                value={filterResuelto}
                onChange={(v) => setFilterResuelto(v as 'confirmadas' | 'pendiente' | 'resuelto' | 'all')}
                options={[
                    { value: 'confirmadas', label: 'Confirmadas', activeClass: 'bg-blue-500 text-white' },
                    { value: 'pendiente', label: 'Pendientes', activeClass: 'bg-amber-400 text-neutral-950' },
                    { value: 'resuelto', label: 'Resueltas', activeClass: 'bg-green-500 text-white' },
                    { value: 'all', label: 'Todas', activeClass: 'bg-neutral-900 text-white' },
                ]}
            />

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
                headerExtras={leyenda}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
            />

            {/* Modal Confirmar reunión + crear tickets */}
            {confirmarReunion && (
                <ConfirmarReunionTicketsModal
                    reunion={confirmarReunion}
                    onClose={() => setConfirmarReunion(null)}
                    onConfirmed={onReunionConfirmada}
                />
            )}

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
                            <div className={`mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-3 ${(envioConfirm.noAplica.length > 0 || envioConfirm.realizadas.length > 0) ? 'bg-amber-50' : 'bg-green-50'}`}>
                                {(envioConfirm.noAplica.length > 0 || envioConfirm.realizadas.length > 0)
                                    ? <AlertTriangle className="w-7 h-7 text-amber-500" />
                                    : <Send className="w-7 h-7 text-green-500" />
                                }
                            </div>
                            <h3 className="text-lg font-black text-neutral-900 tracking-tight">
                                {(envioConfirm.noAplica.length > 0 || envioConfirm.realizadas.length > 0) ? 'Tareas pendientes' : 'Confirmar envío'}
                            </h3>
                            {(envioConfirm.noAplica.length > 0 || envioConfirm.realizadas.length > 0) ? (
                                <div className="mt-2 text-sm text-neutral-600">
                                    <p className="mb-2">Las siguientes tareas están <strong className="text-amber-800">pendientes</strong>:</p>

                                    {envioConfirm.noAplica.length > 0 && (
                                        <div className="mt-2 text-left">
                                            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">Pasarán a &lsquo;No aplica&rsquo;:</p>
                                            <ul className="space-y-1">
                                                {envioConfirm.noAplica.map((f: string) => (
                                                    <li key={f} className="flex items-center gap-2 text-red-600 font-semibold">
                                                        <X className="w-3 h-3 shrink-0" />
                                                        {f}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {envioConfirm.realizadas.length > 0 && (
                                        <div className="mt-3 text-left">
                                            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">Pasarán a &lsquo;Realizada&rsquo;:</p>
                                            <ul className="space-y-1">
                                                {envioConfirm.realizadas.map((f: string) => (
                                                    <li key={f} className="flex items-center gap-2 text-green-700 font-semibold">
                                                        <Check className="w-3 h-3 shrink-0" />
                                                        {f}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
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
                                className={`flex-1 h-11 rounded-xl font-black text-xs uppercase tracking-widest transition disabled:opacity-50 flex items-center justify-center gap-2 text-white ${(envioConfirm.noAplica.length > 0 || envioConfirm.realizadas.length > 0) ? 'bg-amber-500 hover:bg-amber-600' : 'bg-green-600 hover:bg-green-700'}`}
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
