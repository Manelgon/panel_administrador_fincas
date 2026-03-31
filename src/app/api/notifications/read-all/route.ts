import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { logActivity } from "@/lib/logActivity";

export async function POST() {
    const supabase = await supabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });

    const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

    if (!error) {
        await logActivity({
            action: 'read',
            entityType: 'aviso',
            entityName: 'Todos los avisos',
            details: { method: 'read-all' },
            supabaseClient: supabase
        });
    }

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
}
