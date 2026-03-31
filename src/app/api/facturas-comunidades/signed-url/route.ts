import { NextResponse } from "next/server";
import { supabaseRouteClient } from "@/lib/supabase/route";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: Request) {
    try {
        const supabase = await supabaseRouteClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "No autenticado" }, { status: 401 });
        }

        const url = new URL(req.url);
        const filePath = url.searchParams.get("path");
        const download = url.searchParams.get("download") === "true";

        if (!filePath) {
            return NextResponse.json({ error: "Falta path" }, { status: 400 });
        }

        const fileName = filePath.split('/').pop() || 'archivo.pdf';

        console.log("Generating signed URL for bucket 'FACTURAS':", { filePath, download, fileName });

        const { data, error } = await supabaseAdmin.storage
            .from("FACTURAS")
            .createSignedUrl(filePath, 60 * 15, {
                download: download ? fileName : false
            });

        if (error) {
            console.error("Supabase createSignedUrl Error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        console.log("Signed URL generated successfully:", data?.signedUrl);

        if (!data?.signedUrl) {
            return NextResponse.json({ error: "No se pudo generar la URL firmada" }, { status: 500 });
        }

        return NextResponse.json({ url: data.signedUrl });
    } catch (error) {
        console.error("Error generating signed URL:", error);
        return NextResponse.json({ error: error instanceof Error ? error.message : "Error interno" }, { status: 500 });
    }
}
