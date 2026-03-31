import { NextResponse } from "next/server";
import { supabaseRouteClient } from "@/lib/supabase/route";
import { generateFichajePdf } from "@/lib/pdf/fichajeResume";

export async function POST(req: Request) {
    const supabase = await supabaseRouteClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const { userId, month, toEmail } = body || {};

    if (!month || !toEmail) {
        return NextResponse.json(
            { error: "Faltan datos (mes o email)" },
            { status: 400 }
        );
    }

    try {
        // 1. Resolve User and Profile
        const targetUserId = userId || user.id;

        const { data: targetProfile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', targetUserId)
            .single();

        if (profileError || !targetProfile) {
            return NextResponse.json({ error: "Perfil no encontrado" }, { status: 404 });
        }

        const userName = `${targetProfile.nombre} ${targetProfile.apellido || ''}`.trim();

        // 2. Fetch Monthly Data
        const startOfMonth = `${month}-01`;
        const nextMonth = getNextMonth(month);

        const { data: entries, error: entriesError } = await supabase
            .from('time_entries')
            .select('*')
            .eq('user_id', targetUserId)
            .gte('start_at', `${startOfMonth}T00:00:00`)
            .lt('start_at', `${nextMonth}T00:00:00`)
            .order('start_at', { ascending: true });

        if (entriesError) throw entriesError;

        // 3. Generate PDF
        const pdfBytes = await generateFichajePdf({
            month,
            userName,
            entries: entries || []
        });

        // 4. Filename
        const [yFn, mFn] = month.split('-');
        const dateFn = `01-${mFn}-${yFn}`;
        const rawName = userName;
        const safeName = rawName.replace(/\s+/g, '').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const filename = `${dateFn}_${safeName}.pdf`;

        // 5. Send to Webhook
        const webhookUrl = process.env.EMAIL_WEBHOOK_URL;
        if (webhookUrl) {
            const formData = new FormData();
            formData.append("to_email", toEmail);
            formData.append("type", "fichaje-resumen");
            formData.append("filename", filename);

            // Create Blob from buffer
            const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
            formData.append("file", blob, filename);

            // Add Profile data
            // Exclude user_id
            const { user_id, ...profileData } = targetProfile;
            formData.append("user_profile", JSON.stringify(profileData));
            formData.append("month", month);
            formData.append("route", "fichaje");

            const webhookRes = await fetch(webhookUrl, {
                method: "POST",
                body: formData,
            });

            if (!webhookRes.ok) {
                console.error("Webhook error status:", webhookRes.status);
                // We might still consider it success for the UI if the generation worked, 
                // but let's report error if webhook fails.
                return NextResponse.json({ error: "Error enviando al webhook" }, { status: 502 });
            }
        } else {
            return NextResponse.json({ error: "Webhook no configurado en servidor" }, { status: 500 });
        }

        return NextResponse.json({ ok: true });

    } catch (e: any) {
        console.error("Send Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

function getNextMonth(yyyyMM: string) {
    const [year, month] = yyyyMM.split('-').map(Number);
    const date = new Date(year, month, 1);
    const nextY = date.getFullYear();
    const nextM = String(date.getMonth() + 1).padStart(2, '0');
    return `${nextY}-${nextM}-01`;
}
