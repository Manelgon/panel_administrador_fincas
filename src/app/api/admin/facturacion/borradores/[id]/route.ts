import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { safeApiError } from "@/lib/errorMessage";
import { requireAdmin } from "@/lib/facturacion/server";
import { borradorSchema, primerError } from "@/lib/facturacion/schemas";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
    try {
        const auth = await requireAdmin();
        if ("res" in auth) return auth.res;
        const { id } = await ctx.params;
        const { data, error } = await supabaseAdmin.from("factura_borradores").select("*").eq("id", id).maybeSingle();
        if (error) throw error;
        if (!data) return NextResponse.json({ error: "El borrador no existe" }, { status: 404 });
        return NextResponse.json({ ok: true, borrador: data });
    } catch (err: unknown) {
        return NextResponse.json({ error: safeApiError(err, "facturacion/borrador/get") }, { status: 500 });
    }
}

export async function PUT(req: Request, ctx: Ctx) {
    try {
        const auth = await requireAdmin();
        if ("res" in auth) return auth.res;
        const { id } = await ctx.params;
        const parsed = borradorSchema.safeParse(await req.json());
        if (!parsed.success) return NextResponse.json({ error: primerError(parsed.error) }, { status: 400 });
        const { error } = await supabaseAdmin.from("factura_borradores")
            .update({ ...parsed.data, updated_at: new Date().toISOString() }).eq("id", id);
        if (error) throw error;
        return NextResponse.json({ ok: true });
    } catch (err: unknown) {
        return NextResponse.json({ error: safeApiError(err, "facturacion/borrador/put") }, { status: 500 });
    }
}

export async function DELETE(_req: Request, ctx: Ctx) {
    try {
        const auth = await requireAdmin();
        if ("res" in auth) return auth.res;
        const { id } = await ctx.params;
        const { error } = await supabaseAdmin.from("factura_borradores").delete().eq("id", id);
        if (error) throw error;
        return NextResponse.json({ ok: true });
    } catch (err: unknown) {
        return NextResponse.json({ error: safeApiError(err, "facturacion/borrador/delete") }, { status: 500 });
    }
}
