"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { Download, Send, Loader2, Plus, AlertCircle } from "lucide-react";
import SearchableSelect from "@/components/SearchableSelect";
import { createBrowserClient } from "@supabase/ssr";
import { useGlobalLoading } from '@/lib/globalLoading';

type Status = "idle" | "generating" | "ready" | "sending" | "error";

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

// Auto-calculated fields (read-only) + Locked Prices
const LOCKED_FIELDS = new Set([
    "Total copias",
    "Total 1",
    "Total 2",
    "Total 3",
    "Total 4",
    "Total 5",
    "Total 6",
    "Suma final",
    "Precio 1",
    "Precio 2",
    "Precio 3",
    "Precio 4",
    "Precio 5",
    "Precio 6",
]);

// Helper: safe number conversion
const num = (v: any) => {
    const n = typeof v === "number" ? v : Number(String(v ?? "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
};

// Helper: round to 2 decimals
const money = (n: number) => Math.round(n * 100) / 100;

// Compute all auto-calculated fields
const compute = (vals: Record<string, any>) => {
    const numeroCartas = num(vals["Número de Cartas"]);
    const copias = num(vals["Copias"]);
    const totalCopias = numeroCartas * copias;

    const qty1 = num(vals["Cantidad Sobre normal"]);
    const p1 = num(vals["Precio 1"]);
    const total1 = money(qty1 * p1);

    const qty2 = num(vals["Cantidad Sobre A5"]);
    const p2 = num(vals["Precio 2"]);
    const total2 = money(qty2 * p2);

    const qty3 = num(vals["Papel corporativo"]);
    const p3 = num(vals["Precio 3"]);
    const total3 = money(qty3 * p3);

    const qty4 = num(vals["Etiqueta manipulación"]);
    const p4 = num(vals["Precio 4"]);
    const total4 = money(qty4 * p4);

    const qty5 = num(vals["Imprimir B/N"]);
    const p5 = num(vals["Precio 5"]);
    const total5 = money(qty5 * p5);

    const qty6 = num(vals["Franqueo postal"]);
    const p6 = num(vals["Precio 6"]);
    const total6 = money(qty6 * p6);

    const sumaFinal = money(total1 + total2 + total3 + total4 + total5 + total6);

    return {
        "Total copias": totalCopias,
        "Total 1": total1,
        "Total 2": total2,
        "Total 3": total3,
        "Total 4": total4,
        "Total 5": total5,
        "Total 6": total6,
        "Suma final": sumaFinal,
    };
};

export default function SuplidosForm({ onSuccess, onCancel }: { onSuccess?: () => void; onCancel?: () => void }) {
    const { withLoading } = useGlobalLoading();
    const [values, setValues] = useState<Record<string, any>>({
        "Número de Cartas": "",
        "Copias": "",
        "Cantidad Sobre normal": "",
        "Cantidad Sobre A5": "",
        "Papel corporativo": "",
        "Etiqueta manipulación": "",
        "Imprimir B/N": "",
        "Franqueo postal": "",
    });
    const [status, setStatus] = useState<Status>("idle");
    const [pdfUrl, setPdfUrl] = useState<string>("");
    const [submissionId, setSubmissionId] = useState<number | null>(null);
    const [toEmail, setToEmail] = useState("");
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [communities, setCommunities] = useState<Comunidad[]>([]);

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const res = await fetch("/api/documentos/settings?doc_key=suplidos");
                if (!res.ok) throw new Error("Error fetching settings");
                const data = await res.json();

                setValues((prev) => {
                    const next = {
                        ...prev,
                        "Precio 1": data.settings?.precio_1 ?? 0,
                        "Precio 2": data.settings?.precio_2 ?? 0,
                        "Precio 3": data.settings?.precio_3 ?? 0,
                        "Precio 4": data.settings?.precio_4 ?? 0,
                        "Precio 5": data.settings?.precio_5 ?? 0,
                        "Precio 6": data.settings?.precio_6 ?? 0,
                    };
                    return { ...next, ...compute(next) };
                });
            } catch (error) {
                console.error("Error loading settings", error);
                toast.error("Error cargando precios fijos");
            }
        };

        loadSettings();
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

    const handleCommunityChange = (codigo: string) => {
        const comunidad = communities.find(c => c.codigo === codigo);
        setValues(prev => {
            const next = {
                ...prev,
                "Código": codigo,
                "Nombre Comunidad": comunidad?.nombre_cdad || "",
            };
            if (comunidad) {
                Object.assign(next, {
                    "Nombre Cliente": comunidad.nombre_cdad,
                    "NIF": comunidad.cif,
                    "Provincia": comunidad.provincia,
                    "Domicilio": comunidad.direccion,
                });
            }
            return { ...next, ...compute(next) };
        });
    };

    const onChange = (label: string, raw: string, type?: string) => {
        if (LOCKED_FIELDS.has(label)) return;
        if (label === "Código") {
            handleCommunityChange(raw);
            return;
        }

        let v: any = raw;
        if (type === "number") v = raw === "" ? "" : Number(raw);

        setValues((prev) => {
            const next = { ...prev, [label]: v };
            const numCartas = num(next["Número de Cartas"]);
            const numCopias = num(next["Copias"]);
            const totalCopias = numCartas * numCopias;

            if (label === "Número de Cartas" || label === "Copias") {
                next["Imprimir B/N"] = totalCopias;
                next["Etiqueta manipulación"] = numCartas;
            }
            return { ...next, ...compute(next) };
        });
    };

    const generate = async () => {
        await withLoading(async () => {
            setStatus("generating");
            try {
                const rawPayload = { ...values, ...compute(values) };
                const payload = Object.fromEntries(
                    Object.entries(rawPayload).map(([k, v]) => [k, (v as any) === "" ? 0 : v])
                );

                const res = await fetch("/api/documentos/suplidos/generate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || "Error generando PDF");

                setPdfUrl(data.pdfUrl);
                setSubmissionId(data.submissionId);
                setStatus("ready");
                toast.success("PDF generado ✅");
            } catch (e: any) {
                setStatus("error");
                toast.error(e?.message || "Error inesperado");
            }
        }, 'Generando PDF...');
    };

    const download = () => pdfUrl && window.open(pdfUrl, "_blank");

    const sendEmail = async () => {
        if (!submissionId) return;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!toEmail || !emailRegex.test(toEmail)) {
            setFormErrors(prev => ({ ...prev, toEmail: 'Introduce un email válido' }));
            return;
        }
        setFormErrors(prev => ({ ...prev, toEmail: '' }));

        await withLoading(async () => {
            setStatus("sending");
            try {
                const res = await fetch("/api/documentos/suplidos/send", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ submissionId, toEmail }),
                });
                if (!res.ok) throw new Error("Error enviando email");
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
            <div className="flex flex-col h-full overflow-hidden text-center">
                <div className="flex-grow overflow-y-auto p-8 custom-scrollbar">
                    <div className="max-w-md mx-auto space-y-8 py-12">
                        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                            <Download className="w-8 h-8" />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-2xl font-bold text-slate-900">¡Suplido Generado!</h2>
                            <p className="text-slate-600">El documento se ha creado correctamente.</p>
                        </div>
                        <div className="flex flex-col gap-3">
                            <button onClick={download} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 rounded-xl font-bold transition">
                                Descargar PDF
                            </button>
                            <button onClick={() => { setStatus("idle"); setPdfUrl(""); setFormErrors({}); }} className="w-full bg-white border border-slate-200 hover:bg-slate-50 h-12 rounded-xl font-bold transition">
                                Volver al formulario
                            </button>
                        </div>
                        <div className="pt-8 border-t border-slate-100">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 text-left">Enviar por email</p>
                            <div className="flex gap-2">
                                <input
                                    type="email"
                                    placeholder="email@ejemplo.com"
                                    value={toEmail}
                                    onChange={(e) => { setToEmail(e.target.value); setFormErrors(prev => ({ ...prev, toEmail: '' })); }}
                                    className={`flex-1 rounded-xl border px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 ${formErrors.toEmail ? 'border-red-400' : 'border-slate-200'}`}
                                />
                                <button onClick={sendEmail} disabled={status === "sending"} className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2 rounded-xl text-sm font-bold disabled:opacity-50">
                                    {status === "sending" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enviar"}
                                </button>
                            </div>
                            {formErrors.toEmail && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.toEmail}</p>}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const isDisabled = status === "generating";
    const canGenerate = values["Código"] && values["Número de Cartas"] && values["Copias"] && values["Nombre Cliente"];

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="flex-grow overflow-y-auto p-4 sm:px-5 sm:py-4 custom-scrollbar">
                <div className="space-y-4">
                    {/* Section: Datos Cliente */}
                    <div>
                        <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pb-2 mb-3 border-b border-yellow-400">Datos Cliente</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
                            <div className="flex flex-col">
                                <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Código</label>
                                <SearchableSelect
                                    value={values["Código"] ?? ""}
                                    onChange={(val) => onChange("Código", String(val))}
                                    options={communities.map(c => ({ value: c.codigo, label: `${c.codigo} - ${c.nombre_cdad}` }))}
                                    placeholder="Seleccionar código"
                                />
                            </div>
                            <Field label="Nombre Cliente" value={values["Nombre Cliente"]} onChange={(v) => onChange("Nombre Cliente", v)} disabled={isDisabled} />
                            <Field label="NIF" value={values["NIF"]} onChange={(v) => onChange("NIF", v)} disabled={isDisabled} />
                            <Field label="Fecha emisión" value={values["Fecha emisión"]} onChange={(v) => onChange("Fecha emisión", v)} disabled={isDisabled} type="date" />
                            <Field label="Domicilio" value={values["Domicilio"]} onChange={(v) => onChange("Domicilio", v)} disabled={isDisabled} />
                            <Field label="Provincia" value={values["Provincia"]} onChange={(v) => onChange("Provincia", v)} disabled={isDisabled} />
                            <div className="md:col-span-2">
                                <Field label="Descripción" value={values["Descripcion"]} onChange={(v) => onChange("Descripcion", v)} disabled={isDisabled} />
                            </div>
                        </div>
                    </div>

                    {/* Section: Datos Suplido */}
                    <div>
                        <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pb-2 mb-3 border-b border-yellow-400">Datos Suplido</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-neutral-50/60 rounded-lg border border-neutral-100 mb-3">
                            <Field label="Nº Cartas" value={values["Número de Cartas"]} onChange={(v) => onChange("Número de Cartas", v, "number")} disabled={isDisabled} type="number" />
                            <Field label="Copias" value={values["Copias"]} onChange={(v) => onChange("Copias", v, "number")} disabled={isDisabled} type="number" />
                            <Field label="Total Copias (Auto)" value={values["Total copias"]} readOnly disabled type="number" className="bg-neutral-100" onChange={() => { }} />
                        </div>

                        <div className="overflow-x-auto border rounded-lg border-neutral-100">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-neutral-50/60 text-neutral-400 uppercase text-[10px] font-bold">
                                    <tr>
                                        <th className="px-3 py-2">Concepto</th>
                                        <th className="px-3 py-2 text-center">Cantidad</th>
                                        <th className="px-3 py-2 text-center">Precio</th>
                                        <th className="px-3 py-2 text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-50">
                                    {[
                                        { label: "Sobre Normal", qty: "Cantidad Sobre normal", price: "Precio 1", total: "Total 1" },
                                        { label: "Sobre A5", qty: "Cantidad Sobre A5", price: "Precio 2", total: "Total 2" },
                                        { label: "Papel Corporativo", qty: "Papel corporativo", price: "Precio 3", total: "Total 3" },
                                        { label: "Etiq. Manipulación", qty: "Etiqueta manipulación", price: "Precio 4", total: "Total 4" },
                                        { label: "Imprimir B/N", qty: "Imprimir B/N", price: "Precio 5", total: "Total 5" },
                                        { label: "Franqueo Postal", qty: "Franqueo postal", price: "Precio 6", total: "Total 6" },
                                    ].map((row) => (
                                        <tr key={row.label} className="hover:bg-neutral-50/40">
                                            <td className="px-3 py-2 font-semibold text-xs">{row.label}</td>
                                            <td className="px-3 py-2">
                                                <input
                                                    type="number"
                                                    value={values[row.qty]}
                                                    disabled={isDisabled || row.qty === "Imprimir B/N" || row.qty === "Etiqueta manipulación"}
                                                    onChange={e => onChange(row.qty, e.target.value, "number")}
                                                    className="w-full rounded-lg border border-neutral-200 bg-neutral-50/60 px-2 py-1.5 text-center text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400 focus:bg-white disabled:bg-neutral-100 transition"
                                                />
                                            </td>
                                            <td className="px-3 py-2">
                                                <div className="relative">
                                                    <input type="number" readOnly disabled value={values[row.price] ?? 0} className="w-full text-center bg-neutral-50 border-none text-neutral-500 text-sm py-1.5" />
                                                    <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-neutral-400">€</span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-right font-bold text-sm">{(values[row.total] ?? 0).toFixed(2)} €</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="border-t border-neutral-200 bg-neutral-50/60 font-bold">
                                    <tr>
                                        <td colSpan={3} className="px-3 py-2 text-right text-xs uppercase tracking-wide text-neutral-500">Suma Final</td>
                                        <td className="px-3 py-2 text-right text-sm bg-yellow-400/10">{(values["Suma final"] ?? 0).toFixed(2)} €</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
            <div className="px-5 py-3 border-t border-neutral-100 bg-neutral-50/40 flex justify-end gap-2 flex-wrap">
                <button onClick={onCancel} className="px-6 py-2 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-600 rounded-lg text-xs font-bold transition">
                    Cancelar
                </button>
                <button onClick={generate} disabled={isDisabled || !canGenerate} className="px-6 py-2 bg-yellow-400 hover:bg-yellow-500 text-neutral-950 rounded-lg text-xs font-bold transition disabled:opacity-50 flex items-center gap-2 shadow-sm">
                    {status === "generating" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    {status === "generating" ? "Generando..." : "Generar Suplido"}
                </button>
            </div>
        </div>
    );
}

function Field({ label, value, onChange, type = "text", disabled = false, readOnly = false, className = "" }: { label: string; value: any; onChange?: (v: string) => void; type?: string; disabled?: boolean; readOnly?: boolean; className?: string }) {
    return (
        <div className="flex flex-col">
            <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">{label}</label>
            <input
                type={type}
                value={value ?? ""}
                onChange={(e) => onChange?.(e.target.value)}
                disabled={disabled}
                readOnly={readOnly}
                className={`w-full rounded-lg border border-neutral-200 bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400 focus:bg-white disabled:bg-neutral-100 disabled:text-neutral-400 transition ${className}`}
            />
        </div>
    );
}
