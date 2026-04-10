import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getEmisor } from "@/lib/getEmisor";

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

function wrapText(text: string, maxWidth: number, font: any, size: number): string[] {
    if (!text) return [];
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

export async function generateActivitiesPdf({
    activities
}: {
    activities: any[];
}) {
    const { headerPath, nombre } = await getEmisor();
    const logoBytes = await downloadAssetPng(headerPath || "certificados/logo-retenciones.png");

    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([841.89, 595.28]); // A4 Landscape
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const margin = 30;
    let y = height - 40;

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

    const title = "REGISTRO DE ACTIVIDAD";
    const titleSize = 16;
    const titleW = bold.widthOfTextAtSize(title, titleSize);

    page.drawText(title, {
        x: (width - titleW) / 2,
        y: y,
        size: titleSize,
        font: bold,
        color: rgb(0, 0, 0),
    });

    y -= 30;

    const summaryHeight = 25;
    page.drawRectangle({
        x: margin,
        y: y - summaryHeight,
        width: width - (margin * 2),
        height: summaryHeight,
        color: rgb(0.96, 0.96, 0.96),
    });

    const totalText = `Total Registros: ${activities.length}`;
    page.drawText(totalText, {
        x: margin + 10,
        y: y - summaryHeight + 8,
        size: 10,
        font: bold,
        color: rgb(0, 0, 0),
    });

    y -= (summaryHeight + 20);

    const minRowHeight = 25;
    const fontSize = 8;

    const cols = [
        { label: "Usuario", x: margin, w: 120 },
        { label: "Acción", x: margin + 120, w: 80 },
        { label: "Entidad", x: margin + 200, w: 100 },
        { label: "Nombre Entidad", x: margin + 300, w: 150 },
        { label: "Detalles", x: margin + 450, w: 230 },
        { label: "Fecha", x: margin + 680, w: 100 },
    ];

    const drawTableHeader = (currentPage: any, curY: number) => {
        currentPage.drawRectangle({ x: margin, y: curY - 5, width: width - (margin * 2), height: minRowHeight, color: rgb(0.98, 0.8, 0.08) });
        cols.forEach(col => {
            currentPage.drawText(col.label, { x: col.x + 2, y: curY + 5, size: 9, font: bold, color: rgb(0, 0, 0) });
        });
    };

    drawTableHeader(page, y);
    y -= minRowHeight;

    const getActionLabel = (action: string) => {
        const labels: any = {
            create: 'Crear',
            update: 'Actualizar',
            delete: 'Eliminar',
            mark_paid: 'Marcar Pago',
            toggle_active: 'Cambiar Estado',
            update_password: 'Cambiar Contraseña',
            clock_in: 'Fichaje Entrada',
            clock_out: 'Fichaje Salida',
            generate: 'Generar',
            read: 'Leído'
        };
        return labels[action] || action;
    };

    const getEntityLabel = (entityType: string) => {
        const labels: any = {
            comunidad: 'Comunidad',
            incidencia: 'Incidencia',
            morosidad: 'Morosidad',
            profile: 'Perfil',
            fichaje: 'Fichaje',
            documento: 'Documento',
            aviso: 'Aviso'
        };
        return labels[entityType] || entityType;
    };

    // Improve wrapText to handle long strings without spaces (like JSON)
    const wrapTextForce = (text: string, maxWidth: number, font: any, size: number): string[] => {
        if (!text) return [];
        const lines: string[] = [];

        // Sanitize
        text = text.replace(/[\r\n]+/g, " ");

        const words = text.split(' ');
        let currentLine = "";

        for (let i = 0; i < words.length; i++) {
            let word = words[i];

            // Check if word itself is too long
            const wordWidth = font.widthOfTextAtSize(word, size);
            if (wordWidth > maxWidth) {
                // Force split long word
                if (currentLine.length > 0) {
                    lines.push(currentLine);
                    currentLine = "";
                }

                let remaining = word;
                while (remaining.length > 0) {
                    let sliceLen = remaining.length;
                    while (sliceLen > 0 && font.widthOfTextAtSize(remaining.substring(0, sliceLen), size) > maxWidth) {
                        sliceLen--;
                    }
                    if (sliceLen === 0) sliceLen = 1; // Anti-freeze
                    lines.push(remaining.substring(0, sliceLen));
                    remaining = remaining.substring(sliceLen);
                }
                continue;
            }

            const width = font.widthOfTextAtSize(currentLine + (currentLine ? " " : "") + word, size);
            if (width < maxWidth) {
                currentLine += (currentLine ? " " : "") + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        if (currentLine) lines.push(currentLine);
        return lines;
    };

    for (let index = 0; index < activities.length; index++) {
        const act = activities[index];

        const usuario = act.user_name || '-';
        const accion = getActionLabel(act.action);
        const entidad = getEntityLabel(act.entity_type);
        const nombreEntidad = act.entity_name || '-';
        // Pretty print JSON safely to string, then remove breaks
        const detalles = typeof act.details === 'string' ? act.details : JSON.stringify(act.details);
        const fecha = new Date(act.created_at).toLocaleString('es-ES');

        const detailsWidth = cols[4].w - 6;
        const detailsLines = wrapTextForce(detalles || '', detailsWidth, font, fontSize);

        const lineHeight = fontSize + 4;
        // Padding top 6, bottom 6
        const textBlockHeight = Math.max(minRowHeight, (detailsLines.length * lineHeight) + 12);

        // Check Page Break
        if (y - textBlockHeight < 40) {
            page = pdfDoc.addPage([841.89, 595.28]);
            y = page.getSize().height - 40;
            drawTableHeader(page, y);
            y -= minRowHeight;
        }

        // Draw Row Background
        if (index % 2 !== 0) {
            page.drawRectangle({
                x: margin,
                y: y - textBlockHeight,
                width: width - (margin * 2),
                height: textBlockHeight,
                color: rgb(0.98, 0.98, 0.98)
            });
        }

        // Draw Border Line (Optional, or just bottom border)
        page.drawLine({
            start: { x: margin, y: y - textBlockHeight },
            end: { x: width - margin, y: y - textBlockHeight },
            color: rgb(0.9, 0.9, 0.9),
            thickness: 0.5
        });

        // Vertical Alignment: Top aligned with padding
        const textY = y - 10;

        page.drawText(usuario.substring(0, 25), { x: cols[0].x + 2, y: textY, size: fontSize, font });
        page.drawText(accion, { x: cols[1].x + 2, y: textY, size: fontSize, font });
        page.drawText(entidad, { x: cols[2].x + 2, y: textY, size: fontSize, font });
        page.drawText(nombreEntidad.substring(0, 30), { x: cols[3].x + 2, y: textY, size: fontSize, font });

        // Draw Wrapped Details
        detailsLines.forEach((line, i) => {
            page.drawText(line, {
                x: cols[4].x + 2,
                y: textY - (i * lineHeight),
                size: fontSize,
                font
            });
        });

        page.drawText(fecha, { x: cols[5].x + 2, y: textY, size: fontSize, font });

        y -= textBlockHeight;
    }

    const footerText = nombre || "Administración de Fincas";
    const allPages = pdfDoc.getPages();
    for (const p of allPages) {
        const { width: pW } = p.getSize();
        const textW = font.widthOfTextAtSize(footerText, 8);
        p.drawText(footerText, {
            x: pW / 2 - textW / 2,
            y: 20,
            size: 8,
            font,
            color: rgb(0.5, 0.5, 0.5),
        });
    }

    return await pdfDoc.save();
}
