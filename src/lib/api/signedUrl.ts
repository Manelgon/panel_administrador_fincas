import { NextResponse } from "next/server";
import { supabaseRouteClient } from "@/lib/supabase/route";

/**
 * Factory de route handlers GET que generan una URL firmada de descarga para
 * un documento de la tabla `doc_submissions`.
 *
 * Uso:
 *   export const GET = createDocSubmissionSignedUrlRoute();
 *   export const GET = createDocSubmissionSignedUrlRoute({ allowDocx: true });
 *
 * @param opts.bucket   bucket de storage (por defecto "documentos_administrativos")
 * @param opts.allowDocx si true, admite ?format=docx y usa payload.docx_path
 */
export function createDocSubmissionSignedUrlRoute(opts: { bucket?: string; allowDocx?: boolean } = {}) {
    const BUCKET = opts.bucket ?? "documentos_administrativos";

    return async function GET(req: Request) {
        const supabase = await supabaseRouteClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "No autenticado" }, { status: 401 });
        }

        const url = new URL(req.url);
        const id = url.searchParams.get("id");
        const format = opts.allowDocx
            ? (url.searchParams.get("format") || "pdf").toLowerCase()
            : "pdf";

        if (!id) {
            return NextResponse.json({ error: "Falta id" }, { status: 400 });
        }

        try {
            const sub = await supabase
                .from("doc_submissions")
                .select("pdf_path, payload")
                .eq("id", Number(id))
                .single();

            if (sub.error || !sub.data) {
                return NextResponse.json({ error: "No encontrado" }, { status: 404 });
            }

            let path: string;
            if (format === "docx") {
                path = sub.data.payload?.docx_path || "";
                if (!path) {
                    return NextResponse.json({ error: "Este documento no tiene DOCX asociado" }, { status: 404 });
                }
            } else {
                path = sub.data.pdf_path;
            }

            const filename = path.split("/").pop() || `documento.${format}`;
            const signed = await supabase.storage
                .from(BUCKET)
                .createSignedUrl(path, 60 * 10, { download: filename }); // 10 minutos

            if (signed.error) {
                return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
            }

            return NextResponse.json({ url: signed.data.signedUrl, pdfPath: path });
        } catch (error: any) {
            console.error("Error getting signed URL:", error);
            return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
        }
    };
}
