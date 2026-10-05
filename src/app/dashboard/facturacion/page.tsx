"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { Loader2, FileText, Pencil, Trash2, RefreshCw } from "lucide-react";
import { calcularTotales, moneda, type LineaEntrada } from "@/lib/facturacion/calculo";
import { FacturacionHeader, useAdminGuard, api, errMsg, cardCls, selectCls, nombreFacturador, type Facturador } from "@/components/facturacion/shared";
import ConfirmarDialog from "@/components/facturacion/ConfirmarDialog";

type Factura = {
    id: string; emisor_id: string; numero: string; fecha_emision: string; cliente_nombre: string;
    base_total: number; cuota_total: number; retencion_total: number; importe_total: number;
    estado: string; pdf_url: string | null; verifactu_alta_id: string | null;
};
type Borrador = { id: string; emisor_id: string; fecha_emision: string | null; lineas: LineaEntrada[]; retencion_pct: number; updated_at: string; clientes_facturacion: { nombre: string } | null };

const fechaEs = (iso: string) => iso.split("-").reverse().join("/");

export default function FacturacionPage() {
    const ok = useAdminGuard();
    const [anio, setAnio] = useState(new Date().getFullYear());
    const [filtro, setFiltro] = useState("");
    const [facturadores, setFacturadores] = useState<Facturador[]>([]);
    const [facturas, setFacturas] = useState<Factura[]>([]);
    const [borradores, setBorradores] = useState<Borrador[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<string | null>(null);

    const cargar = useCallback(async () => {
        try {
            const [f, l] = await Promise.all([
                api<{ facturadores: Facturador[] }>("/api/admin/facturacion/facturadores"),
                api<{ facturas: Factura[]; borradores: Borrador[] }>(`/api/admin/facturacion/facturas?anio=${anio}`),
            ]);
            setFacturadores(f.facturadores); setFacturas(l.facturas); setBorradores(l.borradores);
        } catch (e) { toast.error(errMsg(e)); } finally { setLoading(false); }
    }, [anio]);
    useEffect(() => { if (ok) cargar(); }, [ok, cargar]);

    const nombre = (id: string) => { const f = facturadores.find((x) => x.id === id); return f ? nombreFacturador(f) : "—"; };
    const color = (id: string) => facturadores.find((x) => x.id === id)?.color_principal ?? "#ddd";

    const verPdf = async (id: string) => {
        const win = window.open("", "_blank");
        try {
            const r = await api<{ url: string }>(`/api/admin/facturacion/facturas/${id}/pdf`);
            if (win) win.location.href = r.url;
        } catch (e) { win?.close(); toast.error(errMsg(e)); }
    };
    const completar = async (id: string) => {
        setBusy(id);
        try { await api(`/api/admin/facturacion/facturas/${id}/completar`, { method: "POST" }); toast.success("Factura completada"); cargar(); }
        catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); }
    };
    const [borradorABorrar, setBorradorABorrar] = useState<string | null>(null);
    const borrarBorrador = async (id: string) => {
        setBorradorABorrar(null);
        try { await api(`/api/admin/facturacion/borradores/${id}`, { method: "DELETE" }); cargar(); }
        catch (e) { toast.error(errMsg(e)); }
    };

    const fs = facturas.filter((f) => !filtro || f.emisor_id === filtro);
    const bs = borradores.filter((b) => !filtro || b.emisor_id === filtro);
    const kpis = facturadores.filter((f) => f.activo || facturas.some((x) => x.emisor_id === f.id)).map((f) => {
        const mias = facturas.filter((x) => x.emisor_id === f.id && x.estado === "emitida");
        return { f, n: mias.length, base: mias.reduce((s, x) => s + Number(x.base_total), 0) };
    });

    if (!ok || loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-neutral-400" /></div>;

    return (
        <div className="space-y-6">
            <ConfirmarDialog open={borradorABorrar !== null} titulo="¿Borrar este borrador?" textoConfirmar="Borrar" peligro
                onConfirmar={() => borradorABorrar && borrarBorrador(borradorABorrar)} onCancelar={() => setBorradorABorrar(null)}>
                <p>El borrador no tiene valor fiscal; se elimina sin dejar rastro.</p>
            </ConfirmarDialog>
            <FacturacionHeader />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {kpis.map(({ f, n, base }) => (
                    <button key={f.id} onClick={() => setFiltro(filtro === f.id ? "" : f.id)}
                        className={`text-left rounded-xl border p-4 bg-white transition ${filtro === f.id ? "border-neutral-900" : "border-neutral-200"}`}>
                        <div className="flex items-center gap-2 text-sm text-neutral-600"><span className="w-3 h-3 rounded-full" style={{ background: f.color_principal }} />{nombreFacturador(f)}</div>
                        <div className="text-2xl font-semibold mt-1">{moneda(base)} €</div>
                        <div className="text-xs text-neutral-500">{n} facturas en {anio} · base imponible</div>
                    </button>
                ))}
            </div>

            <div className="flex flex-wrap gap-2">
                <select className={selectCls} value={filtro} onChange={(e) => setFiltro(e.target.value)}>
                    <option value="">Todos los facturadores</option>
                    {facturadores.map((f) => <option key={f.id} value={f.id}>{nombreFacturador(f)}</option>)}
                </select>
                <select className={selectCls} value={anio} onChange={(e) => { setLoading(true); setAnio(Number(e.target.value)); }}>
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
            </div>

            {bs.length > 0 && (
                <div className={cardCls}>
                    <h2 className="font-semibold text-neutral-800 mb-2">Borradores</h2>
                    <ul className="divide-y divide-neutral-100">
                        {bs.map((b) => (
                            <li key={b.id} className="flex items-center justify-between py-2 text-sm gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color(b.emisor_id) }} />
                                    <span className="truncate">{nombre(b.emisor_id)} → {b.clientes_facturacion?.nombre ?? "sin cliente"}</span>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className="font-medium">{moneda(calcularTotales(b.lineas, Number(b.retencion_pct)).aPagar)} €</span>
                                    <Link href={`/dashboard/facturacion/borrador/${b.id}`} className="p-1.5 text-neutral-500 hover:text-neutral-900" aria-label="Editar"><Pencil className="w-4 h-4" /></Link>
                                    <button onClick={() => setBorradorABorrar(b.id)} className="p-1.5 text-neutral-500 hover:text-red-600" aria-label="Borrar"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className={`${cardCls} p-0 overflow-x-auto`}>
                <table className="w-full text-sm">
                    <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase">
                        <tr><th className="text-left px-4 py-2">Nº</th><th className="text-left px-4 py-2">Fecha</th><th className="text-left px-4 py-2">Facturador</th><th className="text-left px-4 py-2">Cliente</th><th className="text-right px-4 py-2">Total</th><th /></tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                        {fs.map((f) => {
                            const aPagar = Number(f.importe_total) - Number(f.retencion_total);
                            const incompleta = !f.pdf_url || !f.verifactu_alta_id;
                            return (
                                <tr key={f.id} className={f.estado === "anulada" ? "opacity-50" : ""}>
                                    <td className="px-4 py-2 font-mono text-xs whitespace-nowrap">{f.numero}</td>
                                    <td className="px-4 py-2 whitespace-nowrap">{fechaEs(f.fecha_emision)}</td>
                                    <td className="px-4 py-2"><span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: color(f.emisor_id) }} />{nombre(f.emisor_id)}</span></td>
                                    <td className="px-4 py-2">{f.cliente_nombre}</td>
                                    <td className="px-4 py-2 text-right whitespace-nowrap">{moneda(aPagar)} €</td>
                                    <td className="px-4 py-2 text-right whitespace-nowrap">
                                        {incompleta
                                            ? <button onClick={() => completar(f.id)} disabled={busy === f.id} className="inline-flex items-center gap-1 text-amber-700 text-xs"><RefreshCw className={`w-3.5 h-3.5 ${busy === f.id ? "animate-spin" : ""}`} /> Completar</button>
                                            : <button onClick={() => verPdf(f.id)} className="p-1.5 text-neutral-500 hover:text-neutral-900" aria-label="Ver PDF"><FileText className="w-4 h-4" /></button>}
                                    </td>
                                </tr>
                            );
                        })}
                        {!fs.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-neutral-400">No hay facturas emitidas en {anio}.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
