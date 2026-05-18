import { NextResponse } from "next/server";
import { supabaseRouteClient } from "@/lib/supabase/route";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getEmisor } from "@/lib/getEmisor";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import {
    Document,
    Packer,
    Paragraph,
    HeadingLevel,
    AlignmentType,
    Table,
    TableRow,
    TableCell,
    TextRun,
    WidthType,
    BorderStyle,
    ImageRun,
} from "docx";

export const runtime = "nodejs";
export const maxDuration = 60;

const DOC_KEY = "presupuesto_anual";
const TITLE = "Presupuesto ordinario anual";
const BUCKET = "documentos_administrativos";

type Partida = {
    nombre: string;
    gasto_anterior: number;
    presupuesto_propuesto: number;
    variacion_eur: number;
    variacion_pct: number;
};

type CuotaActual = {
    tipo_finca: string;
    num_fincas: number;
    cuota_mensual: number;
    total_mensual: number;
    total_anual: number;
};

type SubidaPorTipo = {
    tipo_finca: string;
    cuota_actual: number;
    cuota_nueva: number;
    subida_eur: number;
    subida_pct: number;
};

interface Analysis {
    comunidad: string;
    ejercicio_analizado: string;
    introduccion: string;
    partidas: Partida[];
    total_gasto_anterior: number;
    total_presupuesto_propuesto: number;
    cuotas_actuales: CuotaActual[];
    ingresos_previstos_anual: number;
    resultado_estimado: { ingresos: number; gastos: number; resultado: number };
    subida_propuesta: {
        pct_medio_ponderado: number;
        por_tipo: SubidaPorTipo[];
    };
    justificacion: string[];
    observaciones: string[];
    advertencias: string[];
}

function n(v: any) {
    const x = typeof v === "number" ? v : Number(String(v ?? "0").replace(",", "."));
    return Number.isFinite(x) ? x : 0;
}
function moneyES(v: any) {
    return n(v).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}
function pctES(v: any) {
    return n(v).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " %";
}
function clean(s: string) {
    return String(s || "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-zA-Z0-9\-_.]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "");
}

async function downloadAssetBytes(path: string): Promise<Uint8Array | null> {
    if (!path) return null;
    try {
        const { data, error } = await supabaseAdmin.storage.from("doc-assets").download(path);
        if (error || !data) return null;
        return new Uint8Array(await data.arrayBuffer());
    } catch {
        return null;
    }
}

// ---- Charts (quickchart.io → PNG bytes) ----

const PALETTE = [
    "#F6B73C", "#E8852B", "#C95F2F", "#3F7E83", "#5FA8AD", "#7BC4B5",
    "#9DB87A", "#D4C24C", "#A86CA1", "#7461A8", "#566EAA", "#8794C2",
    "#C0606B", "#D9989B", "#7A7A7A", "#B5B5B5",
];

async function fetchChartPng(config: any, width = 900, height = 500): Promise<Uint8Array | null> {
    try {
        const url = "https://quickchart.io/chart";
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chart: config,
                width,
                height,
                format: "png",
                backgroundColor: "white",
                devicePixelRatio: 2,
            }),
        });
        if (!res.ok) return null;
        return new Uint8Array(await res.arrayBuffer());
    } catch {
        return null;
    }
}

async function buildPieChart(partidas: Partida[]): Promise<Uint8Array | null> {
    const items = partidas.filter(p => n(p.presupuesto_propuesto) > 0);
    if (!items.length) return null;
    return fetchChartPng({
        type: "doughnut",
        data: {
            labels: items.map(p => p.nombre),
            datasets: [{
                data: items.map(p => Number(n(p.presupuesto_propuesto).toFixed(2))),
                backgroundColor: items.map((_, i) => PALETTE[i % PALETTE.length]),
                borderColor: "#ffffff",
                borderWidth: 2,
            }],
        },
        options: {
            plugins: {
                title: { display: true, text: "Distribución del presupuesto propuesto", font: { size: 18, weight: "bold" } },
                legend: { position: "right", labels: { boxWidth: 14, font: { size: 12 } } },
                datalabels: {
                    color: "#fff",
                    font: { weight: "bold", size: 11 },
                    formatter: (value: number, ctx: any) => {
                        const total = ctx.dataset.data.reduce((a: number, b: number) => a + b, 0);
                        const pct = total ? (value / total) * 100 : 0;
                        return pct < 4 ? "" : pct.toFixed(1) + "%";
                    },
                },
            },
        },
    }, 900, 520);
}

async function buildBarChart(partidas: Partida[]): Promise<Uint8Array | null> {
    if (!partidas?.length) return null;
    return fetchChartPng({
        type: "bar",
        data: {
            labels: partidas.map(p => p.nombre),
            datasets: [
                {
                    label: "Gasto anterior",
                    data: partidas.map(p => Number(n(p.gasto_anterior).toFixed(2))),
                    backgroundColor: "#9DB8C2",
                },
                {
                    label: "Presupuesto propuesto",
                    data: partidas.map(p => Number(n(p.presupuesto_propuesto).toFixed(2))),
                    backgroundColor: "#F6B73C",
                },
            ],
        },
        options: {
            plugins: {
                title: { display: true, text: "Comparativa por partida: gasto anterior vs presupuesto propuesto", font: { size: 16, weight: "bold" } },
                legend: { position: "bottom" },
            },
            scales: {
                y: { beginAtZero: true, ticks: { callback: "function(v){return v.toLocaleString('es-ES')+' €';}" } },
                x: { ticks: { autoSkip: false, maxRotation: 35, minRotation: 0, font: { size: 10 } } },
            },
        },
    }, 1000, 480);
}

// =================== PDF ===================

// WinAnsi-safe: pdf-lib's standard Helvetica only supports CP1252; drop/replace
// anything outside that range (emojis, smart quotes, dashes, etc.) so the IA's
// output can't crash PDF generation.
function winAnsiSafe(s: any): string {
    return String(s ?? "")
        .replace(/[‘’‚‛]/g, "'")
        .replace(/[“”„‟]/g, '"')
        .replace(/[–—―]/g, "-")
        .replace(/…/g, "...")
        .replace(/[   ]/g, " ")
        .replace(/[⚠⚡✅❌✔✖]/g, "!")
        // Strip any remaining non-WinAnsi char (rough: anything above 0xFF
        // that survived the replacements above)
        .replace(/[Ā-￿]/g, "");
}

async function buildPdf(
    a: Analysis,
    emisor: any,
    logoBytes: Uint8Array | null,
    chartPie: Uint8Array | null,
    chartBar: Uint8Array | null,
): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const A4 = { w: 595.28, h: 841.89 };
    const margin = 45;
    const contentW = A4.w - margin * 2;
    const BLACK = rgb(0, 0, 0);
    const GREY = rgb(0.45, 0.45, 0.45);
    const YELLOW = rgb(0.98, 0.84, 0.40);
    const LIGHT = rgb(0.96, 0.96, 0.96);
    const BORDER = rgb(0.82, 0.82, 0.82);

    let page = pdfDoc.addPage([A4.w, A4.h]);
    let y = A4.h;

    const newPage = () => {
        page = pdfDoc.addPage([A4.w, A4.h]);
        y = A4.h - margin;
    };
    const ensure = (h: number) => {
        if (y - h < margin + 30) newPage();
    };

    // Header a ancho completo (mismo patrón que suplidos)
    if (logoBytes) {
        try {
            const img = await pdfDoc.embedPng(logoBytes).catch(() => pdfDoc.embedJpg(logoBytes));
            const targetW = A4.w - 20;
            const ratio = img.height / img.width;
            const targetH = targetW * ratio;
            const x = 10;
            const yPos = A4.h - 10 - targetH;
            page.drawImage(img, { x, y: yPos, width: targetW, height: targetH });
            y = yPos - 18;
        } catch {
            y = A4.h - margin;
        }
    } else {
        y = A4.h - margin;
    }

    // Título
    ensure(40);
    page.drawText("Presupuesto ordinario anual propuesto", {
        x: margin, y: y - 18, size: 16, font: bold, color: BLACK,
    });
    y -= 28;

    // Comunidad + ejercicio
    ensure(20);
    const subtitle = winAnsiSafe(`${a.comunidad}${a.ejercicio_analizado ? ` · Ejercicio analizado: ${a.ejercicio_analizado}` : ""}`);
    page.drawText(subtitle, { x: margin, y: y - 12, size: 10, font: bold, color: GREY });
    y -= 22;

    // Introducción
    const wrap = (text: string, f: any, size: number, maxW: number) => {
        const words = String(text || "").split(/\s+/).filter(Boolean);
        const lines: string[] = [];
        let line = "";
        for (const w of words) {
            const test = line ? `${line} ${w}` : w;
            if (f.widthOfTextAtSize(test, size) <= maxW) line = test;
            else { if (line) lines.push(line); line = w; }
        }
        if (line) lines.push(line);
        return lines;
    };

    if (a.introduccion) {
        const lines = wrap(winAnsiSafe(a.introduccion), font, 10, contentW);
        ensure(lines.length * 13 + 6);
        for (const ln of lines) {
            page.drawText(ln, { x: margin, y: y - 11, size: 10, font, color: BLACK });
            y -= 13;
        }
        y -= 6;
    }

    // Helpers tabla
    const drawTable = (opts: {
        title: string;
        headers: string[];
        rows: string[][];
        widths: number[];          // sum should match contentW
        aligns?: ("left" | "right" | "center")[];
        footer?: string[];
    }) => {
        const { title, headers, rows, widths, aligns = [], footer } = opts;
        const rowH = 18;
        const headerH = 20;

        ensure(28 + headerH + rowH * Math.min(rows.length, 3) + 8);

        // Section title
        page.drawText(winAnsiSafe(title), { x: margin, y: y - 12, size: 11, font: bold, color: BLACK });
        page.drawRectangle({ x: margin, y: y - 19, width: contentW, height: 1.5, color: YELLOW });
        y -= 22;

        // Header
        let cx = margin;
        for (let i = 0; i < headers.length; i++) {
            page.drawRectangle({
                x: cx, y: y - headerH, width: widths[i], height: headerH,
                color: LIGHT, borderColor: BORDER, borderWidth: 0.5,
            });
            const txt = winAnsiSafe(headers[i]);
            const size = 8.5;
            const align = aligns[i] || "left";
            let tx = cx + 5;
            if (align === "right") tx = cx + widths[i] - 5 - bold.widthOfTextAtSize(txt, size);
            if (align === "center") tx = cx + widths[i] / 2 - bold.widthOfTextAtSize(txt, size) / 2;
            page.drawText(txt, { x: tx, y: y - headerH + 6, size, font: bold, color: BLACK });
            cx += widths[i];
        }
        y -= headerH;

        // Rows
        for (const row of rows) {
            ensure(rowH);
            cx = margin;
            for (let i = 0; i < row.length; i++) {
                page.drawRectangle({
                    x: cx, y: y - rowH, width: widths[i], height: rowH,
                    color: rgb(1, 1, 1), borderColor: BORDER, borderWidth: 0.5,
                });
                const txt = winAnsiSafe(row[i]);
                const size = 8.5;
                const align = aligns[i] || "left";
                let tx = cx + 5;
                const tw = font.widthOfTextAtSize(txt, size);
                if (align === "right") tx = cx + widths[i] - 5 - tw;
                if (align === "center") tx = cx + widths[i] / 2 - tw / 2;
                page.drawText(txt, { x: tx, y: y - rowH + 5, size, font, color: BLACK });
                cx += widths[i];
            }
            y -= rowH;
        }

        // Footer
        if (footer && footer.length === headers.length) {
            ensure(rowH);
            cx = margin;
            for (let i = 0; i < footer.length; i++) {
                page.drawRectangle({
                    x: cx, y: y - rowH, width: widths[i], height: rowH,
                    color: LIGHT, borderColor: BORDER, borderWidth: 0.5,
                });
                const txt = winAnsiSafe(footer[i]);
                const size = 9;
                const align = aligns[i] || "left";
                let tx = cx + 5;
                const tw = bold.widthOfTextAtSize(txt, size);
                if (align === "right") tx = cx + widths[i] - 5 - tw;
                if (align === "center") tx = cx + widths[i] / 2 - tw / 2;
                page.drawText(txt, { x: tx, y: y - rowH + 5, size, font: bold, color: BLACK });
                cx += widths[i];
            }
            y -= rowH;
        }

        y -= 12;
    };

    // Tabla 1: Gastos
    drawTable({
        title: "1. Presupuesto de gastos ordinarios",
        headers: ["Partida", "Gasto ejercicio anterior", "Presupuesto propuesto", "Variación €", "Variación %"],
        widths: [200, 90, 90, 65, 60],
        aligns: ["left", "right", "right", "right", "right"],
        rows: a.partidas.map(p => [
            p.nombre,
            moneyES(p.gasto_anterior),
            moneyES(p.presupuesto_propuesto),
            moneyES(p.variacion_eur),
            pctES(p.variacion_pct),
        ]),
        footer: [
            "TOTAL",
            moneyES(a.total_gasto_anterior),
            moneyES(a.total_presupuesto_propuesto),
            moneyES(a.total_presupuesto_propuesto - a.total_gasto_anterior),
            "",
        ],
    });

    // Tabla 2: Cuotas actuales
    drawTable({
        title: "2. Detalle de cuotas comunitarias actuales",
        headers: ["Tipo de finca", "Nº fincas", "Cuota mensual", "Total mensual", "Total anual"],
        widths: [180, 70, 85, 85, 85],
        aligns: ["left", "center", "right", "right", "right"],
        rows: a.cuotas_actuales.map(c => [
            c.tipo_finca,
            String(c.num_fincas),
            moneyES(c.cuota_mensual),
            moneyES(c.total_mensual),
            moneyES(c.total_anual),
        ]),
        footer: [
            "TOTAL",
            String(a.cuotas_actuales.reduce((s, x) => s + n(x.num_fincas), 0)),
            "",
            moneyES(a.cuotas_actuales.reduce((s, x) => s + n(x.total_mensual), 0)),
            moneyES(a.ingresos_previstos_anual),
        ],
    });

    // Tabla 3: Resultado estimado
    drawTable({
        title: "3. Resultado estimado del ejercicio",
        headers: ["Concepto", "Importe"],
        widths: [350, 155],
        aligns: ["left", "right"],
        rows: [
            ["Ingresos anuales previstos (cuotas actuales)", moneyES(a.resultado_estimado.ingresos)],
            ["Gastos anuales presupuestados", moneyES(a.resultado_estimado.gastos)],
            ["Resultado estimado", moneyES(a.resultado_estimado.resultado)],
        ],
    });

    // Tabla 4: Subida propuesta
    drawTable({
        title: `4. Subida propuesta · % medio ponderado: ${pctES(a.subida_propuesta.pct_medio_ponderado)}`,
        headers: ["Tipo de finca", "Cuota actual", "Cuota nueva", "Subida €", "Subida %"],
        widths: [170, 90, 90, 80, 75],
        aligns: ["left", "right", "right", "right", "right"],
        rows: a.subida_propuesta.por_tipo.map(t => [
            t.tipo_finca,
            moneyES(t.cuota_actual),
            moneyES(t.cuota_nueva),
            moneyES(t.subida_eur),
            pctES(t.subida_pct),
        ]),
    });

    // Gráficas
    const drawChart = async (bytes: Uint8Array, title: string) => {
        try {
            const img = await pdfDoc.embedPng(bytes);
            const targetW = contentW;
            const ratio = img.height / img.width;
            const targetH = Math.min(targetW * ratio, 320);
            const finalW = targetH === 320 ? targetH / ratio : targetW;
            const xOff = margin + (contentW - finalW) / 2;

            ensure(targetH + 32);
            page.drawText(winAnsiSafe(title), { x: margin, y: y - 12, size: 11, font: bold, color: BLACK });
            page.drawRectangle({ x: margin, y: y - 19, width: contentW, height: 1.5, color: YELLOW });
            y -= 24;
            page.drawImage(img, { x: xOff, y: y - targetH, width: finalW, height: targetH });
            y -= targetH + 12;
        } catch {
            // ignore chart errors
        }
    };
    if (chartPie) await drawChart(chartPie, "Distribución del presupuesto por partida");
    if (chartBar) await drawChart(chartBar, "Comparativa: gasto anterior vs presupuesto propuesto");

    // Justificación
    if (a.justificacion?.length) {
        ensure(20);
        page.drawText("5. Justificación de la subida propuesta", { x: margin, y: y - 12, size: 11, font: bold, color: BLACK });
        page.drawRectangle({ x: margin, y: y - 19, width: contentW, height: 1.5, color: YELLOW });
        y -= 24;
        for (const item of a.justificacion) {
            const lines = wrap(winAnsiSafe("• " + item), font, 10, contentW - 10);
            ensure(lines.length * 13 + 4);
            for (const ln of lines) {
                page.drawText(ln, { x: margin + 5, y: y - 11, size: 10, font, color: BLACK });
                y -= 13;
            }
            y -= 3;
        }
        y -= 6;
    }

    // Observaciones
    if (a.observaciones?.length) {
        ensure(20);
        page.drawText("6. Observaciones finales", { x: margin, y: y - 12, size: 11, font: bold, color: BLACK });
        page.drawRectangle({ x: margin, y: y - 19, width: contentW, height: 1.5, color: YELLOW });
        y -= 24;
        for (const item of a.observaciones) {
            const lines = wrap(winAnsiSafe("• " + item), font, 10, contentW - 10);
            ensure(lines.length * 13 + 4);
            for (const ln of lines) {
                page.drawText(ln, { x: margin + 5, y: y - 11, size: 10, font, color: BLACK });
                y -= 13;
            }
            y -= 3;
        }
    }

    // Advertencias (si las hay)
    if (a.advertencias?.length) {
        ensure(30);
        y -= 6;
        page.drawText("Advertencias", { x: margin, y: y - 12, size: 11, font: bold, color: rgb(0.7, 0.2, 0.2) });
        page.drawRectangle({ x: margin, y: y - 19, width: contentW, height: 1.5, color: rgb(0.9, 0.5, 0.5) });
        y -= 24;
        for (const item of a.advertencias) {
            const lines = wrap(winAnsiSafe("! " + item), font, 10, contentW - 10);
            ensure(lines.length * 13 + 4);
            for (const ln of lines) {
                page.drawText(ln, { x: margin + 5, y: y - 11, size: 10, font, color: rgb(0.7, 0.2, 0.2) });
                y -= 13;
            }
            y -= 3;
        }
    }

    // Footer global
    const footerText = winAnsiSafe(`${emisor?.nombre || "Serincosol"} · administracion@serincosol.com`);
    const footerSize = 8;
    for (const p of pdfDoc.getPages()) {
        const { width: pW } = p.getSize();
        const w = font.widthOfTextAtSize(footerText, footerSize);
        p.drawText(footerText, { x: pW / 2 - w / 2, y: 22, size: footerSize, font, color: GREY });
    }

    return await pdfDoc.save({ useObjectStreams: true });
}

// =================== DOCX ===================

const docxBorder = {
    top: { style: BorderStyle.SINGLE, size: 4, color: "D1D1D1" },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: "D1D1D1" },
    left: { style: BorderStyle.SINGLE, size: 4, color: "D1D1D1" },
    right: { style: BorderStyle.SINGLE, size: 4, color: "D1D1D1" },
};

const cell = (text: string, opts?: { bold?: boolean; align?: "left" | "right" | "center"; bg?: string; widthPct?: number }) =>
    new TableCell({
        width: opts?.widthPct ? { size: opts.widthPct, type: WidthType.PERCENTAGE } : undefined,
        shading: opts?.bg ? { fill: opts.bg } : undefined,
        borders: docxBorder,
        children: [
            new Paragraph({
                alignment: opts?.align === "right" ? AlignmentType.RIGHT : opts?.align === "center" ? AlignmentType.CENTER : AlignmentType.LEFT,
                children: [new TextRun({ text, bold: !!opts?.bold, size: 18 })],
            }),
        ],
    });

const headingPara = (text: string) =>
    new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 120 },
        children: [new TextRun({ text, bold: true, size: 24 })],
    });

const bulletList = (items: string[], color?: string) =>
    items.map(it =>
        new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 80 },
            children: [new TextRun({ text: it, size: 20, color })],
        })
    );

async function buildDocx(
    a: Analysis,
    emisor: any,
    logoBytes: Uint8Array | null,
    chartPie: Uint8Array | null,
    chartBar: Uint8Array | null,
): Promise<Buffer> {
    const children: any[] = [];

    if (logoBytes) {
        try {
            // Determine format heuristically (PNG vs JPEG)
            const isPng = logoBytes[0] === 0x89 && logoBytes[1] === 0x50;
            children.push(
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                        new ImageRun({
                            data: logoBytes as any,
                            transformation: { width: 560, height: 90 },
                            type: isPng ? "png" : "jpg",
                        } as any),
                    ],
                })
            );
        } catch {
            // ignore
        }
    }

    children.push(
        new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { after: 100 },
            children: [new TextRun({ text: "Presupuesto ordinario anual propuesto", bold: true, size: 32 })],
        }),
        new Paragraph({
            spacing: { after: 200 },
            children: [
                new TextRun({
                    text: `${a.comunidad}${a.ejercicio_analizado ? ` · Ejercicio analizado: ${a.ejercicio_analizado}` : ""}`,
                    italics: true,
                    size: 20,
                    color: "707070",
                }),
            ],
        }),
    );

    if (a.introduccion) {
        children.push(new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: a.introduccion, size: 20 })] }));
    }

    // Tabla 1
    children.push(headingPara("1. Presupuesto de gastos ordinarios"));
    children.push(
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
                new TableRow({
                    children: [
                        cell("Partida", { bold: true, bg: "F5F5F5", widthPct: 36 }),
                        cell("Gasto anterior", { bold: true, bg: "F5F5F5", align: "right", widthPct: 17 }),
                        cell("Propuesto", { bold: true, bg: "F5F5F5", align: "right", widthPct: 17 }),
                        cell("Variación €", { bold: true, bg: "F5F5F5", align: "right", widthPct: 15 }),
                        cell("Variación %", { bold: true, bg: "F5F5F5", align: "right", widthPct: 15 }),
                    ],
                }),
                ...a.partidas.map(p =>
                    new TableRow({
                        children: [
                            cell(p.nombre),
                            cell(moneyES(p.gasto_anterior), { align: "right" }),
                            cell(moneyES(p.presupuesto_propuesto), { align: "right" }),
                            cell(moneyES(p.variacion_eur), { align: "right" }),
                            cell(pctES(p.variacion_pct), { align: "right" }),
                        ],
                    })
                ),
                new TableRow({
                    children: [
                        cell("TOTAL", { bold: true, bg: "F5F5F5" }),
                        cell(moneyES(a.total_gasto_anterior), { bold: true, bg: "F5F5F5", align: "right" }),
                        cell(moneyES(a.total_presupuesto_propuesto), { bold: true, bg: "F5F5F5", align: "right" }),
                        cell(moneyES(a.total_presupuesto_propuesto - a.total_gasto_anterior), { bold: true, bg: "F5F5F5", align: "right" }),
                        cell("", { bg: "F5F5F5" }),
                    ],
                }),
            ],
        })
    );

    // Tabla 2
    children.push(headingPara("2. Detalle de cuotas comunitarias actuales"));
    children.push(
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
                new TableRow({
                    children: [
                        cell("Tipo de finca", { bold: true, bg: "F5F5F5", widthPct: 36 }),
                        cell("Nº fincas", { bold: true, bg: "F5F5F5", align: "center", widthPct: 14 }),
                        cell("Cuota mensual", { bold: true, bg: "F5F5F5", align: "right", widthPct: 17 }),
                        cell("Total mensual", { bold: true, bg: "F5F5F5", align: "right", widthPct: 17 }),
                        cell("Total anual", { bold: true, bg: "F5F5F5", align: "right", widthPct: 16 }),
                    ],
                }),
                ...a.cuotas_actuales.map(c =>
                    new TableRow({
                        children: [
                            cell(c.tipo_finca),
                            cell(String(c.num_fincas), { align: "center" }),
                            cell(moneyES(c.cuota_mensual), { align: "right" }),
                            cell(moneyES(c.total_mensual), { align: "right" }),
                            cell(moneyES(c.total_anual), { align: "right" }),
                        ],
                    })
                ),
                new TableRow({
                    children: [
                        cell("TOTAL", { bold: true, bg: "F5F5F5" }),
                        cell(String(a.cuotas_actuales.reduce((s, x) => s + n(x.num_fincas), 0)), { bold: true, bg: "F5F5F5", align: "center" }),
                        cell("", { bg: "F5F5F5" }),
                        cell(moneyES(a.cuotas_actuales.reduce((s, x) => s + n(x.total_mensual), 0)), { bold: true, bg: "F5F5F5", align: "right" }),
                        cell(moneyES(a.ingresos_previstos_anual), { bold: true, bg: "F5F5F5", align: "right" }),
                    ],
                }),
            ],
        })
    );

    // Tabla 3
    children.push(headingPara("3. Resultado estimado del ejercicio"));
    children.push(
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
                new TableRow({
                    children: [
                        cell("Concepto", { bold: true, bg: "F5F5F5", widthPct: 70 }),
                        cell("Importe", { bold: true, bg: "F5F5F5", align: "right", widthPct: 30 }),
                    ],
                }),
                new TableRow({ children: [cell("Ingresos anuales previstos (cuotas actuales)"), cell(moneyES(a.resultado_estimado.ingresos), { align: "right" })] }),
                new TableRow({ children: [cell("Gastos anuales presupuestados"), cell(moneyES(a.resultado_estimado.gastos), { align: "right" })] }),
                new TableRow({ children: [cell("Resultado estimado", { bold: true }), cell(moneyES(a.resultado_estimado.resultado), { bold: true, align: "right" })] }),
            ],
        })
    );

    // Tabla 4
    children.push(headingPara(`4. Subida propuesta · % medio ponderado: ${pctES(a.subida_propuesta.pct_medio_ponderado)}`));
    children.push(
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
                new TableRow({
                    children: [
                        cell("Tipo de finca", { bold: true, bg: "F5F5F5", widthPct: 34 }),
                        cell("Cuota actual", { bold: true, bg: "F5F5F5", align: "right", widthPct: 17 }),
                        cell("Cuota nueva", { bold: true, bg: "F5F5F5", align: "right", widthPct: 17 }),
                        cell("Subida €", { bold: true, bg: "F5F5F5", align: "right", widthPct: 16 }),
                        cell("Subida %", { bold: true, bg: "F5F5F5", align: "right", widthPct: 16 }),
                    ],
                }),
                ...a.subida_propuesta.por_tipo.map(t =>
                    new TableRow({
                        children: [
                            cell(t.tipo_finca),
                            cell(moneyES(t.cuota_actual), { align: "right" }),
                            cell(moneyES(t.cuota_nueva), { align: "right" }),
                            cell(moneyES(t.subida_eur), { align: "right" }),
                            cell(pctES(t.subida_pct), { align: "right" }),
                        ],
                    })
                ),
            ],
        })
    );

    // Gráficas
    const addChart = (bytes: Uint8Array, title: string) => {
        children.push(headingPara(title));
        children.push(
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 200 },
                children: [
                    new ImageRun({
                        data: bytes as any,
                        transformation: { width: 540, height: 300 },
                        type: "png",
                    } as any),
                ],
            })
        );
    };
    if (chartPie) addChart(chartPie, "Distribución del presupuesto por partida");
    if (chartBar) addChart(chartBar, "Comparativa: gasto anterior vs presupuesto propuesto");

    // Justificación
    if (a.justificacion?.length) {
        children.push(headingPara("5. Justificación de la subida propuesta"));
        children.push(...bulletList(a.justificacion));
    }

    // Observaciones
    if (a.observaciones?.length) {
        children.push(headingPara("6. Observaciones finales"));
        children.push(...bulletList(a.observaciones));
    }

    // Advertencias
    if (a.advertencias?.length) {
        children.push(
            new Paragraph({
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 240, after: 120 },
                children: [new TextRun({ text: "Advertencias", bold: true, size: 24, color: "B33636" })],
            })
        );
        children.push(...bulletList(a.advertencias, "B33636"));
    }

    // Footer paragraph (final)
    children.push(
        new Paragraph({
            spacing: { before: 400 },
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: `${emisor?.nombre || "Serincosol"} · administracion@serincosol.com`, italics: true, size: 16, color: "707070" })],
        })
    );

    const doc = new Document({
        creator: emisor?.nombre || "Serincosol",
        title: TITLE,
        sections: [{ children }],
    });

    return await Packer.toBuffer(doc);
}

// =================== ROUTE ===================

export async function POST(req: Request) {
    const supabase = await supabaseRouteClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (!body?.analysis) return NextResponse.json({ error: "Falta el análisis" }, { status: 400 });

    const a: Analysis = body.analysis;
    const comunidadCodigo: string = body.comunidad_codigo || "";

    try {
        const emisor = await getEmisor();

        const [logoBytes, chartPie, chartBar] = await Promise.all([
            downloadAssetBytes(emisor.headerPath || emisor.logoPath || ""),
            buildPieChart(a.partidas || []),
            buildBarChart(a.partidas || []),
        ]);

        const [pdfBytes, docxBuffer] = await Promise.all([
            buildPdf(a, emisor, logoBytes, chartPie, chartBar),
            buildDocx(a, emisor, logoBytes, chartPie, chartBar),
        ]);

        const comunidadSafe = clean(a.comunidad || comunidadCodigo || "Comunidad");
        const ejercicioSafe = clean(a.ejercicio_analizado || "ejercicio");
        const stamp = Date.now();
        const basePath = `presupuestos/PRES_${comunidadSafe}_${ejercicioSafe}_${stamp}`;
        const pdfPath = `${basePath}.pdf`;
        const docxPath = `${basePath}.docx`;

        const [pdfUpload, docxUpload] = await Promise.all([
            supabase.storage.from(BUCKET).upload(pdfPath, pdfBytes, { contentType: "application/pdf", upsert: true }),
            supabase.storage.from(BUCKET).upload(docxPath, docxBuffer, {
                contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                upsert: true,
            }),
        ]);

        if (pdfUpload.error) throw new Error("Error subiendo PDF: " + pdfUpload.error.message);
        if (docxUpload.error) throw new Error("Error subiendo DOCX: " + docxUpload.error.message);

        const payload = {
            ...a,
            codigo: comunidadCodigo,
            nombre_comunidad: a.comunidad,
            docx_path: docxPath,
        };

        const { data: submissionData, error: dbError } = await supabase
            .from("doc_submissions")
            .insert({
                user_id: user.id,
                doc_key: DOC_KEY,
                title: TITLE,
                payload,
                pdf_path: pdfPath,
            })
            .select("id")
            .single();

        if (dbError) throw new Error("Error guardando datos: " + dbError.message);

        const [pdfUrl, docxUrl] = await Promise.all([
            supabase.storage.from(BUCKET).createSignedUrl(pdfPath, 60 * 10, { download: pdfPath.split("/").pop() }),
            supabase.storage.from(BUCKET).createSignedUrl(docxPath, 60 * 10, { download: docxPath.split("/").pop() }),
        ]);

        await supabase.from("activity_logs").insert({
            user_id: user.id,
            user_name: user.user_metadata?.nombre || user.email || "Sistema",
            action: "generate",
            entity_type: "documento",
            entity_id: submissionData.id,
            entity_name: TITLE,
            details: JSON.stringify({
                doc_key: DOC_KEY,
                titulo: TITLE,
                comunidad: a.comunidad,
                ejercicio: a.ejercicio_analizado,
                pct_subida: a.subida_propuesta?.pct_medio_ponderado,
            }),
        });

        return NextResponse.json({
            ok: true,
            submissionId: submissionData.id,
            pdfUrl: pdfUrl.data?.signedUrl,
            docxUrl: docxUrl.data?.signedUrl,
        });
    } catch (err: any) {
        console.error("Presupuestos generate error:", err);
        return NextResponse.json({ error: err?.message || "Error interno del servidor" }, { status: 500 });
    }
}
