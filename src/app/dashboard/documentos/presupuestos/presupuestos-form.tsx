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
} from "lucide-react";
import SearchableSelect from "@/components/SearchableSelect";
import { createBrowserClient } from "@supabase/ssr";
import { useGlobalLoading } from "@/lib/globalLoading";

interface Comunidad {
    id: number;
    codigo: string;
    nombre_cdad: string;
}

type Stage = "form" | "analyzing" | "review" | "generating" | "ready";

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
}: {
    onSuccess?: () => void;
    onCancel?: () => void;
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

    // =================== READY ===================
    if (stage === "ready") {
        return (
            <div className="flex flex-col h-full overflow-hidden">
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
                <div className="flex-grow overflow-y-auto p-4 sm:px-5 sm:py-4 custom-scrollbar">
                    <div className="max-w-4xl mx-auto space-y-5">
                        {/* Cabecera */}
                        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                            <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">
                                Comunidad
                            </div>
                            <h2 className="text-lg font-bold text-neutral-900">{analysis.comunidad || "—"}</h2>
                            {analysis.ejercicio_analizado && (
                                <p className="text-xs text-neutral-600 mt-1">
                                    Ejercicio analizado: <strong>{analysis.ejercicio_analizado}</strong>
                                </p>
                            )}
                            {analysis.introduccion && (
                                <p className="text-sm text-neutral-700 mt-3 leading-relaxed">{analysis.introduccion}</p>
                            )}
                        </div>

                        {/* Advertencias */}
                        {analysis.advertencias?.length > 0 && (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                                <div className="flex items-center gap-2 text-red-700 font-bold text-sm mb-2">
                                    <AlertTriangle className="w-4 h-4" />
                                    Advertencias
                                </div>
                                <ul className="text-sm text-red-800 space-y-1 list-disc list-inside">
                                    {analysis.advertencias.map((adv, i) => (
                                        <li key={i}>{adv}</li>
                                    ))}
                                </ul>
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
                                                <td className="px-3 py-2">{p.nombre}</td>
                                                <td className="px-3 py-2 text-right tabular-nums">{money(p.gasto_anterior)}</td>
                                                <td className="px-3 py-2 text-right tabular-nums">{money(p.presupuesto_propuesto)}</td>
                                                <td className="px-3 py-2 text-right tabular-nums">{money(p.variacion_eur)}</td>
                                                <td className="px-3 py-2 text-right tabular-nums">{pct(p.variacion_pct)}</td>
                                            </tr>
                                        ))}
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
                                                <td className="px-3 py-2">{c.tipo_finca}</td>
                                                <td className="px-3 py-2 text-center tabular-nums">{c.num_fincas}</td>
                                                <td className="px-3 py-2 text-right tabular-nums">{money(c.cuota_mensual)}</td>
                                                <td className="px-3 py-2 text-right tabular-nums">{money(c.total_mensual)}</td>
                                                <td className="px-3 py-2 text-right tabular-nums">{money(c.total_anual)}</td>
                                            </tr>
                                        ))}
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
                                                <td className="px-3 py-2">{t.tipo_finca}</td>
                                                <td className="px-3 py-2 text-right tabular-nums">{money(t.cuota_actual)}</td>
                                                <td className="px-3 py-2 text-right tabular-nums font-semibold">{money(t.cuota_nueva)}</td>
                                                <td className="px-3 py-2 text-right tabular-nums">{money(t.subida_eur)}</td>
                                                <td className="px-3 py-2 text-right tabular-nums">{pct(t.subida_pct)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Section>

                        {/* Justificación */}
                        {analysis.justificacion?.length > 0 && (
                            <Section title="5. Justificación de la subida propuesta">
                                <ul className="space-y-2 text-sm text-neutral-700 list-disc list-inside">
                                    {analysis.justificacion.map((j, i) => (
                                        <li key={i}>{j}</li>
                                    ))}
                                </ul>
                            </Section>
                        )}

                        {/* Observaciones */}
                        {analysis.observaciones?.length > 0 && (
                            <Section title="6. Observaciones finales">
                                <ul className="space-y-2 text-sm text-neutral-700 list-disc list-inside">
                                    {analysis.observaciones.map((o, i) => (
                                        <li key={i}>{o}</li>
                                    ))}
                                </ul>
                            </Section>
                        )}
                    </div>
                </div>

                <div className="px-5 py-3 border-t border-neutral-100 bg-neutral-50/40 flex justify-between gap-2 flex-wrap shrink-0">
                    <button
                        onClick={() => setStage("form")}
                        className="px-4 py-2 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-600 rounded-lg text-xs font-bold transition flex items-center gap-2"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Volver a los archivos
                    </button>
                    <div className="flex gap-2">
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-600 rounded-lg text-xs font-bold transition"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={generate}
                            disabled={stage === "generating"}
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
