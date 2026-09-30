import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { safeApiError } from "@/lib/errorMessage";
import { requireAdmin, BUCKET_PDF } from "@/lib/facturacion/server";

export const dynamic = "force-dynamic";

// GET — URL firmada (60 s) del PDF emitido
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireAdmin();
        if ("res" in auth) return auth.res;
        const { id } = await ctx.params;
        const { data: f, error } = await supabaseAdmin.from("facturas").select("pdf_url").eq("id", id).maybeSingle();
        if (error) throw error;
        if (!f?.pdf_url) return NextResponse.json({ error: "Esta factura aún no tiene PDF. Pulsa \"Completar\"." }, { status: 404 });
        const { data: s, error: e2 } = await supabaseAdmin.storage.from(BUCKET_PDF).createSignedUrl(f.pdf_url, 60);
        if (e2) throw e2;
        return NextResponse.json({ ok: true, url: s.signedUrl });
    } catch (err: unknown) {
        return NextResponse.json({ error: safeApiError(err, "facturacion/factura/pdf") }, { status: 500 });
    }
}
