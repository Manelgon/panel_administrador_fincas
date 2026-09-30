"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { Loader2, Plus, Trash2, Save, Eye, Send, UserPlus, Download } from "lucide-react";
import { calcularTotales, moneda, type LineaEntrada } from "@/lib/facturacion/calculo";
import { formatearNumero } from "@/lib/verifactu/numeracion";
import { ClienteForm, ImportarCliente } from "./ClienteForm";
import { api, jsonInit, errMsg, inputCls, labelCls, cardCls, btnPrimary, btnDark, btnGhost, nombreFacturador, nifPendiente, type Facturador, type Cliente } from "./shared";

type Linea = { cantidad: string; concepto: string; precio_unitario: string; tipo_iva: string };
const num = (s: string) => Number(String(s).replace(",", ".")) || 0;
const hoy = () => new Date().toISOString().slice(0, 10);

export default function EditorFactura({ borradorId }: { borradorId?: string }) {
    const router = useRouter();
    const [id, setId] = useState(borradorId);
    const [facturadores, setFacturadores] = useState<Facturador[]>([]);
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [anio, setAnio] = useState(new Date().getFullYear());
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<"" | "guardar" | "preview" | "emitir">("");
    const [panelCliente, setPanelCliente] = useState<"" | "nuevo" | "importar">("");

    const [emisorId, setEmisorId] = useState<string | null>(null);
    const [clienteId, setClienteId] = useState<string | null>(null);
    const [fecha, setFecha] = useState(hoy());
    const [lineas, setLineas] = useState<Linea[]>([]);
    const [irpf, setIrpf] = useState("0");
    const [notas, setNotas] = useState("");

    useEffect(() => {
        (async () => {
            try {
                const [f, c] = await Promise.all([
                    api<{ facturadores: Facturador[]; anio: number }>("/api/admin/facturacion/facturadores"),
                    api<{ clientes: Cliente[] }>("/api/admin/facturacion/clientes"),
                ]);
                setFacturadores(f.facturadores.filter((x) => x.activo)); setAnio(f.anio); setClientes(c.clientes);
                if (borradorId) {
                    const { borrador: b } = await api<{ borrador: { emisor_id: string; cliente_id: string | null; fecha_emision: string | null; lineas: LineaEntrada[]; retencion_pct: number; notas: string | null } }>(`/api/admin/facturacion/borradores/${borradorId}`);
                    setEmisorId(b.emisor_id); setClienteId(b.cliente_id); setFecha(b.fecha_emision ?? hoy());
                    setLineas(b.lineas.map((l) => ({ cantidad: String(l.cantidad), concepto: l.concepto, precio_unitario: String(l.precio_unitario), tipo_iva: String(l.tipo_iva) })));
                    setIrpf(String(b.retencion_pct)); setNotas(b.notas ?? "");
                }
            } catch (e) { toast.error(errMsg(e)); } finally { setLoading(false); }
        })();
    }, [borradorId]);

    const emisor = facturadores.find((f) => f.id === emisorId) ?? null;
    const cliente = clientes.find((c) => c.id === clienteId) ?? null;
    const entrada: LineaEntrada[] = lineas.map((l) => ({ cantidad: num(l.cantidad), concepto: l.concepto, precio_unitario: num(l.precio_unitario), tipo_iva: num(l.tipo_iva) }));
    const t = useMemo(() => calcularTotales(entrada, num(irpf)), [JSON.stringify(entrada), irpf]); // eslint-disable-line react-hooks/exhaustive-deps

    const elegirEmisor = (f: Facturador) => {
        setEmisorId(f.id);
        if (!id) setIrpf(String(Number(f.irpf_defecto)));
        if (!lineas.length) setLineas([{ cantidad: "1", concepto: "", precio_unitario: "", tipo_iva: String(Number(f.iva_defecto)) }]);
    };
    const setLinea = (i: number, k: keyof Linea, v: string) => setLineas((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));

    const guardar = async (): Promise<string | null> => {
        if (!emisorId) { toast.error("Elige con qué facturador emites"); return null; }
        const body = { emisor_id: emisorId, cliente_id: clienteId, fecha_emision: fecha || null, lineas: entrada.filter((l) => l.concepto.trim()), retencion_pct: num(irpf), notas };
        if (id) { await api(`/api/admin/facturacion/borradores/${id}`, jsonInit("PUT", body)); return id; }
        const r = await api<{ id: string }>("/api/admin/facturacion/borradores", jsonInit("POST", body));
        setId(r.id); window.history.replaceState(null, "", `/dashboard/facturacion/borrador/${r.id}`);
        return r.id;
    };

    const accion = async (tipo: "guardar" | "preview" | "emitir") => {
        if (tipo === "emitir") {
            if (!emisor?.serie) { toast.error("Configura la numeración de este facturador antes de emitir"); return; }
            const numero = formatearNumero({ prefijo: emisor.serie.prefijo, sep1: emisor.serie.sep1, anio: emisor.serie.anio_cifras, sep2: emisor.serie.sep2, digitos: emisor.serie.digitos }, Number(fecha.slice(0, 4)) || anio, emisor.siguiente ?? 1);
            if (!confirm(`Se emitirá con ${nombreFacturador(emisor)} como ${numero} (aprox.).\n\nUna vez emitida no se puede modificar ni borrar: solo rectificar.\n\n¿Emitir?`)) return;
        }
        const win = tipo === "preview" ? window.open("", "_blank") : null;
        setBusy(tipo);
        try {
            const bid = await guardar();
            if (!bid) { win?.close(); return; }
            if (tipo === "guardar") toast.success("Borrador guardado");
            if (tipo === "preview" && win) win.location.href = `/api/admin/facturacion/borradores/${bid}/pdf`;
            if (tipo === "emitir") {
                const r = await api<{ numero: string }>(`/api/admin/facturacion/borradores/${bid}/emitir`, { method: "POST" });
                toast.success(`Factura ${r.numero} emitida`);
                router.push("/dashboard/facturacion");
            }
        } catch (e) { win?.close(); toast.error(errMsg(e)); } finally { setBusy(""); }
    };

    if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-neutral-400" /></div>;

    return (
        <div className="space-y-4">
            <div className={cardCls}>
                <h2 className="font-semibold text-neutral-800 mb-3">1. ¿Con quién facturas?</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {facturadores.map((f) => (
                        <button key={f.id} type="button" onClick={() => elegirEmisor(f)}
                            className={`text-left rounded-xl border-2 p-3 transition ${f.id === emisorId ? "border-neutral-900" : "border-neutral-200 hover:border-neutral-400"}`}>
                            <div className="h-10 flex items-center">
                                {f.logo_url ? <img src={f.logo_url} alt="" className="max-h-10 max-w-full object-contain" /> : <span className="w-6 h-6 rounded-full" style={{ background: f.color_principal }} />}
                            </div>
                            <div className="font-medium text-sm mt-2">{nombreFacturador(f)}</div>
                            <div className="text-xs text-neutral-500">{nifPendiente(f.nif) ? "Falta el NIF" : f.nif}{Number(f.irpf_defecto) > 0 ? ` · IRPF ${Number(f.irpf_defecto)} %` : ""}</div>
                        </button>
                    ))}
                </div>
            </div>

            <div className={cardCls}>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <h2 className="font-semibold text-neutral-800">2. Cliente y fecha</h2>
                    <div className="flex gap-2">
                        <button type="button" className={btnGhost} onClick={() => setPanelCliente(panelCliente === "importar" ? "" : "importar")}><Download className="w-4 h-4" /> Importar</button>
                        <button type="button" className={btnGhost} onClick={() => setPanelCliente(panelCliente === "nuevo" ? "" : "nuevo")}><UserPlus className="w-4 h-4" /> Nuevo</button>
                    </div>
                </div>
                {panelCliente && (
                    <div className="mb-4 rounded-lg bg-neutral-50 p-4">
                        {panelCliente === "nuevo"
                            ? <ClienteForm onCancel={() => setPanelCliente("")} onSaved={(c) => { setClientes((l) => [...l, c]); setClienteId(c.id); setPanelCliente(""); }} />
                            : <ImportarCliente onImported={(c) => { setClientes((l) => (l.some((x) => x.id === c.id) ? l : [...l, c])); setClienteId(c.id); setPanelCliente(""); }} />}
                    </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <label className="md:col-span-2"><span className={labelCls}>Cliente</span>
                        <select className={inputCls} value={clienteId ?? ""} onChange={(e) => setClienteId(e.target.value || null)}>
                            <option value="">Elige un cliente…</option>
                            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.nif ? ` · ${c.nif}` : " · sin NIF"}</option>)}
                        </select>
                        {cliente && !cliente.nif && <span className="text-xs text-amber-600">Este cliente no tiene NIF: complétalo en Clientes para poder emitir.</span>}
                    </label>
                    <label><span className={labelCls}>Fecha de emisión</span>
                        <input type="date" className={inputCls} value={fecha} onChange={(e) => setFecha(e.target.value)} /></label>
                </div>
            </div>

            <div className={cardCls}>
                <h2 className="font-semibold text-neutral-800 mb-3">3. Conceptos</h2>
                <div className="space-y-2">
                    <div className="hidden md:grid grid-cols-12 gap-2 text-xs text-neutral-500 uppercase">
                        <span className="col-span-1">Cant.</span><span className="col-span-6">Concepto</span><span className="col-span-2 text-right">Precio (sin IVA)</span><span className="col-span-1">IVA %</span><span className="col-span-2 text-right">Total</span>
                    </div>
                    {lineas.map((l, i) => (
                        <div key={i} className="grid grid-cols-12 gap-2 items-start">
                            <input aria-label="Cantidad" className={`${inputCls} mt-0 col-span-3 md:col-span-1`} inputMode="decimal" value={l.cantidad} onChange={(e) => setLinea(i, "cantidad", e.target.value)} />
                            <textarea aria-label="Concepto" rows={1} className={`${inputCls} mt-0 col-span-9 md:col-span-6`} value={l.concepto} onChange={(e) => setLinea(i, "concepto", e.target.value)} />
                            <input aria-label="Precio" className={`${inputCls} mt-0 col-span-5 md:col-span-2 text-right`} inputMode="decimal" value={l.precio_unitario} onChange={(e) => setLinea(i, "precio_unitario", e.target.value)} />
                            <input aria-label="IVA" className={`${inputCls} mt-0 col-span-3 md:col-span-1`} inputMode="decimal" value={l.tipo_iva} onChange={(e) => setLinea(i, "tipo_iva", e.target.value)} />
                            <div className="col-span-3 md:col-span-2 flex items-center justify-end gap-1 pt-2 text-sm">
                                {moneda(t.lineas[i]?.total ?? 0)}
                                <button type="button" aria-label="Quitar línea" className="p-1 text-neutral-400 hover:text-red-600" onClick={() => setLineas((ls) => ls.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></button>
                            </div>
                        </div>
                    ))}
                    <button type="button" className={btnGhost} disabled={!emisor}
                        onClick={() => setLineas((ls) => [...ls, { cantidad: "1", concepto: "", precio_unitario: "", tipo_iva: String(Number(emisor?.iva_defecto ?? 21)) }])}>
                        <Plus className="w-4 h-4" /> Añadir línea
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5 pt-4 border-t border-neutral-100">
                    <div className="space-y-3">
                        <label className="block w-40"><span className={labelCls}>IRPF (%)</span>
                            <input className={inputCls} inputMode="decimal" value={irpf} onChange={(e) => setIrpf(e.target.value)} /></label>
                        <label className="block"><span className={labelCls}>Notas internas (no salen en el PDF)</span>
                            <textarea rows={2} className={inputCls} value={notas} onChange={(e) => setNotas(e.target.value)} /></label>
                    </div>
                    <dl className="text-sm space-y-1 self-end">
                        <div className="flex justify-between"><dt>Base imponible</dt><dd>{moneda(t.base)} €</dd></div>
                        {t.desglose.map((d) => <div key={d.tipoIva} className="flex justify-between"><dt>IVA {d.tipoIva} %</dt><dd>{moneda(d.cuota)} €</dd></div>)}
                        {t.retencionPct > 0 && <div className="flex justify-between"><dt>IRPF {t.retencionPct} %</dt><dd>−{moneda(t.retencion)} €</dd></div>}
                        <div className="flex justify-between text-base font-bold pt-2 border-t border-neutral-200"><dt>Total factura</dt><dd>{moneda(t.aPagar)} €</dd></div>
                    </dl>
                </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
                <button type="button" className={btnGhost} disabled={!!busy} onClick={() => accion("guardar")}>{busy === "guardar" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar borrador</button>
                <button type="button" className={btnDark} disabled={!!busy} onClick={() => accion("preview")}>{busy === "preview" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />} Vista previa</button>
                <button type="button" className={btnPrimary} disabled={!!busy} onClick={() => accion("emitir")}>{busy === "emitir" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Emitir factura</button>
            </div>
        </div>
    );
}
