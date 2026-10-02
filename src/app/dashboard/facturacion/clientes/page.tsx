"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Loader2, Plus, Download, Pencil, Trash2, Search } from "lucide-react";
import { ClienteForm, ImportarCliente } from "@/components/facturacion/ClienteForm";
import ConfirmarDialog from "@/components/facturacion/ConfirmarDialog";
import { FacturacionHeader, useAdminGuard, api, errMsg, cardCls, inputCls, btnPrimary, btnGhost, type Cliente } from "@/components/facturacion/shared";

const ORIGEN: Record<string, string> = { manual: "Manual", comunidad: "Comunidad", proveedor: "Proveedor", facturador: "Facturador" };

export default function ClientesFacturacionPage() {
    const ok = useAdminGuard();
    const [lista, setLista] = useState<Cliente[]>([]);
    const [loading, setLoading] = useState(true);
    const [modo, setModo] = useState<"nada" | "nuevo" | "importar" | Cliente>("nada");
    const [q, setQ] = useState("");

    const cargar = useCallback(async () => {
        try {
            const r = await api<{ clientes: Cliente[] }>("/api/admin/facturacion/clientes");
            setLista(r.clientes);
        } catch (e) { toast.error(errMsg(e)); } finally { setLoading(false); }
    }, []);
    useEffect(() => { if (ok) cargar(); }, [ok, cargar]);

    const [aQuitar, setAQuitar] = useState<Cliente | null>(null);
    const quitar = async (c: Cliente) => {
        setAQuitar(null);
        try {
            await api(`/api/admin/facturacion/clientes/${c.id}`, { method: "DELETE" });
            toast.success("Quitado de la agenda"); cargar();
        } catch (e) { toast.error(errMsg(e)); }
    };

    const filtrados = lista.filter((c) => !q || `${c.nombre} ${c.nif ?? ""} ${c.ciudad ?? ""}`.toLowerCase().includes(q.toLowerCase()));
    if (!ok || loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-neutral-400" /></div>;

    return (
        <div className="space-y-6">
            <ConfirmarDialog open={aQuitar !== null} titulo="¿Quitar de la agenda?" textoConfirmar="Quitar" peligro
                onConfirmar={() => aQuitar && quitar(aQuitar)} onCancelar={() => setAQuitar(null)}>
                <p>Se quitará a <strong>{aQuitar?.nombre}</strong> de la agenda. Sus facturas emitidas no cambian.</p>
            </ConfirmarDialog>
            <FacturacionHeader />
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 absolute left-3 top-3.5 text-neutral-400" />
                    <input className={`${inputCls} pl-9 mt-0`} placeholder="Buscar cliente" value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
                <div className="flex gap-2">
                    <button className={btnGhost} onClick={() => setModo("importar")}><Download className="w-4 h-4" /> Importar</button>
                    <button className={btnPrimary} onClick={() => setModo("nuevo")}><Plus className="w-4 h-4" /> Nuevo cliente</button>
                </div>
            </div>

            {modo !== "nada" && (
                <div className={cardCls}>
                    <h2 className="font-semibold text-neutral-800 mb-3">
                        {modo === "importar" ? "Importar desde el panel" : modo === "nuevo" ? "Nuevo cliente" : `Editar ${modo.nombre}`}
                    </h2>
                    {modo === "importar"
                        ? <ImportarCliente onImported={() => { setModo("nada"); cargar(); }} />
                        : <ClienteForm cliente={modo === "nuevo" ? null : modo} onCancel={() => setModo("nada")} onSaved={() => { setModo("nada"); cargar(); }} />}
                </div>
            )}

            <div className={`${cardCls} p-0 overflow-x-auto`}>
                <table className="w-full text-sm">
                    <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase">
                        <tr><th className="text-left px-4 py-2">Cliente</th><th className="text-left px-4 py-2">NIF</th><th className="text-left px-4 py-2 hidden md:table-cell">Ciudad</th><th className="text-left px-4 py-2 hidden md:table-cell">Origen</th><th /></tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                        {filtrados.map((c) => (
                            <tr key={c.id}>
                                <td className="px-4 py-2">{c.nombre}</td>
                                <td className="px-4 py-2 font-mono text-xs">{c.nif ?? <span className="text-amber-600">sin NIF</span>}</td>
                                <td className="px-4 py-2 hidden md:table-cell">{c.ciudad}</td>
                                <td className="px-4 py-2 hidden md:table-cell text-neutral-500">{ORIGEN[c.origen] ?? c.origen}</td>
                                <td className="px-4 py-2 text-right whitespace-nowrap">
                                    <button className="p-1.5 text-neutral-500 hover:text-neutral-900" aria-label="Editar" onClick={() => setModo(c)}><Pencil className="w-4 h-4" /></button>
                                    <button className="p-1.5 text-neutral-500 hover:text-red-600" aria-label="Quitar" onClick={() => setAQuitar(c)}><Trash2 className="w-4 h-4" /></button>
                                </td>
                            </tr>
                        ))}
                        {!filtrados.length && <tr><td colSpan={5} className="px-4 py-8 text-center text-neutral-400">Aún no hay clientes. Crea uno o impórtalo desde comunidades o proveedores.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
