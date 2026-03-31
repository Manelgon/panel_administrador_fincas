import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: Request) {
    try {
        const { fromPath, toPath } = await req.json();

        if (!fromPath || !toPath) {
            return NextResponse.json({ error: "Rutas de origen y destino requeridas" }, { status: 400 });
        }

        console.log(`Moving file from ${fromPath} to ${toPath}`);

        const { data, error } = await supabaseAdmin.storage
            .from("FACTURAS")
            .move(fromPath, toPath);

        if (error) {
            console.error("Supabase Storage Error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: "Archivo movido correctamente" });
    } catch (error: any) {
        console.error("Error moving file:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
