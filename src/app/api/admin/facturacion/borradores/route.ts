import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { safeApiError } from "@/lib/errorMessage";
import { requireAdmin } from "@/lib/facturacion/server";
import { borradorSchema, primerError } from "@/lib/facturacion/schemas";

export const dynamic = "force-dynamic";

// POST — crear borrador
export async function POST(req: Request) {
    try {
        const auth = await requireAdmin();
        if ("res" in auth) return auth.res;
        const parsed = borradorSchema.safeParse(await req.json());
        if (!parsed.success) return NextResponse.json({ error: primerError(parsed.error) }, { status: 400 });
        const { data, error } = await supabaseAdmin.from("factura_borradores")
            .insert({ ...parsed.data, created_by: auth.userId }).select("id").single();
        if (error) throw error;
        return NextResponse.json({ ok: true, id: data.id });
    } catch (err: unknown) {
        return NextResponse.json({ error: safeApiError(err, "facturacion/borradores/post") }, { status: 500 });
    }
}
