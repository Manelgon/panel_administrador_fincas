import { PDFDocument, rgb, StandardFonts, PDFFont } from "pdf-lib";
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

// -----------------------------------------------------------
// Text Wrapping & Drawing Helpers
// -----------------------------------------------------------

function wrapText(text: string, maxWidth: number, font: PDFFont, size: number): string[] {
    if (!text) return [];
    const paragraphs = text.split('\n');
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

export async function generateDebtDetailPdf({ debt, notes = [] }: { debt: any, notes?: any[] }) {
    // --- ASSETS ---
    const { headerPath, nombre } = await getEmisor();
    const logoBytes = await downloadAssetPng(headerPath || "certificados/logo-retenciones.png");

    // --- PDF SETUP ---
    const pdfDoc = await PDFDocument.create();
    // A4 Portrait
    let page = pdfDoc.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();

    // Fonts
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const margin = 40;
    let y = height - margin;

    // --- 1. LOGO ---
    if (logoBytes) {
        try {
            const img = await pdfDoc.embedPng(logoBytes);
            // Full width
            const targetW = width;
            const targetH = (img.height / img.width) * targetW;

            // Draw at x=0, top-aligned
            page.drawImage(img, {
                x: 0,
                y: height - targetH,
                width: targetW,
                height: targetH
            });

            // Adjust y below header
            y = height - targetH - 30;
        } catch (e) {
            console.error("Logo embed error", e);
            y -= 20;
        }
    } else {
        y -= 20;
    }

    // --- 2. HEADER: Deuda #ID ---
    const title = `Deuda #${debt.id}`;
    page.drawText(title, {
        x: margin,
        y: y,
        size: 24,
        font: fontBold,
        color: rgb(0, 0, 0),
    });
    y -= 20;

    const createdText = `Creado el ${new Date(debt.created_at).toLocaleString('es-ES')}`;
    page.drawText(createdText, {
        x: margin,
        y: y,
        size: 10,
        font: fontRegular,
        color: rgb(0.5, 0.5, 0.5),
    });
    y -= 40;

    // --- 3. STATUS BAR ---
    const statusBarHeight = 40;
    page.drawRectangle({
        x: margin,
        y: y - statusBarHeight,
        width: width - (margin * 2),
        height: statusBarHeight,
        color: rgb(0.98, 0.98, 0.98),
        borderColor: rgb(0.9, 0.9, 0.9),
        borderWidth: 1,
    });

    const drawLabelValue = (label: string, value: string, xPos: number, yPos: number, valueColor: any = rgb(0, 0, 0), valueBg?: any) => {
        page.drawText(label, { x: xPos, y: yPos, size: 10, font: fontRegular, color: rgb(0.5, 0.5, 0.5) });
        const labelW = fontRegular.widthOfTextAtSize(label, 10);

        const valX = xPos + labelW + 5;

        if (valueBg) {
            const valW = fontBold.widthOfTextAtSize(value, 10);
            page.drawRectangle({
                x: valX - 4,
                y: yPos - 4,
                width: valW + 8,
                height: 18,
                color: valueBg,
                opacity: 0.3
            });
        }

        page.drawText(value, { x: valX, y: yPos, size: 10, font: fontBold, color: valueColor });
        return valX + fontBold.widthOfTextAtSize(value, 10) + 20;
    };

    const statusY = y - (statusBarHeight / 2) - 4;
    let curX = margin + 15;

    // Estado
    const estado = debt.estado || 'Pendiente';
    let estadoBg = rgb(1, 0.9, 0);

    if (estado === 'Pagado') {
        estadoBg = rgb(0, 1, 0);
    } else if (estado === 'En disputa') {
        estadoBg = rgb(1, 0.8, 0.8);
    }

    curX = drawLabelValue("Estado:", estado, curX, statusY, rgb(0, 0, 0), estadoBg);
    page.drawLine({ start: { x: curX - 10, y: statusY - 5 }, end: { x: curX - 10, y: statusY + 12 }, color: rgb(0.8, 0.8, 0.8) });

    // Importe
    const importeTxt = `${debt.importe}€`;
    curX = drawLabelValue("Importe:", importeTxt, curX, statusY, rgb(0, 0, 0));
    page.drawLine({ start: { x: curX - 10, y: statusY - 5 }, end: { x: curX - 10, y: statusY + 12 }, color: rgb(0.8, 0.8, 0.8) });

    // Comunidad
    const commName = debt.comunidad || debt.comunidades?.nombre_cdad || '-';
    const commShort = commName.length > 25 ? commName.substring(0, 25) + '...' : commName;
    drawLabelValue("Comunidad:", commShort, curX, statusY);

    y -= (statusBarHeight + 40);

    // --- 4. DETAILS COLUMNS ---
    const colGap = 40;
    const colWidth = (width - margin * 2 - colGap) / 2;
    const leftColX = margin;
    const rightColX = margin + colWidth + colGap;
    let currentSectionsY = y;

    const drawSectionHeader = (title: string, x: number, y: number) => {
        page.drawText(title, { x: x, y: y, size: 12, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
        page.drawLine({ start: { x: x, y: y - 5 }, end: { x: x + colWidth, y: y - 5 }, color: rgb(0, 0, 0), thickness: 1.5 });
        return y - 25;
    };

    const drawRow = (label: string, value: string, x: number, curY: number) => {
        page.drawText(label, { x: x, y: curY, size: 10, font: fontRegular, color: rgb(0.5, 0.5, 0.5) });
        const valX = x + 80;
        const maxValW = colWidth - 80;
        const valueLines = wrapText(value, maxValW, fontBold, 10);
        valueLines.forEach((line, i) => {
            page.drawText(line, { x: valX, y: curY - (i * 12), size: 10, font: fontBold, color: rgb(0, 0, 0) });
        });
        const heightUsed = Math.max(1, valueLines.length) * 12 + 12;
        page.drawLine({ start: { x, y: curY - (heightUsed - 8) }, end: { x: x + colWidth, y: curY - (heightUsed - 8) }, color: rgb(0.9, 0.9, 0.9) });
        return curY - heightUsed;
    };

    let leftY = drawSectionHeader("INFORMACIÓN DEL DEUDOR", leftColX, currentSectionsY);
    leftY = drawRow("Nombre", debt.nombre_deudor || '-', leftColX, leftY);
    leftY = drawRow("Apellidos", debt.apellidos || '-', leftColX, leftY);
    leftY = drawRow("Teléfono", debt.telefono_deudor || '-', leftColX, leftY);
    leftY = drawRow("Email", debt.email_deudor || '-', leftColX, leftY);

    let rightY = drawSectionHeader("GESTIÓN", rightColX, currentSectionsY);
    const gestorName = debt.gestor_profile?.nombre || (debt.gestor && debt.gestor.length > 20 ? 'Desconocido' : debt.gestor) || '-';
    const fechaNot = debt.fecha_notificacion ? new Date(debt.fecha_notificacion).toLocaleDateString('es-ES') : '-';
    rightY = drawRow("Gestor", gestorName, rightColX, rightY);
    rightY = drawRow("F. Notif.", fechaNot, rightColX, rightY);
    if (debt.estado === 'Pagado') {
        const fechaPago = debt.fecha_pago ? new Date(debt.fecha_pago).toLocaleDateString('es-ES') : '-';
        rightY = drawRow("F. Pago", fechaPago, rightColX, rightY);
    }
    rightY = drawRow("Aviso", debt.aviso || 'No', rightColX, rightY);

    y = Math.min(leftY, rightY) - 40;

    // --- 5. CONCEPTO / TÍTULO ---
    page.drawText("CONCEPTO", { x: margin, y: y, size: 12, font: fontBold });
    page.drawLine({ start: { x: margin, y: y - 5 }, end: { x: width - margin, y: y - 5 }, color: rgb(0, 0, 0), thickness: 1.5 });
    y -= 25;

    const conceptoLines = wrapText(debt.titulo_documento || '', width - (margin * 2) - 20, fontRegular, 10);
    const conceptHeight = (conceptoLines.length * 15) + 20;

    if (y - conceptHeight < 40) {
        page = pdfDoc.addPage([595.28, 841.89]);
        y = height - margin;
    }

    page.drawRectangle({
        x: margin,
        y: y - conceptHeight,
        width: width - (margin * 2),
        height: conceptHeight,
        color: rgb(0.98, 0.98, 0.98),
        borderColor: rgb(0.9, 0.9, 0.9),
        borderWidth: 1
    });

    conceptoLines.forEach((line, i) => {
        page.drawText(line, { x: margin + 10, y: y - 20 - (i * 15), size: 10, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
    });

    y -= (conceptHeight + 30);

    // --- 6. OBSERVACIONES ---
    if (debt.observaciones) {
        const obsLines = wrapText(debt.observaciones || '', width - (margin * 2) - 20, fontRegular, 10);
        const obsHeight = (obsLines.length * 15) + 20;

        if (y - obsHeight < 40) {
            page = pdfDoc.addPage([595.28, 841.89]);
            y = height - margin;
        }

        page.drawText("OBSERVACIONES", { x: margin, y: y, size: 12, font: fontBold });
        page.drawLine({ start: { x: margin, y: y - 5 }, end: { x: width - margin, y: y - 5 }, color: rgb(0, 0, 0), thickness: 1.5 });
        y -= 25;

        page.drawRectangle({
            x: margin,
            y: y - obsHeight,
            width: width - (margin * 2),
            height: obsHeight,
            color: rgb(0.98, 0.98, 0.98),
            borderColor: rgb(0.9, 0.9, 0.9),
            borderWidth: 1
        });

        obsLines.forEach((line, i) => {
            page.drawText(line, { x: margin + 10, y: y - 20 - (i * 15), size: 10, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
        });

        y -= (obsHeight + 30);
    }

    // --- LINK DOCUMENTO ---
    if (debt.documento) {
        if (y - 50 < 40) {
            page = pdfDoc.addPage([595.28, 841.89]);
            y = height - margin;
        }

        page.drawText("DOCUMENTO ADJUNTO", { x: margin, y: y, size: 12, font: fontBold });
        page.drawLine({ start: { x: margin, y: y - 5 }, end: { x: width - margin, y: y - 5 }, color: rgb(0, 0, 0), thickness: 1.5 });
        y -= 25;

        page.drawText(`Enlace: ${debt.documento}`, { x: margin, y: y, size: 9, font: fontRegular, color: rgb(0, 0, 1) });
        y -= 30;
    }

    // --- 7. NOTAS DE GESTIÓN (Timeline) ---
    if (notes && notes.length > 0) {
        if (y - 100 < 40) {
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
            const totalH = (contentLines.length * 12) + 25;

            if (y - totalH < 40) {
                page = pdfDoc.addPage([595.28, 841.89]);
                y = height - margin;
            }

            page.drawText(header, { x: margin, y: y, size: 8, font: fontBold, color: rgb(0.3, 0.3, 0.3) });
            y -= 12;

            contentLines.forEach((line) => {
                page.drawText(line, { x: margin + 5, y: y, size: 9, font: fontRegular, color: rgb(0, 0, 0) });
                y -= 12;
            });

            y -= 10;
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

