import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const filePath = url.searchParams.get("path");

        if (!filePath) {
            return NextResponse.json({ error: "Falta path" }, { status: 400 });
        }

        console.log("Proxying PDF preview for:", filePath);

        // Download file from Supabase using admin client
        const { data, error } = await supabaseAdmin.storage
            .from("FACTURAS")
            .download(filePath);

        if (error) {
            console.error("Supabase download error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (!data) {
            return NextResponse.json({ error: "Archivo vacío" }, { status: 404 });
        }

        // Return the file with proper PDF headers
        return new NextResponse(data, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": "inline",
            },
        });
    } catch (error) {
        console.error("Error in PDF view proxy:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Error interno" },
            { status: 500 }
        );
    }
}
