'use client';

import { useState, useEffect } from 'react';
import { Trash2, X, Loader2, AlertTriangle, ShieldAlert } from 'lucide-react';
import ModalPortal from '@/components/ModalPortal';

type Counts = {
    tickets: number;
    morosidad: number;
    reuniones: number;
    fichajes: number;
    empleados: number;
};

export type ComunidadSummary = {
    id: number;
    codigo: string;
    nombre_cdad: string;
    activo: boolean;
};

interface DeleteComunidadModalProps {
    isOpen: boolean;
    comunidad: ComunidadSummary | null;
    counts: Counts | null;
    loadingCounts: boolean;
    isProcessing: boolean;
    onClose: () => void;
    onDeactivate: () => Promise<void>;
    onDeleteForever: (credentials: { email: string; password: string }) => Promise<void>;
}

export default function DeleteComunidadModal({
    isOpen,
    comunidad,
    counts,
    loadingCounts,
    isProcessing,
    onClose,
    onDeactivate,
    onDeleteForever,
}: DeleteComunidadModalProps) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [codigoConfirm, setCodigoConfirm] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen || !comunidad) return null;

    const isActive = comunidad.activo;
    const totalDependencies = counts
        ? counts.tickets + counts.morosidad + counts.reuniones + counts.fichajes + counts.empleados
        : 0;
    const codigoMatches = codigoConfirm.trim() === comunidad.codigo;
    const canSubmitDelete = codigoMatches && email.length > 0 && password.length > 0 && !isProcessing;

    const handleSubmitDelete = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmitDelete) return;
        await onDeleteForever({ email, password });
    };

    return (
        <ModalPortal>
            <div
                className="fixed inset-0 bg-black/50 z-[9999] flex items-end sm:items-center sm:justify-center sm:p-4 backdrop-blur-sm animate-in fade-in duration-200"
                role="presentation"
            >
                <div
                    className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-lg p-6 relative max-h-[92dvh] overflow-y-auto animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 border border-neutral-100"
                    role="dialog"
                    aria-modal="true"
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        onClick={onClose}
                        aria-label="Cerrar modal"
                        className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    {isActive ? (
                        <ActiveCommunityContent
                            comunidad={comunidad}
                            counts={counts}
                            loadingCounts={loadingCounts}
                            isProcessing={isProcessing}
                            totalDependencies={totalDependencies}
                            onClose={onClose}
                            onDeactivate={onDeactivate}
                        />
                    ) : (
                        <InactiveCommunityContent
                            comunidad={comunidad}
                            counts={counts}
                            loadingCounts={loadingCounts}
                            isProcessing={isProcessing}
                            totalDependencies={totalDependencies}
                            email={email}
                            password={password}
                            codigoConfirm={codigoConfirm}
                            codigoMatches={codigoMatches}
                            canSubmitDelete={canSubmitDelete}
                            setEmail={setEmail}
                            setPassword={setPassword}
                            setCodigoConfirm={setCodigoConfirm}
                            onClose={onClose}
                            onSubmit={handleSubmitDelete}
                        />
                    )}
                </div>
            </div>
        </ModalPortal>
    );
}

function ActiveCommunityContent({
    comunidad,
    counts,
    loadingCounts,
    isProcessing,
    totalDependencies,
    onClose,
    onDeactivate,
}: {
    comunidad: ComunidadSummary;
    counts: Counts | null;
    loadingCounts: boolean;
    isProcessing: boolean;
    totalDependencies: number;
    onClose: () => void;
    onDeactivate: () => Promise<void>;
}) {
    return (
        <>
            <div className="mb-6 text-center">
                <div className="mx-auto w-16 h-16 bg-yellow-50 rounded-full flex items-center justify-center mb-4 ring-8 ring-yellow-50/50">
                    <ShieldAlert className="w-8 h-8 text-yellow-600" />
                </div>
                <h3 className="text-xl font-black text-neutral-900 uppercase tracking-tight">
                    Comunidad protegida
                </h3>
                <p className="text-sm text-neutral-600 mt-2 font-medium">
                    <span className="font-bold">{comunidad.nombre_cdad}</span> está <span className="font-bold">activa</span>.
                    No puede eliminarse para proteger su historial.
                </p>
            </div>

            <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 mb-6">
                <p className="text-xs font-bold text-neutral-700 mb-2 uppercase tracking-widest">
                    Datos asociados a esta comunidad
                </p>
                {loadingCounts ? (
                    <div className="flex items-center gap-2 text-sm text-neutral-500">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Calculando...
                    </div>
                ) : counts ? (
                    <DependencyList counts={counts} total={totalDependencies} />
                ) : null}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                <p className="text-sm text-blue-900 font-semibold mb-1">¿Qué pasa si la desactivas?</p>
                <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
                    <li>Dejará de aparecer en los formularios nuevos.</li>
                    <li>Su historial seguirá visible y consultable.</li>
                    <li>Podrás reactivarla en cualquier momento.</li>
                    <li>Una vez inactiva, podrás eliminarla definitivamente si lo necesitas.</li>
                </ul>
            </div>

            <div className="flex gap-3">
                <button
                    type="button"
                    onClick={onClose}
                    disabled={isProcessing}
                    className="flex-1 h-12 px-6 border border-neutral-200 text-neutral-600 rounded-xl hover:bg-neutral-50 font-bold text-xs uppercase tracking-widest transition-all"
                >
                    Cancelar
                </button>
                <button
                    type="button"
                    onClick={onDeactivate}
                    disabled={isProcessing}
                    className="flex-1 h-12 px-6 bg-yellow-400 text-neutral-950 rounded-xl hover:bg-yellow-500 font-black text-xs uppercase tracking-[0.15em] transition-all shadow-lg shadow-yellow-100 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {isProcessing ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>DESACTIVANDO...</span>
                        </>
                    ) : (
                        <span>DESACTIVAR</span>
                    )}
                </button>
            </div>
        </>
    );
}

function InactiveCommunityContent({
    comunidad,
    counts,
    loadingCounts,
    isProcessing,
    totalDependencies,
    email,
    password,
    codigoConfirm,
    codigoMatches,
    canSubmitDelete,
    setEmail,
    setPassword,
    setCodigoConfirm,
    onClose,
    onSubmit,
}: {
    comunidad: ComunidadSummary;
    counts: Counts | null;
    loadingCounts: boolean;
    isProcessing: boolean;
    totalDependencies: number;
    email: string;
    password: string;
    codigoConfirm: string;
    codigoMatches: boolean;
    canSubmitDelete: boolean;
    setEmail: (v: string) => void;
    setPassword: (v: string) => void;
    setCodigoConfirm: (v: string) => void;
    onClose: () => void;
    onSubmit: (e: React.FormEvent) => Promise<void>;
}) {
    return (
        <>
            <div className="mb-6 text-center">
                <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4 ring-8 ring-red-50/50">
                    <AlertTriangle className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="text-xl font-black text-neutral-900 uppercase tracking-tight">
                    Eliminar definitivamente
                </h3>
                <p className="text-sm text-neutral-600 mt-2 font-medium">
                    Vas a borrar <span className="font-bold">{comunidad.nombre_cdad}</span> y todo su historial relacionado.
                </p>
            </div>

            {totalDependencies > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                    <p className="text-xs font-bold text-red-800 mb-2 uppercase tracking-widest flex items-center gap-1.5">
                        <Trash2 className="w-3.5 h-3.5" />
                        Se borrará para siempre
                    </p>
                    {loadingCounts ? (
                        <div className="flex items-center gap-2 text-sm text-red-700">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Calculando...
                        </div>
                    ) : counts ? (
                        <DependencyList counts={counts} total={totalDependencies} variant="danger" />
                    ) : null}
                </div>
            )}

            <form onSubmit={onSubmit} className="space-y-4">
                <div>
                    <label htmlFor="comunidad-codigo-confirm" className="block text-[10px] font-black text-neutral-700 uppercase tracking-widest mb-1.5 ml-1">
                        Escribe el código <span className="text-red-600">{comunidad.codigo}</span> para confirmar
                    </label>
                    <input
                        id="comunidad-codigo-confirm"
                        type="text"
                        required
                        disabled={isProcessing}
                        autoComplete="off"
                        autoFocus
                        className={`w-full px-4 py-3 bg-neutral-50 border rounded-xl focus:ring-2 outline-none transition-all text-sm font-mono ${
                            codigoConfirm.length === 0
                                ? 'border-neutral-200 focus:ring-yellow-400 focus:border-yellow-400'
                                : codigoMatches
                                    ? 'border-green-400 focus:ring-green-400 focus:border-green-400 bg-green-50'
                                    : 'border-red-300 focus:ring-red-400 focus:border-red-400'
                        }`}
                        value={codigoConfirm}
                        onChange={(e) => setCodigoConfirm(e.target.value)}
                        placeholder={comunidad.codigo}
                    />
                </div>

                <div>
                    <label htmlFor="comunidad-admin-email" className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1.5 ml-1">Email Administrador</label>
                    <input
                        id="comunidad-admin-email"
                        type="email"
                        required
                        disabled={isProcessing}
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 outline-none transition-all text-sm"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="admin@ejemplo.com"
                        autoComplete="off"
                    />
                </div>

                <div>
                    <label htmlFor="comunidad-admin-pass" className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1.5 ml-1">Contraseña Administrador</label>
                    <input
                        id="comunidad-admin-pass"
                        type="password"
                        required
                        disabled={isProcessing}
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 outline-none transition-all text-sm"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="new-password"
                    />
                </div>

                <div className="flex gap-3 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isProcessing}
                        className="flex-1 h-12 px-6 border border-neutral-200 text-neutral-600 rounded-xl hover:bg-neutral-50 font-bold text-xs uppercase tracking-widest transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={!canSubmitDelete}
                        className="flex-1 h-12 px-6 bg-red-600 text-white rounded-xl hover:bg-red-700 font-black text-xs uppercase tracking-[0.15em] transition-all shadow-lg shadow-red-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>ELIMINANDO...</span>
                            </>
                        ) : (
                            <span>ELIMINAR TODO</span>
                        )}
                    </button>
                </div>
            </form>
        </>
    );
}

function DependencyList({ counts, total, variant = 'neutral' }: { counts: Counts; total: number; variant?: 'neutral' | 'danger' }) {
    if (total === 0) {
        return (
            <p className={`text-sm ${variant === 'danger' ? 'text-red-700' : 'text-neutral-600'}`}>
                Sin datos relacionados.
            </p>
        );
    }

    const rows: Array<{ label: string; value: number }> = [
        { label: 'Tickets / incidencias', value: counts.tickets },
        { label: 'Registros de morosidad', value: counts.morosidad },
        { label: 'Reuniones', value: counts.reuniones },
        { label: 'Fichajes / tareas', value: counts.fichajes },
        { label: 'Empleados asignados', value: counts.empleados },
    ].filter((r) => r.value > 0);

    const valueClass = variant === 'danger' ? 'text-red-900' : 'text-neutral-900';
    const labelClass = variant === 'danger' ? 'text-red-700' : 'text-neutral-600';

    return (
        <ul className="space-y-1.5">
            {rows.map((row) => (
                <li key={row.label} className="flex items-center justify-between text-sm">
                    <span className={labelClass}>{row.label}</span>
                    <span className={`font-bold ${valueClass}`}>{row.value}</span>
                </li>
            ))}
        </ul>
    );
}
