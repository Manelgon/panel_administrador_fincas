import { NextResponse } from "next/server";
import { supabaseRouteClient } from "@/lib/supabase/route";

/**
 * GET /api/documentos/suplidos/signed-url?id={submissionId}
 * Generate signed URL and redirect to PDF
 */
export async function GET(req: Request) {
    const supabase = await supabaseRouteClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) {
        return NextResponse.json({ error: "Falta id" }, { status: 400 });
    }

    try {
        const sub = await supabase
            .from("doc_submissions")
            .select("pdf_path")
            .eq("id", Number(id))
            .single();

        if (sub.error || !sub.data) {
            return NextResponse.json({ error: "No encontrado" }, { status: 404 });
        }

        const filename = sub.data.pdf_path.split("/").pop() || "documento.pdf";
        const signed = await supabase.storage
            .from("documentos_administrativos")
            .createSignedUrl(sub.data.pdf_path, 60 * 10, { download: filename }); // 10 minutes

        if (signed.error) {
            return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
        }

        return NextResponse.json({ url: signed.data.signedUrl, pdfPath: sub.data.pdf_path });
    } catch (error: any) {
        console.error("Error getting signed URL:", error);
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
}
