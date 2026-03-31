'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import DataTable, { Column } from '@/components/DataTable';
import SearchableSelect from '@/components/SearchableSelect';
import { FileDown, Download, Calendar } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface ActivityLog {
    id: number;
    user_name: string;
    action: string;
    entity_type: string;
    entity_id: number;
    entity_name: string;
    details: any;
    created_at: string;
}

export default function ActividadPage() {
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [isExporting, setIsExporting] = useState(false);

    // Filters
    const [filterUser, setFilterUser] = useState('all');
    const [filterAction, setFilterAction] = useState('all');
    const [filterType, setFilterType] = useState('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        setLoading(true);
        let allLogs: ActivityLog[] = [];
        let from = 0;
        let to = 999;
        let finished = false;

        const BATCH_SIZE = 1000;

        while (!finished) {
            const { data, error } = await supabase
                .from('activity_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .range(from, to);

            if (error) {
                console.error('Error fetching logs:', error);
                finished = true;
            } else if (data && data.length > 0) {
                allLogs = [...allLogs, ...data];
                if (data.length < BATCH_SIZE) {
                    finished = true;
                } else {
                    from += BATCH_SIZE;
                    to += BATCH_SIZE;
                }
            } else {
                finished = true;
            }
        }

        setLogs(allLogs);
        setLoading(false);
    };

    const handleExport = async (type: 'csv' | 'pdf') => {
        if (selectedIds.size === 0) return toast.error('Selecciona al menos un registro');

        setIsExporting(true);
        const loadingToast = toast.loading(`Generando ${type.toUpperCase()}...`);

        try {
            const response = await fetch('/api/actividad/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ids: Array.from(selectedIds),
                    type
                })
            });

            if (!response.ok) throw new Error('Error al exportar');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const now = new Date();
            const dateStr = `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`;
            a.download = `actividad_${dateStr}.${type}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            toast.success('Exportación completada', { id: loadingToast });
        } catch (error) {
            console.error(error);
            toast.error('Error al exportar', { id: loadingToast });
        } finally {
            setIsExporting(false);
        }
    };

    // ... getActionLabel, getEntityLabel, getActionColor ...
    const getActionLabel = (action: string, details?: any) => {
        // Special case for resolved incidents
        if (action === 'update' && details) {
            try {
                const parsed = typeof details === 'string' ? JSON.parse(details) : details;
                if (parsed.resuelto === true || parsed.Resuelto === true) return 'Resuelto';
            } catch (e) { }
        }

        const labels: Record<string, string> = {
            create: 'Crear',
            update: 'Actualizar',
            delete: 'Eliminado',
            mark_paid: 'Marcar Pagado',
            toggle_active: 'Cambiar Estado',
            clock_in: 'Fichaje Entrada',
            clock_out: 'Fichaje Salida',
            generate: 'Generar',
            read: 'Leído',
        };
        return labels[action] || action;
    };

    const getEntityLabel = (entityType: string) => {
        const labels: Record<string, string> = {
            comunidad: 'Comunidad',
            incidencia: 'Incidencia',
            morosidad: 'Morosidad',
            profile: 'Perfil de Usuario',
            fichaje: 'Control Horario',
            documento: 'Documento',
            aviso: 'Aviso',
        };
        return labels[entityType] || entityType;
    };

    const getActionColor = (action: string, label?: string) => {
        if (label === 'Resuelto') return 'bg-emerald-100 text-emerald-800';

        const colors: Record<string, string> = {
            create: 'bg-green-100 text-green-800',
            update: 'bg-blue-100 text-blue-800',
            delete: 'bg-red-100 text-red-800',
            mark_paid: 'bg-yellow-100 text-yellow-800',
            toggle_active: 'bg-purple-100 text-purple-800',
            clock_in: 'bg-emerald-100 text-emerald-800',
            clock_out: 'bg-amber-100 text-amber-800',
            generate: 'bg-indigo-100 text-indigo-800',
            read: 'bg-neutral-100 text-neutral-800',
        };
        return colors[action] || 'bg-gray-100 text-gray-800';
    };

    const columns: Column<ActivityLog>[] = [
        {
            key: 'created_at',
            label: 'Fecha',
            render: (row) => new Date(row.created_at).toLocaleString('es-ES', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
            }),
        },
        {
            key: 'user_name',
            label: 'Usuario',
        },
        {
            key: 'action',
            label: 'Acción',
            render: (row) => {
                const label = getActionLabel(row.action, row.details);
                return (
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getActionColor(row.action, label)}`}>
                        {label}
                    </span>
                );
            },
            getSearchValue: (row) => getActionLabel(row.action, row.details),
        },
        {
            key: 'entity_type',
            label: 'Tipo',
            render: (row) => getEntityLabel(row.entity_type),
            getSearchValue: (row) => getEntityLabel(row.entity_type),
        },
        {
            key: 'entity_name',
            label: 'Entidad',
            render: (row) => row.entity_name || '-',
        },
        {
            key: 'details',
            label: 'Detalles',
            getSearchValue: (row) => {
                if (!row.details) return '';
                try {
                    const details = typeof row.details === 'string' ? JSON.parse(row.details) : row.details;
                    return Object.entries(details).map(([k, v]) => `${k}: ${v}`).join(' ');
                } catch { return ''; }
            },
            render: (row) => {
                if (!row.details) return '-';
                try {
                    const details = typeof row.details === 'string' ? JSON.parse(row.details) : row.details;
                    if (Object.keys(details).length === 0) return '-';
                    return (
                        <div className="flex flex-col gap-1 text-xs">
                            {Object.entries(details).map(([key, value]) => (
                                <div key={key} className="flex items-start gap-1">
                                    <span className="font-semibold text-neutral-600 capitalize">
                                        {key.replace(/_/g, ' ')}:
                                    </span>
                                    <span className="text-neutral-900 truncate max-w-[200px]" title={String(value)}>
                                        {String(value)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    );
                } catch { return '-'; }
            },
        },
    ];

    // Filter Logic
    const filteredLogs = logs.filter(log => {
        const matchesUser = filterUser === 'all' ? true : log.user_name === filterUser;
        const matchesAction = filterAction === 'all' ? true : log.action === filterAction;
        const matchesType = filterType === 'all' ? true : log.entity_type === filterType;

        const lDate = new Date(log.created_at);
        const logDateStr = `${lDate.getFullYear()}-${String(lDate.getMonth() + 1).padStart(2, '0')}-${String(lDate.getDate()).padStart(2, '0')}`;

        let matchesDate = true;
        if (dateFrom) {
            matchesDate = matchesDate && logDateStr >= dateFrom;
        }
        if (dateTo) {
            matchesDate = matchesDate && logDateStr <= dateTo;
        }

        return matchesUser && matchesAction && matchesType && matchesDate;
    });

    const uniqueUsers = Array.from(new Set(logs.map(l => l.user_name))).filter(Boolean).sort();
    const uniqueActions = Array.from(new Set(logs.map(l => l.action))).filter(Boolean).sort();
    const uniqueTypes = Array.from(new Set(logs.map(l => l.entity_type))).filter(Boolean).sort();

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-xl font-bold text-neutral-900">Registro de Actividad</h1>

                <div className="flex items-center gap-2">
                    {selectedIds.size > 0 && (
                        <span className="text-xs font-medium text-neutral-500 mr-2">
                            {selectedIds.size} seleccionados
                        </span>
                    )}
                    <button
                        onClick={() => handleExport('csv')}
                        disabled={selectedIds.size === 0 || isExporting}
                        className="flex items-center gap-2 bg-white border border-neutral-300 text-neutral-700 px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-neutral-50 transition disabled:opacity-50"
                    >
                        <Download className="w-4 h-4" />
                        CSV
                    </button>
                    <button
                        onClick={() => handleExport('pdf')}
                        disabled={selectedIds.size === 0 || isExporting}
                        className="flex items-center gap-2 bg-neutral-900 text-white px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-neutral-800 transition disabled:opacity-50"
                    >
                        <FileDown className="w-4 h-4" />
                        PDF
                    </button>
                </div>
            </div>

            <DataTable
                data={filteredLogs}
                columns={columns}
                keyExtractor={(row) => row.id}
                storageKey="actividad"
                loading={loading}
                emptyMessage="No hay registros de actividad"
                selectable={true}
                selectedKeys={selectedIds}
                onSelectionChange={(keys) => setSelectedIds(keys as Set<number>)}
                extraFilters={
                    <div className="flex items-center gap-2">
                        <SearchableSelect
                            value={filterUser === 'all' ? '' : filterUser}
                            onChange={(val) => setFilterUser(val === '' ? 'all' : String(val))}
                            options={uniqueUsers.map(u => ({ value: u, label: u }))}
                            placeholder="Todos los Usuarios"
                            className="w-[160px]"
                        />
                        <SearchableSelect
                            value={filterAction === 'all' ? '' : filterAction}
                            onChange={(val) => setFilterAction(val === '' ? 'all' : String(val))}
                            options={uniqueActions.map(a => ({ value: a, label: getActionLabel(a) }))}
                            placeholder="Todas las Acciones"
                            className="w-[160px]"
                        />
                        <SearchableSelect
                            value={filterType === 'all' ? '' : filterType}
                            onChange={(val) => setFilterType(val === '' ? 'all' : String(val))}
                            options={uniqueTypes.map(t => ({ value: t, label: getEntityLabel(t) }))}
                            placeholder="Todos los Tipos"
                            className="w-[160px]"
                        />
                        <div className="flex items-center gap-1 bg-white border border-neutral-300 rounded-md px-2 h-[38px]">
                            <Calendar className="w-4 h-4 text-neutral-400" />
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="text-sm outline-none border-none bg-transparent"
                                placeholder="Desde"
                            />
                            <span className="text-neutral-400">-</span>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="text-sm outline-none border-none bg-transparent"
                                placeholder="Hasta"
                            />
                        </div>
                    </div>
                }
            />
        </div>
    );
}
