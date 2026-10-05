import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { safeApiError } from "@/lib/errorMessage";
import { requireAdmin, errorDeRegla } from "@/lib/facturacion/server";
import { numeracionSchema, primerError } from "@/lib/facturacion/schemas";

export const dynamic = "force-dynamic";

// PUT — formato de número de la serie por defecto y, opcionalmente, desde qué número continúa
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireAdmin();
        if ("res" in auth) return auth.res;
        const { id } = await ctx.params;

        const parsed = numeracionSchema.safeParse(await req.json());
        if (!parsed.success) return NextResponse.json({ error: primerError(parsed.error) }, { status: 400 });
        const { siguiente, ...formato } = parsed.data;

        const { data: serie } = await supabaseAdmin.from("facturacion_series").select("id")
            .eq("emisor_id", id).eq("tipo", "normal").eq("por_defecto", true).maybeSingle();

        let serieId: number;
        if (serie) {
            const { count } = await supabaseAdmin.from("facturas").select("id", { count: "exact", head: true }).eq("serie_id", serie.id);
            if ((count ?? 0) > 0) {
                const { data: act } = await supabaseAdmin.from("facturacion_series").select("*").eq("id", serie.id).single();
                const cambia = (Object.keys(formato) as (keyof typeof formato)[]).some((k) => act?.[k] !== formato[k]);
                if (cambia) {
                    return NextResponse.json({ error: "Esta serie ya tiene facturas emitidas: el formato no se puede cambiar. Solo el número siguiente." }, { status: 400 });
                }
            } else {
                const { error } = await supabaseAdmin.from("facturacion_series").update(formato).eq("id", serie.id);
                if (error?.code === "23505") return NextResponse.json({ error: "Este facturador ya tiene otra serie con ese prefijo" }, { status: 400 });
                if (error) throw error;
            }
            serieId = serie.id;
        } else {
            const { data: nueva, error } = await supabaseAdmin.from("facturacion_series")
                .insert({ ...formato, emisor_id: id, tipo: "normal", por_defecto: true }).select("id").single();
            if (error?.code === "23505") return NextResponse.json({ error: "Este facturador ya tiene otra serie con ese prefijo" }, { status: 400 });
            if (error) throw error;
            serieId = nueva.id;
        }

        if (siguiente) {
            const { error } = await supabaseAdmin.rpc("facturacion_fijar_siguiente", {
                p_serie_id: serieId, p_anio: new Date().getFullYear(), p_siguiente: siguiente,
            });
            if (error) {
                const regla = errorDeRegla(error);
                if (regla) return NextResponse.json({ error: regla }, { status: 400 });
                throw error;
            }
        }
        return NextResponse.json({ ok: true });
    } catch (err: unknown) {
        return NextResponse.json({ error: safeApiError(err, "facturacion/numeracion") }, { status: 500 });
    }
}
