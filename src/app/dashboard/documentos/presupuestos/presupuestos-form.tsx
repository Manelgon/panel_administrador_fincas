"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "react-hot-toast";
import {
    Download,
    Loader2,
    Upload,
    FileText,
    AlertTriangle,
    Sparkles,
    ArrowLeft,
    X,
    CheckCircle2,
    Pencil,
    Save,
    Plus,
    Trash2,
    AlertCircle,
} from "lucide-react";
import { createPortal } from "react-dom";
import SearchableSelect from "@/components/SearchableSelect";
import { createBrowserClient } from "@supabase/ssr";
import { useGlobalLoading } from "@/lib/globalLoading";

interface Comunidad {
    id: number;
    codigo: string;
    nombre_cdad: string;
}

type Stage = "form" | "analyzing" | "review" | "generating" | "ready";

type GastosVariosModo = "mantener" | "subir_pct" | "importe_fijo" | "criterio_ia";
type CuotasSubidaModo = "pct_cuota_actual" | "importe_fijo" | "criterio_ia";

interface Partida {
    nombre: string;
    gasto_anterior: number;
    presupuesto_propuesto: number;
    variacion_eur: number;
    variacion_pct: number;
}

interface CuotaActual {
    tipo_finca: string;
    num_fincas: number;
    cuota_mensual: number;
    total_mensual: number;
    total_anual: number;
}

interface SubidaPorTipo {
    tipo_finca: string;
    cuota_actual: number;
    cuota_nueva: number;
    subida_eur: number;
    subida_pct: number;
}

interface Analysis {
    comunidad: string;
    ejercicio_analizado: string;
    introduccion: string;
    partidas: Partida[];
    total_gasto_anterior: number;
    total_presupuesto_propuesto: number;
    cuotas_actuales: CuotaActual[];
    ingresos_previstos_anual: number;
    resultado_estimado: { ingresos: number; gastos: number; resultado: number };
    subida_propuesta: { pct_medio_ponderado: number; por_tipo: SubidaPorTipo[] };
    justificacion: string[];
    observaciones: string[];
    advertencias: string[];
}

const money = (v: any) =>
    Number(v ?? 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const pct = (v: any) =>
    Number(v ?? 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " %";

export default function PresupuestosForm({
    onSuccess,
    onCancel,
    registerCloseGuard,
}: {
    onSuccess?: () => void;
    onCancel?: () => void;
    registerCloseGuard?: (fn: (() => boolean | Promise<boolean>) | null) => void;
}) {
    const { withLoading } = useGlobalLoading();
    const [stage, setStage] = useState<Stage>("form");
    const [communities, setCommunities] = useState<Comunidad[]>([]);
    const [comunidadCodigo, setComunidadCodigo] = useState("");
    const [liquidacionFile, setLiquidacionFile] = useState<File | null>(null);
    const [cuotasFile, setCuotasFile] = useState<File | null>(null);
    const [analysis, setAnalysis] = useState<Analysis | null>(null);
    const [pdfUrl, setPdfUrl] = useState("");
    const [docxUrl, setDocxUrl] = useState("");
    const [editing, setEditing] = useState(false);
    const editSnapshotRef = useRef<Analysis | null>(null);

    // Parámetros del análisis IA
    const [pctSubidaGlobal, setPctSubidaGlobal] = useState<number>(0);
    const [gastosVariosModo, setGastosVariosModo] = useState<GastosVariosModo>("criterio_ia");
    const [gastosVariosValor, setGastosVariosValor] = useState<number>(0);
    const [cuotasSubidaModo, setCuotasSubidaModo] = useState<CuotasSubidaModo>("criterio_ia");
    const [cuotasSubidaValor, setCuotasSubidaValor] = useState<number>(0);

    const [confirmState, setConfirmState] = useState<{
        open: boolean;
        title: string;
        message: string;
        confirmText: string;
        resolve?: (v: boolean) => void;
    }>({ open: false, title: "", message: "", confirmText: "Aceptar" });

    const askConfirm = (title: string, message: string, confirmText = "Sí, continuar") =>
        new Promise<boolean>((resolve) => {
            setConfirmState({ open: true, title, message, confirmText, resolve });
        });

    const closeConfirm = (value: boolean) => {
        confirmState.resolve?.(value);
        setConfirmState((s) => ({ ...s, open: false, resolve: undefined }));
    };

    // Confirmación al cerrar el modal cuando hay datos sin descargar
    useEffect(() => {
        if (!registerCloseGuard) return;
        const needsConfirm = (stage === "review" && analysis !== null) || editing;
        if (needsConfirm) {
            registerCloseGuard(() =>
                askConfirm(
                    editing ? "¿Descartar los cambios?" : "¿Cerrar sin descargar?",
                    editing
                        ? "Si cierras ahora se perderán los cambios sin guardar."
                        : "Se perderá el presupuesto generado y tendrás que repetir el análisis.",
                    editing ? "Sí, descartar" : "Sí, cerrar",
                ),
            );
        } else {
            registerCloseGuard(null);
        }
        return () => registerCloseGuard(null);
    }, [stage, editing, analysis, registerCloseGuard]);

    const handleEnterEdit = () => {
        if (analysis) editSnapshotRef.current = structuredClone(analysis);
        setEditing(true);
    };

    const handleCancelEdit = () => {
        if (editSnapshotRef.current) {
            setAnalysis(editSnapshotRef.current);
            editSnapshotRef.current = null;
        }
        setEditing(false);
    };

    const handleCancelReview = async () => {
        if (analysis) {
            const ok = await askConfirm(
                "¿Cerrar sin descargar?",
                "Se perderá el presupuesto generado y tendrás que repetir el análisis.",
                "Sí, cerrar",
            );
            if (!ok) return;
        }
        onCancel?.();
    };

    const liquidacionRef = useRef<HTMLInputElement>(null);
    const cuotasRef = useRef<HTMLInputElement>(null);

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    useEffect(() => {
        (async () => {
            const { data } = await supabase
                .from("comunidades")
                .select("id, codigo, nombre_cdad")
                .eq("activo", true)
                .order("codigo", { ascending: true });
            setCommunities(data || []);
        })();
    }, []);

    const handlePickFile = (which: "liquidacion" | "cuotas", file: File | null) => {
        if (!file) return;
        if (file.type !== "application/pdf") {
            toast.error("Sólo se admiten archivos PDF");
            return;
        }
        if (file.size > 15 * 1024 * 1024) {
            toast.error("El PDF no puede superar 15 MB");
            return;
        }
        if (which === "liquidacion") setLiquidacionFile(file);
        else setCuotasFile(file);
    };

    const analyze = async () => {
        if (!liquidacionFile || !cuotasFile) {
            toast.error("Sube los dos PDFs antes de analizar");
            return;
        }

        await withLoading(async () => {
            setStage("analyzing");
            try {
                const fd = new FormData();
                fd.append("liquidacion", liquidacionFile);
                fd.append("cuotas", cuotasFile);
                if (comunidadCodigo) fd.append("comunidad_codigo", comunidadCodigo);
                fd.append("pct_subida_global", String(pctSubidaGlobal));
                fd.append("gastos_varios_modo", gastosVariosModo);
                fd.append("gastos_varios_valor", String(gastosVariosValor));
                fd.append("cuotas_subida_modo", cuotasSubidaModo);
                fd.append("cuotas_subida_valor", String(cuotasSubidaValor));

                const res = await fetch("/api/documentos/presupuestos/analyze", {
                    method: "POST",
                    body: fd,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || "Error analizando los PDFs");

                setAnalysis(data.analysis);
                setStage("review");
                toast.success("Análisis completado");
            } catch (err: any) {
                console.error(err);
                setStage("form");
                toast.error(err?.message || "Error analizando los PDFs");
            }
        }, "Analizando documentos con IA...");
    };

    // ----- Edición + recálculo -----
    const recompute = (a: Analysis): Analysis => {
        const partidas = a.partidas.map((p) => {
            const ga = Number(p.gasto_anterior) || 0;
            const pp = Number(p.presupuesto_propuesto) || 0;
            const variacion_eur = +(pp - ga).toFixed(2);
            const variacion_pct = ga > 0 ? +(((pp - ga) / ga) * 100).toFixed(2) : 0;
            return { ...p, gasto_anterior: ga, presupuesto_propuesto: pp, variacion_eur, variacion_pct };
        });
        const total_gasto_anterior = +partidas.reduce((s, p) => s + p.gasto_anterior, 0).toFixed(2);
        const total_presupuesto_propuesto = +partidas.reduce((s, p) => s + p.presupuesto_propuesto, 0).toFixed(2);

        const cuotas_actuales = a.cuotas_actuales.map((c) => {
            const num_fincas = Number(c.num_fincas) || 0;
            const cuota_mensual = Number(c.cuota_mensual) || 0;
            const total_mensual = +(num_fincas * cuota_mensual).toFixed(2);
            const total_anual = +(total_mensual * 12).toFixed(2);
            return { ...c, num_fincas, cuota_mensual, total_mensual, total_anual };
        });
        const ingresos_previstos_anual = +cuotas_actuales.reduce((s, c) => s + c.total_anual, 0).toFixed(2);

        const resultado_estimado = {
            ingresos: ingresos_previstos_anual,
            gastos: total_presupuesto_propuesto,
            resultado: +(ingresos_previstos_anual - total_presupuesto_propuesto).toFixed(2),
        };

        const por_tipo = a.subida_propuesta.por_tipo.map((t) => {
            const cuota_actual = Number(t.cuota_actual) || 0;
            const cuota_nueva = Number(t.cuota_nueva) || 0;
            const subida_eur = +(cuota_nueva - cuota_actual).toFixed(2);
            const subida_pct = cuota_actual > 0 ? +(((cuota_nueva - cuota_actual) / cuota_actual) * 100).toFixed(2) : 0;
            return { ...t, cuota_actual, cuota_nueva, subida_eur, subida_pct };
        });

        // % medio ponderado por nº de fincas del tipo (matching por nombre tipo_finca)
        const fincasByTipo = new Map(cuotas_actuales.map((c) => [c.tipo_finca, c.num_fincas]));
        const totFincas = por_tipo.reduce((s, t) => s + (fincasByTipo.get(t.tipo_finca) || 0), 0);
        const pct_medio_ponderado =
            totFincas > 0
                ? +(
                      por_tipo.reduce(
                          (s, t) => s + (t.subida_pct * (fincasByTipo.get(t.tipo_finca) || 0)),
                          0,
                      ) / totFincas
                  ).toFixed(2)
                : por_tipo.length > 0
                  ? +(por_tipo.reduce((s, t) => s + t.subida_pct, 0) / por_tipo.length).toFixed(2)
                  : 0;

        return {
            ...a,
            partidas,
            total_gasto_anterior,
            total_presupuesto_propuesto,
            cuotas_actuales,
            ingresos_previstos_anual,
            resultado_estimado,
            subida_propuesta: { pct_medio_ponderado, por_tipo },
        };
    };

    const updateAnalysis = (mutator: (a: Analysis) => Analysis) => {
        setAnalysis((prev) => (prev ? mutator(structuredClone(prev)) : prev));
    };

    const saveEdits = () => {
        setAnalysis((prev) => (prev ? recompute(prev) : prev));
        editSnapshotRef.current = null;
        setEditing(false);
        toast.success("Cambios guardados y totales recalculados");
    };

    const generate = async () => {
        if (!analysis) return;
        await withLoading(async () => {
            setStage("generating");
            try {
                const res = await fetch("/api/documentos/presupuestos/generate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ analysis, comunidad_codigo: comunidadCodigo }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || "Error generando los documentos");

                setPdfUrl(data.pdfUrl || "");
                setDocxUrl(data.docxUrl || "");
                setStage("ready");
                toast.success("Documentos generados ✅");
            } catch (err: any) {
                console.error(err);
                setStage("review");
                toast.error(err?.message || "Error generando los documentos");
            }
        }, "Generando DOCX + PDF...");
    };

    const confirmDialogEl = (
        <ConfirmDialog
            open={confirmState.open}
            title={confirmState.title}
            message={confirmState.message}
            confirmText={confirmState.confirmText}
            onConfirm={() => closeConfirm(true)}
            onCancel={() => closeConfirm(false)}
        />
    );

    // =================== READY ===================
    if (stage === "ready") {
        return (
            <div className="flex flex-col h-full overflow-hidden">
                {confirmDialogEl}
                <div className="flex-grow overflow-y-auto custom-scrollbar p-8">
                    <div className="max-w-md mx-auto space-y-8 py-8 text-center">
                        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                            <CheckCircle2 className="w-8 h-8" />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-2xl font-bold text-slate-900">¡Presupuesto generado!</h2>
                            <p className="text-slate-600">Descarga el documento en el formato que prefieras.</p>
                        </div>
                        <div className="flex flex-col gap-3">
                            {docxUrl && (
                                <a
                                    href={docxUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 rounded-xl font-bold transition flex items-center justify-center gap-2"
                                >
                                    <Download className="w-5 h-5" />
                                    Descargar Word (DOCX)
                                </a>
                            )}
                            {pdfUrl && (
                                <a
                                    href={pdfUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 rounded-xl font-bold transition flex items-center justify-center gap-2"
                                >
                                    <Download className="w-5 h-5" />
                                    Descargar PDF
                                </a>
                            )}
                            <button
                                onClick={() => {
                                    setStage("form");
                                    setLiquidacionFile(null);
                                    setCuotasFile(null);
                                    setComunidadCodigo("");
                                    setAnalysis(null);
                                    setPdfUrl("");
                                    setDocxUrl("");
                                    setEditing(false);
                                }}
                                className="w-full bg-white border border-slate-200 hover:bg-slate-50 h-12 rounded-xl font-bold transition"
                            >
                                Crear otro presupuesto
                            </button>
                            <a
                                href="/dashboard/documentos"
                                className="w-full text-slate-400 hover:text-slate-600 text-sm font-medium transition underline"
                                onClick={onSuccess}
                            >
                                Ir al listado
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // =================== REVIEW ===================
    if ((stage === "review" || stage === "generating") && analysis) {
        return (
            <div className="flex flex-col h-full overflow-hidden">
                {confirmDialogEl}
                <div className="flex-grow overflow-y-auto p-4 sm:px-5 sm:py-4 custom-scrollbar">
                    <div className="max-w-4xl mx-auto space-y-5">
                        {/* Cabecera */}
                        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                            <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">
                                Comunidad
                            </div>
                            {editing ? (
                                <>
                                    <input
                                        className="w-full bg-white border border-yellow-300 rounded-md px-2 py-1 text-lg font-bold text-neutral-900"
                                        value={analysis.comunidad || ""}
                                        onChange={(e) =>
                                            updateAnalysis((a) => ({ ...a, comunidad: e.target.value }))
                                        }
                                    />
                                    <div className="mt-2">
                                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                                            Ejercicio analizado
                                        </label>
                                        <input
                                            className="w-full bg-white border border-yellow-300 rounded-md px-2 py-1 text-xs text-neutral-700"
                                            value={analysis.ejercicio_analizado || ""}
                                            onChange={(e) =>
                                                updateAnalysis((a) => ({ ...a, ejercicio_analizado: e.target.value }))
                                            }
                                        />
                                    </div>
                                    <div className="mt-2">
                                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                                            Introducción
                                        </label>
                                        <textarea
                                            rows={3}
                                            className="w-full bg-white border border-yellow-300 rounded-md px-2 py-1 text-sm text-neutral-700"
                                            value={analysis.introduccion || ""}
                                            onChange={(e) =>
                                                updateAnalysis((a) => ({ ...a, introduccion: e.target.value }))
                                            }
                                        />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <h2 className="text-lg font-bold text-neutral-900">{analysis.comunidad || "—"}</h2>
                                    {analysis.ejercicio_analizado && (
                                        <p className="text-xs text-neutral-600 mt-1">
                                            Ejercicio analizado: <strong>{analysis.ejercicio_analizado}</strong>
                                        </p>
                                    )}
                                    {analysis.introduccion && (
                                        <p className="text-sm text-neutral-700 mt-3 leading-relaxed">{analysis.introduccion}</p>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Advertencias */}
                        {(analysis.advertencias?.length > 0 || editing) && (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                                <div className="flex items-center gap-2 text-red-700 font-bold text-sm mb-2">
                                    <AlertTriangle className="w-4 h-4" />
                                    Advertencias
                                </div>
                                {editing ? (
                                    <EditableList
                                        items={analysis.advertencias || []}
                                        onChange={(items) =>
                                            updateAnalysis((a) => ({ ...a, advertencias: items }))
                                        }
                                        placeholder="Advertencia..."
                                        tone="red"
                                    />
                                ) : (
                                    <ul className="text-sm text-red-800 space-y-1 list-disc list-inside">
                                        {analysis.advertencias.map((adv, i) => (
                                            <li key={i}>{adv}</li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}

                        {/* Tabla 1 — Gastos */}
                        <Section title="1. Presupuesto de gastos ordinarios">
                            <div className="overflow-x-auto border border-neutral-100 rounded-lg">
                                <table className="w-full text-sm">
                                    <thead className="bg-neutral-50 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                                        <tr>
                                            <th className="px-3 py-2 text-left">Partida</th>
                                            <th className="px-3 py-2 text-right">Gasto anterior</th>
                                            <th className="px-3 py-2 text-right">Propuesto</th>
                                            <th className="px-3 py-2 text-right">Variación €</th>
                                            <th className="px-3 py-2 text-right">Variación %</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-100">
                                        {analysis.partidas.map((p, i) => (
                                            <tr key={i}>
                                                <td className="px-3 py-2">
                                                    {editing ? (
                                                        <input
                                                            className="w-full bg-white border border-neutral-200 rounded px-2 py-1 text-sm"
                                                            value={p.nombre}
                                                            onChange={(e) =>
                                                                updateAnalysis((a) => {
                                                                    a.partidas[i].nombre = e.target.value;
                                                                    return a;
                                                                })
                                                            }
                                                        />
                                                    ) : (
                                                        p.nombre
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 text-right tabular-nums">
                                                    {editing ? (
                                                        <NumberInput
                                                            value={p.gasto_anterior}
                                                            onChange={(v) =>
                                                                updateAnalysis((a) => {
                                                                    a.partidas[i].gasto_anterior = v;
                                                                    return a;
                                                                })
                                                            }
                                                        />
                                                    ) : (
                                                        money(p.gasto_anterior)
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 text-right tabular-nums">
                                                    {editing ? (
                                                        <NumberInput
                                                            value={p.presupuesto_propuesto}
                                                            onChange={(v) =>
                                                                updateAnalysis((a) => {
                                                                    a.partidas[i].presupuesto_propuesto = v;
                                                                    return a;
                                                                })
                                                            }
                                                        />
                                                    ) : (
                                                        money(p.presupuesto_propuesto)
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 text-right tabular-nums text-neutral-500">{money(p.variacion_eur)}</td>
                                                <td className="px-3 py-2 text-right tabular-nums text-neutral-500">{pct(p.variacion_pct)}</td>
                                                {editing && (
                                                    <td className="px-1">
                                                        <button
                                                            onClick={() =>
                                                                updateAnalysis((a) => {
                                                                    a.partidas.splice(i, 1);
                                                                    return a;
                                                                })
                                                            }
                                                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                                                            title="Eliminar partida"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                        {editing && (
                                            <tr>
                                                <td colSpan={6} className="px-3 py-2">
                                                    <button
                                                        onClick={() =>
                                                            updateAnalysis((a) => {
                                                                a.partidas.push({
                                                                    nombre: "Nueva partida",
                                                                    gasto_anterior: 0,
                                                                    presupuesto_propuesto: 0,
                                                                    variacion_eur: 0,
                                                                    variacion_pct: 0,
                                                                });
                                                                return a;
                                                            })
                                                        }
                                                        className="text-xs font-bold text-yellow-700 hover:text-yellow-800 flex items-center gap-1"
                                                    >
                                                        <Plus className="w-3.5 h-3.5" /> Añadir partida
                                                    </button>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                    <tfoot className="bg-neutral-50 font-bold">
                                        <tr>
                                            <td className="px-3 py-2">TOTAL</td>
                                            <td className="px-3 py-2 text-right tabular-nums">{money(analysis.total_gasto_anterior)}</td>
                                            <td className="px-3 py-2 text-right tabular-nums">{money(analysis.total_presupuesto_propuesto)}</td>
                                            <td className="px-3 py-2 text-right tabular-nums">
                                                {money(analysis.total_presupuesto_propuesto - analysis.total_gasto_anterior)}
                                            </td>
                                            <td className="px-3 py-2" />
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </Section>

                        {/* Tabla 2 — Cuotas actuales */}
                        <Section title="2. Detalle de cuotas comunitarias actuales">
                            <div className="overflow-x-auto border border-neutral-100 rounded-lg">
                                <table className="w-full text-sm">
                                    <thead className="bg-neutral-50 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                                        <tr>
                                            <th className="px-3 py-2 text-left">Tipo de finca</th>
                                            <th className="px-3 py-2 text-center">Nº fincas</th>
                                            <th className="px-3 py-2 text-right">Cuota mensual</th>
                                            <th className="px-3 py-2 text-right">Total mensual</th>
                                            <th className="px-3 py-2 text-right">Total anual</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-100">
                                        {analysis.cuotas_actuales.map((c, i) => (
                                            <tr key={i}>
                                                <td className="px-3 py-2">
                                                    {editing ? (
                                                        <input
                                                            className="w-full bg-white border border-neutral-200 rounded px-2 py-1 text-sm"
                                                            value={c.tipo_finca}
                                                            onChange={(e) =>
                                                                updateAnalysis((a) => {
                                                                    a.cuotas_actuales[i].tipo_finca = e.target.value;
                                                                    return a;
                                                                })
                                                            }
                                                        />
                                                    ) : (
                                                        c.tipo_finca
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 text-center tabular-nums">
                                                    {editing ? (
                                                        <NumberInput
                                                            value={c.num_fincas}
                                                            decimals={0}
                                                            onChange={(v) =>
                                                                updateAnalysis((a) => {
                                                                    a.cuotas_actuales[i].num_fincas = v;
                                                                    return a;
                                                                })
                                                            }
                                                        />
                                                    ) : (
                                                        c.num_fincas
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 text-right tabular-nums">
                                                    {editing ? (
                                                        <NumberInput
                                                            value={c.cuota_mensual}
                                                            onChange={(v) =>
                                                                updateAnalysis((a) => {
                                                                    a.cuotas_actuales[i].cuota_mensual = v;
                                                                    return a;
                                                                })
                                                            }
                                                        />
                                                    ) : (
                                                        money(c.cuota_mensual)
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 text-right tabular-nums text-neutral-500">{money(c.total_mensual)}</td>
                                                <td className="px-3 py-2 text-right tabular-nums text-neutral-500">{money(c.total_anual)}</td>
                                                {editing && (
                                                    <td className="px-1">
                                                        <button
                                                            onClick={() =>
                                                                updateAnalysis((a) => {
                                                                    a.cuotas_actuales.splice(i, 1);
                                                                    return a;
                                                                })
                                                            }
                                                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                                                            title="Eliminar tipo"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                        {editing && (
                                            <tr>
                                                <td colSpan={6} className="px-3 py-2">
                                                    <button
                                                        onClick={() =>
                                                            updateAnalysis((a) => {
                                                                a.cuotas_actuales.push({
                                                                    tipo_finca: "Nuevo tipo",
                                                                    num_fincas: 0,
                                                                    cuota_mensual: 0,
                                                                    total_mensual: 0,
                                                                    total_anual: 0,
                                                                });
                                                                return a;
                                                            })
                                                        }
                                                        className="text-xs font-bold text-yellow-700 hover:text-yellow-800 flex items-center gap-1"
                                                    >
                                                        <Plus className="w-3.5 h-3.5" /> Añadir tipo de finca
                                                    </button>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                    <tfoot className="bg-neutral-50 font-bold">
                                        <tr>
                                            <td className="px-3 py-2">TOTAL ANUAL</td>
                                            <td colSpan={3} />
                                            <td className="px-3 py-2 text-right tabular-nums">{money(analysis.ingresos_previstos_anual)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </Section>

                        {/* Resultado estimado */}
                        <Section title="3. Resultado estimado del ejercicio">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <Stat label="Ingresos previstos" value={money(analysis.resultado_estimado.ingresos)} />
                                <Stat label="Gastos presupuestados" value={money(analysis.resultado_estimado.gastos)} />
                                <Stat
                                    label="Resultado"
                                    value={money(analysis.resultado_estimado.resultado)}
                                    color={analysis.resultado_estimado.resultado >= 0 ? "emerald" : "red"}
                                />
                            </div>
                        </Section>

                        {/* Subida propuesta */}
                        <Section
                            title="4. Subida propuesta"
                            subtitle={`% medio ponderado: ${pct(analysis.subida_propuesta.pct_medio_ponderado)}`}
                        >
                            <div className="overflow-x-auto border border-neutral-100 rounded-lg">
                                <table className="w-full text-sm">
                                    <thead className="bg-neutral-50 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                                        <tr>
                                            <th className="px-3 py-2 text-left">Tipo de finca</th>
                                            <th className="px-3 py-2 text-right">Cuota actual</th>
                                            <th className="px-3 py-2 text-right">Cuota nueva</th>
                                            <th className="px-3 py-2 text-right">Subida €</th>
                                            <th className="px-3 py-2 text-right">Subida %</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-100">
                                        {analysis.subida_propuesta.por_tipo.map((t, i) => (
                                            <tr key={i}>
                                                <td className="px-3 py-2">
                                                    {editing ? (
                                                        <input
                                                            className="w-full bg-white border border-neutral-200 rounded px-2 py-1 text-sm"
                                                            value={t.tipo_finca}
                                                            onChange={(e) =>
                                                                updateAnalysis((a) => {
                                                                    a.subida_propuesta.por_tipo[i].tipo_finca = e.target.value;
                                                                    return a;
                                                                })
                                                            }
                                                        />
                                                    ) : (
                                                        t.tipo_finca
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 text-right tabular-nums">
                                                    {editing ? (
                                                        <NumberInput
                                                            value={t.cuota_actual}
                                                            onChange={(v) =>
                                                                updateAnalysis((a) => {
                                                                    a.subida_propuesta.por_tipo[i].cuota_actual = v;
                                                                    return a;
                                                                })
                                                            }
                                                        />
                                                    ) : (
                                                        money(t.cuota_actual)
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 text-right tabular-nums font-semibold">
                                                    {editing ? (
                                                        <NumberInput
                                                            value={t.cuota_nueva}
                                                            onChange={(v) =>
                                                                updateAnalysis((a) => {
                                                                    a.subida_propuesta.por_tipo[i].cuota_nueva = v;
                                                                    return a;
                                                                })
                                                            }
                                                        />
                                                    ) : (
                                                        money(t.cuota_nueva)
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 text-right tabular-nums text-neutral-500">{money(t.subida_eur)}</td>
                                                <td className="px-3 py-2 text-right tabular-nums text-neutral-500">{pct(t.subida_pct)}</td>
                                                {editing && (
                                                    <td className="px-1">
                                                        <button
                                                            onClick={() =>
                                                                updateAnalysis((a) => {
                                                                    a.subida_propuesta.por_tipo.splice(i, 1);
                                                                    return a;
                                                                })
                                                            }
                                                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                                                            title="Eliminar"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                        {editing && (
                                            <tr>
                                                <td colSpan={6} className="px-3 py-2">
                                                    <button
                                                        onClick={() =>
                                                            updateAnalysis((a) => {
                                                                a.subida_propuesta.por_tipo.push({
                                                                    tipo_finca: "Nuevo tipo",
                                                                    cuota_actual: 0,
                                                                    cuota_nueva: 0,
                                                                    subida_eur: 0,
                                                                    subida_pct: 0,
                                                                });
                                                                return a;
                                                            })
                                                        }
                                                        className="text-xs font-bold text-yellow-700 hover:text-yellow-800 flex items-center gap-1"
                                                    >
                                                        <Plus className="w-3.5 h-3.5" /> Añadir tipo
                                                    </button>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Section>

                        {/* Justificación */}
                        {(analysis.justificacion?.length > 0 || editing) && (
                            <Section title="5. Justificación de la subida propuesta">
                                {editing ? (
                                    <EditableList
                                        items={analysis.justificacion || []}
                                        onChange={(items) =>
                                            updateAnalysis((a) => ({ ...a, justificacion: items }))
                                        }
                                        placeholder="Justificación..."
                                    />
                                ) : (
                                    <ul className="space-y-2 text-sm text-neutral-700 list-disc list-inside">
                                        {analysis.justificacion.map((j, i) => (
                                            <li key={i}>{j}</li>
                                        ))}
                                    </ul>
                                )}
                            </Section>
                        )}

                        {/* Observaciones */}
                        {(analysis.observaciones?.length > 0 || editing) && (
                            <Section title="6. Observaciones finales">
                                {editing ? (
                                    <EditableList
                                        items={analysis.observaciones || []}
                                        onChange={(items) =>
                                            updateAnalysis((a) => ({ ...a, observaciones: items }))
                                        }
                                        placeholder="Observación..."
                                    />
                                ) : (
                                    <ul className="space-y-2 text-sm text-neutral-700 list-disc list-inside">
                                        {analysis.observaciones.map((o, i) => (
                                            <li key={i}>{o}</li>
                                        ))}
                                    </ul>
                                )}
                            </Section>
                        )}
                    </div>
                </div>

                <div className="px-5 py-3 border-t border-neutral-100 bg-neutral-50/40 flex justify-between gap-2 flex-wrap shrink-0">
                    <button
                        onClick={() => {
                            setEditing(false);
                            setStage("form");
                        }}
                        className="px-4 py-2 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-600 rounded-lg text-xs font-bold transition flex items-center gap-2"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Volver a los archivos
                    </button>
                    <div className="flex gap-2">
                        {editing ? (
                            <>
                                <button
                                    onClick={saveEdits}
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-2 shadow-sm"
                                >
                                    <Save className="w-3.5 h-3.5" />
                                    Guardar cambios
                                </button>
                                <button
                                    onClick={handleCancelEdit}
                                    className="px-4 py-2 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-600 rounded-lg text-xs font-bold transition"
                                >
                                    Cancelar
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={handleEnterEdit}
                                    className="px-4 py-2 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-700 rounded-lg text-xs font-bold transition flex items-center gap-2"
                                >
                                    <Pencil className="w-3.5 h-3.5" />
                                    Editar
                                </button>
                                <button
                                    onClick={handleCancelReview}
                                    className="px-4 py-2 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-600 rounded-lg text-xs font-bold transition"
                                >
                                    Cancelar
                                </button>
                            </>
                        )}
                        <button
                            onClick={generate}
                            disabled={stage === "generating" || editing}
                            title={editing ? "Guarda los cambios antes de generar" : undefined}
                            className="px-6 py-2 bg-yellow-400 hover:bg-yellow-500 text-neutral-950 rounded-lg text-xs font-bold transition disabled:opacity-50 flex items-center gap-2 shadow-sm"
                        >
                            {stage === "generating" ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    Generando...
                                </>
                            ) : (
                                <>
                                    <FileText className="w-3.5 h-3.5" />
                                    Generar DOCX + PDF
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // =================== FORM ===================
    const canAnalyze = !!liquidacionFile && !!cuotasFile && stage === "form";

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="flex-grow overflow-y-auto p-4 sm:px-5 sm:py-4 custom-scrollbar">
                <div className="max-w-3xl mx-auto space-y-5">
                    <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-neutral-700">
                        <div className="flex items-start gap-2">
                            <Sparkles className="w-4 h-4 text-yellow-600 mt-0.5 shrink-0" />
                            <div>
                                <p className="font-semibold text-neutral-900">¿Cómo funciona?</p>
                                <p className="mt-1 text-xs text-neutral-600">
                                    Sube la <strong>liquidación del ejercicio anterior</strong> y el{" "}
                                    <strong>listado de cuotas actuales</strong>. La IA analiza ambos PDFs y propone un
                                    presupuesto al alza, calculando además la subida necesaria sobre las cuotas. Después
                                    podrás revisar y generar el DOCX + PDF.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Comunidad (opcional) */}
                    <div>
                        <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">
                            Comunidad (opcional, para registro)
                        </label>
                        <SearchableSelect
                            value={comunidadCodigo}
                            onChange={(val) => setComunidadCodigo(String(val))}
                            options={communities.map((c) => ({
                                value: c.codigo,
                                label: `${c.codigo} - ${c.nombre_cdad}`,
                            }))}
                            placeholder="Selecciona la comunidad..."
                        />
                    </div>

                    {/* Uploads */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FilePicker
                            label="Liquidación del ejercicio anterior"
                            file={liquidacionFile}
                            onPick={(f) => handlePickFile("liquidacion", f)}
                            onClear={() => setLiquidacionFile(null)}
                            inputRef={liquidacionRef}
                        />
                        <FilePicker
                            label="Listado de cuotas actuales"
                            file={cuotasFile}
                            onPick={(f) => handlePickFile("cuotas", f)}
                            onClear={() => setCuotasFile(null)}
                            inputRef={cuotasRef}
                        />
                    </div>

                    {/* Parámetros del análisis */}
                    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 space-y-4">
                        <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                            Parámetros del análisis
                        </p>

                        {/* % Subida global */}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <label className="text-sm font-semibold text-neutral-700 sm:w-56 shrink-0">
                                % Subida global
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    min={0}
                                    max={50}
                                    step={0.1}
                                    value={pctSubidaGlobal}
                                    onChange={(e) => {
                                        const v = Math.min(50, Math.max(0, Number(e.target.value)));
                                        setPctSubidaGlobal(v);
                                    }}
                                    className="w-24 bg-white border border-neutral-200 rounded-lg px-3 py-2 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-yellow-400"
                                />
                                <span className="text-sm text-neutral-500">%</span>
                                {pctSubidaGlobal === 0 && (
                                    <span className="text-xs text-neutral-400 italic">La IA aplica su propio criterio</span>
                                )}
                            </div>
                        </div>

                        {/* Gastos varios */}
                        <div className="flex flex-col sm:flex-row sm:items-start gap-2">
                            <label className="text-sm font-semibold text-neutral-700 sm:w-56 shrink-0 sm:pt-2">
                                Gastos varios
                            </label>
                            <div className="flex flex-col gap-2 flex-1">
                                <select
                                    value={gastosVariosModo}
                                    onChange={(e) => setGastosVariosModo(e.target.value as GastosVariosModo)}
                                    className="bg-white border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                                >
                                    <option value="criterio_ia">Dejar a criterio de la IA</option>
                                    <option value="mantener">Mantener igual (mismo importe)</option>
                                    <option value="subir_pct">Subir un % concreto</option>
                                    <option value="importe_fijo">Fijar importe exacto (€)</option>
                                </select>
                                {(gastosVariosModo === "subir_pct" || gastosVariosModo === "importe_fijo") && (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            min={0}
                                            step={gastosVariosModo === "subir_pct" ? 0.1 : 1}
                                            value={gastosVariosValor}
                                            onChange={(e) => setGastosVariosValor(Math.max(0, Number(e.target.value)))}
                                            className="w-32 bg-white border border-neutral-200 rounded-lg px-3 py-2 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-yellow-400"
                                        />
                                        <span className="text-sm text-neutral-500">
                                            {gastosVariosModo === "subir_pct" ? "%" : "€"}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Separador */}
                        <div className="border-t border-neutral-200 pt-4">
                            <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-3">
                                Subida de cuotas de propietarios
                            </p>

                            {/* Modalidad subida cuotas */}
                            <div className="flex flex-col sm:flex-row sm:items-start gap-2">
                                <label className="text-sm font-semibold text-neutral-700 sm:w-56 shrink-0 sm:pt-2">
                                    Modalidad de subida
                                </label>
                                <div className="flex flex-col gap-2 flex-1">
                                    <select
                                        value={cuotasSubidaModo}
                                        onChange={(e) => setCuotasSubidaModo(e.target.value as CuotasSubidaModo)}
                                        className="bg-white border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                                    >
                                        <option value="criterio_ia">Dejar a criterio de la IA</option>
                                        <option value="pct_cuota_actual">% sobre cuota actual (por coeficiente)</option>
                                        <option value="importe_fijo">Importe fijo igual para todos (+€/mes)</option>
                                    </select>
                                    {(cuotasSubidaModo === "pct_cuota_actual" || cuotasSubidaModo === "importe_fijo") && (
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                min={0}
                                                step={cuotasSubidaModo === "pct_cuota_actual" ? 0.1 : 0.01}
                                                value={cuotasSubidaValor}
                                                onChange={(e) => setCuotasSubidaValor(Math.max(0, Number(e.target.value)))}
                                                className="w-32 bg-white border border-neutral-200 rounded-lg px-3 py-2 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-yellow-400"
                                            />
                                            <span className="text-sm text-neutral-500">
                                                {cuotasSubidaModo === "pct_cuota_actual" ? "%" : "€ / mes por finca"}
                                            </span>
                                        </div>
                                    )}
                                    {cuotasSubidaModo === "criterio_ia" && (
                                        <p className="text-xs text-neutral-400 italic">
                                            La IA propondrá la subida necesaria para equilibrar el presupuesto
                                        </p>
                                    )}
                                    {cuotasSubidaModo !== "criterio_ia" && cuotasSubidaValor > 0 && (
                                        <p className="text-xs text-neutral-500">
                                            {cuotasSubidaModo === "pct_cuota_actual"
                                                ? `Cada propietario pagará un ${cuotasSubidaValor}% más sobre su cuota actual`
                                                : `Cada propietario pagará ${cuotasSubidaValor}€/mes más, independientemente de su coeficiente`
                                            }
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-5 py-3 border-t border-neutral-100 bg-neutral-50/40 flex justify-end gap-2 flex-wrap shrink-0">
                <button
                    onClick={onCancel}
                    className="px-6 py-2 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-600 rounded-lg text-xs font-bold transition"
                >
                    Cancelar
                </button>
                <button
                    onClick={analyze}
                    disabled={!canAnalyze}
                    className="px-6 py-2 bg-yellow-400 hover:bg-yellow-500 text-neutral-950 rounded-lg text-xs font-bold transition disabled:opacity-50 flex items-center gap-2 shadow-sm"
                >
                    {stage === "analyzing" ? (
                        <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Analizando...
                        </>
                    ) : (
                        <>
                            <Sparkles className="w-3.5 h-3.5" />
                            Analizar con IA
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}

function Section({
    title,
    subtitle,
    children,
}: {
    title: string;
    subtitle?: string;
    children: React.ReactNode;
}) {
    return (
        <div>
            <div className="flex items-baseline justify-between gap-3 pb-2 mb-3 border-b border-yellow-400">
                <h3 className="text-sm font-bold text-neutral-900">{title}</h3>
                {subtitle && <span className="text-xs text-neutral-500">{subtitle}</span>}
            </div>
            {children}
        </div>
    );
}

function Stat({ label, value, color }: { label: string; value: string; color?: "emerald" | "red" }) {
    const colorCls =
        color === "emerald"
            ? "text-emerald-700 bg-emerald-50 border-emerald-200"
            : color === "red"
                ? "text-red-700 bg-red-50 border-red-200"
                : "text-neutral-900 bg-neutral-50 border-neutral-200";
    return (
        <div className={`rounded-lg border p-3 ${colorCls}`}>
            <div className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">{label}</div>
            <div className="text-base font-bold tabular-nums">{value}</div>
        </div>
    );
}

function ConfirmDialog({
    open,
    title,
    message,
    confirmText = "Aceptar",
    onConfirm,
    onCancel,
}: {
    open: boolean;
    title: string;
    message: string;
    confirmText?: string;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    if (!open || typeof window === "undefined") return null;
    return createPortal(
        <div
            className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-[100000] flex items-end sm:items-center sm:justify-center sm:p-4 animate-in fade-in duration-150"
            onClick={onCancel}
        >
            <div
                className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-sm p-6 flex flex-col items-center text-center animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="w-14 h-14 bg-yellow-50 rounded-full flex items-center justify-center mb-4">
                    <AlertCircle className="w-7 h-7 text-yellow-600" />
                </div>
                <h3 className="text-lg font-bold text-neutral-900 mb-1.5">{title}</h3>
                <p className="text-sm text-neutral-500 mb-6">{message}</p>
                <div className="flex gap-3 w-full">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-sm font-bold transition"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 py-2.5 bg-yellow-400 hover:bg-yellow-500 text-neutral-950 rounded-xl text-sm font-bold transition active:scale-[0.98] shadow-sm"
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}

function NumberInput({
    value,
    onChange,
    decimals = 2,
}: {
    value: number;
    onChange: (v: number) => void;
    decimals?: number;
}) {
    const [raw, setRaw] = useState<string>(
        Number.isFinite(value) ? String(value).replace(".", ",") : "0",
    );
    useEffect(() => {
        setRaw(Number.isFinite(value) ? String(value).replace(".", ",") : "0");
    }, [value]);
    return (
        <input
            type="text"
            inputMode="decimal"
            className="w-full bg-white border border-neutral-200 rounded px-2 py-1 text-sm text-right tabular-nums"
            value={raw}
            onChange={(e) => {
                const v = e.target.value;
                setRaw(v);
                const num = Number(v.replace(/\s/g, "").replace(",", "."));
                if (Number.isFinite(num)) onChange(decimals === 0 ? Math.round(num) : num);
            }}
            onBlur={() => {
                const num = Number(raw.replace(/\s/g, "").replace(",", "."));
                if (!Number.isFinite(num)) {
                    setRaw("0");
                    onChange(0);
                }
            }}
        />
    );
}

function EditableList({
    items,
    onChange,
    placeholder,
    tone,
}: {
    items: string[];
    onChange: (items: string[]) => void;
    placeholder?: string;
    tone?: "red";
}) {
    const inputCls =
        tone === "red"
            ? "w-full bg-white border border-red-200 rounded px-2 py-1 text-sm text-red-800"
            : "w-full bg-white border border-neutral-200 rounded px-2 py-1 text-sm text-neutral-700";
    return (
        <div className="space-y-2">
            {items.map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                    <textarea
                        rows={1}
                        className={inputCls}
                        value={item}
                        placeholder={placeholder}
                        onChange={(e) => {
                            const next = [...items];
                            next[i] = e.target.value;
                            onChange(next);
                        }}
                    />
                    <button
                        onClick={() => onChange(items.filter((_, idx) => idx !== i))}
                        className="p-1 text-red-500 hover:bg-red-50 rounded shrink-0"
                        title="Eliminar"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            ))}
            <button
                onClick={() => onChange([...items, ""])}
                className="text-xs font-bold text-yellow-700 hover:text-yellow-800 flex items-center gap-1"
            >
                <Plus className="w-3.5 h-3.5" /> Añadir
            </button>
        </div>
    );
}

function FilePicker({
    label,
    file,
    onPick,
    onClear,
    inputRef,
}: {
    label: string;
    file: File | null;
    onPick: (f: File | null) => void;
    onClear: () => void;
    inputRef: React.RefObject<HTMLInputElement | null>;
}) {
    return (
        <div>
            <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">
                {label}
            </label>
            {file ? (
                <div className="rounded-lg border border-neutral-200 bg-white p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-5 h-5 text-emerald-600 shrink-0" />
                        <div className="min-w-0">
                            <div className="text-sm font-semibold text-neutral-900 truncate">{file.name}</div>
                            <div className="text-[10px] text-neutral-500">{(file.size / 1024).toFixed(1)} KB</div>
                        </div>
                    </div>
                    <button
                        onClick={onClear}
                        className="p-1.5 rounded-md hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition"
                        title="Quitar archivo"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className="w-full rounded-lg border-2 border-dashed border-neutral-200 bg-neutral-50/60 hover:bg-yellow-50 hover:border-yellow-300 p-6 flex flex-col items-center justify-center gap-2 transition"
                >
                    <Upload className="w-5 h-5 text-neutral-400" />
                    <span className="text-sm font-semibold text-neutral-700">Subir PDF</span>
                    <span className="text-[10px] text-neutral-500">Máx. 15 MB</span>
                </button>
            )}
            <input
                ref={inputRef}
                type="file"
                accept="application/pdf"
                hidden
                onChange={(e) => onPick(e.target.files?.[0] || null)}
            />
        </div>
    );
}
