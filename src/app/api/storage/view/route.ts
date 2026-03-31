
import { NextResponse } from "next/server";
import { supabaseRouteClient } from "@/lib/supabase/route";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Proxy route to view private storage files.
 * Example: /api/storage/view?bucket=documentos&path=incidencias/1131/file.pdf
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

        if (!bucket || !path) {
            return NextResponse.json({ error: "Bucket and path are required" }, { status: 400 });
        }

        // Generate a 1-minute signed URL
        const { data, error } = await supabaseAdmin.storage
            .from(bucket)
            .createSignedUrl(path, 60);

        if (error || !data?.signedUrl) {
            console.error("[Storage Proxy] Error:", error);
            return NextResponse.json({ error: "No se pudo generar el acceso al archivo" }, { status: 500 });
        }

        // Redirect to the signed URL
        return NextResponse.redirect(data.signedUrl);

    } catch (error: any) {
        console.error("[Storage Proxy] Internal Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
