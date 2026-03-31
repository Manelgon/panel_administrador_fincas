import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import crypto from "crypto";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp"
];

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        const path = formData.get("path") as string;
        const bucket = (formData.get("bucket") as string) || "documentos";

        if (!file || !path) {
            return NextResponse.json({ error: "Archivo y ruta requeridos" }, { status: 400 });
        }

        // --- SECURITY VALIDATION ---

        // 1. Validate File Size
        if (file.size > MAX_SIZE) {
            return NextResponse.json({ error: "El archivo excede el límite de 10MB" }, { status: 400 });
        }

        // 2. Validate MIME Type (Whitelist)
        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json({ error: "Tipo de archivo no permitido. Solo PDF, JPG, PNG o WebP." }, { status: 400 });
        }

        const buffer = await file.arrayBuffer();
        let processedBuffer: Buffer | Uint8Array = Buffer.from(buffer);
        let contentType = file.type;

        // 1. Optimize PDF
        if (file.type === "application/pdf") {
            try {
                const pdfDoc = await PDFDocument.load(buffer);
                // useObjectStreams: true significantly reduces size by grouping objects
                processedBuffer = await pdfDoc.save({ useObjectStreams: true });
                console.log(`[Storage] PDF optimized: ${file.name}`);
            } catch (pdfError) {
                console.error("[Storage] Error optimizing PDF, uploading original:", pdfError);
            }
        }
        // 2. Optimize Images (JPG, PNG, WebP)
        else if (file.type.startsWith("image/") && !file.type.includes("svg")) {
            try {
                let pipeline = sharp(Buffer.from(buffer))
                    .resize({
                        width: 1920,
                        height: 1920,
                        fit: 'inside',
                        withoutEnlargement: true
                    });

                // Convert to JPEG with 80% quality for best balance size/quality
                // If it's a PNG we could keep it PNG but JPEG is usually smaller for photos
                if (file.type === "image/png" || file.type === "image/jpeg" || file.type === "image/webp") {
                    processedBuffer = await pipeline
                        .jpeg({ quality: 80, progressive: true })
                        .toBuffer();
                    contentType = "image/jpeg";
                } else {
                    processedBuffer = await pipeline.toBuffer();
                }

                console.log(`[Storage] Image optimized: ${file.name}`);
            } catch (imageError) {
                console.error("[Storage] Error optimizing image, uploading original:", imageError);
            }
        }

        // 3. Upload to Supabase
        // Use UUID for safe naming prevents overwrites and guessing
        const fileExt = file.name.split('.').pop();
        const safeName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `${path}/${safeName}`.replace(/\/+/g, '/'); // Clean path

        const { data, error } = await supabaseAdmin.storage
            .from(bucket)
            .upload(filePath, processedBuffer, {
                contentType: contentType,
                upsert: true
            });

        if (error) {
            console.error("[Storage] Supabase Upload Error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Return internal proxy URL for secure viewing
        const viewUrl = `/api/storage/view?bucket=${bucket}&path=${encodeURIComponent(filePath)}`;

        return NextResponse.json({
            success: true,
            path: filePath,
            originalName: file.name, // Keep track of original name
            publicUrl: viewUrl, // We overwrite publicUrl with the proxy for compatibility
            viewUrl: viewUrl,
            originalSize: file.size,
            compressedSize: processedBuffer.length
        });

    } catch (error: any) {
        console.error("[Storage] API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
