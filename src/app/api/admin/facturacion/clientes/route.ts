import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { safeApiError } from "@/lib/errorMessage";
import { requireAdmin, normalizarNif } from "@/lib/facturacion/server";
import { clienteSchema, primerError } from "@/lib/facturacion/schemas";

export const dynamic = "force-dynamic";

// GET — agenda de clientes activos
export async function GET() {
    try {
        const auth = await requireAdmin();
        if ("res" in auth) return auth.res;
        const { data, error } = await supabaseAdmin.from("clientes_facturacion")
            .select("*").eq("activo", true).order("nombre");
        if (error) throw error;
        return NextResponse.json({ ok: true, clientes: data });
    } catch (err: unknown) {
        return NextResponse.json({ error: safeApiError(err, "facturacion/clientes") }, { status: 500 });
    }
}

// POST — alta manual
export async function POST(req: Request) {
    try {
        const auth = await requireAdmin();
        if ("res" in auth) return auth.res;
        const parsed = clienteSchema.safeParse(await req.json());
        if (!parsed.success) return NextResponse.json({ error: primerError(parsed.error) }, { status: 400 });
        const nif = normalizarNif(parsed.data.nif);
        if ("error" in nif) return NextResponse.json({ error: nif.error }, { status: 400 });

        const { data, error } = await supabaseAdmin.from("clientes_facturacion")
            .insert({ ...parsed.data, nif: nif.nif, origen: "manual" }).select("*").single();
        if (error) throw error;
        return NextResponse.json({ ok: true, cliente: data });
    } catch (err: unknown) {
        return NextResponse.json({ error: safeApiError(err, "facturacion/clientes/post") }, { status: 500 });
    }
}
