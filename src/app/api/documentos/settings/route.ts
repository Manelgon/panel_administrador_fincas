import { NextResponse } from "next/server";
import { supabaseRouteClient } from "@/lib/supabase/route";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const supabase = await supabaseRouteClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const docKey = searchParams.get('doc_key') || 'suplidos';

        const { data, error } = await supabase
            .from("document_settings")
            .select("setting_key, setting_value")
            .eq("doc_key", docKey);

        if (error) {
            console.error("Error fetching settings:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Devolver valores tal cual (son text en BD). El frontend se encarga de parsear si necesita number.
        const settings: Record<string, any> = {};
        for (const row of data || []) {
            settings[row.setting_key] = row.setting_value;
        }

        return NextResponse.json({ ok: true, settings });

    } catch (err: any) {
        return NextResponse.json({ error: "Error interno: " + err.message }, { status: 500 });
    }
}
