"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Loader2, AlertTriangle } from "lucide-react";
import FichaFacturador from "@/components/facturacion/FichaFacturador";
import NumeracionFacturador from "@/components/facturacion/NumeracionFacturador";
import { FacturacionHeader, useAdminGuard, api, errMsg, nombreFacturador, nifPendiente, type Facturador } from "@/components/facturacion/shared";

export default function FacturadoresPage() {
    const ok = useAdminGuard();
    const [lista, setLista] = useState<Facturador[]>([]);
    const [anio, setAnio] = useState(new Date().getFullYear());
    const [sel, setSel] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const cargar = useCallback(async () => {
        try {
            const r = await api<{ facturadores: Facturador[]; anio: number }>("/api/admin/facturacion/facturadores");
            setLista(r.facturadores); setAnio(r.anio);
            setSel((s) => s ?? r.facturadores[0]?.id ?? null);
        } catch (e) { toast.error(errMsg(e)); } finally { setLoading(false); }
    }, []);
    useEffect(() => { if (ok) cargar(); }, [ok, cargar]);

    const f = lista.find((x) => x.id === sel);
    if (!ok || loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-neutral-400" /></div>;

    return (
        <div className="space-y-6">
            <FacturacionHeader />
            <div className="flex flex-wrap gap-2">
                {lista.map((x) => {
                    const incompleto = nifPendiente(x.nif) || !x.serie;
                    return (
                        <button key={x.id} onClick={() => setSel(x.id)}
                            className={`px-3 py-2 rounded-lg text-sm border flex items-center gap-2 transition ${x.id === sel ? "bg-yellow-50 border-yellow-400 text-neutral-900" : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"} ${x.activo ? "" : "opacity-60"}`}>
                            <span className="w-3 h-3 rounded-full" style={{ background: x.color_principal }} />
                            {nombreFacturador(x)}
                            {incompleto && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" aria-label="Faltan datos" />}
                        </button>
                    );
                })}
            </div>
            {f && (
                <div className="space-y-4">
                    {(nifPendiente(f.nif) || !f.serie) && (
                        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                            Para emitir con {nombreFacturador(f)} falta{f.origen_datos === "ajustes_emisor" ? " (en Ajustes Emisor)" : ""}: {[nifPendiente(f.nif) && "el NIF", !f.direccion && "la dirección", !f.serie && "guardar la numeración"].filter(Boolean).join(", ")}.
                        </div>
                    )}
                    <FichaFacturador f={f} onSaved={cargar} />
                    <NumeracionFacturador f={f} anio={anio} onSaved={cargar} />
                </div>
            )}
        </div>
    );
}
