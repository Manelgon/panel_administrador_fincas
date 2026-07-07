import { rgb } from "pdf-lib";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Dimensiones de página A4 en puntos. */
export const A4 = { w: 595.28, h: 841.89 };

/** Colores comunes de los documentos. */
export const YELLOW = rgb(0.98, 0.84, 0.4);
export const BORDER = rgb(0.82, 0.82, 0.82);
export const BLACK = rgb(0, 0, 0);

/**
 * Descarga un asset del bucket `doc-assets` con el cliente admin (bypass RLS).
 * Intenta la ruta dada y, si falla, reintenta en la raíz del bucket.
 * Devuelve `null` si no se encuentra (registrando un aviso).
 */
export async function downloadAsset(filePath: string): Promise<Buffer | null> {
    let { data, error } = await supabaseAdmin.storage
        .from("doc-assets")
        .download(filePath);

    if (error && filePath.includes("/")) {
        const rootPath = filePath.split("/").pop()!;
        const retry = await supabaseAdmin.storage
            .from("doc-assets")
            .download(rootPath);
        if (!retry.error) {
            data = retry.data;
            error = null;
        }
    }

    if (error || !data) {
        console.warn(`Asset ${filePath} not found:`, error?.message);
        return null;
    }

    const ab = await data.arrayBuffer();
    return Buffer.from(ab);
}

/**
 * Igual que `downloadAsset`, pero devuelve `Uint8Array` y lanza si no existe.
 * Para rutas que asumen que el asset siempre está presente.
 */
export async function downloadAssetOrThrow(filePath: string): Promise<Uint8Array> {
    const buf = await downloadAsset(filePath);
    if (!buf) throw new Error(`Error downloading asset ${filePath}`);
    return new Uint8Array(buf);
}
