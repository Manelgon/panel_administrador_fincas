import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
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

// Helper for yellow blocks (consistent with Suplidos/Facturas)
const drawYellowBlock = (page: any, x: number, y: number, w: number, h: number, title: string, value: string, font: any, bold: any) => {
    page.drawRectangle({ x, y, width: w, height: h, color: rgb(0.98, 0.8, 0.08) });
    page.drawText(title, { x: x + 5, y: y + h - 12, size: 7, font: bold, color: rgb(0, 0, 0) });
    page.drawText(value, { x: x + 5, y: y + 8, size: 10, font: bold, color: rgb(0, 0, 0) });
};

// Common Layout Boilerplate
async function setupPdf(title: string) {
    const { headerPath, nombre } = await getEmisor();
    const logoBytes = await downloadAssetPng(headerPath || "certificados/logo-retenciones.png");
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 Portrait
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const margin = 50;
    let y = height - 40;

    if (logoBytes) {
        try {
            const img = await pdfDoc.embedPng(logoBytes);
            const targetW = width - (margin * 2);
            const targetH = (img.height / img.width) * targetW;
            page.drawImage(img, { x: margin, y: y - targetH, width: targetW, height: targetH });
            y -= (targetH + 20);
        } catch (e) { y -= 40; }
    } else { y -= 40; }

    const titleW = bold.widthOfTextAtSize(title, 18);
    page.drawText(title, { x: (width - titleW) / 2, y, size: 18, font: bold });
    y -= 40;

    return { pdfDoc, page, font, bold, width, height, margin, y, nombre };
}

async function addFooter(pdfDoc: any, font: any, nombre: string) {
    const footerText = nombre || "Administración de Fincas";
    const pages = pdfDoc.getPages();
    for (const p of pages) {
        const { width: pW } = p.getSize();
        const textW = font.widthOfTextAtSize(footerText, 8);
        p.drawText(footerText, { x: pW / 2 - textW / 2, y: 20, size: 8, font, color: rgb(0.5, 0.5, 0.5) });
    }
}

// 1. INCIDENCIAS
export async function generateIncidentDetailPdf(incident: any) {
    const { pdfDoc, page, font, bold, width, margin, y: startY, nombre } = await setupPdf("DETALLE DE INCIDENCIA");
    let y = startY;

    // KPI Blocks (Status, Urgency)
    const blockW = (width - (margin * 2) - 10) / 2;
    drawYellowBlock(page, margin, y - 40, blockW, 40, "ESTADO", incident.resuelto ? "RESUELTO" : "PENDIENTE", font, bold);
    drawYellowBlock(page, margin + blockW + 10, y - 40, blockW, 40, "URGENCIA", (incident.urgencia || "MEDIA").toUpperCase(), font, bold);
    y -= 60;

    // Info Table
    const drawRow = (label: string, value: string, curY: number) => {
        page.drawText(label, { x: margin, y: curY, size: 9, font: bold });
        page.drawText(value || "-", { x: margin + 120, y: curY, size: 9, font });
        return curY - 20;
    };

    y = drawRow("Ticket ID:", `#${incident.id}`, y);
    y = drawRow("Comunidad:", incident.comunidades?.nombre_cdad || incident.comunidad || "-", y);
    y = drawRow("Cliente:", incident.nombre_cliente, y);
    y = drawRow("Teléfono:", incident.telefono, y);
    y = drawRow("Email:", incident.email, y);
    y = drawRow("Fecha Créacion:", new Date(incident.created_at).toLocaleString('es-ES'), y);
    if (incident.resuelto && incident.dia_resuelto) {
        y = drawRow("Fecha Resolución:", new Date(incident.dia_resuelto).toLocaleString('es-ES'), y);
        y = drawRow("Resuelto por:", incident.resolver?.nombre || "-", y);
    }
    y = drawRow("Gestor Asignado:", incident.gestor?.nombre || "-", y);
    y = drawRow("Recibido por:", incident.receptor?.nombre || "-", y);

    y -= 20;
    page.drawText("MENSAJE DEL CLIENTE", { x: margin, y, size: 10, font: bold });
    y -= 15;

    const lines = wrapText(incident.mensaje, width - (margin * 2), font, 9);
    lines.forEach(line => {
        page.drawText(line, { x: margin, y, size: 9, font });
        y -= 12;
    });

    await addFooter(pdfDoc, font, nombre);
    return await pdfDoc.save();
}

// 2. MOROSIDAD (Deuda)
export async function generateDebtDetailPdf(debt: any) {
    const { pdfDoc, page, font, bold, width, margin, y: startY, nombre } = await setupPdf("DETALLE DE DEUDA");
    let y = startY;

    drawYellowBlock(page, margin, y - 40, width - (margin * 2), 40, "ESTADO", debt.pagado ? "PAGADO" : "PENDIENTE", font, bold);
    y -= 60;

    const drawRow = (label: string, value: string, curY: number) => {
        page.drawText(label, { x: margin, y: curY, size: 10, font: bold });
        page.drawText(value || "-", { x: margin + 140, y: curY, size: 10, font });
        return curY - 25;
    };

    y = drawRow("Deuda ID:", `#${debt.id}`, y);
    y = drawRow("Comunidad:", debt.comunidades?.nombre_cdad || debt.comunidad || "-", y);
    y = drawRow("Propietario:", debt.propietario, y);
    y = drawRow("Inmueble:", debt.propiedad, y);
    y = drawRow("Importe:", `${debt.importe?.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`, y);
    y = drawRow("Fecha Envío:", new Date(debt.created_at).toLocaleString('es-ES'), y);

    if (debt.pagado && debt.fecha_pago) {
        y = drawRow("Fecha Pago:", new Date(debt.fecha_pago).toLocaleString('es-ES'), y);
        y = drawRow("Registrado por:", debt.resolver?.nombre || "-", y);
    }

    y -= 20;
    page.drawText("OBSERVACIONES", { x: margin, y, size: 10, font: bold });
    y -= 15;

    const lines = wrapText(debt.observaciones || "Sin observaciones", width - (margin * 2), font, 9);
    lines.forEach(line => {
        page.drawText(line, { x: margin, y, size: 9, font });
        y -= 12;
    });

    await addFooter(pdfDoc, font, nombre);
    return await pdfDoc.save();
}

// 3. AVISOS (Notificaciones)
export async function generateNoticeDetailPdf(notice: any) {
    const { pdfDoc, page, font, bold, width, margin, y: startY, nombre } = await setupPdf("DETALLE DE AVISO");
    let y = startY;

    drawYellowBlock(page, margin, y - 40, width - (margin * 2), 40, "ASUNTO", notice.title?.toUpperCase() || "SIN TÍTULO", font, bold);
    y -= 60;

    const drawRow = (label: string, value: string, curY: number) => {
        page.drawText(label, { x: margin, y: curY, size: 10, font: bold });
        page.drawText(value || "-", { x: margin + 140, y: curY, size: 10, font });
        return curY - 25;
    };

    y = drawRow("Aviso ID:", `#${notice.id}`, y);
    y = drawRow("Destinatario:", notice.recipient_name || notice.recipient_id || "-", y);
    y = drawRow("Tipo:", notice.type || "General", y);
    y = drawRow("Estado:", notice.read ? "Leído" : "No leído", y);
    y = drawRow("Fecha Envío:", new Date(notice.created_at).toLocaleString('es-ES'), y);
    if (notice.read && notice.read_at) {
        y = drawRow("Fecha Lectura:", new Date(notice.read_at).toLocaleString('es-ES'), y);
    }

    y -= 20;
    page.drawText("CONTENIDO DEL MENSAJE", { x: margin, y, size: 10, font: bold });
    y -= 15;

    const lines = wrapText(notice.message, width - (margin * 2), font, 9);
    lines.forEach(line => {
        page.drawText(line, { x: margin, y, size: 9, font });
        y -= 12;
    });

    await addFooter(pdfDoc, font, nombre);
    return await pdfDoc.save();
}
