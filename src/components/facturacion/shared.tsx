"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

// Piezas comunes de las pantallas de Facturación.

export const inputCls = "mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-400 focus:outline-none";
export const selectCls = "rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-400 focus:outline-none";
export const labelCls = "text-sm font-medium text-neutral-700";
export const cardCls = "bg-white rounded-xl shadow-sm border border-neutral-200 p-5";
export const btnPrimary = "inline-flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-neutral-950 px-4 py-2 rounded-lg font-semibold text-sm transition disabled:opacity-50";
export const btnDark = "inline-flex items-center gap-2 bg-neutral-900 hover:bg-neutral-800 text-white px-4 py-2 rounded-lg font-semibold text-sm transition disabled:opacity-50";
export const btnGhost = "inline-flex items-center gap-2 border border-neutral-200 hover:bg-neutral-50 text-neutral-700 px-3 py-2 rounded-lg text-sm transition disabled:opacity-50";

/** Redirige fuera si no es admin. La comprobación real está en cada API. */
export function useAdminGuard(): boolean {
    const router = useRouter();
    const [ok, setOk] = useState(false);
    useEffect(() => {
        (async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) { router.push("/auth/login"); return; }
            const { data } = await supabase.from("profiles").select("rol").eq("user_id", session.user.id).single();
            if (data?.rol !== "admin") { router.push("/dashboard"); return; }
            setOk(true);
        })();
    }, [router]);
    return ok;
}

/** fetch JSON que lanza con el mensaje de error de la API. */
export async function api<T = Record<string, unknown>>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, init);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Error inesperado");
    return json as T;
}

export const jsonInit = (method: string, body: unknown): RequestInit =>
    ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Error inesperado");

const TABS = [
    { href: "/dashboard/facturacion", label: "Facturas" },
    { href: "/dashboard/facturacion/facturadores", label: "Facturadores" },
    { href: "/dashboard/facturacion/clientes", label: "Clientes" },
];

/** Cabecera común de todas las pestañas: título, botón de nueva factura y pestañas. */
export function FacturacionHeader({ titulo = "Facturación" }: { titulo?: string }) {
    return (
        <>
            <div className="flex items-center justify-between gap-3">
                <h1 className="text-xl font-bold text-neutral-900">{titulo}</h1>
                <Link href="/dashboard/facturacion/nueva" className={btnPrimary}><Plus className="w-4 h-4" /> Nueva factura</Link>
            </div>
            <FacturacionTabs />
        </>
    );
}

export function FacturacionTabs() {
    const path = usePathname();
    return (
        <div className="flex gap-1 border-b border-neutral-200">
            {TABS.map((t) => {
                const on = t.href === "/dashboard/facturacion"
                    ? path === t.href || path.startsWith("/dashboard/facturacion/nueva") || path.startsWith("/dashboard/facturacion/borrador")
                    : path.startsWith(t.href);
                return (
                    <Link key={t.href} href={t.href}
                        className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${on ? "border-yellow-400 text-neutral-900" : "border-transparent text-neutral-500 hover:text-neutral-800"}`}>
                        {t.label}
                    </Link>
                );
            })}
        </div>
    );
}

export type Facturador = {
    id: string; razon_social: string; nombre_comercial: string | null; nif: string; tipo_persona: "fisica" | "juridica";
    direccion: string | null; cp: string | null; ciudad: string | null; provincia: string | null; email: string | null;
    telefono: string | null; iban: string | null; iva_defecto: number; irpf_defecto: number; pie_legal: string | null;
    color_principal: string; logo_path: string | null; logo_url: string | null; activo: boolean;
    origen_datos: "propio" | "ajustes_emisor"; aviso_ajustes: string | null;
    serie: { id: number; prefijo: string; sep1: string; anio_cifras: 0 | 2 | 4; sep2: string; digitos: number; reinicio_anual: boolean } | null;
    siguiente: number | null;
};

export type Cliente = {
    id: string; nombre: string; nif: string | null; direccion: string | null; cp: string | null;
    ciudad: string | null; provincia: string | null; email: string | null; origen: string;
};

export const nombreFacturador = (f: Pick<Facturador, "nombre_comercial" | "razon_social">) => f.nombre_comercial || f.razon_social;
export const nifPendiente = (nif: string) => nif.startsWith("PENDIENTE");
