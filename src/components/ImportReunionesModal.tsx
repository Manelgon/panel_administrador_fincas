'use client';

import { useState, useRef, useCallback } from 'react';
import { X, Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import ExcelJS from 'exceljs';
import ModalPortal from '@/components/ModalPortal';

interface ImportRow {
    comunidad_raw: string;
    comunidad_id: number | null;
    fecha_reunion: string;
    tipo: string;
    estado_cuentas: boolean;
    pto_ordinario: boolean;
    pto_extra: boolean;
    morosos: boolean;
    citacion_email: boolean;
    citacion_carta: boolean;
    redactar_acta: boolean;
    vb_pendiente: boolean;
    acta_email: boolean;
    acta_carta: boolean;
    pasar_acuerdos: boolean;
    status?: 'pending' | 'ok' | 'skipped' | 'error' | 'no_comunidad';
    message?: string;
}

interface ComunidadOption {
    id: number;
    nombre_cdad: string;
    codigo: string;
}

interface Props {
    onClose: () => void;
    onImported: () => void;
    comunidades: ComunidadOption[];
}

const parseBool = (val: string | null | undefined): boolean => {
    if (!val) return false;
    const s = String(val).trim().toUpperCase();
    return s === 'SI' || s === 'SÍ' || s === 'YES' || s === 'TRUE' || s === '1' || s === 'X';
};

const TIPOS_VALIDOS = ['JGO', 'JGE', 'JV', 'JD'];

export default function ImportReunionesModal({ onClose, onImported, comunidades }: Props) {
    const [rows, setRows] = useState<ImportRow[]>([]);
    const [importing, setImporting] = useState(false);
    const [done, setDone] = useState(false);
    const [fileName, setFileName] = useState('');
    const [dragOver, setDragOver] = useState(false);
    // comunidad_id overrides para filas sin match
    const [overrides, setOverrides] = useState<Record<number, number>>({});
    // estado override por fila: true = resuelto, false/undefined = pendiente
    const [estadoRows, setEstadoRows] = useState<Record<number, boolean>>({});

    const toggleEstado = (idx: number) =>
        setEstadoRows(prev => ({ ...prev, [idx]: !prev[idx] }));

    const setAllEstado = (resuelto: boolean) =>
        setEstadoRows(() => {
            const next: Record<number, boolean> = {};
            rows.forEach((_, i) => { next[i] = resuelto; });
            return next;
        });
    const fileInputRef = useRef<HTMLInputElement>(null);

    const findComunidad = useCallback((raw: string): number | null => {
        if (!raw) return null;
        const norm = raw.trim().toUpperCase();
        // intenta match por código primero (ej: "021 APARCAMIENTOS ELIGIA" → código "021")
        const codeMatch = norm.match(/^(\d+)/);
        if (codeMatch) {
            const code = String(Number(codeMatch[1])); // normaliza "021" → "21"
            const found = comunidades.find(c => String(Number(c.codigo)) === code || c.codigo === codeMatch[1]);
            if (found) return found.id;
        }
        // fallback: match por nombre
        const byName = comunidades.find(c =>
            c.nombre_cdad.toUpperCase().includes(norm.slice(0, 10)) ||
            norm.includes(c.nombre_cdad.toUpperCase().slice(0, 10))
        );
        return byName?.id ?? null;
    }, [comunidades]);

    const parseFile = useCallback(async (file: File) => {
        setFileName(file.name);
        setRows([]);
        setDone(false);
        setOverrides({});
        setEstadoRows({});

        try {
            const data = await file.arrayBuffer();
            const wb = new ExcelJS.Workbook();
            await wb.xlsx.load(data);

            // Busca la hoja "Seg. Juntas" primero, sino la primera
            const ws = wb.worksheets.find(s => s.name.toLowerCase().includes('juntas') || s.name.toLowerCase().includes('seg')) ?? wb.worksheets[0];
            if (!ws) { toast.error('No se encontró ninguna hoja válida.'); return; }

            const raw: string[][] = [];
            ws.eachRow(row => {
                raw.push((row.values as ExcelJS.CellValue[]).slice(1).map(v => {
                    if (v === null || v === undefined) return '';
                    if (typeof v === 'object' && 'result' in v) return String((v as ExcelJS.CellFormulaValue).result ?? '').trim();
                    if (typeof v === 'object' && v instanceof Date) return v.toISOString().slice(0, 10);
                    if (typeof v === 'object' && 'toISOString' in v) return (v as unknown as Date).toISOString().slice(0, 10);
                    return String(v).trim();
                }));
            });

            if (raw.length < 2) { toast.error('El fichero está vacío.'); return; }

            // Detecta cabeceras
            const headers = raw[0].map(h => String(h).trim().toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, ''));

            const col = (keywords: string[]) => {
                for (const kw of keywords) {
                    const idx = headers.findIndex(h => h.includes(kw));
                    if (idx >= 0) return idx;
                }
                return -1;
            };

            const iComunidad   = col(['comunidad', 'edificio', 'cdad']);
            const iFecha       = col(['fecha', 'date']);
            const iTipo        = col(['tipo', 'type']);
            const iEstadoCtas  = col(['estado de cuentas', 'estado cuentas', 'e. c', 'estado.c']);
            const iPtoOrd      = col(['pto. ordinario', 'ordinario', 'pto ord']);
            const iPtoExtra    = col(['pto. extra', 'extra', 'pto extra']);
            const iMorosos     = col(['moroso']);
            const iCitEmail    = col(['citacion @', 'citacion@', 'cit. @', 'cit @', 'citacion email', 'cit email']);
            const iCitCarta    = col(['cit. carta', 'cit carta', 'citacion carta']);
            const iRedactar    = col(['redactar']);
            const iVb          = col(['v\u00ba b\u00ba', 'vb', 'visto bueno']);
            const iActaEmail   = col(['acta @', 'acta@', 'acta email']);
            const iActaCarta   = col(['acta carta']);
            const iPasarAcuer  = col(['pasar acuerdo', 'acuerdo', 'acuerdos']);

            const parsed: ImportRow[] = [];

            for (let i = 1; i < raw.length; i++) {
                const r = raw[i];
                const comunidad_raw = iComunidad >= 0 ? r[iComunidad] ?? '' : '';
                if (!comunidad_raw.trim()) continue; // skip filas vacías

                // Parsea fecha — puede ser ISO ya o texto
                let fecha_reunion = '';
                const rawFecha = iFecha >= 0 ? r[iFecha] ?? '' : '';
                if (rawFecha.includes('T') || /^\d{4}-\d{2}-\d{2}/.test(rawFecha)) {
                    fecha_reunion = rawFecha.slice(0, 10);
                } else if (rawFecha) {
                    // intenta dd/mm/yyyy o dd-mm-yyyy
                    const m = rawFecha.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
                    if (m) {
                        const y = m[3].length === 2 ? `20${m[3]}` : m[3];
                        fecha_reunion = `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
                    }
                }
                if (!fecha_reunion) continue; // sin fecha no importamos

                const tipoRaw = (iTipo >= 0 ? r[iTipo] ?? '' : '').toUpperCase().trim();
                const tipo = TIPOS_VALIDOS.includes(tipoRaw) ? tipoRaw : 'JGO';

                parsed.push({
                    comunidad_raw,
                    comunidad_id: findComunidad(comunidad_raw),
                    fecha_reunion,
                    tipo,
                    estado_cuentas: parseBool(iEstadoCtas >= 0 ? r[iEstadoCtas] : null),
                    pto_ordinario:  parseBool(iPtoOrd >= 0 ? r[iPtoOrd] : null),
                    pto_extra:      parseBool(iPtoExtra >= 0 ? r[iPtoExtra] : null),
                    morosos:        parseBool(iMorosos >= 0 ? r[iMorosos] : null),
                    citacion_email: parseBool(iCitEmail >= 0 ? r[iCitEmail] : null),
                    citacion_carta: parseBool(iCitCarta >= 0 ? r[iCitCarta] : null),
                    redactar_acta:  parseBool(iRedactar >= 0 ? r[iRedactar] : null),
                    vb_pendiente:   parseBool(iVb >= 0 ? r[iVb] : null),
                    acta_email:     parseBool(iActaEmail >= 0 ? r[iActaEmail] : null),
                    acta_carta:     parseBool(iActaCarta >= 0 ? r[iActaCarta] : null),
                    pasar_acuerdos: parseBool(iPasarAcuer >= 0 ? r[iPasarAcuer] : null),
                    status: 'pending',
                });
            }

            if (parsed.length === 0) { toast.error('No se encontraron filas válidas.'); return; }
            setRows(parsed);

            const sinMatch = parsed.filter(r => r.comunidad_id === null).length;
            if (sinMatch > 0) {
                toast(`${sinMatch} filas sin comunidad reconocida — asígnalas manualmente.`, { icon: '⚠️' });
            } else {
                toast.success(`${parsed.length} reuniones detectadas. Revisa antes de importar.`);
            }
        } catch (e: any) {
            console.error(e);
            toast.error('Error al leer el fichero.');
        }
    }, [findComunidad]);

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
        let okCount = 0, skipCount = 0, errCount = 0;

        const BATCH = 20;
        for (let start = 0; start < updated.length; start += BATCH) {
            const batch = updated.slice(start, start + BATCH).map((r, j) => {
                const globalIdx = start + j;
                const cidOverride = overrides[globalIdx];
                const cid = cidOverride ?? r.comunidad_id;
                if (!cid) return null;
                return {
                    comunidad_id: cid,
                    fecha_reunion: r.fecha_reunion,
                    tipo: r.tipo,
                    estado_cuentas: r.estado_cuentas,
                    pto_ordinario: r.pto_ordinario,
                    pto_extra: r.pto_extra,
                    morosos: r.morosos,
                    citacion_email: r.citacion_email,
                    citacion_carta: r.citacion_carta,
                    redactar_acta: r.redactar_acta,
                    vb_pendiente: r.vb_pendiente,
                    acta_email: r.acta_email,
                    acta_carta: r.acta_carta,
                    pasar_acuerdos: r.pasar_acuerdos,
                    resuelto: estadoRows[globalIdx] ?? false,
                };
            });

            // Filas sin comunidad asignada → marcar como error sin llamar API
            batch.forEach((b, j) => {
                if (!b) {
                    updated[start + j] = { ...updated[start + j], status: 'error', message: 'Sin comunidad asignada' };
                    errCount++;
                }
            });

            const validBatch = batch.filter(Boolean) as NonNullable<typeof batch[number]>[];
            const validIdxs = batch.map((b, j) => b ? start + j : null).filter(x => x !== null) as number[];

            if (validBatch.length > 0) {
                try {
                    const res = await fetch('/api/reuniones/import', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ rows: validBatch }),
                    });
                    const data = await res.json();

                    if (!res.ok) {
                        validIdxs.forEach(idx => {
                            updated[idx] = { ...updated[idx], status: 'error', message: data.error || 'Error del servidor' };
                            errCount++;
                        });
                    } else {
                        (data.results as { status: 'ok' | 'skipped' | 'error'; message?: string }[])
                            .forEach((result, j) => {
                                const idx = validIdxs[j];
                                updated[idx] = { ...updated[idx], status: result.status, message: result.message };
                                if (result.status === 'ok') okCount++;
                                else if (result.status === 'skipped') skipCount++;
                                else errCount++;
                            });
                    }
                } catch (err: any) {
                    validIdxs.forEach(idx => {
                        updated[idx] = { ...updated[idx], status: 'error', message: err?.message || 'Error de red' };
                        errCount++;
                    });
                }
            }

            setRows([...updated]);
        }

        setImporting(false);
        setDone(true);
        onImported();

        if (okCount > 0) toast.success(`${okCount} reuniones importadas.`);
        if (skipCount > 0) toast(`${skipCount} ya existían, omitidas.`, { icon: '⚠️' });
        if (errCount > 0) toast.error(`${errCount} errores.`);
    };

    const stats = {
        ok:      rows.filter(r => r.status === 'ok').length,
        skipped: rows.filter(r => r.status === 'skipped').length,
        error:   rows.filter(r => r.status === 'error').length,
        pending: rows.filter(r => r.status === 'pending').length,
    };

    const importable = rows.filter((r, i) => {
        const cid = overrides[i] ?? r.comunidad_id;
        return cid !== null && r.status === 'pending';
    }).length;

    return (
        <ModalPortal>
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex justify-center items-end sm:items-center sm:p-6"
                onClick={onClose}
            >
                <div
                    className="bg-white w-full max-w-5xl rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[92dvh] sm:max-h-[90dvh] animate-in fade-in slide-in-from-bottom sm:zoom-in-95 duration-200"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex justify-between items-center px-5 py-4 border-b border-neutral-100 bg-neutral-50 shrink-0">
                        <div>
                            <h2 className="text-lg font-bold text-neutral-900 tracking-tight">Importar Reuniones</h2>
                            <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-0.5">
                                Desde fichero Excel (.xlsx) — Hoja &quot;Seg. Juntas&quot;
                            </p>
                        </div>
                        <button onClick={onClose} className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-4 sm:px-5 sm:py-4 overflow-y-auto custom-scrollbar flex-1">
                        <div className="space-y-4">

                            {/* Hint */}
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 flex gap-3">
                                <AlertCircle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
                                <div className="text-xs text-yellow-800 space-y-0.5">
                                    <p className="font-bold">Formato esperado: hoja &quot;Seg. Juntas&quot; del fichero de datos generales</p>
                                    <p>Columnas: <span className="font-semibold">COMUNIDAD · FECHA REUNIÓN · TIPO · ESTADO DE CUENTAS · PTO. ORDINARIO · PTO. EXTRA · MOROSOS · CITACIÓN @ · CIT. CARTA · REDACTAR ACTA · Vº Bº PDT. · ACTA @ · ACTA CARTA · PASAR ACUERDOS</span></p>
                                    <p className="text-yellow-700">Las filas ya existentes (misma comunidad + fecha) se omiten. Los códigos de comunidad se detectan automáticamente.</p>
                                </div>
                            </div>

                            {/* Drop zone */}
                            {!fileName && (
                                <label
                                    className={`block border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${dragOver ? 'border-[#bf4b50] bg-yellow-50' : 'border-neutral-200 hover:border-[#bf4b50] hover:bg-neutral-50'}`}
                                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                                    onDragLeave={() => setDragOver(false)}
                                    onDrop={handleDrop}
                                    htmlFor="import-reuniones-input"
                                >
                                    <FileSpreadsheet className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
                                    <p className="text-sm font-semibold text-neutral-600">Arrastra el fichero aquí o haz clic para seleccionar</p>
                                    <p className="text-xs text-neutral-400 mt-1">Formato soportado: .xlsx, .xls</p>
                                    <input
                                        id="import-reuniones-input"
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".xlsx,.xls"
                                        className="hidden"
                                        onChange={handleFileChange}
                                    />
                                </label>
                            )}

                            {/* Fichero cargado */}
                            {fileName && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <FileSpreadsheet className="w-4 h-4 text-neutral-500" />
                                            <span className="text-sm font-semibold text-neutral-700">{fileName}</span>
                                            <span className="text-xs bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded-full">{rows.length} filas</span>
                                        </div>
                                        <button
                                            onClick={() => { setFileName(''); setRows([]); setDone(false); setOverrides({}); setEstadoRows({}); }}
                                            className="text-xs text-neutral-400 hover:text-red-500 flex items-center gap-1 transition-colors"
                                        >
                                            <RefreshCw className="w-3 h-3" /> Cambiar fichero
                                        </button>
                                    </div>

                                    {/* Contadores — siempre visibles una vez cargado el fichero */}
                                    <div className="grid grid-cols-4 gap-3">
                                        <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 text-center">
                                            <p className="text-lg font-bold text-neutral-900">{rows.length}</p>
                                            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-0.5">Total Excel</p>
                                        </div>
                                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-center">
                                            <p className="text-lg font-bold text-blue-700">{importable + stats.ok}</p>
                                            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mt-0.5">Se importan</p>
                                        </div>
                                        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-center">
                                            <p className="text-lg font-bold text-amber-700">{rows.filter((r, i) => !(overrides[i] ?? r.comunidad_id) && r.status === 'pending').length}</p>
                                            <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mt-0.5">Sin comunidad</p>
                                        </div>
                                        <div className={`border rounded-lg p-3 text-center ${stats.error > 0 ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
                                            <p className={`text-lg font-bold ${stats.error > 0 ? 'text-red-700' : 'text-green-700'}`}>{stats.error > 0 ? stats.error : stats.ok}</p>
                                            <p className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 ${stats.error > 0 ? 'text-red-400' : 'text-green-400'}`}>{stats.error > 0 ? 'Errores' : 'Importadas'}</p>
                                        </div>
                                    </div>

                                    {/* Tabla preview */}
                                    <div>
                                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#bf4b50]">
                                            <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest leading-none">Vista previa</h3>
                                            {!done && rows.length > 0 && (
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setAllEstado(true)}
                                                        className="text-[10px] font-bold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 px-2 py-1 rounded transition-colors"
                                                    >
                                                        Marcar todas Resuelto
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setAllEstado(false)}
                                                        className="text-[10px] font-bold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 px-2 py-1 rounded transition-colors"
                                                    >
                                                        Marcar todas Pendiente
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        <div className="overflow-auto max-h-[380px] rounded-lg border border-neutral-200">
                                            <table className="w-full text-xs">
                                                <thead className="bg-neutral-50 sticky top-0 z-10">
                                                    <tr>
                                                        <th className="text-left text-[9px] font-bold uppercase tracking-wider text-neutral-500 px-3 py-2 w-5">#</th>
                                                        <th className="text-left text-[9px] font-bold uppercase tracking-wider text-neutral-500 px-3 py-2 min-w-[160px]">Comunidad</th>
                                                        <th className="text-left text-[9px] font-bold uppercase tracking-wider text-neutral-500 px-3 py-2 whitespace-nowrap">Fecha</th>
                                                        <th className="text-left text-[9px] font-bold uppercase tracking-wider text-neutral-500 px-3 py-2">Tipo</th>
                                                        <th className="text-center text-[9px] font-bold uppercase tracking-wider text-neutral-500 px-2 py-2 whitespace-nowrap">E.Ctas</th>
                                                        <th className="text-center text-[9px] font-bold uppercase tracking-wider text-neutral-500 px-2 py-2 whitespace-nowrap">Ord</th>
                                                        <th className="text-center text-[9px] font-bold uppercase tracking-wider text-neutral-500 px-2 py-2 whitespace-nowrap">Extra</th>
                                                        <th className="text-center text-[9px] font-bold uppercase tracking-wider text-neutral-500 px-2 py-2 whitespace-nowrap">Mor</th>
                                                        <th className="text-center text-[9px] font-bold uppercase tracking-wider text-neutral-500 px-2 py-2 whitespace-nowrap">Cit@</th>
                                                        <th className="text-center text-[9px] font-bold uppercase tracking-wider text-neutral-500 px-2 py-2 whitespace-nowrap">Cit✉</th>
                                                        <th className="text-center text-[9px] font-bold uppercase tracking-wider text-neutral-500 px-2 py-2 whitespace-nowrap">Acta</th>
                                                        <th className="text-center text-[9px] font-bold uppercase tracking-wider text-neutral-500 px-2 py-2 whitespace-nowrap">VºBº</th>
                                                        <th className="text-center text-[9px] font-bold uppercase tracking-wider text-neutral-500 px-2 py-2 whitespace-nowrap">Acta@</th>
                                                        <th className="text-center text-[9px] font-bold uppercase tracking-wider text-neutral-500 px-2 py-2 whitespace-nowrap">Acta✉</th>
                                                        <th className="text-center text-[9px] font-bold uppercase tracking-wider text-neutral-500 px-2 py-2 whitespace-nowrap">Acuerd</th>
                                                        <th className="text-left text-[9px] font-bold uppercase tracking-wider text-neutral-500 px-3 py-2 w-24">Estado</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {rows.map((row, idx) => {
                                                        const comunidadId = overrides[idx] ?? row.comunidad_id;
                                                        const sinComunidad = !comunidadId && row.status === 'pending';
                                                        const isResuelto = estadoRows[idx] ?? false;
                                                        const rowBg =
                                                            row.status === 'ok'      ? 'bg-green-50/60' :
                                                            row.status === 'skipped' ? 'bg-yellow-50/60' :
                                                            row.status === 'error'   ? 'bg-red-50/60' :
                                                            sinComunidad             ? 'bg-amber-50/40' : '';

                                                        const boolCell = (val: boolean) => (
                                                            <td className="px-2 py-2 text-center">
                                                                <span className={`inline-block w-3 h-3 rounded-sm ${val ? 'bg-green-500' : 'bg-neutral-200'}`} />
                                                            </td>
                                                        );

                                                        return (
                                                            <tr key={idx} className={`border-t border-neutral-100 transition-colors ${rowBg}`}>
                                                                <td className="px-3 py-2 text-neutral-400">{idx + 1}</td>
                                                                <td className="px-3 py-2 max-w-[200px]">
                                                                    {sinComunidad ? (
                                                                        <div className="space-y-1">
                                                                            <span className="block text-[10px] text-amber-700 font-bold truncate" title={row.comunidad_raw}>{row.comunidad_raw}</span>
                                                                            <select
                                                                                value={overrides[idx] ?? ''}
                                                                                onChange={e => {
                                                                                    const val = e.target.value;
                                                                                    setOverrides(prev => {
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
                                                                                    <option key={c.id} value={c.id}>{c.codigo ? `${c.codigo} - ` : ''}{c.nombre_cdad}</option>
                                                                                ))}
                                                                            </select>
                                                                        </div>
                                                                    ) : (
                                                                        <span className="font-medium text-neutral-800 truncate block" title={row.comunidad_raw}>
                                                                            {comunidades.find(c => c.id === comunidadId)?.nombre_cdad ?? row.comunidad_raw}
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td className="px-3 py-2 whitespace-nowrap text-neutral-600 font-medium">
                                                                    {row.fecha_reunion ? new Date(row.fecha_reunion + 'T00:00:00').toLocaleDateString('es-ES') : '-'}
                                                                </td>
                                                                <td className="px-3 py-2">
                                                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                                                        row.tipo === 'JGO' ? 'bg-blue-100 text-blue-700' :
                                                                        row.tipo === 'JGE' ? 'bg-orange-100 text-orange-700' :
                                                                        row.tipo === 'JD'  ? 'bg-teal-100 text-teal-700' :
                                                                        'bg-purple-100 text-purple-700'
                                                                    }`}>{row.tipo}</span>
                                                                </td>
                                                                {boolCell(row.estado_cuentas)}
                                                                {boolCell(row.pto_ordinario)}
                                                                {boolCell(row.pto_extra)}
                                                                {boolCell(row.morosos)}
                                                                {boolCell(row.citacion_email)}
                                                                {boolCell(row.citacion_carta)}
                                                                {boolCell(row.redactar_acta)}
                                                                {boolCell(row.vb_pendiente)}
                                                                {boolCell(row.acta_email)}
                                                                {boolCell(row.acta_carta)}
                                                                {boolCell(row.pasar_acuerdos)}
                                                                <td className="px-3 py-2 whitespace-nowrap">
                                                                    {row.status === 'ok' && (
                                                                        <span className="inline-flex items-center gap-1 text-[10px] text-green-700 font-semibold">
                                                                            <CheckCircle className="w-3 h-3" /> Importada
                                                                        </span>
                                                                    )}
                                                                    {row.status === 'skipped' && (
                                                                        <span className="text-[10px] text-yellow-700 font-semibold">{row.message ?? 'Omitida'}</span>
                                                                    )}
                                                                    {row.status === 'error' && (
                                                                        <span className="inline-flex items-center gap-1 text-[10px] text-red-700 font-semibold cursor-help" title={row.message}>
                                                                            <AlertCircle className="w-3 h-3" />
                                                                            <span className="max-w-[100px] truncate">{row.message ?? 'Error'}</span>
                                                                        </span>
                                                                    )}
                                                                    {row.status === 'pending' && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => toggleEstado(idx)}
                                                                            className={`flex items-center gap-1.5 rounded text-[10px] font-bold px-2 py-1 transition-colors whitespace-nowrap ${
                                                                                isResuelto
                                                                                    ? 'bg-neutral-900 text-white hover:bg-neutral-700'
                                                                                    : 'bg-white border border-neutral-200 text-neutral-500 hover:bg-neutral-50'
                                                                            }`}
                                                                        >
                                                                            <div className={`w-3 h-3 rounded-sm flex items-center justify-center shrink-0 ${isResuelto ? 'bg-white/20' : 'border border-neutral-300'}`}>
                                                                                {isResuelto && <CheckCircle className="w-2 h-2 text-white" />}
                                                                            </div>
                                                                            {isResuelto ? 'Resuelto' : 'Pendiente'}
                                                                        </button>
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
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-neutral-100 bg-neutral-50 flex items-center justify-between shrink-0 flex-wrap gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200 bg-neutral-100 rounded-lg transition"
                        >
                            {done ? 'Cerrar' : 'Cancelar'}
                        </button>

                        {rows.length > 0 && !done && (
                            <button
                                onClick={handleImport}
                                disabled={importing || importable === 0}
                                className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-white bg-[#bf4b50] hover:bg-[#a03d42] rounded-lg transition shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {importing ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Importando {rows.filter(r => r.status !== 'pending').length}/{rows.length}…
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-4 h-4" />
                                        Importar {importable} reuniones
                                    </>
                                )}
                            </button>
                        )}

                        {done && (
                            <div className="flex items-center gap-2 text-sm font-semibold text-green-700">
                                <CheckCircle className="w-4 h-4" />
                                Importación completada — {stats.ok} reuniones importadas
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </ModalPortal>
    );
}
