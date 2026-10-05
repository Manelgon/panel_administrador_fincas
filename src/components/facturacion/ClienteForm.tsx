"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Loader2, Save, Search, Download } from "lucide-react";
import { api, jsonInit, errMsg, inputCls, labelCls, btnDark, btnGhost, type Cliente } from "./shared";

// Alta/edición de un cliente de la agenda, y buscador para importarlo
// desde comunidades, proveedores u otro facturador.

type Datos = Omit<Cliente, "id" | "origen">;
const vacio: Datos = { nombre: "", nif: "", direccion: "", cp: "", ciudad: "", provincia: "", email: "" };

export function ClienteForm({ cliente, onSaved, onCancel }: { cliente?: Cliente | null; onSaved: (c: Cliente) => void; onCancel: () => void }) {
    const [v, setV] = useState<Datos>(cliente ? { ...vacio, ...cliente } : vacio);
    const [saving, setSaving] = useState(false);
    useEffect(() => setV(cliente ? { ...vacio, ...cliente } : vacio), [cliente]);
    const f = (k: keyof Datos) => ({ value: v[k] ?? "", onChange: (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value }) });

    const guardar = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (cliente) {
                await api(`/api/admin/facturacion/clientes/${cliente.id}`, jsonInit("PUT", v));
                onSaved({ ...cliente, ...v });
            } else {
                const r = await api<{ cliente: Cliente }>("/api/admin/facturacion/clientes", jsonInit("POST", v));
                onSaved(r.cliente);
            }
            toast.success("Cliente guardado");
        } catch (err) { toast.error(errMsg(err)); } finally { setSaving(false); }
    };

    return (
        <form onSubmit={guardar} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="md:col-span-2"><span className={labelCls}>Nombre o razón social</span><input required className={inputCls} {...f("nombre")} /></label>
                <label><span className={labelCls}>NIF / CIF</span><input className={`${inputCls} uppercase`} {...f("nif")} /></label>
                <label><span className={labelCls}>Email</span><input type="email" className={inputCls} {...f("email")} /></label>
                <label className="md:col-span-2"><span className={labelCls}>Dirección</span><input className={inputCls} {...f("direccion")} /></label>
                <div className="grid grid-cols-3 gap-3 md:col-span-2">
                    <label><span className={labelCls}>C.P.</span><input className={inputCls} {...f("cp")} /></label>
                    <label><span className={labelCls}>Ciudad</span><input className={inputCls} {...f("ciudad")} /></label>
                    <label><span className={labelCls}>Provincia</span><input className={inputCls} {...f("provincia")} /></label>
                </div>
            </div>
            <div className="flex justify-end gap-2">
                <button type="button" className={btnGhost} onClick={onCancel}>Cancelar</button>
                <button type="submit" className={btnDark} disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar cliente
                </button>
            </div>
        </form>
    );
}

type Fuente = { id: string; nombre: string; nif: string | null; ciudad: string | null };
const TIPOS = [["comunidad", "Comunidades"], ["proveedor", "Proveedores"], ["facturador", "Facturadores"]] as const;

export function ImportarCliente({ onImported }: { onImported: (c: Cliente) => void }) {
    const [tipo, setTipo] = useState<(typeof TIPOS)[number][0]>("comunidad");
    const [q, setQ] = useState("");
    const [res, setRes] = useState<Fuente[]>([]);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        const t = setTimeout(async () => {
            try {
                const r = await api<{ resultados: Fuente[] }>(`/api/admin/facturacion/clientes/fuentes?tipo=${tipo}&q=${encodeURIComponent(q)}`);
                setRes(r.resultados);
            } catch (e) { toast.error(errMsg(e)); }
        }, 250);
        return () => clearTimeout(t);
    }, [tipo, q]);

    const importar = async (id: string) => {
        setBusy(true);
        try {
            const r = await api<{ cliente: Cliente }>("/api/admin/facturacion/clientes/fuentes", jsonInit("POST", { tipo, id }));
            toast.success("Añadido a la agenda");
            onImported(r.cliente);
        } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
    };

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
                {TIPOS.map(([k, l]) => (
                    <button key={k} type="button" onClick={() => setTipo(k)}
                        className={`px-3 py-1.5 rounded-lg text-sm border ${tipo === k ? "bg-yellow-50 border-yellow-400" : "border-neutral-200 text-neutral-600"}`}>{l}</button>
                ))}
            </div>
            <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3.5 text-neutral-400" />
                <input className={`${inputCls} pl-9`} placeholder="Buscar por nombre, código o NIF" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <ul className="divide-y divide-neutral-100 max-h-72 overflow-auto border border-neutral-100 rounded-lg">
                {res.map((r) => (
                    <li key={r.id} className="flex items-center justify-between px-3 py-2 text-sm">
                        <div className="min-w-0">
                            <div className="truncate">{r.nombre}</div>
                            <div className="text-xs text-neutral-400">{[r.nif ?? "sin NIF", r.ciudad].filter(Boolean).join(" · ")}</div>
                        </div>
                        <button type="button" className={btnGhost} disabled={busy} onClick={() => importar(r.id)}><Download className="w-4 h-4" /> Usar</button>
                    </li>
                ))}
                {!res.length && <li className="px-3 py-4 text-sm text-neutral-400 text-center">Sin resultados</li>}
            </ul>
        </div>
    );
}
