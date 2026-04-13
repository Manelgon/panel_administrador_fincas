'use client';

import { createPortal } from 'react-dom';
import { X, Trash2, FileText, Check, Paperclip, Download, RotateCcw, Loader2, UserCog, Save, Pause, CalendarClock } from 'lucide-react';
import ModalActionsMenu from '@/components/ModalActionsMenu';
import SearchableSelect from '@/components/SearchableSelect';
import TimelineChat from '@/components/TimelineChat';
import { getSecureUrl } from '@/lib/storage';
import { Incidencia, Profile, ComunidadOption } from '@/lib/schemas';

interface Props {
    show: boolean;
    selectedDetailIncidencia: Incidencia | null;
    profiles: Profile[];
    comunidades: ComunidadOption[];
    isUpdatingRecord: boolean;
    isUpdatingGestor: boolean;
    isReassigning: boolean;
    newGestorId: string;
    exporting: boolean;
    showReassignSuccessModal: boolean;
    detailFileInputRef: React.RefObject<HTMLInputElement | null>;
    onClose: () => void;
    onDetailFileUpload: (files: FileList) => void;
    onDeleteAttachmentRequest: (url: string) => void;
    onToggleResuelto: (id: number, currentStatus: boolean) => void;
    onDeleteClick: (id: number) => void;
    onExport: (type: 'csv' | 'pdf', ids?: number[]) => void;
    onOpenAplazar: (id: number) => void;
    onUpdateGestor: () => void;
    setIsReassigning: (v: boolean) => void;
    setNewGestorId: (v: string) => void;
    setSelectedDetailIncidencia: (v: Incidencia | ((prev: Incidencia | null) => Incidencia | null)) => void;
    setShowReassignSuccessModal: (v: boolean) => void;
    setShowDetailModal: (v: boolean) => void;
}

export default function DetailModal({
    show,
    selectedDetailIncidencia,
    profiles,
    comunidades,
    isUpdatingRecord,
    isUpdatingGestor,
    isReassigning,
    newGestorId,
    exporting,
    showReassignSuccessModal,
    detailFileInputRef,
    onClose,
    onDetailFileUpload,
    onDeleteAttachmentRequest,
    onToggleResuelto,
    onDeleteClick,
    onExport,
    onOpenAplazar,
    onUpdateGestor,
    setIsReassigning,
    setNewGestorId,
    setSelectedDetailIncidencia,
    setShowReassignSuccessModal,
    setShowDetailModal,
}: Props) {
    if (!show || !selectedDetailIncidencia) return null;

    return (
        <>
            {createPortal(
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex justify-center items-end sm:items-center sm:p-6"
                >
                    <div
                        className="bg-white w-full max-w-4xl rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[92dvh] sm:max-h-[90dvh] animate-in fade-in slide-in-from-bottom sm:zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-white shrink-0">
                            <div>
                                <h2 className="text-xl font-black text-neutral-900 tracking-tight">
                                    {selectedDetailIncidencia.nombre_cliente || 'Sin nombre'} · Ticket #{selectedDetailIncidencia.id}
                                </h2>
                                <p className="text-xs text-neutral-500 mt-0.5">
                                    Registrado el {new Date(selectedDetailIncidencia.created_at).toLocaleDateString('es-ES')}
                                    {selectedDetailIncidencia.resuelto && selectedDetailIncidencia.dia_resuelto && (
                                        <> · Resuelto el {new Date(selectedDetailIncidencia.dia_resuelto as string).toLocaleDateString('es-ES')}</>
                                    )}
                                </p>
                                <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                                    {/* Estado */}
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${selectedDetailIncidencia.resuelto ? 'bg-emerald-100 text-emerald-700' : selectedDetailIncidencia.estado === 'Aplazado' ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${selectedDetailIncidencia.resuelto ? 'bg-emerald-500' : selectedDetailIncidencia.estado === 'Aplazado' ? 'bg-orange-500' : 'bg-[#a03d42]'}`} />
                                        {selectedDetailIncidencia.resuelto ? 'Resuelto' : selectedDetailIncidencia.estado === 'Aplazado' ? 'Aplazado' : 'En trámite'}
                                    </span>
                                    {/* Prioridad */}
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${selectedDetailIncidencia.urgencia === 'Alta' ? 'bg-red-100 text-red-700' : selectedDetailIncidencia.urgencia === 'Media' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${selectedDetailIncidencia.urgencia === 'Alta' ? 'bg-red-500' : selectedDetailIncidencia.urgencia === 'Media' ? 'bg-orange-500' : 'bg-blue-400'}`} />
                                        {selectedDetailIncidencia.urgencia || 'Baja'}
                                    </span>
                                    {/* Sentimiento */}
                                    {selectedDetailIncidencia.sentimiento && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-700">
                                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                                            {selectedDetailIncidencia.sentimiento}
                                        </span>
                                    )}
                                    {/* Aviso */}
                                    {(() => {
                                        const v = Number(selectedDetailIncidencia.aviso);
                                        const avisoLabels: Record<number, { label: string; dot: string; cls: string }> = {
                                            0: { label: 'Sin aviso', dot: 'bg-neutral-400', cls: 'bg-neutral-100 text-neutral-500' },
                                            1: { label: 'WhatsApp', dot: 'bg-green-500', cls: 'bg-green-100 text-green-700' },
                                            2: { label: 'Email', dot: 'bg-blue-500', cls: 'bg-blue-100 text-blue-700' },
                                            3: { label: 'Email + WhatsApp', dot: 'bg-indigo-500', cls: 'bg-indigo-100 text-indigo-700' },
                                        };
                                        const entry = avisoLabels[v] ?? avisoLabels[0];
                                        return (
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${entry.cls}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${entry.dot}`} />
                                                {entry.label}
                                            </span>
                                        );
                                    })()}
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-xl hover:bg-neutral-100 text-neutral-400 hover:text-neutral-900 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* File input hidden */}
                        <input
                            type="file"
                            multiple
                            className="hidden"
                            ref={detailFileInputRef}
                            onChange={(e) => {
                                if (e.target.files && e.target.files.length > 0) {
                                    onDetailFileUpload(e.target.files);
                                }
                            }}
                        />

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar">

                            {/* Sección 1: Identificación del Cliente */}
                            <div>
                                <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-4 border-b border-[#bf4b50]">
                                    Identificación del Cliente
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <div className="lg:col-span-2">
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Comunidad</label>
                                        <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">
                                            {selectedDetailIncidencia.comunidad || selectedDetailIncidencia.comunidades?.nombre_cdad || '—'}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Propietario</label>
                                        <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">
                                            {selectedDetailIncidencia.nombre_cliente || '—'}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Teléfono</label>
                                        <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">
                                            {selectedDetailIncidencia.telefono || '—'}
                                        </div>
                                    </div>
                                    <div className="lg:col-span-2">
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Email</label>
                                        <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">
                                            {selectedDetailIncidencia.email || '—'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Sección 2: Datos de la Incidencia */}
                            <div>
                                <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-4 border-b border-[#bf4b50]">
                                    Datos de la Incidencia
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Clasificación</label>
                                        <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">
                                            {selectedDetailIncidencia.categoria || '—'}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Entrada</label>
                                        <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">
                                            {selectedDetailIncidencia.source || '—'}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Recepción inicial</label>
                                        <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">
                                            {(selectedDetailIncidencia as any).receptor?.nombre || selectedDetailIncidencia.quien_lo_recibe || 'Automática'}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Responsable asignado</label>
                                        <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 flex items-center justify-between gap-2">
                                            <span>{(selectedDetailIncidencia as any).gestor?.nombre || selectedDetailIncidencia.gestor_asignado || 'Pendiente'}</span>
                                            {!isReassigning && (
                                                <button
                                                    onClick={() => { setNewGestorId(selectedDetailIncidencia.gestor_asignado || ''); setIsReassigning(true); }}
                                                    className="p-1 bg-[#bf4b50] hover:bg-[#a03d42] text-white rounded border border-[#a03d42] transition-all shrink-0"
                                                    title="Reasignar gestor"
                                                >
                                                    <UserCog className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                        {isReassigning && (
                                            <div className="flex items-center gap-2 mt-2 animate-in fade-in slide-in-from-top-1">
                                                <div className="flex-1">
                                                    <SearchableSelect
                                                        value={newGestorId}
                                                        onChange={(val) => setNewGestorId(String(val))}
                                                        options={profiles.map(p => ({ value: p.user_id, label: `${p.nombre} (${p.rol})` }))}
                                                        placeholder="Nuevo gestor..."
                                                        className="text-xs"
                                                    />
                                                </div>
                                                <button
                                                    onClick={onUpdateGestor}
                                                    disabled={!newGestorId || isUpdatingGestor}
                                                    className="p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors disabled:opacity-50"
                                                >
                                                    {isUpdatingGestor ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                                </button>
                                                <button
                                                    onClick={() => { setIsReassigning(false); setNewGestorId(''); }}
                                                    disabled={isUpdatingGestor}
                                                    className="p-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors disabled:opacity-50"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="sm:col-span-2 lg:col-span-3">
                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Motivo del ticket</label>
                                        <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">
                                            {selectedDetailIncidencia.motivo_ticket || '—'}
                                        </div>
                                    </div>
                                    {selectedDetailIncidencia.mensaje && (
                                        <div className="sm:col-span-2 lg:col-span-3">
                                            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Mensaje</label>
                                            <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 whitespace-pre-wrap">
                                                {selectedDetailIncidencia.mensaje}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Sección 3: Documentación */}
                            {selectedDetailIncidencia.adjuntos && selectedDetailIncidencia.adjuntos.length > 0 && (
                                <div>
                                    <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-4 border-b border-[#bf4b50]">
                                        Documentación
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {selectedDetailIncidencia.adjuntos.map((url: string, i: number) => (
                                            <div key={i} className="flex items-center justify-between bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2.5">
                                                <div className="flex items-center gap-2">
                                                    <FileText className="w-4 h-4 text-neutral-400 shrink-0" />
                                                    <span className="text-sm text-neutral-700 truncate max-w-[180px]">Documento adjunto {i + 1}</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <a
                                                        href={getSecureUrl(url)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-1.5 hover:bg-neutral-200 rounded text-neutral-400 hover:text-neutral-900 transition-colors"
                                                        title="Ver / Descargar"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                    </a>
                                                    <button
                                                        onClick={(e) => { e.preventDefault(); onDeleteAttachmentRequest(url); }}
                                                        disabled={isUpdatingRecord}
                                                        className="p-1.5 hover:bg-red-50 rounded text-neutral-400 hover:text-red-600 transition-colors disabled:opacity-50"
                                                        title="Eliminar documento"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Sección 4: Chat de Gestores */}
                            <div>
                                <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-4 border-b border-[#bf4b50]">
                                    Chat de Gestores
                                </h3>
                                <TimelineChat entityType="incidencia" entityId={selectedDetailIncidencia.id} />
                            </div>

                        </div>

                        {/* Footer */}
                        <div className="px-4 py-3 bg-white border-t border-neutral-100 flex items-center justify-between shrink-0 gap-2">
                            <ModalActionsMenu actions={[
                                { label: 'Eliminar', icon: <Trash2 className="w-4 h-4" />, onClick: () => { onDeleteClick(selectedDetailIncidencia.id); setShowDetailModal(false); }, variant: 'danger' },
                                { label: isUpdatingRecord ? 'Subiendo…' : 'Adjuntar', icon: isUpdatingRecord ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />, onClick: () => detailFileInputRef.current?.click(), disabled: isUpdatingRecord },
                                { label: exporting ? 'Generando…' : 'PDF', icon: exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />, onClick: () => onExport('pdf', [selectedDetailIncidencia.id]), disabled: exporting },
                                ...((selectedDetailIncidencia.estado || (selectedDetailIncidencia.resuelto ? 'Resuelto' : 'Pendiente')) === 'Pendiente' ? [{ label: 'Aplazar', icon: <Pause className="w-4 h-4" />, onClick: () => onOpenAplazar(selectedDetailIncidencia.id), variant: 'warning' as const }] : []),
                            ]} />
                            <div className="flex items-center gap-2">
                                {selectedDetailIncidencia.estado === 'Aplazado' && (
                                    <div className="px-3 py-1.5 text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-200 rounded-xl flex items-center gap-1.5">
                                        <CalendarClock className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">Hasta </span>{selectedDetailIncidencia.fecha_recordatorio ? new Date(selectedDetailIncidencia.fecha_recordatorio).toLocaleDateString('es-ES') : '...'}
                                    </div>
                                )}
                                {selectedDetailIncidencia.resuelto ? (
                                    <button
                                        onClick={() => { onToggleResuelto(selectedDetailIncidencia.id, selectedDetailIncidencia.resuelto); setSelectedDetailIncidencia({ ...selectedDetailIncidencia, resuelto: false, estado: 'Pendiente', dia_resuelto: undefined, fecha_recordatorio: undefined }); }}
                                        className="px-5 py-2.5 text-sm font-black text-neutral-600 border border-neutral-200 hover:bg-neutral-50 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap"
                                    >
                                        <RotateCcw className="w-4 h-4" />
                                        <span className="hidden sm:inline">Reabrir </span>Ticket
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => { onToggleResuelto(selectedDetailIncidencia.id, selectedDetailIncidencia.resuelto); setShowDetailModal(false); }}
                                        className="px-5 py-2.5 text-sm font-black text-white bg-[#bf4b50] hover:bg-[#a03d42] rounded-xl transition-all shadow-sm flex items-center gap-2 whitespace-nowrap"
                                    >
                                        <Check className="w-4 h-4" />
                                        <span className="hidden sm:inline">Resolver </span>Ticket
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            , document.body)}

            {/* Reassign Success Modal */}
            {showReassignSuccessModal && createPortal(
                <div
                    className="fixed inset-0 bg-neutral-900/60 z-[10000] flex items-end sm:items-center sm:justify-center sm:p-4 backdrop-blur-sm animate-in fade-in duration-200"
                >
                    <div
                        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-sm p-6 relative flex flex-col items-center text-center max-h-[92dvh] overflow-y-auto animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
                    >
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                            <Check className="w-8 h-8 text-green-600" />
                        </div>
                        <h3 className="text-xl font-bold text-neutral-900 mb-2">
                            Gestor Reasignado
                        </h3>
                        <p className="text-neutral-500 mb-6">
                            La incidencia ha sido reasignada al nuevo gestor correctamente.
                        </p>
                        <button
                            onClick={() => setShowReassignSuccessModal(false)}
                            className="w-full py-3 bg-neutral-900 hover:bg-black text-white rounded-xl font-bold transition-transform active:scale-[0.98]"
                        >
                            Aceptar
                        </button>
                    </div>
                </div>
            , document.body)}
        </>
    );
}
