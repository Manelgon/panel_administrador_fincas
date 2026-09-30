import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { safeApiError } from "@/lib/errorMessage";
import { requireAdmin, normalizarNif } from "@/lib/facturacion/server";
import { clienteSchema, primerError } from "@/lib/facturacion/schemas";

export const dynamic = "force-dynamic";

// PUT — editar (las facturas emitidas guardan su propia copia de los datos)
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireAdmin();
        if ("res" in auth) return auth.res;
        const { id } = await ctx.params;
        const parsed = clienteSchema.safeParse(await req.json());
        if (!parsed.success) return NextResponse.json({ error: primerError(parsed.error) }, { status: 400 });
        const nif = normalizarNif(parsed.data.nif);
        if ("error" in nif) return NextResponse.json({ error: nif.error }, { status: 400 });

        const { error } = await supabaseAdmin.from("clientes_facturacion")
            .update({ ...parsed.data, nif: nif.nif, updated_at: new Date().toISOString() }).eq("id", id);
        if (error) throw error;
        return NextResponse.json({ ok: true });
    } catch (err: unknown) {
        return NextResponse.json({ error: safeApiError(err, "facturacion/clientes/put") }, { status: 500 });
    }
}

// DELETE — lo quita de la agenda (baja lógica)
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireAdmin();
        if ("res" in auth) return auth.res;
        const { id } = await ctx.params;
        const { error } = await supabaseAdmin.from("clientes_facturacion")
            .update({ activo: false, updated_at: new Date().toISOString() }).eq("id", id);
        if (error) throw error;
        return NextResponse.json({ ok: true });
    } catch (err: unknown) {
        return NextResponse.json({ error: safeApiError(err, "facturacion/clientes/delete") }, { status: 500 });
    }
}
