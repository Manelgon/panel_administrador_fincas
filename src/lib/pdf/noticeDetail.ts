import { PDFDocument, rgb, StandardFonts, PDFFont } from "pdf-lib";
import { createClient } from "@supabase/supabase-js";
import { getEmisor } from "@/lib/getEmisor";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
        return null;
    }

    const ab = await data.arrayBuffer();
    return Buffer.from(ab);
}

function wrapText(text: string, maxWidth: number, font: PDFFont, size: number): string[] {
    if (!text) return [];
    const paragraphs = text.replace(/\r\n/g, '\n').split('\n');
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

export async function generateNoticeDetailPdf({ notification, entityData }: { notification: any, entityData: any }) {
    const { headerPath, nombre } = await getEmisor();
    const logoBytes = await downloadAssetPng(headerPath || "certificados/logo-retenciones.png");
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([595.28, 841.89]); // A4 Portrait
    const { width, height } = page.getSize();

    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const margin = 40;
    let y = height - margin;

    // --- 1. LOGO (Full Width) ---
    if (logoBytes) {
        try {
            const img = await pdfDoc.embedPng(logoBytes);
            const targetW = width;
            const targetH = (img.height / img.width) * targetW;
            page.drawImage(img, {
                x: 0,
                y: height - targetH,
                width: targetW,
                height: targetH
            });
            y = height - targetH - 30;
        } catch (e) {
            y -= 20;
        }
    } else {
        y -= 20;
    }

    // --- 2. HEADER: Aviso #ID ---
    // User might want "Aviso" or just "Notificación"
    const title = `Aviso #${notification.id.substring(0, 8)}`; // Shorten UUID for display? Or full? Let's use full ID or Title? 
    // The UI shows "Title" in large text. Let's use Title as main header or "Aviso"
    // Requirement says "modal del detalle aviso". Let's use "AVISO"

    page.drawText("AVISO DE SISTEMA", {
        x: margin,
        y: y,
        size: 24,
        font: fontBold,
        color: rgb(0, 0, 0),
    });
    y -= 30;

    page.drawText(notification.title || 'Sin Título', {
        x: margin,
        y: y,
        size: 14,
        font: fontBold,
        color: rgb(0.2, 0.2, 0.2),
    });
    y -= 20;

    const createdText = `Fecha: ${new Date(notification.created_at).toLocaleString('es-ES')}`;
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

    const statusY = y - (statusBarHeight / 2) - 4;

    page.drawText("Estado:", { x: margin + 15, y: statusY, size: 10, font: fontRegular, color: rgb(0.5, 0.5, 0.5) });

    const isRead = notification.is_read;
    const statusTxt = isRead ? 'Leído' : 'Nuevo';
    const statusBg = isRead ? rgb(0.9, 0.9, 0.9) : rgb(1, 0.9, 0);

    const labelW = fontRegular.widthOfTextAtSize("Estado:", 10);
    const valX = margin + 15 + labelW + 10;
    const valW = fontBold.widthOfTextAtSize(statusTxt, 10);

    page.drawRectangle({
        x: valX - 5,
        y: statusY - 5,
        width: valW + 10,
        height: 20,
        color: statusBg,
        opacity: 0.5
    });
    page.drawText(statusTxt, { x: valX, y: statusY, size: 10, font: fontBold, color: rgb(0, 0, 0) });

    // Origen
    if (notification.entity_type) {
        const originLabel = "Origen:";
        const originX = valX + valW + 40;
        page.drawText(originLabel, { x: originX, y: statusY, size: 10, font: fontRegular, color: rgb(0.5, 0.5, 0.5) });

        const originTxt = `${notification.entity_type} #${notification.entity_id}`;
        const oLabW = fontRegular.widthOfTextAtSize(originLabel, 10);
        page.drawText(originTxt, { x: originX + oLabW + 10, y: statusY, size: 10, font: fontBold, color: rgb(0, 0, 0) });
    }

    y -= (statusBarHeight + 40);

    // --- 4. MENSAJE ---
    page.drawText("MENSAJE", { x: margin, y: y, size: 12, font: fontBold });
    page.drawLine({ start: { x: margin, y: y - 5 }, end: { x: width - margin, y: y - 5 }, color: rgb(0, 0, 0), thickness: 1.5 });
    y -= 25;

    const msgLines = wrapText(notification.body || '', width - (margin * 2) - 20, fontRegular, 10);
    const msgHeight = (msgLines.length * 15) + 20;

    page.drawRectangle({
        x: margin,
        y: y - msgHeight,
        width: width - (margin * 2),
        height: msgHeight,
        color: rgb(0.98, 0.98, 0.98),
        borderColor: rgb(0.9, 0.9, 0.9),
        borderWidth: 1
    });

    msgLines.forEach((line, i) => {
        page.drawText(line, {
            x: margin + 10,
            y: y - 20 - (i * 15),
            size: 10,
            font: fontRegular,
            color: rgb(0.2, 0.2, 0.2)
        });
    });

    y -= (msgHeight + 40);

    // --- 5. DETALLES RELACIONADOS (Entity Data) ---
    if (entityData) {
        if (y - 100 < 40) {
            page = pdfDoc.addPage([595.28, 841.89]);
            y = page.getSize().height - 40;
        }

        const entityTitle = notification.entity_type === 'incidencia' ? 'DETALLES DE LA INCIDENCIA'
            : notification.entity_type === 'morosidad' ? 'DETALLES DE LA DEUDA'
                : 'DETALLES RELACIONADOS';

        page.drawText(entityTitle, { x: margin, y: y, size: 12, font: fontBold });
        page.drawLine({ start: { x: margin, y: y - 5 }, end: { x: width - margin, y: y - 5 }, color: rgb(0, 0, 0), thickness: 1.5 });
        y -= 25;

        // Render simple key-value pairs
        const drawRow = (label: string, value: string, curY: number) => {
            page.drawText(label, { x: margin, y: curY, size: 10, font: fontRegular, color: rgb(0.5, 0.5, 0.5) });
            const valX = margin + 120;
            const maxW = width - (margin * 2) - 120;
            const valLines = wrapText(value, maxW, fontBold, 10);

            valLines.forEach((l, i) => {
                page.drawText(l, { x: valX, y: curY - (i * 12), size: 10, font: fontBold, color: rgb(0, 0, 0) });
            });
            return curY - (Math.max(1, valLines.length) * 12 + 8);
        };

        if (notification.entity_type === 'incidencia') {
            y = drawRow("Comunidad", entityData.comunidades?.nombre_cdad || '-', y);
            y = drawRow("Cliente", entityData.nombre_cliente || '-', y);
            y = drawRow("Teléfono", entityData.telefono || '-', y);
            y = drawRow("Mensaje", entityData.mensaje ? (entityData.mensaje.substring(0, 100) + (entityData.mensaje.length > 100 ? '...' : '')) : '-', y);
            y = drawRow("Estado", entityData.resuelto ? 'Resuelto' : 'Pendiente', y);
        } else if (notification.entity_type === 'morosidad') {
            y = drawRow("Comunidad", entityData.comunidades?.nombre_cdad || '-', y);
            y = drawRow("Deudor", `${entityData.nombre_deudor || ''} ${entityData.apellidos || ''}`.trim() || '-', y);
            y = drawRow("Importe", `${entityData.importe}€`, y);
            y = drawRow("Concepto", entityData.titulo_documento || '-', y);
            y = drawRow("Estado", entityData.estado || '-', y);
        }
    }

    // --- FOOTER ---
    const allPages = pdfDoc.getPages();
    for (const p of allPages) {
        const { width: pW } = p.getSize();
        const footerText = nombre || "Administración de Fincas";
        const textW = fontRegular.widthOfTextAtSize(footerText, 8);
        p.drawText(footerText, {
            x: pW / 2 - textW / 2,
            y: 20,
            size: 8,
            font: fontRegular,
            color: rgb(0.6, 0.6, 0.6)
        });
    }

    return await pdfDoc.save();
}
