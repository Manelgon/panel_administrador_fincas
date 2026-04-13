'use client';

import { createPortal } from 'react-dom';
import { X, FileText, Check, AlertCircle, MessageSquare } from 'lucide-react';
import { ComunidadOption } from '@/lib/schemas';
import { ImportPreviewData } from './types';

interface Props {
    show: boolean;
    importPreviewData: ImportPreviewData | null;
    importRecordEstados: Record<number, 'Pendiente' | 'Resuelto'>;
    importRecordComunidades: Record<number, number>;
    importReceptorName: string;
    comunidades: ComunidadOption[];
    onClose: () => void;
    onConfirm: () => void;
    setImportRecordEstados: React.Dispatch<React.SetStateAction<Record<number, 'Pendiente' | 'Resuelto'>>>;
    setImportRecordComunidades: React.Dispatch<React.SetStateAction<Record<number, number>>>;
}

export default function ImportPreviewModal({
    show,
    importPreviewData,
    importRecordEstados,
    importRecordComunidades,
    importReceptorName,
    comunidades,
    onClose,
    onConfirm,
    setImportRecordEstados,
    setImportRecordComunidades,
}: Props) {
    if (!show || !importPreviewData) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex justify-center items-center p-4 sm:p-6 overflow-y-auto">
            <div
                className="bg-white w-full max-w-[95vw] rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[95dvh] animate-in fade-in zoom-in duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-center px-5 py-4 border-b border-neutral-100 bg-neutral-50 flex-shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-neutral-900 tracking-tight">Importar desde PDF</h2>
                        <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-0.5">
                            Revisa los registros antes de confirmar
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-5 py-4 overflow-y-auto custom-scrollbar flex-1 space-y-4">

                    {/* Resumen de conteos */}
                    <div>
                        <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-3 border-b border-[#bf4b50]">Resumen</h3>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 text-center">
                                <div className="text-xl font-bold text-neutral-900">{importPreviewData.total_parsed}</div>
                                <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-1">Total PDF</div>
                            </div>
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                                <div className="text-xl font-bold text-green-700">
                                    {importPreviewData.to_insert + Object.keys(importRecordComunidades).length}
                                </div>
                                <div className="text-[10px] font-bold text-green-500 uppercase tracking-widest mt-1">Se importan</div>
                            </div>
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                                <div className="text-xl font-bold text-amber-700">
                                    {importPreviewData.to_skip - Object.keys(importRecordComunidades).length}
                                </div>
                                <div className="text-[10px] font-bold text-[#a03d42] uppercase tracking-widest mt-1">Se omiten</div>
                            </div>
                        </div>
                    </div>

                    {/* Opciones de estado */}
                    <div className="flex items-center justify-between border-b border-[#bf4b50] pb-2 mb-3">
                        <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest leading-none">Acciones Masivas</h3>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    const newEstados: Record<number, 'Pendiente' | 'Resuelto'> = {};
                                    importPreviewData.records.forEach((rec, idx) => {
                                        if (rec.status === 'ok') newEstados[idx] = 'Resuelto';
                                    });
                                    setImportRecordEstados(newEstados);
                                }}
                                className="text-[10px] font-bold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 px-2 py-1 rounded transition-colors"
                            >
                                Marcar todos Resuelto
                            </button>
                            <button
                                type="button"
                                onClick={() => setImportRecordEstados({})}
                                className="text-[10px] font-bold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 px-2 py-1 rounded transition-colors"
                            >
                                Marcar todos Pendiente
                            </button>
                        </div>
                    </div>

                    {/* Tabla de registros */}
                    <div>
                        <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-3 border-b border-[#bf4b50]">
                            Detalle de registros
                        </h3>
                        <div className="border border-neutral-200 rounded-lg overflow-hidden">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="bg-neutral-50 border-b border-neutral-200">
                                        <th className="text-left px-3 py-2 text-[10px] font-bold text-neutral-500 uppercase tracking-widest w-6"></th>
                                        <th className="text-left px-3 py-2 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Comunidad</th>
                                        <th className="text-left px-3 py-2 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Entrada</th>
                                        <th className="text-left px-3 py-2 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Origen</th>
                                        <th className="text-left px-3 py-2 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Mensaje</th>
                                        <th className="text-left px-3 py-2 text-[10px] font-bold text-neutral-500 uppercase tracking-widest whitespace-nowrap">Fecha</th>
                                        <th className="text-left px-3 py-2 text-[10px] font-bold text-neutral-500 uppercase tracking-widest whitespace-nowrap">Quien lo recibe</th>
                                        <th className="text-left px-3 py-2 text-[10px] font-bold text-neutral-500 uppercase tracking-widest whitespace-nowrap">Gestor asignado</th>
                                        <th className="text-left px-3 py-2 text-[10px] font-bold text-neutral-500 uppercase tracking-widest whitespace-nowrap">Timeline</th>
                                        <th className="text-left px-3 py-2 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {importPreviewData.records.map((rec, idx) => {
                                        const isResuelto = importRecordEstados[idx] === 'Resuelto';
                                        return (
                                            <tr
                                                key={idx}
                                                className={`border-b border-neutral-100 last:border-0 ${rec.status === 'ok' ? 'bg-white hover:bg-neutral-50/60' : 'bg-amber-50/40'}`}
                                            >
                                                {/* Estado icon */}
                                                <td className="px-3 py-2.5">
                                                    <span className={`w-4 h-4 rounded flex items-center justify-center ${rec.status === 'ok' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                                        {rec.status === 'ok'
                                                            ? <Check className="w-2.5 h-2.5" strokeWidth={3} />
                                                            : <AlertCircle className="w-2.5 h-2.5" />}
                                                    </span>
                                                </td>
                                                {/* Comunidad */}
                                                <td className="px-3 py-2.5 font-semibold text-neutral-800 max-w-[180px]">
                                                    {rec.status === 'skip' && rec.comunidad_not_found ? (
                                                        <div>
                                                            <span className="block text-[10px] text-amber-700 font-bold truncate mb-1" title={rec.comunidad_name}>{rec.comunidad_name}</span>
                                                            <select
                                                                value={importRecordComunidades[idx] ?? ''}
                                                                onChange={e => {
                                                                    const val = e.target.value;
                                                                    setImportRecordComunidades(prev => {
                                                                        const next = { ...prev };
                                                                        if (val) next[idx] = Number(val);
                                                                        else delete next[idx];
                                                                        return next;
                                                                    });
                                                                }}
                                                                className="w-full text-[10px] border border-amber-300 rounded px-1.5 py-1 bg-white text-neutral-700 focus:border-[#bf4b50] outline-none"
                                                            >
                                                                <option value="">— Asignar comunidad —</option>
                                                                {comunidades.map(c => (
                                                                    <option key={c.id} value={c.id}>{c.nombre_cdad}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <span className="block truncate">{rec.comunidad_matched ?? rec.comunidad_name}</span>
                                                            {rec.status === 'skip' && (
                                                                <span className="block text-[10px] text-amber-700 font-bold mt-0.5 truncate">{rec.reason}</span>
                                                            )}
                                                        </>
                                                    )}
                                                </td>
                                                {/* Entrada */}
                                                <td className="px-3 py-2.5 whitespace-nowrap">
                                                    {rec.source_mapped
                                                        ? <span className="bg-neutral-100 text-neutral-600 rounded px-1.5 py-0.5 font-bold text-[10px] uppercase tracking-wide">{rec.source_mapped}</span>
                                                        : <span className="text-neutral-300">—</span>}
                                                </td>
                                                {/* Origen */}
                                                <td className="px-3 py-2.5 text-neutral-600 max-w-[160px]">
                                                    <span className="block truncate">{rec.motivo}</span>
                                                </td>
                                                {/* Mensaje */}
                                                <td className="px-3 py-2.5 text-neutral-400 max-w-[200px]">
                                                    <span className="block truncate">{rec.mensaje}</span>
                                                </td>
                                                {/* Fecha */}
                                                <td className="px-3 py-2.5 text-neutral-400 whitespace-nowrap font-medium">
                                                    {rec.fecha.replace('T', ' ').slice(0, 16)}
                                                </td>
                                                {/* Quien lo recibe */}
                                                <td className="px-3 py-2.5 whitespace-nowrap">
                                                    <span className="text-xs font-medium text-neutral-700">{importReceptorName}</span>
                                                </td>
                                                {/* Gestor asignado */}
                                                <td className="px-3 py-2.5 whitespace-nowrap">
                                                    <span className="text-xs font-medium text-neutral-700">{importReceptorName}</span>
                                                </td>
                                                {/* Timeline count */}
                                                <td className="px-3 py-2.5 whitespace-nowrap">
                                                    {rec.chat_count > 0 ? (
                                                        <span className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5">
                                                            <MessageSquare className="w-3 h-3" />
                                                            {rec.chat_count}
                                                        </span>
                                                    ) : (
                                                        <span className="text-neutral-300 text-[10px]">—</span>
                                                    )}
                                                </td>
                                                {/* Estado toggle */}
                                                <td className="px-3 py-2.5">
                                                    {rec.status === 'ok' || (rec.status === 'skip' && rec.comunidad_not_found && importRecordComunidades[idx]) ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => setImportRecordEstados(prev => ({
                                                                ...prev,
                                                                [idx]: isResuelto ? 'Pendiente' : 'Resuelto'
                                                            }))}
                                                            className={`flex items-center gap-1.5 rounded text-[10px] font-bold px-2 py-1 transition-colors whitespace-nowrap ${
                                                                isResuelto
                                                                    ? 'bg-neutral-900 text-white hover:bg-neutral-700'
                                                                    : 'bg-white border border-neutral-200 text-neutral-500 hover:bg-neutral-50'
                                                            }`}
                                                        >
                                                            <div className={`w-3 h-3 rounded-sm flex items-center justify-center shrink-0 ${isResuelto ? 'bg-white/20' : 'border border-neutral-300'}`}>
                                                                {isResuelto && <Check className="w-2 h-2 text-white" strokeWidth={4} />}
                                                            </div>
                                                            {isResuelto ? 'Resuelto' : 'Pendiente'}
                                                        </button>
                                                    ) : (
                                                        <span className="text-neutral-300 text-[10px]">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-neutral-100 bg-neutral-50/40 flex justify-end gap-2 flex-shrink-0 flex-wrap">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-bold text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={importPreviewData.to_insert + Object.keys(importRecordComunidades).length === 0}
                        className="px-6 py-2 bg-[#bf4b50] hover:bg-[#a03d42] text-white rounded-lg text-xs font-bold transition disabled:opacity-50 flex items-center gap-2 shadow-sm"
                    >
                        <FileText className="w-3.5 h-3.5" />
                        Importar {importPreviewData.to_insert + Object.keys(importRecordComunidades).length} registros
                    </button>
                </div>
            </div>
        </div>
    , document.body);
}
