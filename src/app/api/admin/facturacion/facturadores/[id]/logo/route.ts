import { NextResponse } from "next/server";
import sharp from "sharp";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { safeApiError } from "@/lib/errorMessage";
import { requireAdmin, BUCKET_ASSETS } from "@/lib/facturacion/server";

export const dynamic = "force-dynamic";

async function vinculado(id: string): Promise<boolean> {
    const { data } = await supabaseAdmin.from("facturacion_emisores").select("origen_datos").eq("id", id).maybeSingle();
    return data?.origen_datos === "ajustes_emisor";
}

// POST — subir/reemplazar el logo del facturador (doc-assets/facturadores/{id}/logo.png)
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireAdmin();
        if ("res" in auth) return auth.res;
        const { id } = await ctx.params;
        if (await vinculado(id)) return NextResponse.json({ error: "El logo de este facturador se cambia en Ajustes Emisor" }, { status: 400 });

        const file = (await req.formData()).get("file") as File | null;
        if (!file) return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
            return NextResponse.json({ error: "Solo se permiten imágenes JPG, PNG o WebP" }, { status: 400 });
        }
        if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "La imagen no puede superar 5MB" }, { status: 400 });

        const png = await sharp(Buffer.from(await file.arrayBuffer()))
            .resize({ width: 900, height: 300, fit: "inside", withoutEnlargement: true })
            .png().toBuffer();
        const path = `facturadores/${id}/logo.png`;
        const { error: up } = await supabaseAdmin.storage.from(BUCKET_ASSETS).upload(path, png, { contentType: "image/png", upsert: true });
        if (up) throw up;
        const { error } = await supabaseAdmin.from("facturacion_emisores").update({ logo_path: path, updated_at: new Date().toISOString() }).eq("id", id);
        if (error) throw error;

        const { data: s } = await supabaseAdmin.storage.from(BUCKET_ASSETS).createSignedUrl(path, 3600);
        return NextResponse.json({ ok: true, url: s?.signedUrl ?? "" });
    } catch (err: unknown) {
        return NextResponse.json({ error: safeApiError(err, "facturacion/logo") }, { status: 500 });
    }
}

// DELETE — quitar el logo (las facturas ya emitidas conservan su PDF)
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireAdmin();
        if ("res" in auth) return auth.res;
        const { id } = await ctx.params;
        if (await vinculado(id)) return NextResponse.json({ error: "El logo de este facturador se cambia en Ajustes Emisor" }, { status: 400 });
        const { error } = await supabaseAdmin.from("facturacion_emisores").update({ logo_path: null, updated_at: new Date().toISOString() }).eq("id", id);
        if (error) throw error;
        return NextResponse.json({ ok: true });
    } catch (err: unknown) {
        return NextResponse.json({ error: safeApiError(err, "facturacion/logo/delete") }, { status: 500 });
    }
}
