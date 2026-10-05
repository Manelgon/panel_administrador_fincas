import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { safeApiError } from "@/lib/errorMessage";
import { requireAdmin } from "@/lib/facturacion/server";

export const dynamic = "force-dynamic";

// GET ?anio=2026 — facturas emitidas del año + todos los borradores
export async function GET(req: Request) {
    try {
        const auth = await requireAdmin();
        if ("res" in auth) return auth.res;
        const anio = Number(new URL(req.url).searchParams.get("anio")) || new Date().getFullYear();

        const [facturas, borradores] = await Promise.all([
            supabaseAdmin.from("facturas")
                .select("id, emisor_id, numero, fecha_emision, cliente_nombre, cliente_nif, base_total, cuota_total, retencion_total, importe_total, estado, pdf_url, verifactu_alta_id, fecha_pago, created_at")
                .eq("anio", anio).order("fecha_emision", { ascending: false }).order("correlativo", { ascending: false }),
            supabaseAdmin.from("factura_borradores")
                .select("id, emisor_id, fecha_emision, lineas, retencion_pct, updated_at, clientes_facturacion(nombre)")
                .order("updated_at", { ascending: false }),
        ]);
        if (facturas.error) throw facturas.error;
        if (borradores.error) throw borradores.error;
        return NextResponse.json({ ok: true, anio, facturas: facturas.data, borradores: borradores.data });
    } catch (err: unknown) {
        return NextResponse.json({ error: safeApiError(err, "facturacion/facturas") }, { status: 500 });
    }
}
