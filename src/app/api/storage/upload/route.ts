import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import crypto from "crypto";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_BUCKETS = ["documentos", "FACTURAS"];
const ALLOWED_TYPES = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    // Microsoft Word
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    // Microsoft Excel
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    // Microsoft PowerPoint
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    // OpenDocument
    "application/vnd.oasis.opendocument.text",
    "application/vnd.oasis.opendocument.spreadsheet",
    "application/vnd.oasis.opendocument.presentation",
    // Google Docs / Sheets / Slides exports
    "application/vnd.google-apps.document",
    "application/vnd.google-apps.spreadsheet",
    // Texto plano y CSV
    "text/plain",
    "text/csv",
    "application/csv",
    // Outlook email
    "application/vnd.ms-outlook",
];
const ALLOWED_EXTENSIONS = [
    "pdf", "jpg", "jpeg", "png", "webp",
    "doc", "docx", "xls", "xlsx", "ppt", "pptx",
    "odt", "ods", "odp",
    "txt", "csv", "msg"
];

export async function POST(req: Request) {
    try {
        // 0. Verify Authentication (session cookie or Bearer token)
        const cookieStore = await cookies();
        const authHeader = req.headers.get('Authorization');
        const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) {
                        return cookieStore.get(name)?.value;
                    },
                    set(name: string, value: string, options: CookieOptions) {
                        cookieStore.set({ name, value, ...options });
                    },
                    remove(name: string, options: CookieOptions) {
                        cookieStore.set({ name, value: '', ...options });
                    },
                },
            }
        );

        const { data: { user }, error: userError } = await supabase.auth.getUser(token || undefined);

        if (userError || !user) {
            return NextResponse.json({ error: "Unauthorized: No session" }, { status: 401 });
        }

        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('activo')
            .eq('user_id', user.id)
            .single();

        if (!profile || profile.activo === false) {
            return NextResponse.json({ error: "Forbidden: Inactive account" }, { status: 403 });
        }

        const formData = await req.formData();
        const file = formData.get("file") as File;
        const path = formData.get("path") as string;
        const bucket = (formData.get("bucket") as string) || "documentos";

        if (!file || !path) {
            return NextResponse.json({ error: "Archivo y ruta requeridos" }, { status: 400 });
        }

        if (!ALLOWED_BUCKETS.includes(bucket)) {
            return NextResponse.json({ error: "Bucket no permitido" }, { status: 400 });
        }

        if (path.includes("..")) {
            return NextResponse.json({ error: "Ruta no válida" }, { status: 400 });
        }

        // --- SECURITY VALIDATION ---

        // 1. Validate File Size
        if (file.size > MAX_SIZE) {
            return NextResponse.json({ error: "El archivo excede el límite de 10MB" }, { status: 400 });
        }

        // 2. Validate MIME Type (Whitelist) with extension fallback
        // Some browsers/OS send application/octet-stream or empty type for Office files,
        // so we also accept by extension when the MIME is not in the whitelist.
        const extension = (file.name.split('.').pop() || '').toLowerCase();
        const mimeOk = ALLOWED_TYPES.includes(file.type);
        const extOk = ALLOWED_EXTENSIONS.includes(extension);
        if (!mimeOk && !extOk) {
            return NextResponse.json({ error: "Tipo de archivo no permitido. Formatos válidos: PDF, imágenes, Word, Excel, PowerPoint, ODT/ODS/ODP, TXT o CSV." }, { status: 400 });
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
            return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
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
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
}
