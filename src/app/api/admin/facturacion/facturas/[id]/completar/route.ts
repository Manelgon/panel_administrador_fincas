import { NextResponse } from "next/server";
import { safeApiError } from "@/lib/errorMessage";
import { requireAdmin } from "@/lib/facturacion/server";
import { completarFactura } from "@/lib/facturacion/emitir";

export const dynamic = "force-dynamic";

// POST — reintenta el registro VeriFactu y el PDF de una factura ya emitida
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireAdmin();
        if ("res" in auth) return auth.res;
        const { id } = await ctx.params;
        const r = await completarFactura(id);
        if ("error" in r) return NextResponse.json({ error: `No se pudo completar: ${r.error}` }, { status: 400 });
        return NextResponse.json({ ok: true });
    } catch (err: unknown) {
        return NextResponse.json({ error: safeApiError(err, "facturacion/completar") }, { status: 500 });
    }
}
