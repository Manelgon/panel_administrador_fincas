import { NextResponse } from "next/server";
import { supabaseRouteClient } from "@/lib/supabase/route";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { promises as fs } from "fs";
import path from "path";
import { logActivity } from "@/lib/logActivity";
import { getEmisor } from "@/lib/getEmisor";

// Constants (Matching branding in report/route.ts)
const A4 = { w: 595.28, h: 841.89 };
const YELLOW = rgb(0.98, 0.84, 0.40);
const BORDER = rgb(0.82, 0.82, 0.82);
const BLACK = rgb(0, 0, 0);

function formatToEuropeanDate(dateStr: string | null | undefined): string {
    if (!dateStr) return "-";
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
    } catch {
        return dateStr;
    }
}

async function downloadAssetPng(path: string): Promise<Uint8Array> {
    try {
        const { data, error } = await supabaseAdmin.storage
            .from("doc-assets")
            .download(path);
        if (error || !data) throw new Error(error?.message || "Sin datos");
        return new Uint8Array(await data.arrayBuffer());
    } catch (e: any) {
        throw new Error(`Error descargando asset [${path}]: ${e.message}`);
    }
}

export async function POST(req: Request) {
    try {
        const supabase = await supabaseRouteClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

        const { structured, communityId, communityName, fechaInicio, fechaFin } = await req.json();

        // 1) Initialize PDF
        const pdfDoc = await PDFDocument.create();
        let page = pdfDoc.addPage([A4.w, A4.h]);
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const marginX = 50;
        const contentW = A4.w - marginX * 2;
        let currentY = A4.h - 50;

        // 2) Header PDF — usa header de company_settings, fallback al public/
        try {
            const emisorData = await getEmisor();
            let logoBytes: Uint8Array;
            if (emisorData.headerPath) {
                logoBytes = await downloadAssetPng(emisorData.headerPath);
            } else {
                const localPath = path.join(process.cwd(), "public", "logo-retenciones.png");
                logoBytes = new Uint8Array(await fs.readFile(localPath));
            }
            const img = await pdfDoc.embedPng(logoBytes);
            const targetW = A4.w - 20;
            const targetH = (img.height / img.width) * targetW;
            page.drawImage(img, { x: 10, y: A4.h - 10 - targetH, width: targetW, height: targetH });
            currentY = A4.h - 20 - targetH - 30;
        } catch (e) {
            console.warn("Logo skip:", e);
        }

        // 3) Header
        page.drawText("INFORME DE RESUMEN DE EMAILS (IA)", { x: marginX, y: currentY, size: 16, font: bold, color: BLACK });
        currentY -= 20;
        page.drawText(`Comunidad: ${communityName || 'Desconocida'}`, { x: marginX, y: currentY, size: 10, font, color: rgb(0.3, 0.3, 0.3) });
        currentY -= 14;
        page.drawText(`Periodo: ${formatToEuropeanDate(fechaInicio)} al ${formatToEuropeanDate(fechaFin)}`, { x: marginX, y: currentY, size: 10, font, color: rgb(0.3, 0.3, 0.3) });
        currentY -= 14;

        const now = new Date();
        const genDate = formatToEuropeanDate(now.toISOString());
        const genTime = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        page.drawText(`Fecha Generación: ${genDate} ${genTime}`, { x: marginX, y: currentY, size: 10, font, color: rgb(0.3, 0.3, 0.3) });
        currentY -= 30;

        // 4) Group Emails by Sender for Administrative Layout
        const grouped: Record<string, { name: string, email: string, entries: any[] }> = {};
        for (const email of structured.emails) {
            const key = email.remitente_email.toLowerCase().trim();
            if (!grouped[key]) {
                grouped[key] = {
                    name: email.remitente_nombre || email.remitente_email,
                    email: email.remitente_email,
                    entries: []
                };
            }
            grouped[key].entries.push(email);
        }
        const senderGroups = Object.values(grouped);

        // 5) Draw Groups
        for (const group of senderGroups) {
            // Check page overflow for new group header
            if (currentY < 150) {
                page = pdfDoc.addPage([A4.w, A4.h]);
                currentY = A4.h - 50;
            }

            // Group Header (Administrative Sender Block)
            const headerBoxH = 30;
            page.drawRectangle({
                x: marginX, y: currentY - headerBoxH, width: contentW, height: headerBoxH,
                color: YELLOW, borderColor: BORDER, borderWidth: 0.5
            });

            const displayName = group.name.toLowerCase() === group.email.toLowerCase()
                ? group.email.toLowerCase()
                : `${group.name.toUpperCase()} (${group.email.toLowerCase()})`;

            page.drawText(`REMITENTE: ${displayName}`, {
                x: marginX + 10, y: currentY - 18, size: 9, font: bold
            });
            currentY -= (headerBoxH + 15);

            // Draw entries for this sender
            for (const email of group.entries) {
                // Check page overflow for entry
                if (currentY < 100) {
                    page = pdfDoc.addPage([A4.w, A4.h]);
                    currentY = A4.h - 50;
                }

                // Date and Indicator (Fix WinAnsi encoding: use - instead of ●)
                page.drawText(`- FECHA: ${formatToEuropeanDate(email.fecha)}`, {
                    x: marginX + 10, y: currentY, size: 8, font: bold, color: rgb(0.2, 0.2, 0.2)
                });
                currentY -= 12;

                // Summary Text (Wrapped)
                const words = email.resumen.split(' ');
                let line = '';
                const fontSize = 9;
                const lineHeight = 12;

                for (const word of words) {
                    const testLine = line + word + ' ';
                    const width = font.widthOfTextAtSize(testLine, fontSize);
                    if (width > contentW - 25) {
                        page.drawText(line, { x: marginX + 20, y: currentY, size: fontSize, font });
                        currentY -= lineHeight;
                        line = word + ' ';
                        if (currentY < 60) {
                            page = pdfDoc.addPage([A4.w, A4.h]);
                            currentY = A4.h - 50;
                        }
                    } else {
                        line = testLine;
                    }
                }
                page.drawText(line, { x: marginX + 20, y: currentY, size: fontSize, font });
                currentY -= (lineHeight + 15);
            }
            currentY -= 10; // Extra space between groups
        }

        // 6) Add Footers (Page X of Y)
        const totalPages = pdfDoc.getPageCount();
        const pages = pdfDoc.getPages();
        for (let i = 0; i < totalPages; i++) {
            const p = pages[i];
            p.drawText(`Página ${i + 1} de ${totalPages}`, {
                x: A4.w / 2 - 30,
                y: 30,
                size: 8,
                font,
                color: rgb(0.5, 0.5, 0.5)
            });
            p.drawText("Informe Generado por SERINCOSOL IA * DOCUMENTO CERTIFICADO", {
                x: marginX,
                y: 30,
                size: 7,
                font,
                color: rgb(0.7, 0.7, 0.7)
            });
        }

        // 5) Save & Upload
        const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
        const timestamp = Date.now();
        const filename = `${timestamp}_${communityName.replace(/[^a-z0-9]/gi, '_')}.pdf`;
        const pdfPath = `email-reports/${communityName}/${filename}`;

        const { error: uploadError } = await supabaseAdmin.storage
            .from("documentos")
            .upload(pdfPath, pdfBytes, {
                contentType: 'application/pdf',
                upsert: true
            });

        if (uploadError) throw uploadError;

        // 6) Save record in database
        const { data: reportRecord, error: dbError } = await supabaseAdmin
            .from('email_reports')
            .insert({
                community_id: communityId,
                community_name: communityName,
                title: structured.titulo || `Informe ${communityName}`,
                period_start: fechaInicio,
                period_end: fechaFin,
                pdf_path: pdfPath,
                emails_count: structured.total || structured.emails.length
            })
            .select()
            .single();

        if (dbError) throw dbError;

        // 6.5) Log activity
        await logActivity({
            action: 'generate',
            entityType: 'informe_email',
            entityName: reportRecord.title,
            details: {
                comunidad: communityName,
                periodo: `${fechaInicio} - ${fechaFin}`,
                emails: reportRecord.emails_count
            },
            supabaseClient: supabase
        });

        // 7) Create signed URL for instant viewing
        const { data: signData, error: signError } = await supabaseAdmin.storage
            .from("documentos")
            .createSignedUrl(pdfPath, 3600); // 1 hour

        return NextResponse.json({
            success: true,
            pdfUrl: signData?.signedUrl,
            reportId: reportRecord.id
        });

    } catch (error: any) {
        console.error("PDF generation error:", error);
        return NextResponse.json({
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, { status: 500 });
    }
}
