import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/api/requireAuth";

export async function POST(req: Request) {
    try {
        const auth = await requireAuth();
        if (!auth.success) return auth.response;

        const { bucket, path } = await req.json();

        if (!bucket || !path) {
            return NextResponse.json({ error: "Bucket and path are required" }, { status: 400 });
        }

        // --- SECURITY VALIDATION ---
        // Basic check to ensure we are deleting from allowed prefixes if needed
        // For now, mirroring the upload logic's bucket flexibility but with careful admin usage.

        const { data, error } = await supabaseAdmin.storage
            .from(bucket)
            .remove([path]);

        if (error) {
            console.error("[Storage Delete] Error:", error);
            return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: "File deleted successfully",
            data
        });

    } catch (error: any) {
        console.error("[Storage Delete] API Error:", error);
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
}
