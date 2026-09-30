import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { safeApiError } from "@/lib/errorMessage";
import { requireAdmin } from "@/lib/facturacion/server";
import { emitirBorrador } from "@/lib/facturacion/emitir";

export const dynamic = "force-dynamic";

// POST — emitir: asigna número, congela la factura, registro VeriFactu y PDF
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireAdmin();
        if ("res" in auth) return auth.res;
        const { id } = await ctx.params;
        const r = await emitirBorrador(id, auth.userId);
        if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status ?? 400 });

        await supabaseAdmin.from("activity_logs").insert({
            user_id: auth.userId, action: "create", entity_type: "factura",
            entity_name: r.numero, details: { modulo: "facturacion", factura_id: r.facturaId },
        }).then(({ error }) => { if (error) console.warn("[facturacion] activity_logs:", error.message); });

        return NextResponse.json({ ok: true, facturaId: r.facturaId, numero: r.numero });
    } catch (err: unknown) {
        return NextResponse.json({ error: safeApiError(err, "facturacion/emitir") }, { status: 500 });
    }
}
