import { NextResponse } from "next/server";
import { supabaseRouteClient } from "@/lib/supabase/route";
import { generateFichajePdf } from "@/lib/pdf/fichajeResume";

/**
 * GET /api/fichaje/export/pdf?user_id=X&month=YYYY-MM
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('user_id');
    const month = searchParams.get('month');

    if (!month) return NextResponse.json({ error: "Month is required" }, { status: 400 });

    const supabase = await supabaseRouteClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Role check
    const { data: profile } = await supabase.from('profiles').select('rol').eq('user_id', user.id).single();
    const targetUserId = (profile?.rol === 'admin' && userId) ? userId : user.id;

    // Fetch User Info
    const { data: targetProfile } = await supabase.from('profiles').select('nombre, apellido').eq('user_id', targetUserId).single();
    const userName = targetProfile ? `${targetProfile.nombre} ${targetProfile.apellido || ''}`.trim() : 'Usuario';

    // Fetch Monthly Data
    const startOfMonth = `${month}-01`;
    const nextMonth = getNextMonth(month);

    const { data: entries, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('user_id', targetUserId)
        .gte('start_at', `${startOfMonth}T00:00:00`)
        .lt('start_at', `${nextMonth}T00:00:00`)
        .order('start_at', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    try {
        // --- PDF GENERATION (Shared Lib) ---
        const pdfBytes = await generateFichajePdf({
            month,
            userName,
            entries: entries || []
        });

        // Filename: 01-MM-YYYY_NombreApellido.pdf
        const [yFn, mFn] = month.split('-');
        const dateFn = `01-${mFn}-${yFn}`;
        const rawName = targetProfile ? `${targetProfile.nombre}${targetProfile.apellido || ''}` : 'Usuario';
        // Remove spaces and accents
        const safeName = rawName.replace(/\s+/g, '').normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        return new NextResponse(Buffer.from(pdfBytes), {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${dateFn}_${safeName}.pdf"`,
            },
        });

    } catch (err: any) {
        console.error("PDF Gen Error:", err);
        return NextResponse.json({ error: "Error generando PDF: " + err.message }, { status: 500 });
    }
}

function getNextMonth(yyyyMM: string) {
    const [year, month] = yyyyMM.split('-').map(Number);
    const date = new Date(year, month, 1);
    const nextY = date.getFullYear();
    const nextM = String(date.getMonth() + 1).padStart(2, '0');
    return `${nextY}-${nextM}-01`;
}
