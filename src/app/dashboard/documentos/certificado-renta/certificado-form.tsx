"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { Download, Loader2, FileText, Plus, AlertCircle } from "lucide-react";
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

type RecordData = {
    Apellidos: string;
    Nombre: string;
    Nif: string;
    "Dirección 2": string;
    Piso: string;
    CP: string;
    Poblacion: string;
    DIAS: string;
    "%": string;
    Participación: string;
    Ganancia: string;
    Retenciones: string;
    Provincia: string;
    "Clave 1": string;
    Subclave: string;
    "Clave 2": string;
    Naturaleza: string;
    Situación: string;
    Declarado: string;
    Mail: string;
};

const INITIAL_DATA: RecordData = {
    Apellidos: "",
    Nombre: "",
    Nif: "",
    "Dirección 2": "",
    Piso: "",
    CP: "",
    Poblacion: "",
    DIAS: "",
    "%": "",
    Participación: "",
    Ganancia: "",
    Retenciones: "",
    Provincia: "",
    "Clave 1": "",
    Subclave: "",
    "Clave 2": "",
    Naturaleza: "",
    Situación: "",
    Declarado: "",
    Mail: "",
};

export default function CertificadoForm({ onSuccess, onCancel }: { onSuccess?: () => void; onCancel?: () => void }) {
    const { withLoading } = useGlobalLoading();
    const [values, setValues] = useState<RecordData>(INITIAL_DATA);
    const [status, setStatus] = useState<"idle" | "generating" | "ready" | "sending" | "error">("idle");
    const [submissionId, setSubmissionId] = useState<number | null>(null);
    const [toEmail, setToEmail] = useState("");
    const [pdfUrl, setPdfUrl] = useState<string>("");
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [communities, setCommunities] = useState<Comunidad[]>([]);
    const [selectedCode, setSelectedCode] = useState("");

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

    const handleChange = (key: keyof RecordData, val: string) => {
        setValues((prev) => ({ ...prev, [key]: val }));
    };

    const handleCommunityChange = (codigo: string) => {
        setSelectedCode(codigo);
        const comunidad = communities.find(c => c.codigo === codigo);

        if (comunidad) {
            setValues(prev => ({
                ...prev,
                "Código": codigo,
                "Nombre Comunidad": comunidad.nombre_cdad,
                // Apellidos/Nombre/Nif removed per user request (only address data)
                "Dirección 2": comunidad.direccion,
                CP: comunidad.cp,
                Poblacion: comunidad.ciudad,
                Provincia: comunidad.provincia
            }));
        }
    };

    const generate = async () => {
        // Validation for internal email field
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (values.Mail && !emailRegex.test(values.Mail)) {
            setFormErrors(prev => ({ ...prev, mail: 'El formato del email no es válido' }));
            return;
        }
        setFormErrors(prev => ({ ...prev, mail: '' }));

        await withLoading(async () => {
            setStatus("generating");
            setPdfUrl("");
            setSubmissionId(null);

            try {
                const res = await fetch("/api/documentos/certificado-renta/generate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(values),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || "Error generando PDF");

                setPdfUrl(data.pdfUrl);
                setSubmissionId(data.submissionId);
                setStatus("ready");
                toast.success("PDF generado correctamente ✅");
            } catch (e: any) {
                setStatus("error");
                toast.error(e?.message || "Error inesperado");
            }
        }, 'Generando certificado...');
    };

    const download = () => {
        if (!pdfUrl) return;
        window.open(pdfUrl, "_blank");
    };

    const sendEmail = async () => {
        if (!submissionId) return;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!toEmail || !emailRegex.test(toEmail)) {
            setFormErrors(prev => ({ ...prev, toEmail: 'Introduce un email de destino válido' }));
            return;
        }
        setFormErrors(prev => ({ ...prev, toEmail: '' }));

        await withLoading(async () => {
            setStatus("sending");

            try {
                const res = await fetch("/api/documentos/certificado-renta/send", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ submissionId, toEmail }),
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

    // SUCCESS VIEW
    if (status === "ready" || status === "sending") {
        return (
            <div className="flex flex-col h-full overflow-hidden">
                <div className="flex-grow overflow-y-auto custom-scrollbar">
                    <div className="flex flex-col items-center justify-center p-6 sm:p-12 text-center space-y-8 max-w-3xl mx-auto">
                        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shrink-0 animate-in zoom-in duration-300">
                            <Download className="w-8 h-8" />
                        </div>

                        <div className="space-y-2">
                            <h2 className="text-2xl font-bold text-slate-900">¡Certificado Generado!</h2>
                            <p className="text-slate-600">
                                El documento se ha creado correctamente. <br />
                                Puedes descargarlo o enviarlo por email ahora.
                            </p>
                        </div>

                        <div className="flex flex-col gap-3 max-w-md mx-auto w-full">
                            <button
                                onClick={download}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 rounded-xl font-bold shadow-sm transition flex items-center justify-center gap-2 active:scale-[0.98]"
                            >
                                <Download className="w-5 h-5" />
                                Descargar PDF
                            </button>

                            <button
                                onClick={() => { setStatus("idle"); setSubmissionId(null); setPdfUrl(""); setFormErrors({}); }}
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
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Body */}
            <div className="flex-grow overflow-y-auto p-4 sm:px-5 sm:py-4 custom-scrollbar">
                <div className="space-y-4 max-w-4xl mx-auto">
                    <div className="space-y-4">
                        <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pb-2 mb-3 border-b border-yellow-400">Datos del Declarante</h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                            <div>
                                <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Comunidad</label>
                                <SearchableSelect
                                    value={selectedCode}
                                    onChange={(val) => handleCommunityChange(String(val))}
                                    options={communities.map(c => ({
                                        value: c.codigo,
                                        label: `${c.codigo} - ${c.nombre_cdad}`
                                    }))}
                                    placeholder="Selecciona comunidad..."
                                />
                            </div>

                            <Field label="Apellidos" value={values.Apellidos} onChange={(v) => handleChange("Apellidos", v)} />
                            <Field label="Nombre" value={values.Nombre} onChange={(v) => handleChange("Nombre", v)} />
                            <Field label="NIF" value={values.Nif} onChange={(v) => handleChange("Nif", v)} />

                            <Field label="Dirección" value={values["Dirección 2"]} onChange={(v) => handleChange("Dirección 2", v)} />
                            <Field label="Piso/Puerta" value={values.Piso} onChange={(v) => handleChange("Piso", v)} />
                            <Field label="Código Postal" value={values.CP} onChange={(v) => handleChange("CP", v)} />

                            <Field label="Población" value={values.Poblacion} onChange={(v) => handleChange("Poblacion", v)} />
                            <Field label="Provincia" value={values.Provincia} onChange={(v) => handleChange("Provincia", v)} />
                            <div>
                                <Field label="Mail" value={values.Mail} onChange={(v) => { handleChange("Mail", v); setFormErrors(prev => ({ ...prev, mail: '' })); }} type="email" className={formErrors.mail ? 'border-red-400' : ''} />
                                {formErrors.mail && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle className="w-3 h-3 shrink-0" />{formErrors.mail}</p>}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pb-2 mb-3 border-b border-yellow-400">Datos Económicos</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
                            <Field label="DIAS" value={values.DIAS} onChange={(v) => handleChange("DIAS", v)} type="number" />
                            <Field label="%" value={values["%"]} onChange={(v) => handleChange("%", v)} type="number" />
                            <Field label="Participación" value={values.Participación} onChange={(v) => handleChange("Participación", v)} />
                            <Field label="Ganancia" value={values.Ganancia} onChange={(v) => handleChange("Ganancia", v)} type="number" />
                            <Field label="Retenciones" value={values.Retenciones} onChange={(v) => handleChange("Retenciones", v)} type="number" />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pb-2 mb-3 border-b border-yellow-400">Claves Fiscales</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                            <Field label="Clave 1" value={values["Clave 1"]} onChange={(v) => handleChange("Clave 1", v)} />
                            <Field label="Subclave" value={values.Subclave} onChange={(v) => handleChange("Subclave", v)} />
                            <Field label="Clave 2" value={values["Clave 2"]} onChange={(v) => handleChange("Clave 2", v)} />
                            <Field label="Naturaleza" value={values.Naturaleza} onChange={(v) => handleChange("Naturaleza", v)} />
                            <Field label="Situación" value={values.Situación} onChange={(v) => handleChange("Situación", v)} />
                            <Field label="Declarado" value={values.Declarado} onChange={(v) => handleChange("Declarado", v)} />
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
                    onClick={generate}
                    disabled={status === "generating"}
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
                            Generar Certificado
                        </>
                    )}
                </button>
            </div>
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

function Field({ label, value, onChange, type = "text", className = "" }: { label: string; value: any; onChange: (v: string) => void; type?: string; className?: string }) {
    return (
        <div className="flex flex-col">
            <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">{label}</label>
            <input
                type={type}
                value={value ?? ""}
                onChange={(e) => onChange(e.target.value)}
                className={`w-full rounded-lg border border-neutral-200 bg-neutral-50/60 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400 focus:bg-white disabled:bg-neutral-100 disabled:text-neutral-400 transition ${className}`}
            />
        </div>
    );
}
