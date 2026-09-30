"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { Save, Loader2, Upload, X, Building2, ExternalLink } from "lucide-react";
import { api, jsonInit, errMsg, inputCls, labelCls, cardCls, btnDark, btnGhost, nifPendiente, type Facturador } from "./shared";

type Form = Omit<Facturador, "id" | "logo_path" | "logo_url" | "serie" | "siguiente" | "origen_datos" | "aviso_ajustes">;

/** En el facturador vinculado, estos campos vienen de Ajustes Emisor. */
const DE_AJUSTES = ["razon_social", "nif", "direccion", "cp", "ciudad", "telefono", "iban"] as const;

const aForm = (f: Facturador): Form => ({
    razon_social: f.razon_social, nombre_comercial: f.nombre_comercial ?? "", nif: nifPendiente(f.nif) ? "" : f.nif,
    tipo_persona: f.tipo_persona, direccion: f.direccion ?? "", cp: f.cp ?? "", ciudad: f.ciudad ?? "", provincia: f.provincia ?? "",
    email: f.email ?? "", telefono: f.telefono ?? "", iban: f.iban ?? "", iva_defecto: Number(f.iva_defecto),
    irpf_defecto: Number(f.irpf_defecto), pie_legal: f.pie_legal ?? "", color_principal: f.color_principal, activo: f.activo,
});

function Campo({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
    return <label className={`block ${className}`}><span className={labelCls}>{label}</span>{children}</label>;
}

export default function FichaFacturador({ f, onSaved }: { f: Facturador; onSaved: () => void }) {
    const [v, setV] = useState<Form>(() => aForm(f));
    const [saving, setSaving] = useState(false);
    const [logoUrl, setLogoUrl] = useState(f.logo_url);
    const [subiendo, setSubiendo] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    useEffect(() => { setV(aForm(f)); setLogoUrl(f.logo_url); }, [f]);

    const vinculado = f.origen_datos === "ajustes_emisor";
    const set = <K extends keyof Form>(k: K, val: Form[K]) => setV((p) => ({ ...p, [k]: val }));
    const txt = (k: keyof Form) => ({
        value: String(v[k] ?? ""),
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(k, e.target.value as never),
        ...(vinculado && (DE_AJUSTES as readonly string[]).includes(k) ? { readOnly: true, required: false, className: `${inputCls} bg-neutral-50 text-neutral-500`, title: "Se edita en Ajustes Emisor" } : {}),
    });

    const guardar = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const body: Record<string, unknown> = { ...v };
            if (vinculado) for (const k of DE_AJUSTES) delete body[k];
            await api(`/api/admin/facturacion/facturadores/${f.id}`, jsonInit("PUT", body));
            toast.success("Datos guardados");
            onSaved();
        } catch (err) { toast.error(errMsg(err)); } finally { setSaving(false); }
    };

    const subirLogo = async (file: File) => {
        setSubiendo(true);
        try {
            const fd = new FormData(); fd.append("file", file);
            const r = await api<{ url: string }>(`/api/admin/facturacion/facturadores/${f.id}/logo`, { method: "POST", body: fd });
            setLogoUrl(r.url); toast.success("Logo actualizado");
        } catch (err) { toast.error(errMsg(err)); } finally { setSubiendo(false); }
    };

    const quitarLogo = async () => {
        try {
            await api(`/api/admin/facturacion/facturadores/${f.id}/logo`, { method: "DELETE" });
            setLogoUrl(null); toast.success("Logo quitado");
        } catch (err) { toast.error(errMsg(err)); }
    };

    return (
        <form onSubmit={guardar} className={`${cardCls} space-y-4`}>
            <h2 className="font-semibold text-neutral-800 flex items-center gap-2"><Building2 className="w-4 h-4" /> Datos del facturador</h2>
            {vinculado && (
                <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-neutral-700">
                    Nombre, CIF, dirección, teléfono, IBAN y logo se toman de <Link href="/dashboard/ajustes-emisor" className="underline font-medium inline-flex items-center gap-1">Ajustes Emisor <ExternalLink className="w-3.5 h-3.5" /></Link>. Aquí solo se configura lo propio de la factura.
                    {f.aviso_ajustes && <div className="text-amber-700 mt-1">{f.aviso_ajustes}</div>}
                </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Campo label="Razón social (sale en la factura)"><input className={inputCls} required {...txt("razon_social")} /></Campo>
                <Campo label="Nombre corto (para el panel)"><input className={inputCls} {...txt("nombre_comercial")} /></Campo>
                <Campo label="NIF / CIF"><input className={`${inputCls} uppercase`} required {...txt("nif")} placeholder="Obligatorio para emitir" /></Campo>
                <Campo label="Tipo">
                    <select className={inputCls} value={v.tipo_persona} onChange={(e) => set("tipo_persona", e.target.value as Form["tipo_persona"])}>
                        <option value="juridica">Sociedad</option><option value="fisica">Autónomo / persona física</option>
                    </select>
                </Campo>
                <Campo label="Dirección" className="md:col-span-2"><input className={inputCls} {...txt("direccion")} /></Campo>
                <div className="grid grid-cols-3 gap-3 md:col-span-2">
                    <Campo label="C.P."><input className={inputCls} {...txt("cp")} /></Campo>
                    <Campo label="Ciudad"><input className={inputCls} {...txt("ciudad")} /></Campo>
                    <Campo label="Provincia"><input className={inputCls} {...txt("provincia")} /></Campo>
                </div>
                <Campo label="Email"><input type="email" className={inputCls} {...txt("email")} /></Campo>
                <Campo label="Teléfono"><input className={inputCls} {...txt("telefono")} /></Campo>
                <Campo label="IBAN (Nº c/c ingreso)" className="md:col-span-2"><input className={`${inputCls} font-mono`} {...txt("iban")} /></Campo>
                <Campo label="IVA por defecto (%)"><input type="number" step="0.01" min={0} max={100} className={inputCls} value={v.iva_defecto} onChange={(e) => set("iva_defecto", Number(e.target.value))} /></Campo>
                <Campo label="IRPF por defecto (%)"><input type="number" step="0.01" min={0} max={100} className={inputCls} value={v.irpf_defecto} onChange={(e) => set("irpf_defecto", Number(e.target.value))} /></Campo>
                <Campo label="Texto legal del pie (RGPD)" className="md:col-span-2">
                    <textarea rows={4} className={inputCls} value={v.pie_legal ?? ""} onChange={(e) => set("pie_legal", e.target.value)} />
                </Campo>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-neutral-100">
                <div>
                    <span className={labelCls}>Logo</span>
                    <div className="mt-1 h-24 rounded-lg border border-dashed border-neutral-300 flex items-center justify-center bg-neutral-50">
                        {logoUrl ? <img src={logoUrl} alt="Logo" className="max-h-20 max-w-full object-contain" /> : <span className="text-xs text-neutral-400">Sin logo: saldrá solo el texto</span>}
                    </div>
                    {vinculado ? (
                        <Link href="/dashboard/ajustes-emisor" className={`${btnGhost} mt-2`}><ExternalLink className="w-4 h-4" /> Cambiar en Ajustes Emisor</Link>
                    ) : (
                    <div className="flex gap-2 mt-2">
                        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                            onChange={(e) => { const file = e.target.files?.[0]; if (file) subirLogo(file); e.target.value = ""; }} />
                        <button type="button" className={btnGhost} onClick={() => fileRef.current?.click()} disabled={subiendo}>
                            {subiendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Subir logo
                        </button>
                        {logoUrl && <button type="button" className={btnGhost} onClick={quitarLogo}><X className="w-4 h-4" /> Quitar</button>}
                    </div>
                    )}
                </div>
                <div>
                    <span className={labelCls}>Color de la factura</span>
                    <div className="flex items-center gap-3 mt-1">
                        <input type="color" value={v.color_principal} onChange={(e) => set("color_principal", e.target.value.toUpperCase())} className="h-10 w-16 rounded border border-neutral-200" />
                        <span className="font-mono text-sm">{v.color_principal}</span>
                    </div>
                    <div className="mt-3 rounded px-3 py-2 text-sm" style={{ background: v.color_principal }}>Así se verán las celdas de datos</div>
                    <label className="flex items-center gap-2 mt-4 text-sm text-neutral-600">
                        <input type="checkbox" checked={v.activo} onChange={(e) => set("activo", e.target.checked)} /> Activo (se puede facturar con él)
                    </label>
                </div>
            </div>

            <div className="flex justify-end">
                <button type="submit" className={btnDark} disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar datos
                </button>
            </div>
        </form>
    );
}
