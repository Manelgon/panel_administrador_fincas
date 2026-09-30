"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Hash, Save, Loader2 } from "lucide-react";
import { formatearNumero } from "@/lib/verifactu/numeracion";
import { api, jsonInit, errMsg, inputCls, labelCls, cardCls, btnDark, type Facturador } from "./shared";

const SEPS = [["", "(ninguno)"], ["-", "-"], ["/", "/"], [":", ":"], [".", "."]] as const;

export default function NumeracionFacturador({ f, anio, onSaved }: { f: Facturador; anio: number; onSaved: () => void }) {
    const inicial = () => ({
        prefijo: f.serie?.prefijo ?? "FCT",
        sep1: f.serie?.sep1 ?? ":",
        anio_cifras: (f.serie?.anio_cifras ?? 4) as 0 | 2 | 4,
        sep2: f.serie?.sep2 ?? "-",
        digitos: f.serie?.digitos ?? 2,
        reinicio_anual: f.serie?.reinicio_anual ?? true,
        siguiente: String(f.siguiente ?? 1),
    });
    const [v, setV] = useState(inicial);
    const [saving, setSaving] = useState(false);
    useEffect(() => setV(inicial()), [f.id, f.serie?.id, f.siguiente]); // eslint-disable-line react-hooks/exhaustive-deps

    const n = Math.max(1, parseInt(v.siguiente) || 1);
    const fmt = { prefijo: v.prefijo.toUpperCase(), sep1: v.sep1, anio: v.anio_cifras, sep2: v.sep2, digitos: v.digitos };

    const guardar = async () => {
        setSaving(true);
        try {
            const cambiaSiguiente = n !== (f.siguiente ?? 1) || !f.serie;
            await api(`/api/admin/facturacion/facturadores/${f.id}/numeracion`, jsonInit("PUT", {
                ...fmt, prefijo: fmt.prefijo, anio_cifras: v.anio_cifras, reinicio_anual: v.reinicio_anual,
                siguiente: cambiaSiguiente ? n : null,
            }));
            toast.success("Numeración guardada");
            onSaved();
        } catch (e) { toast.error(errMsg(e)); } finally { setSaving(false); }
    };

    return (
        <div className={cardCls}>
            <h2 className="font-semibold text-neutral-800 mb-1 flex items-center gap-2"><Hash className="w-4 h-4" /> Numeración de facturas</h2>
            {!f.serie && <p className="text-xs text-amber-700 mb-3">Sin configurar: hay que guardarla antes de poder emitir.</p>}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
                <label><span className={labelCls}>Prefijo</span>
                    <input className={inputCls} value={v.prefijo} maxLength={10} onChange={(e) => setV({ ...v, prefijo: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })} /></label>
                <label><span className={labelCls}>Separador</span>
                    <select className={inputCls} value={v.sep1} onChange={(e) => setV({ ...v, sep1: e.target.value })}>
                        {SEPS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
                <label><span className={labelCls}>Año</span>
                    <select className={inputCls} value={v.anio_cifras} onChange={(e) => setV({ ...v, anio_cifras: Number(e.target.value) as 0 | 2 | 4 })}>
                        <option value={4}>{anio}</option><option value={2}>{String(anio).slice(-2)}</option><option value={0}>Sin año</option></select></label>
                <label><span className={labelCls}>Separador tras año</span>
                    <select className={inputCls} value={v.sep2} disabled={v.anio_cifras === 0} onChange={(e) => setV({ ...v, sep2: e.target.value })}>
                        {SEPS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
                <label><span className={labelCls}>Cifras del número</span>
                    <input type="number" min={1} max={6} className={inputCls} value={v.digitos} onChange={(e) => setV({ ...v, digitos: Math.min(6, Math.max(1, parseInt(e.target.value) || 1)) })} /></label>
                <label><span className={labelCls}>Próxima factura</span>
                    <input type="number" min={1} className={inputCls} value={v.siguiente} onChange={(e) => setV({ ...v, siguiente: e.target.value })} /></label>
            </div>
            <label className="flex items-center gap-2 mt-3 text-sm text-neutral-600">
                <input type="checkbox" checked={v.reinicio_anual} onChange={(e) => setV({ ...v, reinicio_anual: e.target.checked })} />
                Volver a 1 cada 1 de enero
            </label>
            <div className="mt-4 rounded-lg bg-neutral-50 p-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                    <div className="text-xs text-neutral-500">La próxima factura saldrá como</div>
                    <div className="text-2xl font-mono font-semibold">{formatearNumero(fmt, anio, n)}</div>
                </div>
                <div className="text-xs text-neutral-500">y la siguiente: <span className="font-mono">{formatearNumero(fmt, anio, n + 1)}</span></div>
            </div>
            <p className="text-xs text-neutral-400 mt-2">Cuando ya hay facturas emitidas, el formato queda fijo y el número no puede bajar (evita números repetidos).</p>
            <div className="flex justify-end mt-3">
                <button className={btnDark} onClick={guardar} disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar numeración
                </button>
            </div>
        </div>
    );
}
