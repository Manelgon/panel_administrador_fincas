import { NextResponse } from "next/server";
import { getEmisor } from "@/lib/getEmisor";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Endpoint público — solo devuelve nombre y logo URL para la pantalla de login
export async function GET() {
    const emisor = await getEmisor();

    let logoUrl = "";
    if (emisor.logoPath) {
        const { data } = await supabaseAdmin.storage
            .from("doc-assets")
            .createSignedUrl(emisor.logoPath, 3600);
        logoUrl = data?.signedUrl || "";
    }

    return NextResponse.json({
        nombre: emisor.nombre,
        logoPath: logoUrl,
    });
}
