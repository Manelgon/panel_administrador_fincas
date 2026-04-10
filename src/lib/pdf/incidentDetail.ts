import { PDFDocument, rgb, StandardFonts, PDFFont } from "pdf-lib";
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

// -----------------------------------------------------------
// Text Wrapping & Drawing Helpers
// -----------------------------------------------------------

// Helper to remove unsupported characters (like emojis) for WinAnsi fonts
function sanitizeText(text: string): string {
    if (!text) return '';
    // Replace characters that are not in basic Latin or Latin-1 Supplement.
    // This removes emojis and other special symbols that break pdf-lib StandardFonts.
    // Ranges: \x20-\x7E (Printable ASCII), \xA0-\xFF (Latin-1 Supplement)
    // Also keep newlines \n
    // Using a negation set to remove everything else.
    return text.replace(/[^\x20-\x7E\xA0-\xFF\n]/g, '');
}

function wrapText(text: string, maxWidth: number, font: PDFFont, size: number): string[] {
    if (!text) return [];
    const cleanText = sanitizeText(text);
    const paragraphs = cleanText.split('\n');
    let lines: string[] = [];

    paragraphs.forEach(paragraph => {
        const words = paragraph.split(' ');
        let currentLine = words[0] || '';

        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const width = font.widthOfTextAtSize(currentLine + " " + word, size);
            if (width < maxWidth) {
                currentLine += " " + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        lines.push(currentLine);
    });
    return lines;
}

// -----------------------------------------------------------
// Main Generation Function
// -----------------------------------------------------------

export async function generateIncidentDetailPdf({ incident, notes = [] }: { incident: any, notes?: any[] }) {
    // --- ASSETS ---
    const { headerPath, nombre } = await getEmisor();
    const logoBytes = await downloadAssetPng(headerPath || "certificados/logo-retenciones.png");

    // --- PDF SETUP ---
    const pdfDoc = await PDFDocument.create();
    // A4 Portrait: 595.28 x 841.89
    let page = pdfDoc.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();

    // Fonts
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
    // Note: StandardFonts doesn't support emojis or complex charset.
    // For 'Check' icons etc, we might need a separate font or just text simulation.

    const margin = 40;
    let y = height - margin;

    // --- 1. LOGO (Full width header) ---
    if (logoBytes) {
        try {
            const img = await pdfDoc.embedPng(logoBytes);
            // Full width, maintain aspect
            const targetW = width;
            const targetH = (img.height / img.width) * targetW;

            // Draw at absolute top-left
            page.drawImage(img, {
                x: 0,
                y: height - targetH,
                width: targetW,
                height: targetH
            });

            // Adjust y for subsequent content
            // Leave a little space below banner
            y = height - targetH - 30;
        } catch (e) {
            console.error("Logo embed error", e);
            y -= 20;
        }
    } else {
        y -= 20;
    }

    // --- 2. HEADER: Ticket #ID ---
    const ticketTitle = `Ticket #${incident.id}`;
    page.drawText(sanitizeText(ticketTitle), {
        x: margin,
        y: y,
        size: 24,
        font: fontBold,
        color: rgb(0, 0, 0),
    });
    y -= 20;

    const createdText = `Creado el ${new Date(incident.created_at).toLocaleString('es-ES')}`;
    page.drawText(createdText, {
        x: margin,
        y: y,
        size: 10,
        font: fontRegular,
        color: rgb(0.5, 0.5, 0.5), // Gray
    });
    y -= 40;

    // --- 3. STATUS BAR (Highlighted Box) ---
    // Box
    const statusBarHeight = 40;
    page.drawRectangle({
        x: margin,
        y: y - statusBarHeight,
        width: width - (margin * 2),
        height: statusBarHeight,
        color: rgb(0.98, 0.98, 0.98), // Very light gray bg
        borderColor: rgb(0.9, 0.9, 0.9),
        borderWidth: 1,
    });

    // We need to layout: "Estado: [Badge]", "Urgencia: [Badge]", "Categoría: text"
    // Simplified: Just draw text for now, simulating layout.

    const drawLabelValue = (label: string, value: string, xPos: number, yPos: number, valueColor: any = rgb(0, 0, 0), valueBg?: any) => {
        const cleanLabel = sanitizeText(label);
        const cleanValue = sanitizeText(value);
        page.drawText(cleanLabel, { x: xPos, y: yPos, size: 10, font: fontRegular, color: rgb(0.5, 0.5, 0.5) });
        const labelW = fontRegular.widthOfTextAtSize(cleanLabel, 10);

        const valX = xPos + labelW + 5;

        if (valueBg) {
            const valW = fontBold.widthOfTextAtSize(cleanValue, 10);
            page.drawRectangle({
                x: valX - 4,
                y: yPos - 4,
                width: valW + 8,
                height: 18,
                color: valueBg,
                opacity: 0.3 // Light pastel
            });
        }

        page.drawText(cleanValue, { x: valX, y: yPos, size: 10, font: fontBold, color: valueColor });
        return valX + fontBold.widthOfTextAtSize(cleanValue, 10) + 20; // Return next X
    };

    const statusY = y - (statusBarHeight / 2) - 4; // Vertically centered
    let curX = margin + 15;

    // Estado
    const estadoTxt = incident.resuelto ? 'Resuelto' : 'Pendiente';
    const estadoColor = incident.resuelto ? rgb(0, 0.5, 0) : rgb(0.8, 0.5, 0); // Green vs Orange
    const estadoBg = incident.resuelto ? rgb(0, 1, 0) : rgb(1, 0.9, 0);
    curX = drawLabelValue("Estado:", estadoTxt, curX, statusY, rgb(0, 0, 0), estadoBg);

    // Separator
    page.drawLine({ start: { x: curX - 10, y: statusY - 5 }, end: { x: curX - 10, y: statusY + 12 }, color: rgb(0.8, 0.8, 0.8) });

    // Urgencia
    const urgenciaTxt = incident.urgencia || 'No definida';
    const urgenciaColor = urgenciaTxt === 'Alta' ? rgb(0.8, 0, 0) : rgb(0, 0, 0);
    const urgenciaBg = urgenciaTxt === 'Alta' ? rgb(1, 0, 0) : rgb(0.8, 0.8, 1);
    curX = drawLabelValue("Urgencia:", urgenciaTxt, curX, statusY, urgenciaColor, urgenciaBg);

    // Separator
    page.drawLine({ start: { x: curX - 10, y: statusY - 5 }, end: { x: curX - 10, y: statusY + 12 }, color: rgb(0.8, 0.8, 0.8) });

    // Categoria
    const catTxt = incident.categoria || 'Otro';
    drawLabelValue("Categoría:", catTxt, curX, statusY);

    y -= (statusBarHeight + 40);

    // --- 4. DETAILS COLUMNS ---
    const colGap = 40;
    const colWidth = (width - margin * 2 - colGap) / 2;
    const leftColX = margin;
    const rightColX = margin + colWidth + colGap;
    let currentSectionsY = y;

    // --- LEFT COLUMN: Contacto y Ubicación ---
    const drawSectionHeader = (title: string, x: number, y: number) => {
        // Icon placeholder (simple circle) + Text
        page.drawText(sanitizeText(title), { x: x, y: y, size: 12, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
        // Underline
        page.drawLine({ start: { x: x, y: y - 5 }, end: { x: x + colWidth, y: y - 5 }, color: rgb(0, 0, 0), thickness: 1.5 });
        return y - 25;
    };

    let leftY = drawSectionHeader("CONTACTO Y UBICACIÓN", leftColX, currentSectionsY);

    const drawRow = (label: string, value: string, x: number, curY: number) => {
        const cleanLabel = sanitizeText(label);
        const cleanValue = sanitizeText(value);
        page.drawText(cleanLabel, { x: x, y: curY, size: 10, font: fontRegular, color: rgb(0.5, 0.5, 0.5) });
        // Value aligned to right of label? Or fixed tab?
        // UI shows 2 cols within the column: Label (left) | Value (right)
        // Let's us fixed offset for value.
        const valX = x + 80;
        // Wrap value if too long?
        const maxValW = colWidth - 80;
        const valueLines = wrapText(value, maxValW, fontBold, 10);

        valueLines.forEach((line, i) => {
            page.drawText(line, { x: valX, y: curY - (i * 12), size: 10, font: fontBold, color: rgb(0, 0, 0) });
        });

        // Return next Y
        const heightUsed = Math.max(1, valueLines.length) * 12 + 12; // + spacing
        // Divider line? UI has faint divider
        page.drawLine({ start: { x, y: curY - (heightUsed - 8) }, end: { x: x + colWidth, y: curY - (heightUsed - 8) }, color: rgb(0.9, 0.9, 0.9) });

        return curY - heightUsed;
    };

    const commName = incident.comunidad || incident.comunidades?.nombre_cdad || '-';

    leftY = drawRow("Cliente", incident.nombre_cliente || '-', leftColX, leftY);
    leftY = drawRow("Teléfono", incident.telefono || '-', leftColX, leftY);
    leftY = drawRow("Email", incident.email || '-', leftColX, leftY);
    leftY = drawRow("Comunidad", commName, leftColX, leftY);

    // --- RIGHT COLUMN: Gestión Interna ---
    let rightY = drawSectionHeader("GESTIÓN INTERNA", rightColX, currentSectionsY);

    const gestorName = incident.gestor?.nombre || incident.gestor_asignado || '-';
    const receptorName = incident.receptor?.nombre || incident.quien_lo_recibe || '-';
    const sentimento = incident.sentimiento || '-';
    const entrada = incident.source || '-';
    const motivoTicket = incident.motivo_ticket || '-';

    rightY = drawRow("Recibido por", receptorName, rightColX, rightY);
    rightY = drawRow("Gestor", gestorName, rightColX, rightY);
    rightY = drawRow("Entrada", entrada, rightColX, rightY);
    rightY = drawRow("Motivo ticket", motivoTicket, rightColX, rightY);
    rightY = drawRow("Sentimiento", sentimento, rightColX, rightY);
    rightY = drawRow("Fecha Creación", new Date(incident.created_at).toLocaleString('es-ES'), rightColX, rightY);

    // Move Y to below the longest column
    y = Math.min(leftY, rightY) - 40;

    // --- 5. MENSAJE DEL CLIENTE ---
    page.drawText("MENSAJE DEL CLIENTE", { x: margin, y: y, size: 12, font: fontBold });
    page.drawLine({ start: { x: margin, y: y - 5 }, end: { x: width - margin, y: y - 5 }, color: rgb(0, 0, 0), thickness: 1.5 });
    y -= 25;

    // Background box
    const messageLines = wrapText(incident.mensaje || '', width - (margin * 2) - 20, fontRegular, 10);
    const msgHeight = (messageLines.length * 15) + 20;

    // Check pagination
    if (y - msgHeight < 40) {
        page = pdfDoc.addPage([595.28, 841.89]);
        y = height - margin;
    }

    page.drawRectangle({
        x: margin,
        y: y - msgHeight,
        width: width - (margin * 2),
        height: msgHeight,
        color: rgb(0.98, 0.98, 0.98),
        borderColor: rgb(0.9, 0.9, 0.9),
        borderWidth: 1
    });

    messageLines.forEach((line, i) => {
        page.drawText(line, {
            x: margin + 10,
            y: y - 20 - (i * 15),
            size: 10,
            font: fontRegular,
            color: rgb(0.2, 0.2, 0.2)
        });
    });

    y -= (msgHeight + 40);

    // --- 6. ATTACHMENTS (Links) ---
    if (incident.adjuntos && incident.adjuntos.length > 0) {
        // Check pagination
        if (y - 80 < 40) {
            page = pdfDoc.addPage([595.28, 841.89]);
            y = height - margin;
        }

        page.drawText("ARCHIVOS ADJUNTOS", { x: margin, y: y, size: 12, font: fontBold });
        page.drawLine({ start: { x: margin, y: y - 5 }, end: { x: width - margin, y: y - 5 }, color: rgb(0, 0, 0), thickness: 1.5 });
        y -= 25;

        incident.adjuntos.forEach((url: string, i: number) => {
            const label = `Adjunto ${i + 1}: ${url.split('/').pop()?.substring(0, 50)}...`;
            page.drawText(sanitizeText(label), {
                x: margin,
                y: y,
                size: 9,
                font: fontRegular,
                color: rgb(0, 0, 1), // Blue link color
            });
            // We cannot easily make actual clickable links in pdf-lib without annotations, 
            // but displaying the list indicates existence.
            y -= 15;
            if (y < 40) { // Check if next item will fit
                page = pdfDoc.addPage([595.28, 841.89]);
                y = height - margin;
            }
        });
        y -= 20;
    }

    // --- 7. NOTAS DE GESTIÓN (Timeline) ---
    if (notes && notes.length > 0) {
        if (y - 100 < 40) { // Estimate space needed for header + first note
            page = pdfDoc.addPage([595.28, 841.89]);
            y = height - margin;
        }

        page.drawText("NOTAS DE GESTIÓN", { x: margin, y: y, size: 12, font: fontBold });
        page.drawLine({ start: { x: margin, y: y - 5 }, end: { x: width - margin, y: y - 5 }, color: rgb(0, 0, 0), thickness: 1.5 });
        y -= 30;

        notes.forEach((msg) => {
            const dateStr = new Date(msg.created_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            const author = msg.profiles?.nombre || 'Usuario';
            const header = `${author} - ${dateStr}`;

            const contentLines = wrapText(msg.content || '', width - margin * 2 - 20, fontRegular, 9);
            const totalH = (contentLines.length * 12) + 25; // Header (12) + content lines (12 per line) + spacing (10)

            if (y - totalH < 40) { // Check if this note fits on the current page
                page = pdfDoc.addPage([595.28, 841.89]);
                y = height - margin;
            }

            // Header line (Bold small)
            page.drawText(sanitizeText(header), { x: margin, y: y, size: 8, font: fontBold, color: rgb(0.3, 0.3, 0.3) });
            y -= 12;

            contentLines.forEach((line) => {
                page.drawText(line, { x: margin + 5, y: y, size: 9, font: fontRegular, color: rgb(0, 0, 0) });
                y -= 12;
            });

            y -= 10; // Gap between notes
            page.drawLine({ start: { x: margin, y: y + 5 }, end: { x: width - margin, y: y + 5 }, color: rgb(0.9, 0.9, 0.9), thickness: 0.5 });
        });
    }

    // --- FOOTER ---
    const allPages = pdfDoc.getPages();
    for (let i = 0; i < allPages.length; i++) {
        const p = allPages[i];
        const { width: pW } = p.getSize();
        p.drawText(nombre || "Administración de Fincas", {
            x: margin,
            y: 20,
            size: 8,
            font: fontRegular,
            color: rgb(0.6, 0.6, 0.6)
        });
        p.drawText(`Página ${i + 1} de ${allPages.length}`, {
            x: pW - margin - 60,
            y: 20,
            size: 8,
            font: fontRegular,
            color: rgb(0.6, 0.6, 0.6)
        });
    }

    return await pdfDoc.save();
}
