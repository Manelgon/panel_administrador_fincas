import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: Request) {
    try {
        const { path, folderName } = await req.json();

        if (!path || !folderName) {
            return NextResponse.json({ error: "Ruta y nombre de carpeta requeridos" }, { status: 400 });
        }

        // To create a "folder" in Supabase storage, we upload a placeholder file
        const folderPath = `${path}/${folderName}/.emptyFolderPlaceholder`;

        console.log("Creating folder at path:", folderPath);

        const { error } = await supabaseAdmin.storage
            .from("FACTURAS")
            .upload(folderPath, new Uint8Array(0), {
                upsert: true,
                contentType: 'text/plain'
            });

        if (error) {
            console.error("Supabase Storage Error:", error);
            // If it already exists, we might want to just succeed or inform
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: "Carpeta Budget creada correctamente" });
    } catch (error: any) {
        console.error("Error creating folder:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
