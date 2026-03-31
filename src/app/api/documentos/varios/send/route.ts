import { NextResponse } from "next/server";
import { supabaseRouteClient } from "@/lib/supabase/route";

/**
 * POST /api/documentos/varios/send
 * Trigger A SINGLE Webhook containing BOTH Invoice and Certificate data/files.
 * Body: { submissionIdFactura: number, submissionIdCertificado: number, toEmail: string }
 */
export async function POST(req: Request) {
    const supabase = await supabaseRouteClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const { submissionIdFactura, submissionIdCertificado, toEmail } = body || {};

    if ((!submissionIdFactura && !submissionIdCertificado) || !toEmail) {
        return NextResponse.json(
            { error: "Faltan datos (IDs de envíos o email)" },
            { status: 400 }
        );
    }

    try {
        // Fetch submissions
        let subFactura = null;
        let subCertificado = null;

        if (submissionIdFactura) {
            const { data, error } = await supabase
                .from("doc_submissions")
                .select("*")
                .eq("id", submissionIdFactura)
                .single();
            if (!error) subFactura = data;
        }

        if (submissionIdCertificado) {
            const { data, error } = await supabase
                .from("doc_submissions")
                .select("*")
                .eq("id", submissionIdCertificado)
                .single();
            if (!error) subCertificado = data;
        }

        // --- Webhook Trigger (Single Request) ---
        const webhookUrl = process.env.EMAIL_WEBHOOK_URL;
        if (webhookUrl) {
            try {
                const formData = new FormData();
                formData.append("to_email", toEmail);
                formData.append("type", "varios-pack"); // Indicates it contains multiple files
                formData.append("route", "documentos");

                // --- Process Factura ---
                if (subFactura) {
                    formData.append("document_id_factura", subFactura.id.toString());
                    formData.append("data_factura", JSON.stringify(subFactura.payload));

                    const filename = subFactura.pdf_path.split('/').pop() || "factura.pdf";
                    formData.append("filename_factura", filename);

                    // Download
                    const { data: fileBlob, error: downloadError } = await supabase.storage
                        .from("documentos_administrativos")
                        .download(subFactura.pdf_path);

                    if (downloadError) {
                        console.error("Error downloading factura:", downloadError);
                        formData.append("error_factura", downloadError.message);
                    } else if (fileBlob) {
                        formData.append("file_factura", fileBlob, filename);
                        formData.append("size_factura", fileBlob.size.toString());
                    }
                }

                // --- Process Certificado ---
                if (subCertificado) {
                    formData.append("document_id_certificado", subCertificado.id.toString());
                    formData.append("data_certificado", JSON.stringify(subCertificado.payload));

                    const filename = subCertificado.pdf_path.split('/').pop() || "certificado.pdf";
                    formData.append("filename_certificado", filename);

                    // Download
                    const { data: fileBlob, error: downloadError } = await supabase.storage
                        .from("documentos_administrativos")
                        .download(subCertificado.pdf_path);

                    if (downloadError) {
                        console.error("Error downloading certificado:", downloadError);
                        formData.append("error_certificado", downloadError.message);
                    } else if (fileBlob) {
                        formData.append("file_certificado", fileBlob, filename);
                        formData.append("size_certificado", fileBlob.size.toString());
                    }
                }

                // Send unified payload
                await fetch(webhookUrl, {
                    method: "POST",
                    body: formData,
                }).catch(err => console.error("Webhook trigger failed:", err));

            } catch (err) {
                console.error("Error preparing combined webhook:", err);
            }
        } else {
            console.warn("EMAIL_WEBHOOK_URL not configured. No action taken.");
        }

        return NextResponse.json({ ok: true });

    } catch (err: any) {
        console.error("Error processing request:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
