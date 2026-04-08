import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { createClient } from "@supabase/supabase-js";
import { getEmisor } from "@/lib/getEmisor";

// Helper for Service Role (bypassing RLS for assets)
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

// Helper to wrap text
function wrapText(text: string, maxWidth: number, font: any, size: number): string[] {
    if (!text) return [];
    // Basic word wrapping
    const words = text.replace(/\n/g, " ").split(' ');
    const lines: string[] = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
        const word = words[i];
        if (!word) continue;
        const width = font.widthOfTextAtSize(currentLine + " " + word, size);
        if (width < maxWidth) {
            currentLine += " " + word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    lines.push(currentLine);
    return lines;
}

export async function generateIncidentsPdf({
    incidents
}: {
    incidents: any[];
}) {
    // --- ASSETS ---
    const { headerPath, nombre } = await getEmisor();
    const logoBytes = await downloadAssetPng(headerPath || "certificados/logo-retenciones.png");

    // --- PDF GENERATION ---
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([841.89, 595.28]); // A4 Landscape
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const margin = 30;
    let y = height - 40;

    // 1. Logo (Top Header - Full Width)
    if (logoBytes) {
        try {
            const img = await pdfDoc.embedPng(logoBytes);
            const targetW = width - (margin * 2);
            const targetH = (img.height / img.width) * targetW;

            page.drawImage(img, {
                x: margin,
                y: y - targetH,
                width: targetW,
                height: targetH
            });
            y -= (targetH + 20);
        } catch (e) {
            console.error("Logo embed error", e);
            y -= 40;
        }
    } else {
        y -= 40;
    }

    // 2. Title (Below Logo)
    const title = "LISTADO DE INCIDENCIAS";
    const titleSize = 16;
    const titleW = bold.widthOfTextAtSize(title, titleSize);

    // Center Title
    page.drawText(title, {
        x: (width - titleW) / 2,
        y: y,
        size: titleSize,
        font: bold,
        color: rgb(0, 0, 0),
    });

    y -= 30; // Spacing after title

    // 3. Summary Bar (Total Incidencias)
    const summaryHeight = 25;
    page.drawRectangle({
        x: margin,
        y: y - summaryHeight,
        width: width - (margin * 2),
        height: summaryHeight,
        color: rgb(0.96, 0.96, 0.96), // Light Gray
    });

    const totalText = `Total Incidencias: ${incidents.length}`;
    const totalSize = 10;
    // Draw text vertically centered in bar
    page.drawText(totalText, {
        x: margin + 10,
        y: y - summaryHeight + 8, // Vertically centered approx
        size: totalSize,
        font: bold,
        color: rgb(0, 0, 0),
    });

    y -= (summaryHeight + 20); // Move down past summary bar

    // 4. Table Header
    const minRowHeight = 25;
    const fontSize = 8;

    // Columns
    const cols = [
        { label: "ID", x: margin, w: 25 },
        { label: "Fecha", x: margin + 25, w: 50 },
        { label: "Comunidad", x: margin + 75, w: 100 },
        { label: "Cliente", x: margin + 175, w: 80 },
        { label: "Entrada", x: margin + 255, w: 60 },
        { label: "Motivo", x: margin + 315, w: 110 },
        { label: "Mensaje", x: margin + 425, w: 130 },
        { label: "Estado", x: margin + 555, w: 50 },
        { label: "Gestor", x: margin + 605, w: 80 },
        { label: "Telf.", x: margin + 685, w: 60 },
        { label: "Email", x: margin + 745, w: 36 },
    ];

    // Helper to draw Table Header (Yellow Bar)
    const drawTableHeader = (currentPage: any, curY: number) => {
        currentPage.drawRectangle({ x: margin, y: curY - 5, width: width - (margin * 2), height: minRowHeight, color: rgb(0.98, 0.8, 0.08) });
        cols.forEach(col => {
            currentPage.drawText(col.label, { x: col.x + 2, y: curY + 5, size: 9, font: bold, color: rgb(0, 0, 0) });
        });
    };

    drawTableHeader(page, y);
    y -= minRowHeight;

    // 5. Entries loop
    for (let index = 0; index < incidents.length; index++) {
        const inc = incidents[index];

        // Data
        const id = inc.id.toString();
        const fecha = new Date(inc.created_at).toLocaleDateString('es-ES');
        const comunidad = inc.comunidad || inc.comunidades?.nombre_cdad || '-';
        const cliente = inc.nombre_cliente || '-';
        const entrada = inc.source || '-';
        const motivo = inc.motivo_ticket || '-';
        const telefono = inc.telefono || '-';
        const email = inc.email || '-';
        const mensaje = inc.mensaje || '-';
        const estado = inc.resuelto ? 'Resuelto' : 'Pendiente';
        const gestorName = inc.gestor?.nombre || (inc.gestor_asignado ? 'Asignado' : '-');

        // Logic for Row Height based on Messaging
        const messageWidth = cols[6].w - 4;
        const messageLines = wrapText(mensaje, messageWidth, font, fontSize);
        const motivoWidth = cols[5].w - 4;
        const motivoLinesCount = wrapText(motivo, motivoWidth, font, fontSize).length;
        const lineHeight = fontSize + 4; // Spacing
        const maxLines = Math.max(messageLines.length, motivoLinesCount);
        const textBlockHeight = Math.max(minRowHeight, (maxLines * lineHeight) + 6); // +6 for padding

        // Check Page Break
        if (y - textBlockHeight < 40) {
            page = pdfDoc.addPage([841.89, 595.28]);
            y = height - 40;
            drawTableHeader(page, y);
            y -= minRowHeight;
        }

        const rowTopY = y;

        // Zebra background (only for rows being drawn)
        if (index % 2 !== 0) {
            page.drawRectangle({
                x: margin,
                y: rowTopY - textBlockHeight, // Bottom left
                width: width - (margin * 2),
                height: textBlockHeight,
                color: rgb(0.98, 0.98, 0.98)
            });
        }

        // Draw Texts (Top Aligned)
        const commonY = rowTopY - 12;

        page.drawText(id, { x: cols[0].x + 2, y: commonY, size: fontSize, font });
        page.drawText(fecha, { x: cols[1].x + 2, y: commonY, size: fontSize, font });
        page.drawText(comunidad.substring(0, 20), { x: cols[2].x + 2, y: commonY, size: fontSize, font });
        page.drawText(cliente.substring(0, 16), { x: cols[3].x + 2, y: commonY, size: fontSize, font });
        page.drawText(entrada.substring(0, 12), { x: cols[4].x + 2, y: commonY, size: fontSize, font });

        // Multiline Motivo
        const motivoLines = wrapText(motivo, cols[5].w - 4, font, fontSize);
        motivoLines.forEach((line, i) => {
            page.drawText(line, { x: cols[5].x + 2, y: commonY - (i * lineHeight), size: fontSize, font });
        });

        // Multiline Message
        messageLines.forEach((line, i) => {
            page.drawText(line, {
                x: cols[6].x + 2,
                y: commonY - (i * lineHeight),
                size: fontSize,
                font
            });
        });

        page.drawText(estado, { x: cols[7].x + 2, y: commonY, size: fontSize, font, color: inc.resuelto ? rgb(0, 0.5, 0) : rgb(0.8, 0.5, 0) });
        page.drawText(gestorName.substring(0, 14), { x: cols[8].x + 2, y: commonY, size: fontSize, font });
        page.drawText(telefono.substring(0, 11), { x: cols[9].x + 2, y: commonY, size: fontSize, font });
        page.drawText(email.substring(0, 8), { x: cols[10].x + 2, y: commonY, size: fontSize, font });

        y -= textBlockHeight;
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
