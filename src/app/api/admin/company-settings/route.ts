import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseRouteClient } from "@/lib/supabase/route";
import sharp from "sharp";

export const dynamic = "force-dynamic";

async function isAdmin(userId: string): Promise<boolean> {
    const { data } = await supabaseAdmin
        .from("profiles")
        .select("rol")
        .eq("user_id", userId)
        .maybeSingle();
    return data?.rol === "admin";
}

// GET — leer todos los company_settings
export async function GET(req: Request) {
    try {
        const supabase = await supabaseRouteClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
        if (!(await isAdmin(user.id))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

        const { data, error } = await supabaseAdmin
            .from("company_settings")
            .select("setting_key, setting_value");

        if (error) throw error;

        const settings: Record<string, string> = {};
        for (const row of data || []) {
            settings[row.setting_key] = row.setting_value;
        }

        // Generar URLs firmadas para logo y firma
        // Si no hay path guardado, usar los paths por defecto del bucket
        const urls: Record<string, string> = {};
        const fallbackPaths: Record<string, string> = {
            logo_path: "certificados/logo-retenciones.png",
            firma_path: "",
            header_path: "certificados/logo-retenciones.png",
        };
        for (const key of ["logo_path", "firma_path", "header_path"]) {
            const storagePath = settings[key] || fallbackPaths[key];
            if (storagePath) {
                const { data: signed } = await supabaseAdmin.storage
                    .from("doc-assets")
                    .createSignedUrl(storagePath, 3600);
                urls[key.replace("_path", "_url")] = signed?.signedUrl || "";
            }
        }

        return NextResponse.json({ ok: true, settings, urls });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error desconocido";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

// POST — guardar texto o subir imagen (logo/firma)
export async function POST(req: Request) {
    try {
        const supabase = await supabaseRouteClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
        if (!(await isAdmin(user.id))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

        const contentType = req.headers.get("content-type") || "";

        // --- Subida de imagen (multipart/form-data) ---
        if (contentType.includes("multipart/form-data")) {
            const formData = await req.formData();
            const file = formData.get("file") as File | null;
            const type = formData.get("type") as string | null; // "logo" o "firma"

            if (!file || !type || !["logo", "firma", "header"].includes(type)) {
                return NextResponse.json({ error: "Faltan parámetros: file y type (logo|firma|header)" }, { status: 400 });
            }

            const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
            if (!ALLOWED.includes(file.type)) {
                return NextResponse.json({ error: "Solo se permiten imágenes JPG, PNG o WebP" }, { status: 400 });
            }
            if (file.size > 5 * 1024 * 1024) {
                return NextResponse.json({ error: "La imagen no puede superar 5MB" }, { status: 400 });
            }

            const buffer = Buffer.from(await file.arrayBuffer());
            // Optimizar con sharp — convertir a PNG para transparencia (logos/firmas)
            const optimized = await sharp(buffer)
                .resize({ width: 800, height: 400, fit: "inside", withoutEnlargement: true })
                .png({ quality: 90 })
                .toBuffer();

            const storagePath = `company/${type}.png`;

            const { error: uploadError } = await supabaseAdmin.storage
                .from("doc-assets")
                .upload(storagePath, optimized, {
                    contentType: "image/png",
                    upsert: true,
                });

            if (uploadError) throw uploadError;

            // Guardar path en company_settings
            const settingKey = `${type}_path`;
            const { error: upsertError } = await supabaseAdmin
                .from("company_settings")
                .upsert(
                    { setting_key: settingKey, setting_value: storagePath, updated_at: new Date().toISOString() },
                    { onConflict: "setting_key" }
                );

            if (upsertError) throw upsertError;

            // Generar URL firmada para preview inmediato
            const { data: signed } = await supabaseAdmin.storage
                .from("doc-assets")
                .createSignedUrl(storagePath, 3600);

            return NextResponse.json({ ok: true, path: storagePath, url: signed?.signedUrl || "" });
        }

        // --- Guardar campos de texto (JSON) ---
        const body = await req.json();
        const { emisor_name, emisor_address, emisor_city, emisor_cp, emisor_cif, colegiado_nombre, colegio_ciudad, emisor_iban } = body;

        const updates = [
            { setting_key: "emisor_name", setting_value: String(emisor_name ?? ""), updated_at: new Date().toISOString() },
            { setting_key: "emisor_address", setting_value: String(emisor_address ?? ""), updated_at: new Date().toISOString() },
            { setting_key: "emisor_city", setting_value: String(emisor_city ?? ""), updated_at: new Date().toISOString() },
            { setting_key: "emisor_cp", setting_value: String(emisor_cp ?? ""), updated_at: new Date().toISOString() },
            { setting_key: "emisor_cif", setting_value: String(emisor_cif ?? ""), updated_at: new Date().toISOString() },
            { setting_key: "colegiado_nombre", setting_value: String(colegiado_nombre ?? ""), updated_at: new Date().toISOString() },
            { setting_key: "colegio_ciudad", setting_value: String(colegio_ciudad ?? ""), updated_at: new Date().toISOString() },
            { setting_key: "emisor_iban", setting_value: String(emisor_iban ?? ""), updated_at: new Date().toISOString() },
        ];

        const { error } = await supabaseAdmin
            .from("company_settings")
            .upsert(updates, { onConflict: "setting_key" });

        if (error) throw error;

        return NextResponse.json({ ok: true });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error desconocido";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
