'use client';

import { useState, useRef, useCallback } from 'react';
import { X, Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import ModalPortal from '@/components/ModalPortal';

interface ImportRow {
    codigo: string;
    nombre_cdad: string;
    cif: string;
    status?: 'pending' | 'ok' | 'skipped' | 'error';
    message?: string;
}

interface ImportComunidadesModalProps {
    onClose: () => void;
    onImported: () => void;
}

export default function ImportComunidadesModal({ onClose, onImported }: ImportComunidadesModalProps) {
    const [rows, setRows] = useState<ImportRow[]>([]);
    const [importing, setImporting] = useState(false);
    const [done, setDone] = useState(false);
    const [fileName, setFileName] = useState('');
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const parseFile = useCallback((file: File) => {
        setFileName(file.name);
        setRows([]);
        setDone(false);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const wb = XLSX.read(data, { type: 'binary' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                // Convert to array of arrays
                const raw: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

                if (raw.length < 2) {
                    toast.error('El fichero está vacío o no tiene filas de datos.');
                    return;
                }

                // Detect header row – look for Código/Codigo in first row
                // Support flexible column order: try to find by header name
                const headers = raw[0].map((h: any) => String(h).trim().toLowerCase()
                    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove diacritics
                );

                const codigoIdx = headers.findIndex(h => h === 'codigo' || h === 'cod' || h === 'code');
                const nombreIdx = headers.findIndex(h => h.includes('nombre') || h === 'name');
                const cifIdx = headers.findIndex(h => h === 'cif' || h === 'nif' || h.includes('fiscal'));

                // If headers not found, assume positional: col0=Código, col1=Nombre, col2=NIF
                const ci = codigoIdx >= 0 ? codigoIdx : 0;
                const ni = nombreIdx >= 0 ? nombreIdx : 1;
                const fi = cifIdx >= 0 ? cifIdx : 2;

                // Helper: strip leading zeros only from purely numeric codes
                // e.g. "000011" → "11",  "A001" → "A001"
                const normalizeCode = (raw: string): string => {
                    const s = String(raw).trim();
                    return /^\d+$/.test(s) ? String(Number(s)) : s;
                };

                const parsed: ImportRow[] = raw
                    .slice(1) // skip header
                    .map((row: any[]) => ({
                        codigo: normalizeCode(String(row[ci] ?? '')),
                        nombre_cdad: String(row[ni] ?? '').trim(),
                        cif: String(row[fi] ?? '').trim(),
                        status: 'pending' as const,
                    }))
                    .filter(r => r.codigo && r.nombre_cdad); // skip empty rows

                if (parsed.length === 0) {
                    toast.error('No se encontraron filas válidas. Revisa el formato.');
                    return;
                }

                setRows(parsed);
                toast.success(`${parsed.length} comunidades detectadas. Revisa antes de importar.`);
            } catch {
                toast.error('Error al leer el fichero. Asegúrate de que es CSV o Excel válido.');
            }
        };
        reader.readAsBinaryString(file);
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) parseFile(file);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) parseFile(file);
    };

    const handleImport = async () => {
        if (rows.length === 0) return;
        setImporting(true);

        const updated = [...rows];
        let okCount = 0;
        let skipCount = 0;
        let errCount = 0;

        // Send in batches of 20 to the server-side API (bypasses RLS via service_role key)
        const BATCH = 20;
        for (let start = 0; start < updated.length; start += BATCH) {
            const batch = updated.slice(start, start + BATCH).map(r => ({
                codigo: r.codigo,
                nombre_cdad: r.nombre_cdad,
                cif: r.cif || null,
            }));

            try {
                const res = await fetch('/api/comunidades/import', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ rows: batch }),
                });

                const data = await res.json();

                if (!res.ok) {
                    // Whole batch failed — mark all as error
                    for (let i = start; i < start + batch.length; i++) {
                        updated[i] = { ...updated[i], status: 'error', message: data.error || 'Error del servidor' };
                        errCount++;
                    }
                } else {
                    // Apply individual results
                    (data.results as { codigo: string; status: 'ok' | 'skipped' | 'error'; message?: string }[])
                        .forEach((result, j) => {
                            const idx = start + j;
                            updated[idx] = { ...updated[idx], status: result.status, message: result.message };
                            if (result.status === 'ok') okCount++;
                            else if (result.status === 'skipped') skipCount++;
                            else errCount++;
                        });
                }
            } catch (err: any) {
                for (let i = start; i < start + batch.length; i++) {
                    updated[i] = { ...updated[i], status: 'error', message: err?.message || 'Error de red' };
                    errCount++;
                }
            }

            setRows([...updated]);
        }

        setImporting(false);
        setDone(true);
        window.dispatchEvent(new Event('communitiesChanged'));
        onImported();

        if (okCount > 0) toast.success(`${okCount} comunidades importadas correctamente.`);
        if (skipCount > 0) toast(`${skipCount} actualizadas (ya existían).`, { icon: '⚠️' });
        if (errCount > 0) toast.error(`${errCount} errores. Revisa las filas en rojo.`);
    };

    const stats = {
        ok: rows.filter(r => r.status === 'ok').length,
        skipped: rows.filter(r => r.status === 'skipped').length,
        error: rows.filter(r => r.status === 'error').length,
        pending: rows.filter(r => r.status === 'pending').length,
    };

    return (
        <ModalPortal>
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex justify-center items-end sm:items-center sm:p-6"
            onClick={onClose}
        >
            <div
                className="bg-white w-full max-w-4xl rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[92vh] sm:max-h-[90vh] animate-in fade-in slide-in-from-bottom sm:zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-center px-5 py-4 border-b border-neutral-100 bg-neutral-50 shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-neutral-900 tracking-tight">
                            Importar Comunidades
                        </h2>
                        <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-0.5">
                            Desde fichero CSV o Excel (.xlsx, .xls)
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
                <div className="p-4 sm:px-5 sm:py-4 overflow-y-auto custom-scrollbar flex-1">
                    <div className="space-y-4">

                        {/* Format hint */}
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 flex gap-3">
                            <AlertCircle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
                            <div className="text-xs text-yellow-800 space-y-0.5">
                                <p className="font-bold">Formato esperado (columnas en orden):</p>
                                <p><span className="font-semibold">Código</span> · <span className="font-semibold">Nombre</span> · <span className="font-semibold">NIF / CIF</span></p>
                                <p className="text-yellow-700">Si el código ya existe en la base de datos, se actualizará el nombre y NIF. Los IDs se asignan automáticamente — no hay riesgo de gaps.</p>
                            </div>
                        </div>

                        {/* Drop Zone */}
                        {!fileName && (
                            <label
                                className={`block border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${dragOver ? 'border-yellow-400 bg-yellow-50' : 'border-neutral-200 hover:border-yellow-400 hover:bg-neutral-50'}`}
                                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={handleDrop}
                                htmlFor="import-file-input"
                            >
                                <FileSpreadsheet className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
                                <p className="text-sm font-semibold text-neutral-600">Arrastra el fichero aquí o haz clic para seleccionar</p>
                                <p className="text-xs text-neutral-400 mt-1">Formatos soportados: .csv, .xlsx, .xls</p>
                                <input
                                    id="import-file-input"
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".csv,.xlsx,.xls"
                                    className="hidden"
                                    onChange={handleFileChange}
                                />
                            </label>
                        )}

                        {/* File loaded + preview */}
                        {fileName && (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <FileSpreadsheet className="w-4 h-4 text-neutral-500" />
                                        <span className="text-sm font-semibold text-neutral-700">{fileName}</span>
                                        <span className="text-xs bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded-full">{rows.length} filas</span>
                                    </div>
                                    <button
                                        onClick={() => { setFileName(''); setRows([]); setDone(false); }}
                                        className="text-xs text-neutral-400 hover:text-red-500 flex items-center gap-1 transition-colors"
                                    >
                                        <RefreshCw className="w-3 h-3" /> Cambiar fichero
                                    </button>
                                </div>

                                {/* Stats when importing/done */}
                                {(importing || done) && (
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-center">
                                            <p className="text-lg font-bold text-green-700">{stats.ok}</p>
                                            <p className="text-xs text-green-600 font-medium">Importadas</p>
                                        </div>
                                        <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-3 text-center">
                                            <p className="text-lg font-bold text-yellow-700">{stats.skipped}</p>
                                            <p className="text-xs text-yellow-600 font-medium">Omitidas</p>
                                        </div>
                                        <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-center">
                                            <p className="text-lg font-bold text-red-700">{stats.error}</p>
                                            <p className="text-xs text-red-600 font-medium">Errores</p>
                                        </div>
                                    </div>
                                )}

                                {/* Table Preview */}
                                <div className="-section">
                                    <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-2 border-b border-yellow-400">
                                        Vista previa
                                    </h3>
                                    <div className="overflow-auto max-h-[340px] rounded-lg border border-neutral-200">
                                        <table className="w-full text-sm">
                                            <thead className="bg-neutral-50 sticky top-0">
                                                <tr>
                                                    <th className="text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500 px-3 py-2 w-6">#</th>
                                                    <th className="text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500 px-3 py-2">Código</th>
                                                    <th className="text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500 px-3 py-2">Nombre</th>
                                                    <th className="text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500 px-3 py-2">NIF / CIF</th>
                                                    <th className="text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500 px-3 py-2 w-28">Estado</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {rows.map((row, idx) => (
                                                    <tr
                                                        key={idx}
                                                        className={`border-t border-neutral-100 transition-colors ${
                                                            row.status === 'ok' ? 'bg-green-50/60' :
                                                            row.status === 'skipped' ? 'bg-yellow-50/60' :
                                                            row.status === 'error' ? 'bg-red-50/60' : ''
                                                        }`}
                                                    >
                                                        <td className="px-3 py-2 text-neutral-400 text-xs">{idx + 1}</td>
                                                        <td className="px-3 py-2 font-mono text-xs font-semibold text-neutral-800">{row.codigo}</td>
                                                        <td className="px-3 py-2 text-neutral-700 max-w-[250px] truncate">{row.nombre_cdad}</td>
                                                        <td className="px-3 py-2 font-mono text-xs text-neutral-600">{row.cif || '–'}</td>
                                                        <td className="px-3 py-2">
                                                            {row.status === 'pending' && (
                                                                <span className="text-[10px] text-neutral-400 font-medium">Pendiente</span>
                                                            )}
                                                            {row.status === 'ok' && (
                                                                <span className="inline-flex items-center gap-1 text-[10px] text-green-700 font-semibold">
                                                                    <CheckCircle className="w-3 h-3" /> OK
                                                                </span>
                                                            )}
                                                            {row.status === 'skipped' && (
                                                                <span className="text-[10px] text-yellow-700 font-semibold">{row.message}</span>
                                                            )}
                                                            {row.status === 'error' && (
                                                                <span
                                                                    className="inline-flex items-center gap-1 text-[10px] text-red-700 font-semibold cursor-help"
                                                                    title={row.message || 'Error desconocido'}
                                                                >
                                                                    <AlertCircle className="w-3 h-3" />
                                                                    <span className="max-w-[120px] truncate">{row.message || 'Error'}</span>
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-neutral-100 bg-neutral-50 flex items-center justify-between shrink-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200 bg-neutral-100 rounded-lg transition"
                    >
                        {done ? 'Cerrar' : 'Cancelar'}
                    </button>

                    {rows.length > 0 && !done && (
                        <button
                            onClick={handleImport}
                            disabled={importing}
                            className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-neutral-950 bg-yellow-400 hover:bg-yellow-500 rounded-lg transition shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {importing ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Importando {rows.filter(r => r.status !== 'pending').length}/{rows.length}…
                                </>
                            ) : (
                                <>
                                    <Upload className="w-4 h-4" />
                                    Importar {rows.length} comunidades
                                </>
                            )}
                        </button>
                    )}

                    {done && (
                        <div className="flex items-center gap-2 text-sm font-semibold text-green-700">
                            <CheckCircle className="w-4 h-4" />
                            Importación completada
                        </div>
                    )}
                </div>
            </div>
        </div>
        </ModalPortal>
    );
}
