import { NextResponse } from "next/server";
import { supabaseRouteClient } from "@/lib/supabase/route";

const BUCKET = "documentos_administrativos";

export async function GET(req: Request) {
    const supabase = await supabaseRouteClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const format = (url.searchParams.get("format") || "pdf").toLowerCase();

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
            if (!path) return NextResponse.json({ error: "Este documento no tiene DOCX asociado" }, { status: 404 });
        } else {
            path = sub.data.pdf_path;
        }

        const filename = path.split("/").pop() || `documento.${format}`;
        const signed = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 10, { download: filename });

        if (signed.error) {
            return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
        }

        return NextResponse.json({ url: signed.data.signedUrl, pdfPath: path });
    } catch (err: any) {
        console.error("Error getting signed URL:", err);
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
}
