import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { safeApiError } from "@/lib/errorMessage";
import { requireAdmin, sincronizarAjustesEmisor, BUCKET_ASSETS } from "@/lib/facturacion/server";

export const dynamic = "force-dynamic";

// GET — facturadores con su serie por defecto, el próximo número y la URL del logo
export async function GET() {
    try {
        const auth = await requireAdmin();
        if ("res" in auth) return auth.res;
        const { aviso } = await sincronizarAjustesEmisor();

        const { data: emisores, error } = await supabaseAdmin
            .from("facturacion_emisores").select("*").order("orden").order("razon_social");
        if (error) throw error;

        const { data: series, error: e2 } = await supabaseAdmin
            .from("facturacion_series").select("*").eq("tipo", "normal").eq("por_defecto", true);
        if (e2) throw e2;

        const anio = new Date().getFullYear();
        const out = await Promise.all((emisores ?? []).map(async (e) => {
            const serie = series?.find((s) => s.emisor_id === e.id) ?? null;
            let siguiente: number | null = null;
            if (serie) {
                const { data: c } = await supabaseAdmin.from("facturacion_contadores").select("ultimo")
                    .eq("serie_id", serie.id).eq("anio", serie.reinicio_anual ? anio : 0).maybeSingle();
                siguiente = (c?.ultimo ?? 0) + 1;
            }
            let logo_url: string | null = null;
            if (e.logo_path) {
                const { data: s } = await supabaseAdmin.storage.from(BUCKET_ASSETS).createSignedUrl(e.logo_path, 3600);
                logo_url = s?.signedUrl ?? null;
            }
            return { ...e, serie, siguiente, logo_url, aviso_ajustes: e.origen_datos === "ajustes_emisor" ? aviso : null };
        }));

        return NextResponse.json({ ok: true, facturadores: out, anio });
    } catch (err: unknown) {
        return NextResponse.json({ error: safeApiError(err, "facturacion/facturadores") }, { status: 500 });
    }
}
