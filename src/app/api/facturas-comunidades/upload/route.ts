import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        const path = formData.get("path") as string;

        if (!file || !path) {
            return NextResponse.json({ error: "Archivo y ruta requeridos" }, { status: 400 });
        }

        let processedBuffer: Buffer | Uint8Array = Buffer.from(await file.arrayBuffer());

        // 1. Optimize PDF if applicable
        if (file.type === "application/pdf") {
            try {
                const { PDFDocument } = require("pdf-lib");
                const pdfDoc = await PDFDocument.load(processedBuffer);
                processedBuffer = await pdfDoc.save({ useObjectStreams: true });
                console.log("[Facturas] PDF optimized successfully");
            } catch (pdfError) {
                console.error("[Facturas] Error optimizing PDF, uploading original:", pdfError);
            }
        }

        const filePath = `${path}/${file.name}`;

        console.log("Uploading file to path:", filePath);

        const { error } = await supabaseAdmin.storage
            .from("FACTURAS")
            .upload(filePath, processedBuffer, {
                contentType: file.type,
                upsert: true
            });

        if (error) {
            console.error("Supabase Storage Error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Return internal proxy URL for secure viewing
        const viewUrl = `/api/storage/view?bucket=FACTURAS&path=${encodeURIComponent(filePath)}`;

        return NextResponse.json({
            success: true,
            message: "Archivo subido correctamente",
            url: viewUrl
        });
    } catch (error: any) {
        console.error("Error uploading file:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
