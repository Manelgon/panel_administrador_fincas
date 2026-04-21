import { NextResponse } from "next/server";
import { supabaseRouteClient } from "@/lib/supabase/route";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/logActivity";

export async function POST(req: Request) {
    try {
        const supabase = await supabaseRouteClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

        // Get user profile to check if admin
        const { data: profile } = await supabase
            .from('profiles')
            .select('rol')
            .eq('user_id', user.id)
            .single();

        if (profile?.rol !== 'admin' && profile?.rol !== 'gestor') {
            return NextResponse.json({ error: "No tienes permisos suficientes" }, { status: 403 });
        }

        const { id, email, password } = await req.json();
        if (!id) return NextResponse.json({ error: "ID de informe requerido" }, { status: 400 });
        if (!email || !password) return NextResponse.json({ error: "Credenciales de administrador requeridas" }, { status: 400 });

        // 1. Verify credentials by attempting to sign in (stateless)
        const tempClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const { data: authData, error: authError } = await tempClient.auth.signInWithPassword({
            email,
            password,
        });

        if (authError || !authData.user) {
            return NextResponse.json({ error: 'Credenciales de administrador inválidas' }, { status: 401 });
        }

        // 2. Verify authorization (must be admin)
        const { data: adminProfile } = await supabaseAdmin
            .from('profiles')
            .select('rol')
            .eq('user_id', authData.user.id)
            .single();

        if (adminProfile?.rol !== 'admin') {
            return NextResponse.json({ error: 'No tienes permisos de administrador para realizar esta acción' }, { status: 403 });
        }

        // 1) Fetch report details for logging and file deletion
        const { data: report, error: fetchError } = await supabaseAdmin
            .from('email_reports')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !report) {
            return NextResponse.json({ error: "Informe no encontrado" }, { status: 404 });
        }

        // 2) Delete file from storage (if path exists)
        if (report.pdf_path) {
            const { error: storageError } = await supabaseAdmin.storage
                .from("documentos")
                .remove([report.pdf_path]);

            if (storageError) {
                console.error("Storage delete error:", storageError);
                return NextResponse.json({ error: `No se pudo eliminar el archivo PDF del almacenamiento: ${storageError.message}` }, { status: 500 });
            }
        }

        // 3) Delete record from database
        const { error: dbError } = await supabaseAdmin
            .from('email_reports')
            .delete()
            .eq('id', id);

        if (dbError) throw dbError;

        // 4) Log activity
        await logActivity({
            action: 'delete',
            entityType: 'informe_email',
            entityName: report.title,
            details: {
                comunidad: report.community_name,
                pdf_path: report.pdf_path,
                deleted_by: email
            },
            supabaseClient: supabase
        });

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("Delete report error:", error);
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
}
