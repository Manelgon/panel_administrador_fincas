
import { NextResponse } from "next/server";
import { supabaseRouteClient } from "@/lib/supabase/route";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Proxy route to view private storage files.
 * Example: /api/storage/view?bucket=documentos&path=incidencias/1131/file.pdf
 *
 * Con `&download=Contrato.pdf` el archivo se sirve como descarga con ese
 * nombre en vez de abrirse en el navegador (los objetos se guardan con un
 * UUID, así que sin esto la descarga saldría con un nombre ilegible).
 */
export async function GET(req: Request) {
    try {
        const supabase = await supabaseRouteClient();
        const { data: { user } } = await supabase.auth.getUser();

        // Ensure user is authenticated to view any document
        if (!user) {
            return NextResponse.json({ error: "No autenticado" }, { status: 401 });
        }

        const url = new URL(req.url);
        const bucket = url.searchParams.get("bucket");
        const path = url.searchParams.get("path");
        const download = url.searchParams.get("download");

        if (!bucket || !path) {
            return NextResponse.json({ error: "Bucket and path are required" }, { status: 400 });
        }

        // Generate a 1-minute signed URL
        const { data, error } = await supabaseAdmin.storage
            .from(bucket)
            .createSignedUrl(path, 60, download ? { download } : undefined);

        if (error || !data?.signedUrl) {
            console.error("[Storage Proxy] Error:", error);
            return NextResponse.json({ error: "No se pudo generar el acceso al archivo" }, { status: 500 });
        }

        // Redirect to the signed URL
        return NextResponse.redirect(data.signedUrl);

    } catch (error: any) {
        console.error("[Storage Proxy] Internal Error:", error);
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
}
