import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getEmisor } from "@/lib/getEmisor";

// Helper for Service Role (bypassing RLS for assets)
// Helper: Download Asset with Admin Client
async function downloadAssetPng(filePath: string) {
    let { data, error } = await supabaseAdmin.storage
        .from("doc-assets")
        .download(filePath);

    if (error && filePath.includes('/')) {
        const rootPath = filePath.split('/').pop()!;
        const retry = await supabaseAdmin.storage
            .from("doc-assets")
            .download(rootPath);
        if (!retry.error) {
            data = retry.data;
            error = null;
        }
    }

    if (error || !data) {
        console.warn(`Asset ${filePath} not found:`, error?.message);
        return null;
    }

    const ab = await data.arrayBuffer();
    return Buffer.from(ab);
}

export async function generateFichajePdf({
    month,
    userName,
    entries
}: {
    month: string;
    userName: string;
    entries: any[];
}) {
    // --- ASSETS ---
    const { headerPath, nombre, colegiado } = await getEmisor();
    const adminName = colegiado || "Roberto Díaz Rodríguez";
    const logoBytes = await downloadAssetPng(headerPath || "certificados/logo-retenciones.png");
    const selloBytes = await downloadAssetPng("certificados/sello-retenciones.png");

    // --- PDF GENERATION ---
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const margin = 50;
    let y = height - 50;

    // 1. Logo (Top Header)
    if (logoBytes) {
        try {
            const img = await pdfDoc.embedPng(logoBytes);
            // Target width full page minus margins roughly, or specific size
            const targetW = width - 40; // Full width roughly
            const targetH = (img.height / img.width) * targetW;

            // Position like certificate: Top centered or filling header
            const x = 20;
            y = height - 20 - targetH;
            page.drawImage(img, { x, y, width: targetW, height: targetH });
            y -= 30; // Spacing after logo
        } catch (e) {
            console.error("Logo embed error", e);
        }
    } else {
        y -= 40; // Spacing if no logo
    }

    // 2. Title
    const title = "RESUMEN MENSUAL DE FICHAJE";
    const titleSize = 14;
    const titleW = bold.widthOfTextAtSize(title, titleSize);
    page.drawText(title, {
        x: (width - titleW) / 2,
        y,
        size: titleSize,
        font: bold,
        color: rgb(0, 0, 0),
    });
    y -= 30;

    // 3. Info Block
    const [yStr, mStr] = month.split('-');
    const monthName = new Date(parseInt(yStr), parseInt(mStr) - 1, 1).toLocaleString('es-ES', { month: 'long', year: 'numeric' });
    const monthFormatted = monthName.charAt(0).toUpperCase() + monthName.slice(1);

    page.drawText(`Empleado: ${userName}`, { x: margin, y, size: 11, font });
    y -= 15;
    page.drawText(`Mes: ${monthFormatted}`, { x: margin, y, size: 11, font });
    y -= 25;

    // Totals Calculation
    const totalMs = entries?.reduce((acc: number, curr: any) => {
        if (!curr.end_at) return acc;
        return acc + (new Date(curr.end_at).getTime() - new Date(curr.start_at).getTime());
    }, 0) || 0;
    const totalHours = (totalMs / (1000 * 60 * 60)).toFixed(2);
    const daysWorked = new Set(entries?.map((e: any) => e.start_at.split('T')[0])).size;

    // Totals Box
    page.drawRectangle({ x: margin, y: y - 30, width: width - (margin * 2), height: 30, color: rgb(0.96, 0.96, 0.96) });
    page.drawText(`Total Horas: ${totalHours} h`, { x: margin + 20, y: y - 20, size: 11, font: bold });
    page.drawText(`Días Trabajados: ${daysWorked}`, { x: margin + 250, y: y - 20, size: 11, font: bold });
    y -= 50;

    // 4. Table
    const colDate = margin;
    const colStart = margin + 80;
    const colEnd = margin + 160;
    const colHours = margin + 240;
    const colNotes = margin + 310;
    const rowHeight = 20;

    // Header Background (Serincosol Yellow: #FACC15 -> 0.98, 0.8, 0.08)
    page.drawRectangle({ x: margin, y: y - 5, width: width - (margin * 2), height: 20, color: rgb(0.98, 0.8, 0.08) });

    // Header Text
    page.drawText("Fecha", { x: colDate + 5, y: y + 2, size: 10, font: bold, color: rgb(0, 0, 0) });
    page.drawText("Inicio", { x: colStart, y: y + 2, size: 10, font: bold, color: rgb(0, 0, 0) });
    page.drawText("Fin", { x: colEnd, y: y + 2, size: 10, font: bold, color: rgb(0, 0, 0) });
    page.drawText("Horas", { x: colHours, y: y + 2, size: 10, font: bold, color: rgb(0, 0, 0) });
    page.drawText("Tipo Cierre", { x: colNotes, y: y + 2, size: 10, font: bold, color: rgb(0, 0, 0) });

    y -= 25;

    // Entries
    if (entries) {
        entries.forEach((entry: any, index: number) => {
            if (y < 120) { // Check space for footer
                page = pdfDoc.addPage([595.28, 841.89]);
                y = height - 50;
                // Redraw header on new page? Optional, keeping simple for now.
            }

            // Striped row support
            if (index % 2 !== 0) {
                page.drawRectangle({ x: margin, y: y - 5, width: width - (margin * 2), height: rowHeight, color: rgb(0.98, 0.98, 0.98) });
            }

            const start = new Date(entry.start_at);
            const end = entry.end_at ? new Date(entry.end_at) : null;
            const hours = end ? ((end.getTime() - start.getTime()) / (1000 * 60 * 60)).toFixed(2) : '-';

            let note = 'Usuario';
            if (entry.closed_by === 'auto') note = 'Autocierre';
            else if (entry.closed_by === 'admin') note = 'Admin';

            page.drawText(start.toLocaleDateString('es-ES'), { x: colDate + 5, y, size: 9, font });
            page.drawText(start.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }), { x: colStart, y, size: 9, font });
            page.drawText(end ? end.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '-', { x: colEnd, y, size: 9, font });
            page.drawText(hours, { x: colHours, y, size: 9, font });
            page.drawText(note, { x: colNotes, y, size: 9, font });

            y -= rowHeight;
        });
    }

    // 5. Footer (Seal & Signature)
    y -= 30;
    if (y < 150) {
        page = pdfDoc.addPage([595.28, 841.89]);
        y = height - 50;
    }

    if (selloBytes) {
        try {
            const seal = await pdfDoc.embedPng(selloBytes);
            const sealW = 140;
            const sealH = (seal.height / seal.width) * sealW;
            page.drawImage(seal, { x: margin, y: y - sealH, width: sealW, height: sealH });

            const sigY = y - sealH - 15;
            page.drawText(adminName, { x: margin, y: sigY, size: 10, font: bold, color: rgb(0, 0, 0) });
            page.drawText("Administrador de fincas", { x: margin, y: sigY - 12, size: 10, font, color: rgb(0, 0, 0) });
        } catch (e) {
            console.error("Seal embed error", e);
        }
    }

    // 6. Global Footer
    const footerText = nombre || "Administración de Fincas";
    const footerSize = 8;
    const allPages = pdfDoc.getPages();
    for (const p of allPages) {
        const { width: pW } = p.getSize();
        const textW = font.widthOfTextAtSize(footerText, footerSize);
        p.drawText(footerText, {
            x: pW / 2 - textW / 2,
            y: 20,
            size: footerSize,
            font,
            color: rgb(0.5, 0.5, 0.5),
        });
    }

    return await pdfDoc.save();
}
