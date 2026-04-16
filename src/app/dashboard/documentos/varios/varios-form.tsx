"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { Download, Loader2, FileText, Plus, AlertCircle, Trash2 } from "lucide-react";
import SearchableSelect from "@/components/SearchableSelect";
import { createBrowserClient } from "@supabase/ssr";
import { useGlobalLoading } from '@/lib/globalLoading';

interface Comunidad {
    id: number;
    codigo: string;
    nombre_cdad: string;
    cif: string;
    direccion: string;
    cp: string;
    ciudad: string;
    provincia: string;
}

function RequiredAsterisk() {
    return <span className="ml-1 text-yellow-500">*</span>;
}

export default function VariosForm({ onSuccess, onCancel }: { onSuccess?: () => void; onCancel?: () => void }) {
    const { withLoading } = useGlobalLoading();
    const [values, setValues] = useState<Record<string, any>>({
        fecha_emision: "",
    });
    const [conceptRows, setConceptRows] = useState([1]);
    const [status, setStatus] = useState<"idle" | "generating" | "ready" | "sending" | "error">("idle");
    const [pdfUrls, setPdfUrls] = useState<{ factura: string; certificado: string } | null>(null);
    const [submissionIds, setSubmissionIds] = useState<{ factura: number; certificado: number } | null>(null);
    const [toEmail, setToEmail] = useState("");
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [communities, setCommunities] = useState<Comunidad[]>([]);
    const [showSelloConfirm, setShowSelloConfirm] = useState(false);

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    useEffect(() => {
        const fetchCommunities = async () => {
            try {
                const { data, error } = await supabase
                    .from('comunidades')
                    .select('*')
                    .eq('activo', true)
                    .order('codigo', { ascending: true });

                if (error) throw error;
                setCommunities(data || []);
            } catch (error) {
                console.error('Error fetching communities:', error);
                toast.error('Error cargando comunidades');
            }
        };
        fetchCommunities();
    }, []);

    const handleChange = (field: string, val: string | number) => {
        setValues(prev => {
            const next = { ...prev, [field]: val };
            if (field === "nombre" || field === "apellidos") {
                next.nombre_apellidos = [next.nombre, next.apellidos].filter(Boolean).join(" ").trim();
            }
            return calculate(next);
        });
    };

    const handleCommunityChange = (codigo: string) => {
        const comunidad = communities.find(c => c.codigo === codigo);

        setValues(prev => {
            const next: Record<string, any> = {
                ...prev,
                codigo: codigo,
                nombre_comunidad: comunidad?.nombre_cdad || "",
            };

            if (comunidad) {
                Object.assign(next, {
                    cliente: comunidad.nombre_cdad,
                    domicilio: comunidad.direccion,
                    cp: comunidad.cp,
                    ciudad: comunidad.ciudad,
                    provincia: comunidad.provincia,
                });
            }

            next.nombre_apellidos = [next.nombre, next.apellidos].filter(Boolean).join(" ").trim();
            return calculate(next);
        });
    };

    const calculate = (vals: Record<string, any>) => {
        let sum = 0;
        let vatTotal = 0;
        const n = (v: any) => {
            if (typeof v === "number") return v;
            return Number(String(v || "0").replace(",", ".")) || 0;
        };

        for (const i of conceptRows) {
            const qty = n(vals[`und${i}`]);
            const price = n(vals[`importe${i}`]);
            const vatRate = n(vals[`iva${i}`]);

            const sub = qty * price;
            const vat = sub * (vatRate / 100);
            const total = sub + vat;

            vals[`suma${i}`] = total.toFixed(2);

            if (vals[`descripcion${i}`] || qty > 0 || price > 0 || vatRate > 0) {
                sum += sub;
                vatTotal += vat;
            }
        }

        vals["importe_total"] = sum.toFixed(2); // Base Imponible
        vals["iva_total"] = vatTotal.toFixed(2);
        vals["suma_final"] = (sum + vatTotal).toFixed(2); // Total Factura

        return vals;
    };

    const generate = async (skipSello = false) => {
        const conceptErrors: Record<string, string> = {};

        for (const i of conceptRows) {
            const descripcion = String(values[`descripcion${i}`] || "").trim();
            const und = String(values[`und${i}`] || "").trim();
            const importe = String(values[`importe${i}`] || "").trim();
            const iva = String(values[`iva${i}`] || "").trim();
            const filledCount = [descripcion, und, importe, iva].filter(Boolean).length;

            if (filledCount === 4) {
                continue;
            }

            conceptErrors[`concepto${i}`] = "Este concepto es obligatorio: completa unidad, descripción, importe e IVA o elimínalo.";
        }

        if (Object.keys(conceptErrors).length > 0) {
            setFormErrors(prev => ({ ...prev, ...conceptErrors }));
            toast.error("Revisa los conceptos de factura obligatorios");
            return;
        }

        await withLoading(async () => {
            setStatus("generating");
            setSubmissionIds(null);
            setPdfUrls(null);

            try {
                const body = skipSello
                    ? { ...values, skipSello: true, conceptCount: conceptRows.length }
                    : { ...values, conceptCount: conceptRows.length };
                const res = await fetch("/api/documentos/varios/generate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                });
                const data = await res.json();

                if (!res.ok) {
                    if (data.error === "MISSING_SELLO") {
                        setStatus("idle");
                        setShowSelloConfirm(true);
                        return;
                    }
                    throw new Error(data.error || "Error generando PDF");
                }

                setPdfUrls({
                    factura: data.pdfUrlFactura,
                    certificado: data.pdfUrlCertificado,
                });
                setSubmissionIds({
                    factura: data.submissionIdFactura,
                    certificado: data.submissionIdCertificado,
                });

                setStatus("ready");
                toast.success("Documentos generados correctamente");
            } catch (error: unknown) {
                console.error(error);
                setStatus("error");
                toast.error(error instanceof Error ? error.message : "Error generando PDF");
            }
        }, 'Generando documentos...');
    };

    const downloadFactura = () => {
        if (pdfUrls?.factura) window.open(pdfUrls.factura, "_blank");
    };

    const downloadCertificado = () => {
        if (pdfUrls?.certificado) window.open(pdfUrls.certificado, "_blank");
    };

    const sendEmail = async () => {
        if (!submissionIds?.factura || !submissionIds?.certificado) return;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!toEmail || !emailRegex.test(toEmail)) {
            setFormErrors(prev => ({ ...prev, toEmail: 'Introduce un email de destino válido' }));
            return;
        }
        setFormErrors(prev => ({ ...prev, toEmail: '' }));

        await withLoading(async () => {
            setStatus("sending");

            try {
                const res = await fetch("/api/documentos/varios/send", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        submissionIdFactura: submissionIds.factura,
                        submissionIdCertificado: submissionIds.certificado,
                        toEmail
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || "Error enviando email");

                setStatus("ready");
                toast.success("Email enviado correctamente ✅");
            } catch (e: any) {
                setStatus("ready");
                toast.error(e?.message || "Error enviando");
            }
        }, 'Enviando email...');
    };

    if (status === "ready" || status === "sending") {
        return (
            <div className="flex flex-col h-full overflow-hidden">
                <div className="flex-grow overflow-y-auto custom-scrollbar">
                    <div className="flex flex-col items-center justify-center p-6 sm:p-12 text-center space-y-8 max-w-3xl mx-auto">
                        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shrink-0 animate-in zoom-in duration-300">
                            <Download className="w-8 h-8" />
                        </div>

                        <div className="space-y-2">
                            <h2 className="text-2xl font-bold text-slate-900">¡Documentos Generados!</h2>
                            <p className="text-slate-600">
                                Se han generado la factura y el certificado correctamente.
                            </p>
                        </div>

                        <div className="flex flex-col gap-3 max-w-md mx-auto w-full">
                            <button
                                onClick={downloadFactura}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 rounded-xl font-bold shadow-sm transition flex items-center justify-center gap-2 active:scale-[0.98]"
                            >
                                <Download className="w-5 h-5" />
                                Descargar Factura
                            </button>

                            <button
                                onClick={downloadCertificado}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 rounded-xl font-bold shadow-sm transition flex items-center justify-center gap-2 active:scale-[0.98]"
                            >
                                <Download className="w-5 h-5" />
                                Descargar Certificado
                            </button>

                            <div className="h-2"></div>

                            <button
                                onClick={() => { setStatus("idle"); setSubmissionIds(null); setPdfUrls(null); setFormErrors({}); }}
                                className="w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 h-12 rounded-xl font-bold transition flex items-center justify-center gap-2 active:scale-[0.98]"
                            >
                                Volver al formulario
                            </button>
                            <a
                                href="/dashboard/documentos"
                                className="w-full text-slate-400 hover:text-slate-600 text-sm font-medium transition underline"
                            >
                                Ir al listado
                            </a>
                        </div>

                        {/* Email Section */}
                        <div className="max-w-md mx-auto pt-8 border-t border-slate-100 w-full">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 text-left">Enviar por email</p>
                            <div className="flex gap-2">
                                <input
                                    type="email"
                                    placeholder="cliente@ejemplo.com"
                                    value={toEmail}
                                    onChange={(e) => { setToEmail(e.target.value); setFormErrors(prev => ({ ...prev, toEmail: '' })); }}
                                    className={`flex-1 rounded-xl border bg-white px-4 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-all ${formErrors.toEmail ? 'border-red-400' : 'border-slate-200'}`}
                                />
                                <button
                                    onClick={sendEmail}
                                    disabled={status === "sending"}
                                    className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2 rounded-xl text-sm font-bold transition disabled:opacity-50 flex items-center gap-2 shadow-sm"
                                >
                                    {status === "sending" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    Enviar
                                </button>
                            </div>
                            {formErrors.toEmail && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.toEmail}</p>}
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    const isDisabled = status === "generating";
    const allConceptsComplete = conceptRows.every((i) => {
        const descripcion = String(values[`descripcion${i}`] || "").trim();
        const und = String(values[`und${i}`] || "").trim();
        const importe = String(values[`importe${i}`] || "").trim();
        const iva = String(values[`iva${i}`] || "").trim();
        return Boolean(descripcion && und && importe && iva);
    });
    const canGenerate = values.codigo && values.cliente && values.nombre && values.apellidos && values.nif && values.tipo_inmueble && allConceptsComplete;
    const addConceptRow = () => {
        setConceptRows((prev) => [...prev, prev.length ? Math.max(...prev) + 1 : 1]);
    };
    const removeConceptRow = (rowId: number) => {
        if (rowId === 1) return;
        setConceptRows((prev) => prev.filter((id) => id !== rowId));
        setValues((prev) => {
            const next = { ...prev };
            delete next[`und${rowId}`];
            delete next[`descripcion${rowId}`];
            delete next[`importe${rowId}`];
            delete next[`iva${rowId}`];
            delete next[`suma${rowId}`];
            return calculate(next);
        });
        setFormErrors((prev) => {
            const next = { ...prev };
            delete next[`concepto${rowId}`];
            return next;
        });
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Body */}
            <div className="flex-grow overflow-y-auto p-4 sm:px-5 sm:py-4 custom-scrollbar">
                <div className="space-y-4 max-w-4xl mx-auto">
                    {/* Cliente */}
                    <div className="space-y-4">
                        <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pb-2 mb-3 border-b border-yellow-400">Información del Cliente</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                            <div className="sm:col-span-1 lg:col-span-2">
                                <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Comunidad<RequiredAsterisk /></label>
                                <SearchableSelect
                                    value={values.codigo || ""}
                                    onChange={(val) => handleCommunityChange(String(val))}
                                    options={communities.map(c => ({
                                        value: c.codigo,
                                        label: `${c.codigo} - ${c.nombre_cdad}`
                                    }))}
                                    placeholder="Selecciona comunidad..."
                                />
                            </div>
                            <div className="sm:col-span-1 lg:col-span-2">
                                <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Tipo Inmueble<RequiredAsterisk /></label>
                                <SearchableSelect
                                    disabled={isDisabled}
                                    value={values.tipo_inmueble || ""}
                                    onChange={v => handleChange("tipo_inmueble", String(v))}
                                    className="w-full"
                                    placeholder="Seleccionar tipo..."
                                    options={[
                                        { value: 'Vivienda', label: 'Vivienda' },
                                        { value: 'Trastero', label: 'Trastero' },
                                        { value: 'Aparcamiento', label: 'Aparcamiento' },
                                    ]}
                                />
                            </div>
                            <div className="sm:col-span-1 lg:col-span-2">
                                <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Nombre<RequiredAsterisk /></label>
                                <input
                                    disabled={isDisabled}
                                    type="text"
                                    placeholder="Ej: Juan"
                                    className="w-full rounded-lg border border-neutral-200 bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400 focus:bg-white disabled:bg-neutral-100 disabled:text-neutral-400 transition"
                                    value={values.nombre || ""}
                                    onChange={e => handleChange("nombre", e.target.value)}
                                />
                            </div>
                            <div className="sm:col-span-1 lg:col-span-2">
                                <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Apellidos<RequiredAsterisk /></label>
                                <input
                                    disabled={isDisabled}
                                    type="text"
                                    placeholder="Ej: Pérez"
                                    className="w-full rounded-lg border border-neutral-200 bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400 focus:bg-white disabled:bg-neutral-100 disabled:text-neutral-400 transition"
                                    value={values.apellidos || ""}
                                    onChange={e => handleChange("apellidos", e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">NIF<RequiredAsterisk /></label>
                                <input
                                    disabled={isDisabled}
                                    type="text"
                                    placeholder="Ej: 12345678Z"
                                    className="w-full rounded-lg border border-neutral-200 bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400 focus:bg-white disabled:bg-neutral-100 disabled:text-neutral-400 transition"
                                    value={values.nif || ""}
                                    onChange={e => handleChange("nif", e.target.value)}
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Domicilio</label>
                                <input
                                    disabled={isDisabled}
                                    type="text"
                                    placeholder="Ej: C/ Mayor 123"
                                    className="w-full rounded-lg border border-neutral-200 bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400 focus:bg-white disabled:bg-neutral-100 disabled:text-neutral-400 transition"
                                    value={values.domicilio || ""}
                                    onChange={e => handleChange("domicilio", e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">C.P</label>
                                <input
                                    disabled={isDisabled}
                                    type="text"
                                    placeholder="Ej: 29001"
                                    className="w-full rounded-lg border border-neutral-200 bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400 focus:bg-white disabled:bg-neutral-100 disabled:text-neutral-400 transition"
                                    value={values.cp || ""}
                                    onChange={e => handleChange("cp", e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Ciudad</label>
                                <input
                                    disabled={isDisabled}
                                    type="text"
                                    placeholder="Ej: Málaga"
                                    className="w-full rounded-lg border border-neutral-200 bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400 focus:bg-white disabled:bg-neutral-100 disabled:text-neutral-400 transition"
                                    value={values.ciudad || ""}
                                    onChange={e => handleChange("ciudad", e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Provincia</label>
                                <input
                                    disabled={isDisabled}
                                    type="text"
                                    placeholder="Ej: Málaga"
                                    className="w-full rounded-lg border border-neutral-200 bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400 focus:bg-white disabled:bg-neutral-100 disabled:text-neutral-400 transition"
                                    value={values.provincia || ""}
                                    onChange={e => handleChange("provincia", e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Fecha Emisión</label>
                                <input
                                    disabled={isDisabled}
                                    type="date"
                                    className="w-full rounded-lg border border-neutral-200 bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400 focus:bg-white disabled:bg-neutral-100 disabled:text-neutral-400 transition"
                                    value={values.fecha_emision || ""}
                                    onChange={e => handleChange("fecha_emision", e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Factura Lines */}
                    <div className="space-y-4">
                        <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pb-2 mb-3 border-b border-yellow-400">Conceptos Factura</h3>
                        {formErrors.conceptos && (
                            <p className="flex items-center gap-1 text-[11px] font-semibold text-red-500">
                                <AlertCircle className="w-3 h-3 shrink-0" />
                                {formErrors.conceptos}
                            </p>
                        )}

                        {conceptRows.map(i => (
                            <div key={i} className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end bg-neutral-50/60 p-4 rounded-lg border border-neutral-100">
                                <div className="sm:col-span-1">
                                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Und{i === 1 ? <RequiredAsterisk /> : null}</label>
                                    <input
                                        disabled={isDisabled}
                                        type="number"
                                        placeholder="0"
                                        className="w-full rounded-lg border border-neutral-200 bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400 focus:bg-white disabled:bg-neutral-100 disabled:text-neutral-400 transition"
                                        value={values[`und${i}`] || ""}
                                        onChange={e => {
                                            setFormErrors(prev => ({ ...prev, [`concepto${i}`]: "", conceptos: "" }));
                                            handleChange(`und${i}`, e.target.value);
                                        }}
                                    />
                                </div>
                                <div className="sm:col-span-5">
                                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Descripción {i}{i === 1 ? <RequiredAsterisk /> : null}</label>
                                    <input
                                        disabled={isDisabled}
                                        type="text"
                                        placeholder="Concepto..."
                                        className="w-full rounded-lg border border-neutral-200 bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400 focus:bg-white disabled:bg-neutral-100 disabled:text-neutral-400 transition"
                                        value={values[`descripcion${i}`] || ""}
                                        onChange={e => {
                                            setFormErrors(prev => ({ ...prev, [`concepto${i}`]: "", conceptos: "" }));
                                            handleChange(`descripcion${i}`, e.target.value);
                                        }}
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Importe{i === 1 ? <RequiredAsterisk /> : null}</label>
                                    <input
                                        disabled={isDisabled}
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        className="w-full rounded-lg border border-neutral-200 bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400 focus:bg-white disabled:bg-neutral-100 disabled:text-neutral-400 transition"
                                        value={values[`importe${i}`] || ""}
                                        onChange={e => {
                                            setFormErrors(prev => ({ ...prev, [`concepto${i}`]: "", conceptos: "" }));
                                            handleChange(`importe${i}`, e.target.value);
                                        }}
                                    />
                                </div>
                                <div className="sm:col-span-1">
                                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">IVA%{i === 1 ? <RequiredAsterisk /> : null}</label>
                                    <input
                                        disabled={isDisabled}
                                        type="number"
                                        placeholder="21"
                                        className="w-full rounded-lg border border-neutral-200 bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400 focus:bg-white disabled:bg-neutral-100 disabled:text-neutral-400 transition"
                                        value={values[`iva${i}`] ?? ""}
                                        onChange={e => {
                                            setFormErrors(prev => ({ ...prev, [`concepto${i}`]: "", conceptos: "" }));
                                            handleChange(`iva${i}`, e.target.value);
                                        }}
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Total (Auto)</label>
                                    <input
                                        disabled
                                        readOnly
                                        type="text"
                                        className="w-full rounded-lg border border-neutral-100 bg-neutral-100/60 px-3 py-2 text-sm text-right font-semibold text-neutral-500 focus:outline-none"
                                        value={values[`suma${i}`] || 0}
                                    />
                                </div>
                                <div className="sm:col-span-1 flex justify-end">
                                    {i !== 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeConceptRow(i)}
                                            disabled={isDisabled}
                                            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-red-200 bg-white text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                                            title="Eliminar concepto"
                                            aria-label="Eliminar concepto"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                                {formErrors[`concepto${i}`] && (
                                    <div className="sm:col-span-12">
                                        <p className="flex items-center gap-1 text-[11px] font-semibold text-red-500">
                                            <AlertCircle className="w-3 h-3 shrink-0" />
                                            {formErrors[`concepto${i}`]}
                                        </p>
                                    </div>
                                )}
                            </div>
                        ))}
                        <div>
                            <button
                                type="button"
                                onClick={addConceptRow}
                                disabled={isDisabled}
                                className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
                            >
                                <Plus className="w-4 h-4" />
                                Añadir concepto
                            </button>
                        </div>

                        {/* Totals Section */}
                        <div className="bg-neutral-50/60 p-4 rounded-lg border border-neutral-100 mt-4">
                            <div className="flex flex-col sm:flex-row justify-end gap-6 sm:gap-12">
                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">Base Imponible</p>
                                    <p className="text-lg font-bold text-neutral-900">{values.importe_total || "0.00"} €</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">IVA Total</p>
                                    <p className="text-lg font-bold text-neutral-900">{values.iva_total || "0.00"} €</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Total Factura</p>
                                    <p className="text-2xl font-black text-neutral-900">{values.suma_final || "0.00"} €</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Fixed Footer */}
            <div className="px-5 py-3 border-t border-neutral-100 bg-neutral-50/40 shrink-0 flex justify-end gap-2 flex-wrap">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-6 py-2 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-600 rounded-lg text-xs font-bold transition"
                >
                    Cancelar
                </button>
                <button
                    type="button"
                    onClick={() => generate()}
                    disabled={status === "generating" || !canGenerate}
                    className="w-full sm:w-auto h-12 px-8 bg-yellow-400 hover:bg-yellow-500 text-neutral-950 rounded-xl font-bold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm hover:shadow-md active:scale-[0.98]"
                >
                    {status === "generating" ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Generando...
                        </>
                    ) : (
                        <>
                            <Plus className="w-5 h-5" />
                            Generar Factura + Certificado
                        </>
                    )}
                </button>
            </div>

            {/* Modal confirmación: sello no encontrado */}
            {showSelloConfirm && (
                <div className="fixed inset-0 bg-black/40 z-[10000] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-200">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                                <AlertCircle className="w-5 h-5 text-amber-600" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-neutral-900">Sello y firma no encontrados</h3>
                                <p className="text-sm text-neutral-600 mt-1">
                                    No se encontró la imagen del sello y firma en el sistema. Puede subirla en <strong>Ajustes &gt; Emisor</strong> para crear documentos firmados.
                                </p>
                                <p className="text-sm text-neutral-600 mt-2">
                                    ¿Desea crear el documento sin el sello?
                                </p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                onClick={() => setShowSelloConfirm(false)}
                                className="px-4 py-2 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-600 rounded-lg text-sm font-bold transition"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => { setShowSelloConfirm(false); generate(true); }}
                                className="px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-neutral-950 rounded-lg text-sm font-bold transition"
                            >
                                Crear sin sello
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function Send({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="m22 2-7 20-4-9-9-4Z" />
            <path d="M22 2 11 13" />
        </svg>
    )
}
