import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { safeApiError } from "@/lib/errorMessage";
import { requireAdmin, CAMPOS_AJUSTES } from "@/lib/facturacion/server";
import { facturadorSchema, primerError } from "@/lib/facturacion/schemas";
import { validarIdFiscal } from "@/lib/verifactu";

export const dynamic = "force-dynamic";

// PUT — guardar datos del facturador
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireAdmin();
        if ("res" in auth) return auth.res;
        const { id } = await ctx.params;

        const { data: actual } = await supabaseAdmin.from("facturacion_emisores").select("nif, origen_datos").eq("id", id).single();
        if (actual?.origen_datos === "ajustes_emisor") {
            // Nombre, CIF, dirección, teléfono, IBAN y logo se editan en Ajustes Emisor
            const parsed = facturadorSchema.partial().safeParse(await req.json());
            if (!parsed.success) return NextResponse.json({ error: primerError(parsed.error) }, { status: 400 });
            const datos: Record<string, unknown> = { ...parsed.data };
            for (const k of CAMPOS_AJUSTES) delete datos[k];
            const { error } = await supabaseAdmin.from("facturacion_emisores")
                .update({ ...datos, updated_at: new Date().toISOString() }).eq("id", id);
            if (error) throw error;
            return NextResponse.json({ ok: true });
        }

        const parsed = facturadorSchema.safeParse(await req.json());
        if (!parsed.success) return NextResponse.json({ error: primerError(parsed.error) }, { status: 400 });
        const nif = validarIdFiscal(parsed.data.nif);
        if (!nif.valido) return NextResponse.json({ error: `NIF no válido: ${nif.error}` }, { status: 400 });

        const { count } = await supabaseAdmin.from("facturas").select("id", { count: "exact", head: true }).eq("emisor_id", id);
        if ((count ?? 0) > 0 && actual && actual.nif !== nif.normalizado) {
            return NextResponse.json({ error: "No se puede cambiar el NIF: este facturador ya tiene facturas emitidas" }, { status: 400 });
        }

        const { error } = await supabaseAdmin.from("facturacion_emisores")
            .update({ ...parsed.data, nif: nif.normalizado, updated_at: new Date().toISOString() }).eq("id", id);
        if (error?.code === "23505") return NextResponse.json({ error: "Ya hay otro facturador con ese NIF" }, { status: 400 });
        if (error) throw error;
        return NextResponse.json({ ok: true });
    } catch (err: unknown) {
        return NextResponse.json({ error: safeApiError(err, "facturacion/facturadores/put") }, { status: 500 });
    }
}
