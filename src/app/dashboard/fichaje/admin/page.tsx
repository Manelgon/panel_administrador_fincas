'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'react-hot-toast';
import { Users, Calendar, Filter, X, Clock } from 'lucide-react';
import DataTable, { Column } from '@/components/DataTable';
import SearchableSelect from '@/components/SearchableSelect';
import { logActivity } from '@/lib/logActivity';
import EmployeeResume from '@/components/fichaje/EmployeeResume';
import VacationManager from './VacationManager';
import ModalPortal from '@/components/ModalPortal';

interface TimeEntryWithProfile {
    id: number;
    user_id: string;
    start_at: string;
    end_at: string | null;
    note: string | null;
    created_at: string;
    profiles?: {
        nombre: string;
        apellido: string | null;
        rol: string;
        email: string;
    };
}

interface Profile {
    user_id: string;
    nombre: string;
    apellido: string | null;
    rol: string;
}

export default function FichajeAdminPage() {
    const [entries, setEntries] = useState<TimeEntryWithProfile[]>([]);
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [activeTab, setActiveTab] = useState<'control' | 'reports' | 'vacations'>('control');
    const [selectedUserForReport, setSelectedUserForReport] = useState<string | null>(null);

    // Filters
    const [filterUser, setFilterUser] = useState('all');
    const [filterRol, setFilterRol] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');

    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [sessionToClose, setSessionToClose] = useState<string | null>(null);
    const [isClosing, setIsClosing] = useState(false);

    const [settings, setSettings] = useState({
        auto_close_enabled: true,
        max_hours_duration: 12,
        max_minutes_duration: 0,
        daily_execution_hour: 17
    });
    const [savingSettings, setSavingSettings] = useState(false);

    useEffect(() => {
        checkAdminAndFetch();
    }, []);

    const checkAdminAndFetch = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            const { data } = await supabase
                .from('profiles')
                .select('rol')
                .eq('user_id', session.user.id)
                .single();

            if (data?.rol === 'admin') {
                setIsAdmin(true);
                await fetchData();
            } else {
                toast.error('Acceso denegado: solo administradores');
            }
        }
        setLoading(false);
    };

    const fetchData = async () => {
        setLoading(true);
        await Promise.all([fetchProfiles(), fetchEntries(), fetchSettings()]);
        setLoading(false);
    };

    const fetchSettings = async () => {
        const { data, error } = await supabase
            .from('fichaje_settings')
            .select('*')
            .single();

        if (data) {
            setSettings({
                auto_close_enabled: data.auto_close_enabled,
                max_hours_duration: data.max_hours_duration,
                max_minutes_duration: data.max_minutes_duration,
                daily_execution_hour: data.daily_execution_hour ?? 17
            });
        }
    };

    const saveSettings = async () => {
        setSavingSettings(true);
        const { error } = await supabase
            .from('fichaje_settings')
            .update({
                auto_close_enabled: settings.auto_close_enabled,
                max_hours_duration: settings.max_hours_duration,
                max_minutes_duration: settings.max_minutes_duration,
                daily_execution_hour: settings.daily_execution_hour,
                updated_at: new Date().toISOString()
            })
            .eq('id', 1); // Singleton

        if (error) {
            toast.error('Error al guardar ajustes');
            console.error(error);
        } else {
            toast.success('Ajustes guardados correctamente');
        }
        setSavingSettings(false);
    };

    const fetchProfiles = async () => {
        const { data } = await supabase
            .from('profiles')
            .select('user_id, nombre, apellido, rol')
            .eq('activo', true)
            .order('nombre');

        if (data) setProfiles(data);
    };

    const fetchEntries = async () => {
        const { data, error } = await supabase
            .from('time_entries')
            .select(`
                *,
                profiles:user_id (nombre, apellido, rol, email)
            `)
            .order('start_at', { ascending: false })
            .limit(500);

        if (error) {
            toast.error('Error cargando datos');
            console.error(error);
        } else {
            setEntries(data || []);
        }
    };

    const handleAdminClockOut = (userId: string) => {
        setSessionToClose(userId);
        setShowConfirmModal(true);
    };

    const handleConfirmClose = async () => {
        if (!sessionToClose) return;

        setIsClosing(true);
        const { error } = await supabase.rpc('admin_clock_out', {
            _user_id: sessionToClose
        });

        if (error) {
            toast.error('Error al cerrar sesión: ' + error.message);
        } else {
            toast.success('Sesión cerrada correctamente');

            // Log Activity
            const entry = entries.find(e => e.user_id === sessionToClose && !e.end_at);
            const userName = entry?.profiles?.nombre ? `${entry.profiles.nombre} ${entry.profiles.apellido || ''}` : 'Usuario';

            await logActivity({
                action: 'clock_out',
                entityType: 'fichaje',
                entityId: entry?.id || 0,
                entityName: `Fichaje - ${userName}`,
                details: { method: 'admin_forced', closed_user_id: sessionToClose }
            });

            fetchEntries();
            setShowConfirmModal(false);
            setSessionToClose(null);
        }
        setIsClosing(false);
    };

    const formatDuration = (start: string, end: string | null) => {
        const startTime = new Date(start).getTime();
        const endTime = end ? new Date(end).getTime() : Date.now();
        const totalSeconds = Math.floor((endTime - startTime) / 1000);

        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);

        return `${hours}h ${minutes}m`;
    };

    const filteredEntries = entries.filter(entry => {
        // User filter
        if (filterUser !== 'all' && entry.user_id !== filterUser) return false;

        // Rol filter
        if (filterRol !== 'all' && entry.profiles?.rol !== filterRol) return false;

        // Status filter (open/closed)
        if (filterStatus === 'open' && entry.end_at !== null) return false;
        if (filterStatus === 'closed' && entry.end_at === null) return false;

        // Date filters
        if (filterDateFrom) {
            const entryDate = new Date(entry.start_at);
            const fromDate = new Date(filterDateFrom);
            if (entryDate < fromDate) return false;
        }
        if (filterDateTo) {
            const entryDate = new Date(entry.start_at);
            const toDate = new Date(filterDateTo);
            toDate.setHours(23, 59, 59, 999);
            if (entryDate > toDate) return false;
        }

        return true;
    });

    const columns: Column<TimeEntryWithProfile>[] = [
        {
            key: 'id',
            label: 'ID',
        },
        {
            key: 'nombre',
            label: 'Usuario',
            render: (row) => {
                const nombre = row.profiles?.nombre || '-';
                const apellido = row.profiles?.apellido || '';
                return `${nombre} ${apellido}`.trim();
            },
        },
        {
            key: 'rol',
            label: 'Rol',
            render: (row) => (
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${row.profiles?.rol === 'admin' ? 'bg-purple-100 text-purple-700' :
                    row.profiles?.rol === 'gestor' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                    }`}>
                    {row.profiles?.rol || '-'}
                </span>
            ),
        },
        {
            key: 'fecha',
            label: 'Fecha',
            render: (row) => new Date(row.start_at).toLocaleDateString('es-ES'),
        },
        {
            key: 'start_at',
            label: 'Entrada',
            render: (row) => new Date(row.start_at).toLocaleTimeString('es-ES'),
        },
        {
            key: 'end_at',
            label: 'Salida',
            render: (row) => row.end_at ? (
                new Date(row.end_at).toLocaleTimeString('es-ES')
            ) : (
                <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold">
                        En curso
                    </span>
                    <button
                        onClick={() => handleAdminClockOut(row.user_id)}
                        className="text-xs text-red-600 hover:text-red-800 underline"
                        title="Cerrar sesión manualmente"
                    >
                        Cerrar
                    </button>
                </div>
            ),
        },
        {
            key: 'duration',
            label: 'Duración',
            render: (row) => (
                <span className="font-mono text-sm">{formatDuration(row.start_at, row.end_at)}</span>
            ),
        },
        {
            key: 'note',
            label: 'Nota',
            render: (row) => (
                <div className="max-w-xs truncate text-sm" title={row.note || ''}>
                    {row.note || '-'}
                </div>
            ),
        },
    ];

    if (!isAdmin && !loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <p className="text-xl font-semibold text-red-600">Acceso denegado</p>
                    <p className="text-neutral-600 mt-2">Solo administradores pueden acceder a esta página</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Users className="w-6 h-6 text-yellow-500" />
                    <h1 className="text-xl font-bold text-neutral-900">Fichaje - Administración</h1>
                </div>
                <a
                    href="/dashboard/fichaje"
                    className="bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2"
                >
                    <Clock className="w-4 h-4" />
                    Volver a mi Fichaje
                </a>
            </div>

            {/* TABS */}
            <div className="flex border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('control')}
                    className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'control' ? 'border-yellow-400 text-yellow-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    Control General
                </button>
                <button
                    onClick={() => setActiveTab('reports')}
                    className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'reports' ? 'border-yellow-400 text-yellow-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    Informes y Exportación
                </button>
                <button
                    onClick={() => setActiveTab('vacations')}
                    className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'vacations' ? 'border-yellow-400 text-yellow-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    Gestión de Vacaciones
                </button>
            </div>

            {activeTab === 'control' ? (
                <>
                    {/* SETTINGS PANEL */}
                    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                        <div className="flex items-center gap-2 mb-4 border-b pb-2">
                            <Clock className="w-5 h-5 text-neutral-600" />
                            <h2 className="font-semibold text-neutral-900">Ajustes de Auto-Cierre</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-end">
                            <div className="flex items-center gap-2">
                                <label className="flex items-center cursor-pointer gap-2">
                                    <input
                                        type="checkbox"
                                        className="w-5 h-5 text-yellow-500 rounded focus:ring-yellow-500"
                                        checked={settings.auto_close_enabled}
                                        onChange={(e) => setSettings({ ...settings, auto_close_enabled: e.target.checked })}
                                    />
                                    <span className="text-sm font-medium text-gray-700">Activar Auto-Cierre</span>
                                </label>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Hora Ejecución (0-23h)</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="23"
                                    className="w-full px-3 py-2 border rounded-lg text-sm"
                                    value={settings.daily_execution_hour}
                                    onChange={(e) => setSettings({ ...settings, daily_execution_hour: parseInt(e.target.value) || 0 })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Max. Horas</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="48"
                                    className="w-full px-3 py-2 border rounded-lg text-sm"
                                    value={settings.max_hours_duration}
                                    onChange={(e) => setSettings({ ...settings, max_hours_duration: parseInt(e.target.value) || 0 })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Max. Minutos</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="59"
                                    className="w-full px-3 py-2 border rounded-lg text-sm"
                                    value={settings.max_minutes_duration}
                                    onChange={(e) => setSettings({ ...settings, max_minutes_duration: parseInt(e.target.value) || 0 })}
                                />
                            </div>
                            <div>
                                <button
                                    onClick={saveSettings}
                                    disabled={savingSettings}
                                    className="w-full bg-neutral-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-neutral-800 transition disabled:opacity-50"
                                >
                                    {savingSettings ? 'Guardando...' : 'Guardar Ajustes'}
                                </button>
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            El sistema comprobará los fichajes <strong>1 vez al día a las {settings.daily_execution_hour}:00h</strong>. Si encuentra sesiones que excedan <strong>{settings.max_hours_duration}h {settings.max_minutes_duration}m</strong>, las cerrará automáticamente.
                        </p>
                    </div>

                    {/* Filters */}
                    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                        <div className="flex items-center gap-2 mb-4">
                            <Filter className="w-5 h-5 text-neutral-600" />
                            <h2 className="font-semibold text-neutral-900">Filtros</h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                            {/* User filter */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Usuario</label>
                                <select
                                    className="w-full px-3 py-2 border rounded-lg bg-white text-sm"
                                    value={filterUser}
                                    onChange={(e) => setFilterUser(e.target.value)}
                                >
                                    <option value="all">Todos</option>
                                    {profiles.map(p => (
                                        <option key={p.user_id} value={p.user_id}>
                                            {p.nombre} {p.apellido}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Rol filter */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                                <select
                                    className="w-full px-3 py-2 border rounded-lg bg-white text-sm"
                                    value={filterRol}
                                    onChange={(e) => setFilterRol(e.target.value)}
                                >
                                    <option value="all">Todos</option>
                                    <option value="admin">Admin</option>
                                    <option value="gestor">Gestor</option>
                                    <option value="empleado">Empleado</option>
                                </select>
                            </div>

                            {/* Status filter */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                                <select
                                    className="w-full px-3 py-2 border rounded-lg bg-white text-sm"
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                >
                                    <option value="all">Todos</option>
                                    <option value="open">En curso</option>
                                    <option value="closed">Finalizados</option>
                                </select>
                            </div>

                            {/* Date from */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
                                <input
                                    type="date"
                                    className="w-full px-3 py-2 border rounded-lg text-sm"
                                    value={filterDateFrom}
                                    onChange={(e) => setFilterDateFrom(e.target.value)}
                                />
                            </div>

                            {/* Date to */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
                                <input
                                    type="date"
                                    className="w-full px-3 py-2 border rounded-lg text-sm"
                                    value={filterDateTo}
                                    onChange={(e) => setFilterDateTo(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Clear filters */}
                        {(filterUser !== 'all' || filterRol !== 'all' || filterStatus !== 'all' || filterDateFrom || filterDateTo) && (
                            <button
                                onClick={() => {
                                    setFilterUser('all');
                                    setFilterRol('all');
                                    setFilterStatus('all');
                                    setFilterDateFrom('');
                                    setFilterDateTo('');
                                }}
                                className="mt-4 text-sm text-neutral-600 hover:text-neutral-900 flex items-center gap-2 transition-colors"
                            >
                                <X className="w-4 h-4" />
                                Limpiar filtros
                            </button>
                        )}
                    </div>

                    {/* Stats summary */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200">
                            <p className="text-sm text-neutral-600">Total Registros</p>
                            <p className="text-2xl font-bold text-neutral-900">{filteredEntries.length}</p>
                        </div>
                        <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 p-4 rounded-xl border border-yellow-200">
                            <p className="text-sm text-neutral-600">Sesiones Abiertas</p>
                            <p className="text-2xl font-bold text-neutral-900">
                                {filteredEntries.filter(e => !e.end_at).length}
                            </p>
                        </div>
                        <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-xl border border-green-200">
                            <p className="text-sm text-neutral-600">Sesiones Cerradas</p>
                            <p className="text-2xl font-bold text-neutral-900">
                                {filteredEntries.filter(e => e.end_at).length}
                            </p>
                        </div>
                    </div>

                    {/* Table */}
                    <DataTable
                        data={filteredEntries}
                        columns={columns}
                        keyExtractor={(row) => row.id}
                        storageKey="fichaje-admin"
                        loading={loading}
                        emptyMessage="No hay fichajes que coincidan con los filtros"
                    />
                </>
            ) : activeTab === 'reports' ? (
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Seleccionar Empleado</label>
                        <SearchableSelect
                            value={selectedUserForReport || ''}
                            onChange={(val) => setSelectedUserForReport(String(val))}
                            options={profiles.map(p => ({
                                value: p.user_id,
                                label: `${p.nombre} ${p.apellido || ''}`
                            }))}
                            placeholder="-- Seleccionar Usuario --"
                        />
                    </div>

                    {selectedUserForReport && (
                        <EmployeeResume userId={selectedUserForReport} allowExport={true} />
                    )}
                </div>
            ) : (
                <VacationManager />
            )}

            {/* CONFIRMATION MODAL */}
            {showConfirmModal && (
                <ModalPortal>
                <div className="fixed inset-0 bg-black/50 z-[9999] flex items-end sm:items-center sm:justify-center sm:p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full max-w-md p-6 relative animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
                        <button
                            onClick={() => setShowConfirmModal(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="mb-6 text-center">
                            <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                                <Clock className="w-6 h-6 text-red-600" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900">Confirmar Cierre</h3>
                            <p className="text-sm text-gray-500 mt-2">
                                ¿Estás seguro de cerrar manualmente esta sesión? Se registrará la hora actual como salida.
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmClose}
                                disabled={isClosing}
                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition shadow-sm disabled:opacity-50"
                            >
                                {isClosing ? 'Cerrando...' : 'Cerrar Sesión'}
                            </button>
                        </div>
                    </div>
                </div>
                </ModalPortal>
            )}
        </div>
    );
}
