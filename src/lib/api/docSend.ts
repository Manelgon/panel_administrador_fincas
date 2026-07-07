import { NextResponse } from "next/server";
import { supabaseRouteClient } from "@/lib/supabase/route";

/**
 * Factory de route handlers POST que envían un documento de `doc_submissions`
 * por email a través del webhook de n8n (EMAIL_WEBHOOK_URL).
 *
 * Uso:
 *   export const POST = createDocSendRoute({ type: "suplidos", defaultFilename: "suplidos.pdf" });
 *
 * Body esperado: { submissionId: number, toEmail: string }
 *
 * NOTA: conserva el comportamiento actual, incluido que la llamada al webhook
 * es fire-and-forget (`.catch`) y la respuesta es `ok:true` aunque el envío
 * falle. La migración a envío fiable (Resend) está en el Bloque 2 del plan.
 */
export function createDocSendRoute(opts: { type: string; defaultFilename: string; bucket?: string }) {
    const BUCKET = opts.bucket ?? "documentos_administrativos";

    return async function POST(req: Request) {
        const supabase = await supabaseRouteClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "No autenticado" }, { status: 401 });
        }

        const body = await req.json().catch(() => null);
        if (!body?.submissionId || !body?.toEmail) {
            return NextResponse.json(
                { error: "Faltan datos (submissionId, toEmail)" },
                { status: 400 }
            );
        }

        try {
            const sub = await supabase
                .from("doc_submissions")
                .select("id, title, pdf_path, payload")
                .eq("id", body.submissionId)
                .single();

            if (sub.error || !sub.data) {
                return NextResponse.json({ error: "No existe ese envío" }, { status: 404 });
            }

            const webhookUrl = process.env.EMAIL_WEBHOOK_URL;
            if (webhookUrl) {
                try {
                    const formData = new FormData();

                    const { data: fileBlob, error: downloadError } = await supabase.storage
                        .from(BUCKET)
                        .download(sub.data.pdf_path);

                    if (downloadError) {
                        console.error("Error downloading file for webhook:", downloadError);
                        formData.append("file_download_error", downloadError.message);
                    }

                    formData.append("to_email", body.toEmail);
                    formData.append("document_id", sub.data.id.toString());
                    formData.append("type", opts.type);
                    formData.append("route", "documentos");
                    const filename = sub.data.pdf_path.split("/").pop() || opts.defaultFilename;
                    formData.append("filename", filename);

                    if (fileBlob) {
                        formData.append("file", fileBlob, filename);
                        formData.append("file_size_bytes", fileBlob.size.toString());
                    } else {
                        formData.append("file_missing", "true");
                    }

                    formData.append("data", JSON.stringify(sub.data.payload));

                    await fetch(webhookUrl, {
                        method: "POST",
                        headers: {
                            Envio_documentacion_Panel_serincosol: process.env.N8N_WEBHOOK_SECRET || "",
                        },
                        body: formData,
                    }).catch((err) => console.error("Webhook trigger failed:", err));
                } catch (webhookError) {
                    console.error("Error preparing webhook payload:", webhookError);
                }
            } else {
                console.warn("EMAIL_WEBHOOK_URL not configured. No action taken.");
            }

            return NextResponse.json({ ok: true });
        } catch (error: any) {
            console.error("Error processing request:", error);
            return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
        }
    };
}
