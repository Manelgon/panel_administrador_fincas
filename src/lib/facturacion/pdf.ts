import { PDFDocument, StandardFonts, rgb, degrees, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { A4, BLACK, BORDER } from "@/lib/pdf/shared";
import { calcularTotales, moneda, type LineaEntrada } from "./calculo";

// PDF de factura con la marca de cada facturador (logo, color, IBAN, pie legal).
// Maqueta basada en las facturas que ya usaban Serincosol y Roberto.

export type DatosPdf = {
    numero: string | null;          // null = borrador
    fecha: string;                  // YYYY-MM-DD
    emisor: { nombre: string; direccion: string | null; cpCiudad: string | null; nif: string; iban: string | null; pieLegal: string | null; color: string };
    cliente: { nombre: string; direccion: string | null; cpCiudad: string | null; nif: string | null };
    lineas: LineaEntrada[];
    retencionPct: number;
    logo?: Uint8Array | null;
    qrPng?: Uint8Array | null;
    rectifica?: { numero: string; motivo: string | null } | null;
};

function hexToRgb(hex: string): RGB {
    const n = parseInt(hex.replace("#", ""), 16);
    return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function fechaEs(iso: string): string {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
}

function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
    const out: string[] = [];
    for (const para of text.split(/\r?\n/)) {
        let line = "";
        for (const word of para.split(/\s+/).filter(Boolean)) {
            const next = line ? `${line} ${word}` : word;
            if (font.widthOfTextAtSize(next, size) <= maxW) line = next;
            else { if (line) out.push(line); line = word; }
        }
        out.push(line);
    }
    return out;
}

type Ctx = { page: PDFPage; font: PDFFont; bold: PDFFont; color: RGB };

/** Celda con fondo de color (bloques de datos, como en las facturas actuales). */
function celdaColor(c: Ctx, x: number, y: number, w: number, text: string, opts: { bold?: boolean; size?: number } = {}) {
    const h = 20;
    c.page.drawRectangle({ x, y, width: w, height: h, color: c.color });
    const f = opts.bold ? c.bold : c.font;
    const size = opts.size ?? 10;
    let t = text;
    while (t && f.widthOfTextAtSize(t, size) > w - 12) t = t.slice(0, -1);
    c.page.drawText(t, { x: x + 6, y: y + 6, size, font: f, color: BLACK });
}

function celdaTabla(c: Ctx, x: number, yTop: number, w: number, h: number, lines: string[], align: "left" | "right" = "left", size = 10) {
    c.page.drawRectangle({ x, y: yTop - h, width: w, height: h, borderColor: BORDER, borderWidth: 0.8 });
    lines.forEach((ln, i) => {
        const tw = c.font.widthOfTextAtSize(ln, size);
        const tx = align === "right" ? x + w - 6 - tw : x + 6;
        c.page.drawText(ln, { x: tx, y: yTop - 14 - i * 13, size, font: c.font, color: BLACK });
    });
}

export async function construirFacturaPdf(d: DatosPdf): Promise<Uint8Array> {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([A4.w, A4.h]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const c: Ctx = { page, font, bold, color: hexToRgb(d.emisor.color) };
    const mx = 45;
    const cw = A4.w - mx * 2;
    const t = calcularTotales(d.lineas, d.retencionPct);
    const conIrpf = d.retencionPct > 0;

    // Logo (arriba a la derecha)
    if (d.logo) {
        try {
            const img = await pdf.embedPng(d.logo);
            const s = Math.min(270 / img.width, 80 / img.height);
            page.drawImage(img, { x: A4.w - mx - img.width * s, y: A4.h - 30 - img.height * s, width: img.width * s, height: img.height * s });
        } catch (e) {
            console.error("[facturacion/pdf] logo no válido:", e);
        }
    }

    // Fecha y número
    let y = A4.h - 140;
    page.drawText("Fecha de emisión", { x: mx, y: y + 6, size: 10, font, color: BLACK });
    celdaColor(c, mx + 110, y, 180, fechaEs(d.fecha));
    y -= 24;
    page.drawText("Nº Factura", { x: mx, y: y + 6, size: 10, font, color: BLACK });
    celdaColor(c, mx + 110, y, 180, d.numero ?? "BORRADOR (sin número)");

    // Emisor y cliente
    y -= 40;
    const colW = 230;
    const xCli = A4.w - mx - colW;
    page.drawText("CLIENTE:", { x: xCli, y: y + 6, size: 10, font, color: BLACK });
    y -= 22;
    const em = [d.emisor.nombre, d.emisor.direccion, d.emisor.cpCiudad, d.emisor.nif].filter(Boolean) as string[];
    const cl = [d.cliente.nombre, d.cliente.direccion, d.cliente.cpCiudad, d.cliente.nif ? `NIF: ${d.cliente.nif}` : null].filter(Boolean) as string[];
    const filas = Math.max(em.length, cl.length);
    for (let i = 0; i < filas; i++) {
        if (em[i]) celdaColor(c, mx, y - i * 24, colW - 50, em[i]);
        if (cl[i]) celdaColor(c, xCli, y - i * 24, colW, cl[i]);
    }
    y -= filas * 24 + 20;

    if (d.rectifica) {
        page.drawText(`Factura rectificativa de ${d.rectifica.numero}${d.rectifica.motivo ? `. Motivo: ${d.rectifica.motivo}` : ""}`,
            { x: mx, y, size: 9, font: bold, color: BLACK });
        y -= 18;
    }

    // Tabla de líneas
    const cols = conIrpf
        ? { cant: 50, conc: 195, imp: 80, iva: 55, irpf: 55, tot: cw - 435 }
        : { cant: 55, conc: 250, imp: 80, iva: 55, irpf: 0, tot: cw - 440 };
    const head: [string, number][] = [["CANTIDAD", cols.cant], ["CONCEPTO", cols.conc], ["IMPORTE", cols.imp], ["IVA", cols.iva]];
    if (conIrpf) head.push(["IRPF", cols.irpf]);
    head.push(["TOTAL", cols.tot]);
    let x = mx;
    page.drawRectangle({ x: mx, y: y - 20, width: cw, height: 20, color: c.color });
    for (const [label, w] of head) {
        const tw = font.widthOfTextAtSize(label, 7);
        page.drawText(label, { x: x + (w - tw) / 2, y: y - 13, size: 7, font, color: BLACK });
        x += w;
    }
    y -= 20;
    for (const l of [...t.lineas, null]) {
        const concepto = l ? wrap(l.concepto, font, 10, cols.conc - 12) : [""];
        const h = Math.max(22, 10 + concepto.length * 13);
        const irpfLinea = l ? Math.round(l.base * d.retencionPct) / 100 : 0;
        const celdas: [string[], number, "left" | "right"][] = [
            [[l ? String(l.cantidad).replace(".", ",") : ""], cols.cant, "left"],
            [concepto, cols.conc, "left"],
            [[l ? moneda(l.base) : ""], cols.imp, "right"],
            [[l ? moneda(l.cuota) : ""], cols.iva, "right"],
        ];
        if (conIrpf) celdas.push([[l ? moneda(irpfLinea) : ""], cols.irpf, "right"]);
        celdas.push([[l ? moneda(l.total - irpfLinea) : ""], cols.tot, "right"]);
        x = mx;
        for (const [txt, w, al] of celdas) { celdaTabla(c, x, y, w, h, txt, al); x += w; }
        y -= h;
    }
    // Total bajo la columna TOTAL
    page.drawRectangle({ x: A4.w - mx - cols.tot, y: y - 22, width: cols.tot, height: 22, color: c.color });
    const tot = moneda(t.aPagar);
    page.drawText(tot, { x: A4.w - mx - 6 - bold.widthOfTextAtSize(tot, 10), y: y - 15, size: 10, font: bold, color: BLACK });
    y -= 60;

    // Resumen
    const resumen: string[][] = [["BASE IMPONIBLE", `${moneda(t.base)} €`]];
    for (const dsg of t.desglose) resumen.push([`IVA ${String(dsg.tipoIva).replace(".", ",")}%`, `${moneda(dsg.cuota)} €`]);
    if (conIrpf) resumen.push([`IRPF ${String(d.retencionPct).replace(".", ",")}%`, `${moneda(t.retencion)} €`]);
    const slot = cw / resumen.length;
    resumen.forEach(([k, v], i) => {
        page.drawText(k, { x: mx + 15 + i * slot, y, size: 10, font: bold, color: BLACK });
        page.drawText(v, { x: mx + 15 + i * slot + bold.widthOfTextAtSize(k, 10) + 8, y, size: 10, font, color: BLACK });
    });
    y -= 40;
    const tf = `${moneda(t.aPagar)} €`;
    const tfw = bold.widthOfTextAtSize(tf, 12);
    page.drawText(tf, { x: A4.w - mx - 40 - tfw, y, size: 12, font: bold, color: BLACK });
    page.drawText("TOTAL FACTURA", { x: A4.w - mx - 40 - tfw - 12 - bold.widthOfTextAtSize("TOTAL FACTURA", 12), y, size: 12, font: bold, color: BLACK });

    // IBAN
    y -= 45;
    if (d.emisor.iban) {
        page.drawText("Nº c/c ingreso", { x: mx + 15, y, size: 10, font, color: BLACK });
        page.drawText(d.emisor.iban, { x: mx + 15, y: y - 24, size: 10, font, color: BLACK });
    }

    // Pie legal (abajo)
    const pie = d.emisor.pieLegal ? wrap(d.emisor.pieLegal, font, 7.5, cw - 30) : [];
    const pieTop = 40 + pie.length * 10;
    pie.forEach((ln, i) => page.drawText(ln, { x: mx + 15, y: pieTop - i * 10, size: 7.5, font, color: BLACK }));

    // QR tributario (encima del pie, a la derecha)
    if (d.qrPng) {
        const qr = await pdf.embedPng(d.qrPng);
        const s = 80;
        page.drawImage(qr, { x: A4.w - mx - s, y: pieTop + 20, width: s, height: s });
        page.drawText("QR tributario", { x: A4.w - mx - s, y: pieTop + 20 + s + 4, size: 7, font, color: BLACK });
    }

    if (!d.numero) {
        page.drawText("BORRADOR", { x: 130, y: 330, size: 90, font: bold, color: rgb(0.85, 0.85, 0.85), rotate: degrees(35), opacity: 0.5 });
    }
    return pdf.save();
}
