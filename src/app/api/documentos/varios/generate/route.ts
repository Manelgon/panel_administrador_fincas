
import { NextResponse } from "next/server";
import { supabaseRouteClient } from "@/lib/supabase/route";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getEmisor } from "@/lib/getEmisor";

// Helper: Service Role Client to bypass RLS for assets
/**
 * Helper to download asset as Uint8Array (Buffer)
 */
async function downloadAssetPng(path: string): Promise<Uint8Array> {
    // Reuse admin client pattern from other route
    let { data, error } = await supabaseAdmin.storage
        .from("doc-assets") // Correct bucket name
        .download(path);

    if (error || !data) {
        // Fallback logic just in case
        if (path.includes('/')) {
            const rootPath = path.split('/').pop()!;
            const retry = await supabaseAdmin.storage
                .from("doc-assets")
                .download(rootPath);
            if (!retry.error) {
                data = retry.data;
                error = null;
            }
        }
    }

    if (error || !data) {
        throw new Error(`Error downloading asset ${path}: ${error?.message}`);
    }
    return new Uint8Array(await data.arrayBuffer());
}

// --- CONSTANTS & HELPERS FOR INVOICE ---
const A4 = { w: 595.28, h: 841.89 };
const YELLOW = rgb(0.98, 0.84, 0.40);
const BORDER = rgb(0.82, 0.82, 0.82);
const BLACK = rgb(0, 0, 0);

// EMISOR se carga dinámicamente desde company_settings en el handler POST

// --- HELPER: DATE FORMAT EU ---
function formatDateEU(v: any) {
    const s = String(v ?? "").trim();
    if (!s) return "";
    // Try YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        const [y, m, d] = s.split("-");
        return `${d}-${m}-${y}`;
    }
    // Try ISO with T
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
        const [datePart] = s.split("T");
        const [y, m, d] = datePart.split("-");
        return `${d}-${m}-${y}`;
    }
    return s;
}

function txt(v: any) { return String(v ?? "").trim(); }
function n(v: any) {
    const x = typeof v === "number" ? v : Number(String(v ?? "").replace(",", "."));
    return Number.isFinite(x) ? x : 0;
}
function moneyES(v: any) { return n(v).toFixed(2).replace(".", ","); }

function drawRect(page: any, x: number, y: number, w: number, h: number, fill?: any) {
    page.drawRectangle({
        x, y, width: w, height: h,
        color: fill ?? rgb(1, 1, 1),
        borderWidth: 1,
        borderColor: BORDER,
    });
}

function drawText(page: any, font: any, x: number, y: number, t: string, size = 10, bold = false) {
    page.drawText(t, { x, y, size, font, color: BLACK });
}

// --- HELPER: DRAW CELL (Suplidos Style) ---
function drawCell(page: any, font: any, bold: any, x: number, y: number, w: number, h: number, txt: string, opts?: { bold?: boolean; align?: "left" | "right" | "center"; bg?: any }) {
    page.drawRectangle({
        x,
        y,
        width: w,
        height: h,
        color: opts?.bg ?? rgb(1, 1, 1),
        borderWidth: 1,
        borderColor: rgb(0.82, 0.82, 0.82),
    });

    const f = opts?.bold ? bold : font;
    const size = 9;

    let tx = x + 6; // left padding
    if (opts?.align === "right") tx = x + w - 6 - f.widthOfTextAtSize(txt || "", size);
    if (opts?.align === "center") tx = x + w / 2 - f.widthOfTextAtSize(txt || "", size) / 2;

    // Suplidos uses fixed vertical offset y + 6 for 9pt font and 20/22px height
    page.drawText(txt ?? "", { x: tx, y: y + 6, size, font: f, color: BLACK });
}

// --- HELPER: WRAP TEXT ---
function wrapText(text: string, font: any, size: number, maxWidth: number) {
    const words = String(text ?? "").split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = "";

    for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        const width = font.widthOfTextAtSize(test, size);
        if (width <= maxWidth) {
            line = test;
        } else {
            if (line) lines.push(line);
            // palabra muy larga -> corte bruto
            if (font.widthOfTextAtSize(w, size) > maxWidth) {
                let chunk = "";
                for (const ch of w) {
                    const t = chunk + ch;
                    if (font.widthOfTextAtSize(t, size) <= maxWidth) chunk = t;
                    else {
                        lines.push(chunk);
                        chunk = ch;
                    }
                }
                line = chunk;
            } else {
                line = w;
            }
        }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [""];
}

// --- HELPER: DRAW YELLOW BLOCK (Suplidos Style) ---
function drawYellowBlock(params: {
    page: any;
    x: number;
    yTop: number;
    w: number;
    lineH: number;
    paddingX: number;
    paddingY: number;
    lines: string[];
    font: any;
    size: number;
    color: any;
    bg: any;
}) {
    const { page, x, yTop, w, lineH, paddingX, paddingY, lines: textLines, font, size, color, bg } = params;

    const h = paddingY * 2 + textLines.length * lineH;
    const y = yTop - h;

    page.drawRectangle({ x, y, width: w, height: h, color: bg, borderColor: BORDER, borderWidth: 1 });

    let ty = yTop - paddingY - size;
    for (const line of textLines) {
        page.drawText(line ?? "", { x: x + paddingX, y: +ty + 2, size, font, color });
        ty -= lineH;
    }

    return { h, yBottom: y };
}

export async function buildFacturaVariosPdf(
    payload: any,
    assets: { logoBytes?: Uint8Array; iban?: string },
    invoiceNumber?: string,
    emisor?: { nombre: string; direccion: string; ciudad: string; cif: string }
) {
    const EMISOR = emisor ?? { nombre: "", direccion: "", ciudad: "", cif: "" };
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([A4.w, A4.h]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const marginX = 55;
    const contentW = A4.w - marginX * 2;

    // 1) Logo/Banner arriba ancho completo (Estilo Certificado)
    let headerBottomY = A4.h - 50;

    if (assets.logoBytes) {
        try {
            const img = await pdfDoc.embedPng(assets.logoBytes);

            // Lo escalamos para que entre en ancho casi completo (A4.w - 20)
            const targetW = A4.w - 20;
            const targetH = (img.height / img.width) * targetW;

            const x = 10;
            const y = A4.h - 10 - targetH;

            page.drawImage(img, { x, y, width: targetW, height: targetH });

            headerBottomY = y - 25; // deja aire debajo
        } catch (e) {
            console.error("Error drawing logo:", e);
        }
    }

    // 2) Fecha de emisión (Yellow Box)
    const fecha = formatDateEU(payload["fecha_emision"] ?? payload["Fecha emisión"] ?? payload["Fecha"]);
    const fechaLabelY = headerBottomY; // Justo debajo del logo

    page.drawText("Fecha de emisión", { x: marginX, y: fechaLabelY, size: 10, font: bold, color: BLACK });
    page.drawRectangle({ x: marginX + 120, y: fechaLabelY - 8, width: 240, height: 18, color: YELLOW });
    page.drawText(fecha || " ", { x: marginX + 128, y: fechaLabelY - 4, size: 10, font, color: BLACK });

    if (invoiceNumber) {
        const invLabel = invoiceNumber;
        const invW = bold.widthOfTextAtSize(invLabel, 10);
        page.drawText(invLabel, { x: A4.w - marginX - invW, y: fechaLabelY, size: 10, font: bold, color: BLACK });
    }

    // 3) Bloques Emisor y Cliente (DOS BLOQUES AMARILLOS, Estilo Suplidos)
    const blocksTop = fechaLabelY - 35;
    const leftW = 240;
    const rightW = 240;
    const gap = (contentW - leftW - rightW); // Auto gap to fill width
    const fontSize = 10;
    const lineH = 16;

    page.drawText("Emisor", { x: marginX, y: blocksTop + 8, size: 10, font: bold, color: BLACK });
    page.drawText("Cliente", { x: marginX + leftW + gap, y: blocksTop + 8, size: 10, font: bold, color: BLACK });

    const emisorLines = [
        EMISOR.nombre,
        EMISOR.direccion,
        EMISOR.ciudad,
        EMISOR.cif,
    ];

    const cliente = txt(payload["cliente"] ?? payload["Cliente"] ?? payload["Nombre Cliente"] ?? "");
    const domicilio = txt(payload["domicilio"] ?? payload["Domicilio"] ?? "");
    const cp = txt(payload["cp"] ?? payload["C.P"] ?? payload["CP"] ?? "");
    const ciudad = txt(payload["ciudad"] ?? payload["Ciudad"] ?? "");
    const provincia = txt(payload["provincia"] ?? payload["Provincia"] ?? "");
    const nif = txt(payload["nif"] ?? payload["NIF"] ?? "");
    const nombreApellidos = txt(payload["nombre_apellidos"] ?? "");

    const clienteLines = [
        // cliente, // Removed as per user request (Community Name should not appear)
        nombreApellidos,
        domicilio,
        `${cp} ${ciudad} ${provincia}`.trim(),
        `NIF: ${nif}`.trim(),
    ].filter(Boolean);

    // Left Block (Emisor)
    const leftBlock = drawYellowBlock({
        page, x: marginX, yTop: blocksTop, w: leftW, lineH, paddingX: 10, paddingY: 8,
        lines: emisorLines, font, size: fontSize, color: BLACK, bg: YELLOW
    });

    // Right Block (Cliente)
    const rightBlock = drawYellowBlock({
        page, x: marginX + leftW + gap, yTop: blocksTop, w: rightW, lineH, paddingX: 10, paddingY: 8,
        lines: clienteLines, font, size: fontSize, color: BLACK, bg: YELLOW
    });

    const blocksBottomY = Math.min(leftBlock.yBottom, rightBlock.yBottom);

    // ===== TABLA (Estilo Suplidos) =====
    const tableTopY = blocksBottomY - 40;

    // Columnas adaptadas para Factura pero estilo Suplidos
    const col = {
        qty: 80,
        concept: 210,
        base: 85,
        iva: 60,
        total: 85,
    };
    // Ajustar concepto para llenar el ancho si sobra espacio, o recalcular para contentW si se prefiere exacto.
    // Suplidos usa anchos fijos, pero aquí intentaremos cuadrar con contentW o usar fijos parecidos.
    // ContentW ~485. Total arriba = 80+210+85+60+85 = 520. Un poco ancho para margen 55.
    // Ajustamos proporcionalmente a contentW.
    const colScale = contentW / 520; // ~0.93
    // O mejor, definimos anchos fijos que sumen contentW (485)
    // qty: 70, concept: 200, base: 75, iva: 60, total: 80 => 485
    const c = {
        qty: 70,
        concept: 200,
        base: 75,
        iva: 60,
        total: 80
    };

    const headerH = 20; // Suplidos
    const rowH = 22;    // Suplidos

    // Header Row
    let x = marginX;
    drawCell(page, font, bold, x, tableTopY, c.qty, headerH, "CANTIDAD", { bold: true, bg: YELLOW }); x += c.qty;
    drawCell(page, font, bold, x, tableTopY, c.concept, headerH, "CONCEPTO", { bold: true, bg: YELLOW }); x += c.concept;
    drawCell(page, font, bold, x, tableTopY, c.base, headerH, "IMPORTE", { bold: true, bg: YELLOW, align: "right" }); x += c.base;
    drawCell(page, font, bold, x, tableTopY, c.iva, headerH, "IVA", { bold: true, bg: YELLOW, align: "right" }); x += c.iva;
    drawCell(page, font, bold, x, tableTopY, c.total, headerH, "TOTAL", { bold: true, bg: YELLOW, align: "right" });

    // Data Rows
    const lines = [
        {
            und: txt(payload["und1"] ?? payload["Unidad 1"] ?? ""),
            desc: txt(payload["descripcion1"] ?? payload["Descripción 1"] ?? payload["Concepto 1"] ?? ""),
            base: n(payload["importe1"] ?? payload["Importe 1"] ?? 0),
            ivaPercent: n(payload["iva1"] ?? payload["IVA 1"] ?? 0),
        },
        {
            und: txt(payload["und2"] ?? payload["Unidad 2"] ?? ""),
            desc: txt(payload["Concepto2"] ?? payload["Descripción 2"] ?? payload["Concepto 2"] ?? ""),
            base: n(payload["importe2"] ?? payload["Importe 2"] ?? 0),
            ivaPercent: n(payload["iva2"] ?? payload["IVA 2"] ?? 0),
        },
        {
            und: txt(payload["und3"] ?? payload["Unidad 3"] ?? ""),
            desc: txt(payload["Concepto3"] ?? payload["Descripción 3"] ?? payload["Concepto 3"] ?? ""),
            base: n(payload["importe3"] ?? payload["Importe 3"] ?? 0),
            ivaPercent: n(payload["iva3"] ?? payload["IVA 3"] ?? 0),
        },
    ].filter(l => l.und || l.desc || l.base || l.ivaPercent);

    let baseTotal = 0;
    let ivaTotal = 0;

    let ry = tableTopY - rowH;

    for (const l of lines) {
        const ivaAmt = l.base * (l.ivaPercent / 100);
        const total = l.base + ivaAmt;
        baseTotal += l.base;
        ivaTotal += ivaAmt;

        let xx = marginX;
        drawCell(page, font, bold, xx, ry, c.qty, rowH, l.und || "", {}); xx += c.qty;
        drawCell(page, font, bold, xx, ry, c.concept, rowH, l.desc || "", {}); xx += c.concept;
        drawCell(page, font, bold, xx, ry, c.base, rowH, moneyES(l.base), { align: "right" }); xx += c.base;
        drawCell(page, font, bold, xx, ry, c.iva, rowH, moneyES(ivaAmt), { align: "right" }); xx += c.iva;
        drawCell(page, font, bold, xx, ry, c.total, rowH, moneyES(total), { align: "right" });

        ry -= rowH;
    }

    // Calculated total
    const sumaFinal = baseTotal + ivaTotal;



    // Caja total: ALINEADA CON LA COLUMNA "TOTAL" (Estilo Suplidos)
    // Coordenada X de la columna Total = marginX + qty + concept + base + iva
    const sumX = marginX + c.qty + c.concept + c.base + c.iva;
    const sumBoxW = c.total;
    const sumBoxH = 30; // Un poco más alto que una fila normal (22) para destacar

    // Pegado a la tabla: ry es el bottom de la última fila.
    // Rect Y = ry - sumBoxH
    const sumY = ry - sumBoxH;

    page.drawRectangle({
        x: sumX,
        y: sumY,
        width: sumBoxW,
        height: sumBoxH,
        color: YELLOW,
        borderWidth: 1,
        borderColor: rgb(0.82, 0.82, 0.82)
    });

    const totalText = moneyES(sumaFinal);
    const totalSize = 12; // Un poco más grande
    const totalW = bold.widthOfTextAtSize(totalText, totalSize);

    // Centrado o derecha en su caja
    // Alineado a la derecha como el resto de la columna, con padding 6
    const tx = sumX + sumBoxW - 6 - totalW;
    // Centrado verticalmente
    const ty = sumY + (sumBoxH - totalSize) / 2 + 2;

    page.drawText(totalText, { x: tx, y: ty, size: totalSize, font: bold, color: BLACK });

    // ===== RESUMEN =====
    const infoY = sumY - 40; // Espacio tras la caja del total
    const col1 = marginX;
    const col2 = marginX + contentW * 0.38;
    const col3 = marginX + contentW * 0.72;

    page.drawText("BASE IMPONIBLE", { x: col1, y: infoY, size: 10, font: bold, color: BLACK });
    page.drawText(`${moneyES(baseTotal)} €`, { x: col1 + 150, y: infoY, size: 10, font, color: BLACK });

    page.drawText("IVA TOTAL", { x: col2, y: infoY, size: 10, font: bold, color: BLACK });
    page.drawText(`${moneyES(ivaTotal)} €`, { x: col2 + 95, y: infoY, size: 10, font, color: BLACK });

    page.drawText("TOTAL FACTURA", { x: col3, y: infoY, size: 10, font: bold, color: BLACK });
    page.drawText(`${moneyES(sumaFinal)} €`, { x: col3 + 120, y: infoY, size: 10, font: bold, color: BLACK });

    // IBAN
    const iban = txt(assets.iban ?? "");
    if (iban) {
        const ibanY = infoY - 60;
        page.drawText("Nº c/c ingreso", { x: marginX, y: ibanY, size: 10, font: bold, color: BLACK });
        page.drawText(iban, { x: marginX, y: ibanY - 22, size: 10, font, color: BLACK });
    }

    // Global Footer
    const footerText = "Serincosol | Administración de Fincas Málaga";
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

    return await pdfDoc.save({ useObjectStreams: true });
}

// --- HELPER FUNCTIONS FOR CERTIFICATE ---


function fmtDate(val: any) {
    const s = String(val ?? "").trim();
    if (!s) return "";
    // si viene ISO yyyy-mm-dd lo dejamos
    return s;
}

function safe(val: any) {
    return String(val ?? "").trim();
}

/**
 * Dibuja una línea justificada distribuyendo el espacio sobrante entre palabras.
 * Si es la última línea (isLastLine=true), dibuja alineado a la izquierda normal.
 */
function drawJustifiedLine(
    page: any,
    text: string,
    x: number,
    y: number,
    size: number,
    font: any,
    maxWidth: number,
    color: any,
    isLastLine: boolean
) {
    const words = text.split(/\s+/).filter(Boolean);

    // Fallback para línea única, vacía o última línea: normal left align
    if (isLastLine || words.length <= 1) {
        page.drawText(text, { x, y, size, font, color });
        return;
    }

    const totalWordWidth = words.reduce((acc, w) => acc + font.widthOfTextAtSize(w, size), 0);
    const extraSpace = maxWidth - totalWordWidth;
    const gap = extraSpace / (words.length - 1);

    let currentX = x;
    for (let i = 0; i < words.length; i++) {
        const w = words[i];
        page.drawText(w, { x: currentX, y, size, font, color });
        currentX += font.widthOfTextAtSize(w, size) + gap;
    }
}

/**
 * assets.logoBytes y assets.selloBytes vienen descargados de tu bucket privado (doc-assets).
 */
export async function buildPagosAlDiaPdf(payload: any, assets: { logoBytes: Uint8Array; selloBytes: Uint8Array }) {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([A4.w, A4.h]);

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const BLACK = rgb(0, 0, 0);

    // Layout
    const marginX = 90;        // más margen (texto estrecho)
    const maxW = A4.w - marginX * 2;

    // Zona segura inferior para sello+firma (para que nunca solape)
    const FOOTER_SAFE_H = 200; // un poco más de zona segura inferior
    const footerTopY = FOOTER_SAFE_H;

    // 1) Banner/logo arriba a ancho completo con margen (como el ejemplo)
    let headerBottomY = A4.h - 50;

    try {
        const headerImg = await pdfDoc.embedPng(assets.logoBytes);

        // Lo escalamos para que entre en ancho casi completo
        const targetW = A4.w - 20; // margen visual lateral
        const targetH = (headerImg.height / headerImg.width) * targetW;

        const x = 10;
        const y = A4.h - 10 - targetH;

        page.drawImage(headerImg, { x, y, width: targetW, height: targetH });

        headerBottomY = y - 20; // deja aire debajo
    } catch {
        // si falla, seguimos sin romper
    }

    // 2) Título centrado
    const title = "CERTIFICADO DE PAGOS AL DÍA";
    const titleSize = 16;
    const titleW = bold.widthOfTextAtSize(title, titleSize);
    page.drawText(title, {
        x: (A4.w - titleW) / 2,
        y: headerBottomY - 40,   // baja un poco el título
        size: titleSize,
        font: bold,
        color: BLACK,
    });

    // 3) Construcción texto (usa tus campos reales)

    const comunidad = safe(payload["nombre_comunidad"] ?? payload["cliente"] ?? "________________");
    const cliente = safe(payload["nombre_apellidos"] ?? payload["cliente"] ?? "________________");
    const tipoInmueble = safe(payload["tipo_inmueble"] || "inmueble");

    const nif = safe(payload["nif"] ?? "");
    const domicilio = safe(payload["domicilio"] ?? "");
    const cp = safe(payload["cp"] ?? "");
    const ciudad = safe(payload["ciudad"] ?? payload["Ciudad"] ?? "");
    const fecha = formatDateEU(payload["fecha_emision"]);

    const p1 =
        `Roberto Díaz Rodríguez, Administrador de Fincas colegiado en el Ilustre Colegio Territorial de ` +
        `Administradores de Fincas de Málaga, actuando en calidad de Secretario–Administrador de la Comunidad de ` +
        `Propietarios ${comunidad}, sita en ${domicilio}.`;

    const p2 =
        `Que, consultados los libros contables de la mencionada comunidad de propietarios, D./Dª ${cliente}, ` +
        `con DNI/NIF ${nif}, figura como propietario/a del ${tipoInmueble} situado en ${domicilio}, ` +
        `código postal ${cp}, en la ciudad de ${ciudad}, certifico, en base al art. 9.1 e) de la Ley 49/1960, ` +
        `de 21 de Julio, de Propiedad Horizontal, que el ${tipoInmueble} se encuentra, a día de hoy, al corriente de pago de todos los recibos ordinarios ` +
        `o extraordinarios de cuotas de comunidad, salvo devolución bancaria en plazo excepcional.`;

    // 4) Render texto con cursor y wrap, respetando footer safe
    let y = headerBottomY - 95; // empieza el texto más abajo
    const bodySize = 11;
    const lineH = 18;          // más aire entre líneas

    const drawPara = (txt: string) => {
        const lines = wrapText(txt, font, bodySize, maxW);
        for (let i = 0; i < lines.length; i++) {
            const ln = lines[i];
            // Si vamos a invadir la zona de sello/firma, paramos
            if (y <= footerTopY + 20) return;

            const isLastLine = (i === lines.length - 1);
            drawJustifiedLine(page, ln, marginX, y, bodySize, font, maxW, BLACK, isLastLine);

            y -= lineH;
        }
        y -= 10;
    };

    drawPara(p1);

    // CERTIFICO centrado
    const cert = "CERTIFICO";
    const certSize = 13;
    const certW = bold.widthOfTextAtSize(cert, certSize);
    if (y > footerTopY + 80) {
        page.drawText(cert, { x: (A4.w - certW) / 2, y, size: certSize, font: bold, color: BLACK });
        y -= 34; // más aire
    }

    drawPara(p2);

    // Línea final con fecha (si hay espacio, si no, igual no pisa sello)
    const cierre = `Lo que certifico a los efectos oportunos en Málaga a ${fecha || "________________"}.`;
    drawPara(cierre);

    // 5) Sello + firma anclados abajo, SIEMPRE en zona segura
    try {
        const sealImg = await pdfDoc.embedPng(assets.selloBytes);
        const sealW = 150;
        const sealH = (sealImg.height / sealImg.width) * sealW;

        const sx = marginX;
        const sy = 155; // fija abajo (no depende del texto)
        page.drawImage(sealImg, { x: sx, y: sy, width: sealW, height: sealH });
    } catch { }

    page.drawText("Roberto Díaz Rodríguez", { x: marginX, y: 110, size: 11, font: bold, color: BLACK });
    page.drawText("Administrador de fincas", { x: marginX, y: 92, size: 11, font, color: BLACK });

    // Global Footer
    const footerText = "Serincosol | Administración de Fincas Málaga";
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

    return await pdfDoc.save({ useObjectStreams: true });
}
// --- END HELPER ---

export async function POST(req: Request) {
    const supabase = await supabaseRouteClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const payload = await req.json().catch(() => null);
    if (!payload) {
        return NextResponse.json({ error: "Body inválido" }, { status: 400 });
    }

    try {
        // 0) Leer datos del emisor desde BD
        const emisorData = await getEmisor();
        const EMISOR = {
            nombre: emisorData.nombre,
            direccion: emisorData.direccion,
            ciudad: emisorData.ciudad,
            cif: emisorData.cif,
        };

        // 1. Load Assets
        const assets: { logo?: Uint8Array; sello?: Uint8Array; iban?: string } = {};

        // Header: usa el de company_settings, fallback al header por defecto
        const headerStoragePath = emisorData.headerPath || "certificados/logo-retenciones.png";
        assets.logo = await downloadAssetPng(headerStoragePath);
        assets.sello = await downloadAssetPng("certificados/sello-retenciones.png");

        // 2) Fetch Settings (IBAN)
        assets.iban = "ES37 0081 7442 0600 0119 3630"; // Default hardcoded just in case
        const { data: settingsData } = await supabase
            .from("document_settings")
            .select("setting_key, setting_value")
            .eq("doc_key", "facturas_varias");

        if (settingsData) {
            const row = settingsData.find(r => r.setting_key === "iban");
            if (row) assets.iban = row.setting_value;
        }

        let pdfBytesFactura: Uint8Array | null = null;
        let invoiceNumber: string | null = null;
        const generateFactura = true; // Assuming factura is always generated for this route

        if (generateFactura) {
            // Get next invoice number
            const { data: nextInv, error: invErr } = await supabaseAdmin.rpc("get_next_invoice_number", {
                sequence_id: "factura_varios"
            });

            if (!invErr && nextInv) {
                const currentYear = new Date().getFullYear();
                invoiceNumber = `CERT${currentYear}${String(nextInv).padStart(6, '0')}`;
            }

            pdfBytesFactura = await buildFacturaVariosPdf(payload, {
                logoBytes: assets.logo,
                iban: assets.iban
            }, invoiceNumber || undefined, EMISOR);
        }

        // --- DOC 2: CERTIFICADO (Official Style using Builder) ---
        const pdfBytesCertificado = await buildPagosAlDiaPdf(payload, { logoBytes: assets.logo!, selloBytes: assets.sello! });

        // (Proceed to upload...)

        // Calculate total amount for filename
        // Replicating frontend logic to be safe or use what frontend sent?
        // Frontend sends "suma_final" which is pre-calculated string "1050.50".
        // We can trust it or fallback to recompute. Let's try payload.suma_final first.
        let importeTotal = payload["suma_final"];
        if (!importeTotal) {
            // Fallback Compute
            const calc = (v: any) => Number(String(v || "0").replace(",", ".")) || 0;
            let sumBase = 0;
            let vatTotal = 0;
            for (let i = 1; i <= 3; i++) {
                const base = calc(payload[`importe${i}`]);
                const ivap = calc(payload[`iva${i}`]);
                sumBase += base;
                vatTotal += base * (ivap / 100);
            }
            importeTotal = (sumBase + vatTotal).toFixed(2);
        }

        // Clean String
        const clean = (s: string) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9\-_.]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
        const now = new Date();
        const dateStr = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;

        const clienteInfo = clean(payload["cliente"] || "Cliente");
        const nombrePerson = clean(payload["nombre_apellidos"] || "Usuario");

        // FCTA_NOMBRE cliente_importe total_fecha europea actual
        const fileFactura = `varios/FCTA_${clienteInfo}_${importeTotal}_${dateStr}.pdf`;

        // CERT_nombre y apellidos_fecha europea actual
        const fileCertificado = `varios/CERT_${nombrePerson}_${dateStr}.pdf`;

        // Upload Factura
        if (pdfBytesFactura) {
            const { error: uploadErr1 } = await supabaseAdmin.storage
                .from("documentos_administrativos")
                .upload(fileFactura, Buffer.from(pdfBytesFactura), { contentType: "application/pdf", upsert: true });

            if (uploadErr1) throw new Error("Error uploading Factura: " + uploadErr1.message);
        }


        // Upload Certificado
        const { error: uploadErr2 } = await supabaseAdmin.storage
            .from("documentos_administrativos")
            .upload(fileCertificado, Buffer.from(pdfBytesCertificado), { contentType: "application/pdf", upsert: true });

        if (uploadErr2) throw new Error("Error uploading Certificado: " + uploadErr2.message);


        // 5. Insert Records (TWO Rows)
        const commonPayload = { ...payload };

        // Record 1: Factura
        let recFactura = null;
        let signed1 = null;
        if (pdfBytesFactura) {
            const { data: newRecFactura, error: dbErr1 } = await supabase.from("doc_submissions").insert({
                user_id: user.id,
                title: `Factura ${payload.cliente || payload.nombre_comunidad || "Varios"}`,
                doc_key: "facturas_varias",
                pdf_path: fileFactura,
                payload: commonPayload,
                invoice_number: invoiceNumber
            }).select().single();

            if (dbErr1) throw new Error("DB Error Factura: " + dbErr1.message);
            recFactura = newRecFactura;

            signed1 = await supabaseAdmin.storage
                .from("documentos_administrativos")
                .createSignedUrl(fileFactura, 60 * 60);
        }


        // Record 2: Certificado
        const { data: recCert, error: dbErr2 } = await supabase.from("doc_submissions").insert({
            user_id: user.id,
            title: `Certificado Pagos - ${payload.cliente || "Sin Nombre"}`,
            doc_key: "facturas_varias",
            pdf_path: fileCertificado,
            payload: commonPayload,
        }).select().single();

        if (dbErr2) throw new Error("DB Error Certificado: " + dbErr2.message);


        // 6. Return Signed URLs for both
        const signed2 = await supabaseAdmin.storage
            .from("documentos_administrativos")
            .createSignedUrl(fileCertificado, 60 * 60);

        return NextResponse.json({
            success: true,
            submissionIdFactura: recFactura?.id || null,
            submissionIdCertificado: recCert.id,
            pdfUrlFactura: signed1?.data?.signedUrl || null,
            pdfUrlCertificado: signed2.data?.signedUrl
        });

    } catch (e: any) {
        console.error("Error generating Varios PDF:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
