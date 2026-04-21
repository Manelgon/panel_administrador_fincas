import { NextResponse } from "next/server";
import { supabaseRouteClient } from "@/lib/supabase/route";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { promises as fs } from "fs";
import path from "path";
import { logActivity } from "@/lib/logActivity";
import { getEmisor } from "@/lib/getEmisor";

// Constants
const A4 = { w: 595.28, h: 841.89 };
// App-matched color palette: neutral-900 headers, yellow-400 accents
const BRAND_DARK = rgb(0.09, 0.09, 0.11);    // neutral-900
const BRAND_YELLOW = rgb(0.98, 0.84, 0.40);  // yellow-400
const BRAND_YELLOW_LIGHT = rgb(0.99, 0.95, 0.84); // yellow-50
const BORDER = rgb(0.90, 0.90, 0.90);         // neutral-200
const BLACK = rgb(0, 0, 0);
const GRAY = rgb(0.3, 0.3, 0.3);
const LIGHT_GRAY = rgb(0.5, 0.5, 0.5);
const WHITE = rgb(1, 1, 1);
const SECTION_BG = rgb(0.97, 0.97, 0.97);     // neutral-50
const TABLE_HEADER_BG = rgb(0.09, 0.09, 0.11); // neutral-900
const ALT_ROW_BG = rgb(0.98, 0.98, 0.98);     // neutral-100
const ACCENT_TEXT = rgb(0.56, 0.49, 0.02);     // yellow-800

async function downloadAssetPng(storagePath: string): Promise<Uint8Array> {
    const { data, error } = await supabaseAdmin.storage.from("doc-assets").download(storagePath);
    if (error || !data) throw new Error(`Error downloading ${storagePath}: ${error?.message}`);
    return new Uint8Array(await data.arrayBuffer());
}

function formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return "-";
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    } catch {
        return dateStr;
    }
}

function truncateText(text: string, maxLen: number): string {
    if (!text) return "-";
    const clean = sanitizeText(text);
    return clean.length > maxLen ? clean.substring(0, maxLen - 3) + "..." : clean || "-";
}

// Strip numeric code prefix from community name: "002 CARLINDA 4" -> "CARLINDA 4"
function stripCodePrefix(name: string): string {
    if (!name) return 'Desconocida';
    return name.replace(/^\d+\s*[-–]?\s*/, '').trim() || name;
}

// Native pie chart drawing with pdf-lib
function drawPieChart(
    page: any,
    cx: number, cy: number, radius: number,
    slices: { label: string; value: number; color: any }[],
    font: any, bold: any
) {
    const total = slices.reduce((s, sl) => s + sl.value, 0);
    if (total === 0) {
        page.drawText("Sin datos", { x: cx - 20, y: cy - 4, size: 8, font, color: LIGHT_GRAY });
        return;
    }

    // Draw pie slices using filled triangles (approximation with small arc segments)
    let startAngle = -Math.PI / 2; // Start from top
    const segments = 60; // segments per full circle

    for (const slice of slices) {
        if (slice.value === 0) continue;
        const sliceAngle = (slice.value / total) * 2 * Math.PI;
        const segCount = Math.max(2, Math.ceil((sliceAngle / (2 * Math.PI)) * segments));
        const angleStep = sliceAngle / segCount;

        for (let s = 0; s < segCount; s++) {
            const a1 = startAngle + s * angleStep;
            const a2 = startAngle + (s + 1) * angleStep;
            // Draw triangle from center to two points on circumference
            const x1 = cx + radius * Math.cos(a1);
            const y1 = cy + radius * Math.sin(a1);
            const x2 = cx + radius * Math.cos(a2);
            const y2 = cy + radius * Math.sin(a2);

            // Use lines to simulate filled triangle
            page.drawLine({ start: { x: cx, y: cy }, end: { x: x1, y: y1 }, thickness: radius * 0.03, color: slice.color });
            page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: radius * 0.03, color: slice.color });
            // Fill with concentric circles approach
            for (let r = 1; r <= radius; r += 1.2) {
                const fx1 = cx + r * Math.cos(a1);
                const fy1 = cy + r * Math.sin(a1);
                const fx2 = cx + r * Math.cos(a2);
                const fy2 = cy + r * Math.sin(a2);
                page.drawLine({ start: { x: fx1, y: fy1 }, end: { x: fx2, y: fy2 }, thickness: 1.5, color: slice.color });
            }
        }
        startAngle += sliceAngle;
    }

    // Draw white donut hole
    const innerR = radius * 0.55;
    for (let a = 0; a < Math.PI * 2; a += 0.02) {
        const x1 = cx + innerR * Math.cos(a);
        const y1 = cy + innerR * Math.sin(a);
        const x2 = cx + innerR * Math.cos(a + 0.03);
        const y2 = cy + innerR * Math.sin(a + 0.03);
        page.drawLine({ start: { x: cx, y: cy }, end: { x: x1, y: y1 }, thickness: innerR * 0.8, color: WHITE });
    }
    // Clean inner circle
    page.drawCircle({ x: cx, y: cy, size: innerR - 2, color: WHITE });

    // Legend below the chart
    let legendY = cy - radius - 18;
    let legendX = cx - radius;
    for (const slice of slices) {
        if (slice.value === 0) continue;
        const pct = Math.round((slice.value / total) * 100);
        page.drawRectangle({ x: legendX, y: legendY - 3, width: 8, height: 8, color: slice.color });
        page.drawText(`${slice.label}: ${slice.value} (${pct}%)`, { x: legendX + 12, y: legendY - 2, size: 7, font, color: GRAY });
        legendY -= 14;
    }
}

// Sanitize text: remove chars that WinAnsi (Windows-1252) cannot encode
function sanitizeText(text: string): string {
    return (text || "")
        .replace(/\r\n|\n|\r/g, ' ')   // newlines -> space
        .split('').map(c => {
            const code = c.charCodeAt(0);
            // Keep printable ASCII + Latin-1 supplement (0x20-0xFF), replace the rest
            if (code >= 0x20 && code <= 0xff) return c;
            if (code < 0x20) return '';  // control chars
            return ' ';                  // emojis / high Unicode
        }).join('')
        .replace(/\s{2,}/g, ' ')        // collapse multiple spaces
        .trim();
}

// Helper: draw wrapped text and return new Y
function drawWrappedText(
    page: any, text: string, x: number, y: number, maxWidth: number,
    font: any, size: number, lineHeight: number, color: any,
    pdfDoc: any
): { y: number; page: any } {
    const words = sanitizeText(text).split(' ');
    let line = '';
    let currentY = y;
    let currentPage = page;

    for (const word of words) {
        const testLine = line + word + ' ';
        const width = font.widthOfTextAtSize(testLine, size);
        if (width > maxWidth && line.length > 0) {
            currentPage.drawText(line.trim(), { x, y: currentY, size, font, color });
            currentY -= lineHeight;
            line = word + ' ';
            if (currentY < 60) {
                currentPage = pdfDoc.addPage([A4.w, A4.h]);
                currentY = A4.h - 50;
            }
        } else {
            line = testLine;
        }
    }
    if (line.trim()) {
        currentPage.drawText(line.trim(), { x, y: currentY, size, font, color });
        currentY -= lineHeight;
    }
    return { y: currentY, page: currentPage };
}

// Helper: draw a section title bar
function drawSectionTitle(page: any, title: string, x: number, y: number, w: number, bold: any) {
    const h = 32;
    // Dark header bar matching app's neutral-900 style
    page.drawRectangle({ x, y: y - h, width: w, height: h, color: BRAND_DARK });
    // Yellow accent bar on left
    page.drawRectangle({ x, y: y - h, width: 4, height: h, color: BRAND_YELLOW });
    page.drawText(title, { x: x + 16, y: y - 21, size: 11, font: bold, color: WHITE });
    return y - h - 12;
}

// Helper: draw table header row
function drawTableHeader(page: any, columns: { label: string; width: number }[], x: number, y: number, bold: any) {
    const rowH = 24;
    let totalW = columns.reduce((sum, c) => sum + c.width, 0);
    // Subtle light header matching app's neutral-100 bg with bottom border
    page.drawRectangle({ x, y: y - rowH, width: totalW, height: rowH, color: SECTION_BG });
    page.drawLine({ start: { x, y: y - rowH }, end: { x: x + totalW, y: y - rowH }, thickness: 1, color: BRAND_YELLOW });

    let cx = x;
    for (const col of columns) {
        page.drawText(col.label.toUpperCase(), { x: cx + 6, y: y - 16, size: 7, font: bold, color: BRAND_DARK });
        cx += col.width;
    }
    return y - rowH;
}

// Helper: draw table data row
function drawTableRow(page: any, values: string[], columns: { label: string; width: number }[], x: number, y: number, font: any, isAlt: boolean) {
    const rowH = 20;
    let totalW = columns.reduce((sum, c) => sum + c.width, 0);
    if (isAlt) {
        page.drawRectangle({ x, y: y - rowH, width: totalW, height: rowH, color: ALT_ROW_BG });
    }
    page.drawLine({ start: { x, y: y - rowH }, end: { x: x + totalW, y: y - rowH }, thickness: 0.3, color: BORDER });

    let cx = x;
    for (let i = 0; i < values.length; i++) {
        const maxChars = Math.floor(columns[i].width / 4.5);
        page.drawText(truncateText(values[i] || "-", maxChars), { x: cx + 6, y: y - 14, size: 7.5, font, color: GRAY });
        cx += columns[i].width;
    }
    return y - rowH;
}

export async function POST(req: Request) {
    console.log("[CommunityReport] Starting combined PDF generation...");

    try {
        const supabase = await supabaseRouteClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

        const body = await req.json();
        const {
            communityId: inputId, communityName, communityCode,
            includeEmails, includeCronometraje, includeDebts, includeTickets,
            ticketFilter = 'all', debtFilter = 'all', includeCharts = true,
            startDate, endDate, saveToHistory
        } = body;

        if (!inputId) return NextResponse.json({ error: "Comunidad requerida" }, { status: 400 });

        // Default dates if not provided
        const finalStartDate = startDate || new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0];
        const finalEndDate = endDate || new Date().toISOString().split('T')[0];

        // 1) Logic to find actual community ID in Supabase if inputId is an OneDrive ID
        let communityId = inputId;
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(inputId);

        console.log(`[CommunityReport] Lookup Strategy for: "${communityName}"`);

        if (!isUuid) {
            // Extract code: "010 - Test" -> "010"
            const codeMatch = communityName.match(/^(\d+)/);
            const extractedCode = codeMatch ? codeMatch[1] : communityCode;

            // Search by code or exact name
            const { data: commData } = await supabaseAdmin
                .from('comunidades')
                .select('id, nombre_cdad, codigo')
                .or(`codigo.eq."${extractedCode}",nombre_cdad.eq."${communityName}"`)
                .maybeSingle();

            if (commData) {
                communityId = commData.id;
                console.log(`[CommunityReport] Redirected ${inputId} -> Supabase ID ${communityId} (${commData.nombre_cdad})`);
            } else {
                console.warn(`[CommunityReport] Community not found for "${communityName}". Using fallback.`);
            }
        }

        // 2) Initialize PDF
        const pdfDoc = await PDFDocument.create();
        let page = pdfDoc.addPage([A4.w, A4.h]);
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const marginX = 40;
        const contentW = A4.w - marginX * 2;
        let currentY = A4.h - 40;

        // 3) Header PDF — usa header de company_settings, fallback al public/
        try {
            const emisorData = await getEmisor();
            let logoBytes: Uint8Array;
            if (emisorData.headerPath) {
                logoBytes = await downloadAssetPng(emisorData.headerPath);
            } else {
                const localPath = path.join(process.cwd(), "public", "logo-retenciones.png");
                logoBytes = new Uint8Array(await fs.readFile(localPath));
            }
            const img = await pdfDoc.embedPng(logoBytes);
            const targetW = A4.w - 20;
            const targetH = (img.height / img.width) * targetW;
            page.drawImage(img, { x: 10, y: A4.h - 10 - targetH, width: targetW, height: targetH });
            currentY = A4.h - 20 - targetH - 25;
        } catch (e) {
            console.warn("[CommunityReport] Logo skip:", e);
        }

        // 4) Header - strip code prefix from community name
        const cleanName = stripCodePrefix(communityName || '');
        page.drawText(`Informe de: ${cleanName}`, { x: marginX, y: currentY, size: 18, font: bold, color: BRAND_DARK });
        currentY -= 22;
        page.drawText(`Periodo: ${formatDate(finalStartDate)} al ${formatDate(finalEndDate)}`, { x: marginX, y: currentY, size: 10, font, color: GRAY });
        currentY -= 14;

        const now = new Date();
        const dateStr = formatDate(now.toISOString());
        const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        page.drawText(`Fecha del Informe: ${dateStr} ${timeStr}`, { x: marginX, y: currentY, size: 10, font, color: GRAY });
        currentY -= 25;

        // Sections Summary
        const sections: string[] = [];
        if (includeTickets) sections.push("Tickets");
        if (includeDebts) sections.push("Deudas");
        if (includeCronometraje) sections.push("Cronometraje");
        if (includeEmails) sections.push("Emails");
        page.drawText(`Secciones: ${sections.join(", ")}`, { x: marginX, y: currentY, size: 9, font, color: LIGHT_GRAY });
        currentY -= 30;

        // ===== SECCION 1: TICKETS (Incidencias) =====
        if (includeTickets) {
            console.log("[CommunityReport] Section: Tickets");
            if (currentY < 150) { page = pdfDoc.addPage([A4.w, A4.h]); currentY = A4.h - 50; }
            currentY = drawSectionTitle(page, "INCIDENCIAS / TICKETS", marginX, currentY, contentW, bold);

            try {
                let ticketsQuery = supabaseAdmin
                    .from('incidencias')
                    .select('id, nombre_cliente, telefono, email, mensaje, urgencia, sentimiento, resuelto, fecha_recordatorio, dia_resuelto, created_at, profiles:gestor_asignado(nombre)')
                    .eq('comunidad_id', communityId)
                    .gte('created_at', finalStartDate)
                    .lte('created_at', finalEndDate + 'T23:59:59')
                    .order('created_at', { ascending: false });
                if (ticketFilter === 'pending') ticketsQuery = ticketsQuery.eq('resuelto', false);
                const { data: tickets, error: tErr } = await ticketsQuery;

                if (tErr) throw tErr;

                if (tickets && tickets.length > 0) {
                    // Fetch timeline messages for all tickets
                    const ticketIds = tickets.map((t: any) => t.id);
                    const { data: allMessages } = await supabaseAdmin
                        .from('record_messages')
                        .select('id, entity_id, content, created_at, profiles:user_id(nombre)')
                        .eq('entity_type', 'incidencia')
                        .in('entity_id', ticketIds)
                        .order('created_at', { ascending: true });

                    // Group messages by ticket id
                    const msgByTicket: Record<number, any[]> = {};
                    for (const msg of (allMessages || [])) {
                        if (!msgByTicket[msg.entity_id]) msgByTicket[msg.entity_id] = [];
                        msgByTicket[msg.entity_id].push(msg);
                    }

                    // Stats summary
                    const resueltas = tickets.filter((t: any) => t.resuelto).length;
                    const pendientes = tickets.filter((t: any) => !t.resuelto).length;
                    const statsText = `Total: ${tickets.length}  |  Resueltas: ${resueltas}  |  Pendientes: ${pendientes}`;
                    page.drawText(statsText, { x: marginX + 5, y: currentY, size: 8.5, font: bold, color: ACCENT_TEXT });
                    currentY -= 22;

                    // ===== TICKET CARDS =====
                    for (let i = 0; i < tickets.length; i++) {
                        const t = tickets[i];
                        const prof = Array.isArray(t.profiles) ? t.profiles[0] : t.profiles;
                        const gestorName = (prof as any)?.nombre || "-";
                        const messages = msgByTicket[t.id] || [];

                        // Estimate card height to check page break
                        const approxChars = Math.max(1, Math.floor(contentW * 0.85 / 4.5));
                        const msgLines = messages.reduce((acc: number, m: any) => {
                            return acc + Math.ceil((m.content || "").length / approxChars) + 1;
                        }, 0);
                        const estimatedH = 120 + (msgLines * 11) + (messages.length * 5);
                        if (currentY - estimatedH < 60) {
                            page = pdfDoc.addPage([A4.w, A4.h]);
                            currentY = A4.h - 50;
                        }

                        const cardX = marginX;
                        const cardW = contentW;

                        // — Ticket header bar —
                        const headerH = 30;
                        const urgColor = t.urgencia === 'Alta' ? rgb(1, 0.5, 0.26) :
                                         t.urgencia === 'Media' ? BRAND_YELLOW :
                                         rgb(0, 0.77, 0.62);

                        page.drawRectangle({ x: cardX, y: currentY - headerH, width: cardW, height: headerH, color: BRAND_DARK });
                        page.drawRectangle({ x: cardX, y: currentY - headerH, width: 5, height: headerH, color: urgColor });
                        page.drawText(`#${t.id}  ${sanitizeText(t.nombre_cliente || 'Sin nombre')}`, { x: cardX + 14, y: currentY - 20, size: 11, font: bold, color: WHITE });

                        // Estado badge
                        const estadoText = t.resuelto ? "RESUELTO" : (t.fecha_recordatorio ? "APLAZADO" : "PENDIENTE");
                        const estadoColor = t.resuelto ? rgb(0, 0.77, 0.62) : (t.fecha_recordatorio ? BRAND_YELLOW : rgb(1, 0.5, 0.26));
                        page.drawText(estadoText, { x: cardX + cardW - 75, y: currentY - 20, size: 9, font: bold, color: estadoColor });
                        currentY -= headerH + 10;

                        // — Meta info rows —
                        const pad = 10;
                        const col1X = cardX + pad;
                        const col2X = cardX + cardW * 0.33;
                        const col3X = cardX + cardW * 0.64;
                        const metaSize = 8.5;
                        const metaGap = 16;

                        // Fila 1: Fecha apertura | Fecha resolución | Urgencia
                        page.drawText("Apertura:", { x: col1X, y: currentY, size: metaSize, font: bold, color: LIGHT_GRAY });
                        page.drawText(formatDate(t.created_at), { x: col1X + 48, y: currentY, size: metaSize, font, color: BRAND_DARK });

                        if (t.resuelto && t.dia_resuelto) {
                            page.drawText("Resuelto:", { x: col2X, y: currentY, size: metaSize, font: bold, color: LIGHT_GRAY });
                            page.drawText(formatDate(t.dia_resuelto), { x: col2X + 48, y: currentY, size: metaSize, font, color: rgb(0, 0.77, 0.62) });
                        } else if (t.fecha_recordatorio) {
                            page.drawText("Aplazado:", { x: col2X, y: currentY, size: metaSize, font: bold, color: LIGHT_GRAY });
                            page.drawText(formatDate(t.fecha_recordatorio), { x: col2X + 48, y: currentY, size: metaSize, font, color: BRAND_YELLOW });
                        }

                        page.drawText("Urgencia:", { x: col3X, y: currentY, size: metaSize, font: bold, color: LIGHT_GRAY });
                        page.drawText(sanitizeText(t.urgencia || "-"), { x: col3X + 48, y: currentY, size: metaSize, font: bold, color: urgColor });
                        currentY -= metaGap;

                        // Fila 2: Gestor | Tel | Email
                        page.drawText("Gestor:", { x: col1X, y: currentY, size: metaSize, font: bold, color: LIGHT_GRAY });
                        page.drawText(truncateText(gestorName, 22), { x: col1X + 40, y: currentY, size: metaSize, font, color: BRAND_DARK });

                        if (t.telefono) {
                            page.drawText("Tel:", { x: col2X, y: currentY, size: metaSize, font: bold, color: LIGHT_GRAY });
                            page.drawText(sanitizeText(t.telefono), { x: col2X + 24, y: currentY, size: metaSize, font, color: BRAND_DARK });
                        }
                        if (t.email) {
                            page.drawText("Email:", { x: col3X, y: currentY, size: metaSize, font: bold, color: LIGHT_GRAY });
                            page.drawText(truncateText(t.email, 26), { x: col3X + 34, y: currentY, size: metaSize, font, color: BRAND_DARK });
                        }
                        currentY -= metaGap;

                        // Fila 3: Sentimiento (solo si existe)
                        if (t.sentimiento) {
                            page.drawText("Sentimiento:", { x: col1X, y: currentY, size: metaSize, font: bold, color: LIGHT_GRAY });
                            page.drawText(sanitizeText(t.sentimiento), { x: col1X + 62, y: currentY, size: metaSize, font, color: BRAND_DARK });
                            currentY -= metaGap;
                        }

                        currentY -= 4;
                        // — Separator —
                        page.drawLine({ start: { x: cardX + pad, y: currentY }, end: { x: cardX + cardW - pad, y: currentY }, thickness: 0.5, color: BORDER });
                        currentY -= 12;

                        // — Descripción —
                        page.drawText("Descripcion:", { x: col1X, y: currentY, size: 9, font: bold, color: BRAND_DARK });
                        currentY -= 13;
                        const msgResult = drawWrappedText(page, t.mensaje || "-", col1X + 6, currentY, cardW - 24, font, 8.5, 13, GRAY, pdfDoc);
                        page = msgResult.page;
                        currentY = msgResult.y;
                        currentY -= 8;

                        // — Timeline —
                        if (messages.length > 0) {
                            page.drawLine({ start: { x: cardX + pad, y: currentY }, end: { x: cardX + cardW - pad, y: currentY }, thickness: 0.5, color: BORDER });
                            currentY -= 12;
                            page.drawText(`TIMELINE (${messages.length} mensaje${messages.length !== 1 ? 's' : ''})`, { x: col1X, y: currentY, size: 9, font: bold, color: BRAND_DARK });
                            currentY -= 14;

                            for (const msg of messages) {
                                if (currentY < 60) {
                                    page = pdfDoc.addPage([A4.w, A4.h]);
                                    currentY = A4.h - 50;
                                }
                                const msgProf = Array.isArray(msg.profiles) ? msg.profiles[0] : msg.profiles;
                                const msgAuthor = sanitizeText((msgProf as any)?.nombre || "Sistema");
                                const msgDate = formatDate(msg.created_at);
                                const msgTime = new Date(msg.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

                                // Timeline dot + author/date
                                page.drawCircle({ x: col1X + 5, y: currentY - 2, size: 4, color: BRAND_YELLOW });
                                page.drawText(`${msgAuthor}  -  ${msgDate} ${msgTime}`, { x: col1X + 14, y: currentY, size: 8.5, font: bold, color: BRAND_DARK });
                                currentY -= 13;

                                // Message content (wrapped)
                                const res = drawWrappedText(page, msg.content || "", col1X + 14, currentY, cardW - 30, font, 8.5, 13, GRAY, pdfDoc);
                                page = res.page;
                                currentY = res.y;
                                currentY -= 8;
                            }
                        }

                        currentY -= 10;
                        // Bottom border of card
                        page.drawLine({ start: { x: cardX, y: currentY }, end: { x: cardX + cardW, y: currentY }, thickness: 0.6, color: BORDER });
                        currentY -= 14;
                    }

                    // ===== CHARTS: Tickets =====
                    if (includeCharts) {
                        currentY -= 5;
                        if (currentY < 250) { page = pdfDoc.addPage([A4.w, A4.h]); currentY = A4.h - 50; }

                        page.drawText("Resumen Visual de Tickets", { x: marginX + 5, y: currentY, size: 10, font: bold, color: BRAND_DARK });
                        currentY -= 15;

                        const chartRadius = 50;
                        const chartCenterY = currentY - chartRadius - 10;

                        const pie1X = marginX + chartRadius + 30;
                        page.drawText("Estado", { x: pie1X - 15, y: currentY, size: 8, font: bold, color: GRAY });
                        drawPieChart(page, pie1X, chartCenterY, chartRadius, [
                            { label: "Resuelta", value: resueltas, color: rgb(0, 0.77, 0.62) },
                            { label: "Pendiente", value: pendientes, color: BRAND_YELLOW }
                        ], font, bold);

                        const urgMap: Record<string, number> = { 'Alta': 0, 'Media': 0, 'Baja': 0 };
                        tickets.forEach((t: any) => { if (t.urgencia && urgMap.hasOwnProperty(t.urgencia)) urgMap[t.urgencia]++; });
                        const pie2X = marginX + chartRadius * 2 + 140;
                        page.drawText("Urgencia", { x: pie2X - 20, y: currentY, size: 8, font: bold, color: GRAY });
                        drawPieChart(page, pie2X, chartCenterY, chartRadius, [
                            { label: "Alta", value: urgMap['Alta'], color: rgb(1, 0.5, 0.26) },
                            { label: "Media", value: urgMap['Media'], color: BRAND_YELLOW },
                            { label: "Baja", value: urgMap['Baja'], color: rgb(0, 0.77, 0.62) }
                        ], font, bold);

                        const sentMap: Record<string, number> = {};
                        tickets.forEach((t: any) => { const s = t.sentimiento || 'Neutral'; sentMap[s] = (sentMap[s] || 0) + 1; });
                        const pie3X = marginX + chartRadius * 4 + 250;
                        page.drawText("Sentimiento", { x: pie3X - 25, y: currentY, size: 8, font: bold, color: GRAY });
                        drawPieChart(page, pie3X, chartCenterY, chartRadius, [
                            { label: "Positivo", value: sentMap['Positivo'] || 0, color: rgb(0, 0.77, 0.62) },
                            { label: "Neutral", value: sentMap['Neutral'] || 0, color: BRAND_YELLOW },
                            { label: "Negativo", value: sentMap['Negativo'] || 0, color: rgb(1, 0.5, 0.26) }
                        ], font, bold);

                        const maxLegendItems = Math.max(
                            2,
                            Object.values(urgMap).filter(v => v > 0).length,
                            Object.keys(sentMap).length
                        );
                        currentY = chartCenterY - chartRadius - 18 - (maxLegendItems * 14) - 10;
                    }

                } else {
                    page.drawText("No se encontraron incidencias en este periodo.", { x: marginX + 5, y: currentY, size: 9, font, color: GRAY });
                    currentY -= 20;
                }
            } catch (e: any) {
                page.drawText(`Error de datos (Tickets): ${e.message}`, { x: marginX + 5, y: currentY, size: 9, font, color: rgb(0.8, 0, 0) });
                currentY -= 20;
            }
            currentY -= 20;
        }

        // ===== SECCION 2: DEUDAS (Morosidad) =====
        if (includeDebts) {
            console.log("[CommunityReport] Section: Debts");
            if (currentY < 150) { page = pdfDoc.addPage([A4.w, A4.h]); currentY = A4.h - 50; }
            currentY = drawSectionTitle(page, "DEUDAS / MOROSIDAD", marginX, currentY, contentW, bold);

            try {
                let debtsQuery = supabaseAdmin
                    .from('morosidad')
                    .select('nombre_deudor, apellidos, titulo_documento, importe, estado, fecha_notificacion, created_at')
                    .eq('comunidad_id', communityId)
                    .gte('created_at', finalStartDate)
                    .lte('created_at', finalEndDate + 'T23:59:59')
                    .order('created_at', { ascending: false });
                if (debtFilter === 'pending') debtsQuery = debtsQuery.eq('estado', 'Pendiente');
                const { data: debts, error: dErr } = await debtsQuery;

                if (dErr) throw dErr;

                if (debts && debts.length > 0) {
                    const totalDeuda = debts.reduce((s: number, d: any) => s + (d.importe || 0), 0);
                    const deudaPendiente = debts.filter((d: any) => d.estado === 'Pendiente').length;
                    const statsDeuda = `Total: ${debts.length}  |  Pendientes: ${deudaPendiente}  |  Importe total: ${totalDeuda.toLocaleString('es-ES')} EUR`;
                    page.drawText(statsDeuda, { x: marginX + 5, y: currentY, size: 8.5, font: bold, color: ACCENT_TEXT });
                    currentY -= 22;

                    // ===== DEBT CARDS =====
                    for (let i = 0; i < debts.length; i++) {
                        const d = debts[i];
                        const deudorName = sanitizeText(`${d.nombre_deudor || ''} ${d.apellidos || ''}`.trim() || 'Sin nombre');
                        const isPagado = (d.estado || '').toLowerCase() === 'pagado';
                        const estadoDeudaColor = isPagado ? rgb(0, 0.77, 0.62) : BRAND_YELLOW;

                        if (currentY < 120) { page = pdfDoc.addPage([A4.w, A4.h]); currentY = A4.h - 50; }

                        const dCardX = marginX;
                        const dCardW = contentW;
                        const dPad = 10;
                        const dCol1X = dCardX + dPad;
                        const dCol2X = dCardX + dCardW * 0.33;
                        const dCol3X = dCardX + dCardW * 0.64;
                        const dMetaSize = 8.5;
                        const dGap = 16;

                        // — Debt header —
                        const dHeaderH = 30;
                        page.drawRectangle({ x: dCardX, y: currentY - dHeaderH, width: dCardW, height: dHeaderH, color: BRAND_DARK });
                        page.drawRectangle({ x: dCardX, y: currentY - dHeaderH, width: 5, height: dHeaderH, color: estadoDeudaColor });
                        page.drawText(deudorName, { x: dCardX + 14, y: currentY - 20, size: 11, font: bold, color: WHITE });
                        page.drawText(sanitizeText(d.estado || "-").toUpperCase(), { x: dCardX + dCardW - 75, y: currentY - 20, size: 9, font: bold, color: estadoDeudaColor });
                        currentY -= dHeaderH + 10;

                        // Fila 1: Importe | Estado | Fecha notificación
                        page.drawText("Importe:", { x: dCol1X, y: currentY, size: dMetaSize, font: bold, color: LIGHT_GRAY });
                        page.drawText(`${(d.importe || 0).toLocaleString('es-ES')} EUR`, { x: dCol1X + 44, y: currentY, size: dMetaSize, font: bold, color: BRAND_DARK });

                        page.drawText("Estado:", { x: dCol2X, y: currentY, size: dMetaSize, font: bold, color: LIGHT_GRAY });
                        page.drawText(sanitizeText(d.estado || "-"), { x: dCol2X + 40, y: currentY, size: dMetaSize, font: bold, color: estadoDeudaColor });

                        page.drawText("F. Notif.:", { x: dCol3X, y: currentY, size: dMetaSize, font: bold, color: LIGHT_GRAY });
                        page.drawText(formatDate(d.fecha_notificacion), { x: dCol3X + 50, y: currentY, size: dMetaSize, font, color: BRAND_DARK });
                        currentY -= dGap;

                        // Fila 2: Fecha creación | Concepto (label)
                        page.drawText("Alta:", { x: dCol1X, y: currentY, size: dMetaSize, font: bold, color: LIGHT_GRAY });
                        page.drawText(formatDate(d.created_at), { x: dCol1X + 28, y: currentY, size: dMetaSize, font, color: BRAND_DARK });
                        currentY -= dGap;

                        // — Separator + Concepto —
                        currentY -= 2;
                        page.drawLine({ start: { x: dCardX + dPad, y: currentY }, end: { x: dCardX + dCardW - dPad, y: currentY }, thickness: 0.5, color: BORDER });
                        currentY -= 12;

                        page.drawText("Concepto:", { x: dCol1X, y: currentY, size: 9, font: bold, color: BRAND_DARK });
                        currentY -= 13;
                        const dRes = drawWrappedText(page, d.titulo_documento || "-", dCol1X + 6, currentY, dCardW - 24, font, 8.5, 13, GRAY, pdfDoc);
                        page = dRes.page;
                        currentY = dRes.y;

                        currentY -= 10;
                        page.drawLine({ start: { x: dCardX, y: currentY }, end: { x: dCardX + dCardW, y: currentY }, thickness: 0.6, color: BORDER });
                        currentY -= 14;
                    }
                    // ===== CHART: Deudas =====
                    if (includeCharts) {
                        currentY -= 15;
                        if (currentY < 250) { page = pdfDoc.addPage([A4.w, A4.h]); currentY = A4.h - 50; }

                        page.drawText("Resumen Visual de Deudas", { x: marginX + 5, y: currentY, size: 10, font: bold, color: BRAND_DARK });
                        currentY -= 15;

                        const debtChartRadius = 50;
                        const debtChartY = currentY - debtChartRadius - 10;

                        const debtPendiente = debts.filter((d: any) => d.estado === 'Pendiente').reduce((s: number, d: any) => s + (d.importe || 0), 0);
                        const debtPagado = debts.filter((d: any) => d.estado === 'Pagado').reduce((s: number, d: any) => s + (d.importe || 0), 0);
                        const debtOtros = totalDeuda - debtPendiente - debtPagado;

                        const debtPie1X = marginX + debtChartRadius + 30;
                        page.drawText("Estado de Deuda", { x: debtPie1X - 30, y: currentY, size: 8, font: bold, color: GRAY });
                        drawPieChart(page, debtPie1X, debtChartY, debtChartRadius, [
                            { label: "Pendiente", value: debtPendiente, color: BRAND_YELLOW },
                            { label: "Pagado", value: debtPagado, color: rgb(0, 0.77, 0.62) },
                            ...(debtOtros > 0 ? [{ label: "Otros", value: debtOtros, color: LIGHT_GRAY }] : [])
                        ], font, bold);

                        const debtCountPendiente = debts.filter((d: any) => d.estado === 'Pendiente').length;
                        const debtCountPagado = debts.filter((d: any) => d.estado === 'Pagado').length;
                        const debtCountOtros = debts.length - debtCountPendiente - debtCountPagado;

                        const debtPie2X = marginX + debtChartRadius * 2 + 140;
                        page.drawText("Recibos", { x: debtPie2X - 15, y: currentY, size: 8, font: bold, color: GRAY });
                        drawPieChart(page, debtPie2X, debtChartY, debtChartRadius, [
                            { label: "Pendiente", value: debtCountPendiente, color: BRAND_YELLOW },
                            { label: "Pagado", value: debtCountPagado, color: rgb(0, 0.77, 0.62) },
                            ...(debtCountOtros > 0 ? [{ label: "Otros", value: debtCountOtros, color: LIGHT_GRAY }] : [])
                        ], font, bold);

                        const debtLegendItems = Math.max(2, (debtOtros > 0 ? 3 : 2));
                        currentY = debtChartY - debtChartRadius - 18 - (debtLegendItems * 14) - 10;
                    }

                } else {
                    page.drawText("No se encontraron deudas en este periodo.", { x: marginX + 5, y: currentY, size: 9, font, color: GRAY });
                    currentY -= 20;
                }
            } catch (e: any) {
                page.drawText(`Error de datos (Deudas): ${e.message}`, { x: marginX + 5, y: currentY, size: 9, font, color: rgb(0.8, 0, 0) });
                currentY -= 20;
            }
            currentY -= 20;
        }

        // ===== SECCION 3: CRONOMETRAJE =====
        if (includeCronometraje) {
            console.log("[CommunityReport] Section: Cronometraje");
            if (currentY < 150) { page = pdfDoc.addPage([A4.w, A4.h]); currentY = A4.h - 50; }
            currentY = drawSectionTitle(page, "CRONOMETRAJE DE TAREAS", marginX, currentY, contentW, bold);

            try {
                // Fetch tasks specifically for this community
                const { data: communityTasks, error: ctErr } = await supabaseAdmin
                    .from('task_timers')
                    .select('id, nota, start_at, end_at, duration_seconds, is_manual, tipo_tarea, comunidad_id, profiles:user_id(nombre)')
                    .eq('comunidad_id', communityId)
                    .gte('start_at', finalStartDate)
                    .lte('start_at', finalEndDate + 'T23:59:59')
                    .not('duration_seconds', 'is', null)
                    .order('start_at', { ascending: false });

                if (ctErr) throw ctErr;

                // Fetch shared tasks (comunidad_id is null = TODAS LAS COMUNIDADES)
                const { data: sharedTasks } = await supabaseAdmin
                    .from('task_timers')
                    .select('id, nota, start_at, end_at, duration_seconds, is_manual, tipo_tarea, comunidad_id, profiles:user_id(nombre)')
                    .is('comunidad_id', null)
                    .gte('start_at', finalStartDate)
                    .lte('start_at', finalEndDate + 'T23:59:59')
                    .not('duration_seconds', 'is', null)
                    .order('start_at', { ascending: false });

                // Count total communities for proportional distribution
                const { count: totalComms } = await supabaseAdmin
                    .from('comunidades')
                    .select('*', { count: 'exact', head: true });

                const numComms = totalComms || 1;

                // Calculate totals
                const specificSeconds = (communityTasks || []).reduce((acc, t) => acc + (t.duration_seconds || 0), 0);
                const sharedSeconds = (sharedTasks || []).reduce((acc, t) => acc + (t.duration_seconds || 0), 0);
                const proportionalSharedSeconds = Math.floor(sharedSeconds / numComms);
                const totalSeconds = specificSeconds + proportionalSharedSeconds;
                const specificCount = (communityTasks || []).length;
                const sharedCount = (sharedTasks || []).length;

                const totalTasks = specificCount + sharedCount;
                const avgSeconds = totalTasks > 0 ? Math.round(totalSeconds / totalTasks) : 0;

                // Format duration helper
                const fmtDur = (s: number) => {
                    const h = Math.floor(s / 3600);
                    const m = Math.floor((s % 3600) / 60);
                    return `${h}h ${m}m`;
                };

                // Summary KPIs
                const kpiW = (contentW - 20) / 3;
                const kpiH = 46;
                const kpiY = currentY;

                // KPI 1: Total Tiempo
                page.drawRectangle({ x: marginX, y: kpiY - kpiH, width: kpiW, height: kpiH, color: BRAND_YELLOW_LIGHT, borderColor: BORDER, borderWidth: 1 });
                page.drawText("TOTAL HORAS", { x: marginX + 10, y: kpiY - 16, size: 7, font: bold, color: ACCENT_TEXT });
                page.drawText(fmtDur(totalSeconds), { x: marginX + 10, y: kpiY - 32, size: 12, font: bold, color: BRAND_DARK });

                // KPI 2: Tareas Realizadas
                const kpi2X = marginX + kpiW + 10;
                page.drawRectangle({ x: kpi2X, y: kpiY - kpiH, width: kpiW, height: kpiH, color: BRAND_YELLOW_LIGHT, borderColor: BORDER, borderWidth: 1 });
                page.drawText("TAREAS REALIZADAS", { x: kpi2X + 10, y: kpiY - 16, size: 7, font: bold, color: ACCENT_TEXT });
                page.drawText(`${totalTasks} Tareas`, { x: kpi2X + 10, y: kpiY - 32, size: 12, font: bold, color: BRAND_DARK });

                // KPI 3: Media por Tarea
                const kpi3X = marginX + (kpiW + 10) * 2;
                page.drawRectangle({ x: kpi3X, y: kpiY - kpiH, width: kpiW, height: kpiH, color: BRAND_YELLOW_LIGHT, borderColor: BORDER, borderWidth: 1 });
                page.drawText("MEDIA POR TAREA", { x: kpi3X + 10, y: kpiY - 16, size: 7, font: bold, color: ACCENT_TEXT });
                page.drawText(`${fmtDur(avgSeconds)} / Tarea`, { x: kpi3X + 10, y: kpiY - 32, size: 12, font: bold, color: BRAND_DARK });

                currentY = kpiY - kpiH - 20;

                // ===== NATIVE PIE CHARTS FOR CRONOMETRAJE =====
                let allTasks = communityTasks || [];
                
                if (allTasks.length > 0) {
                    if (currentY < 180) { page = pdfDoc.addPage([A4.w, A4.h]); currentY = A4.h - 50; }

                    page.drawText("Resumen Visual de Tiempos y Tipos", { x: marginX + 5, y: currentY, size: 10, font: bold, color: BRAND_DARK });
                    currentY -= 15;

                    const cronoChartRadius = 45;
                    const cronoChartY = currentY - cronoChartRadius - 10;

                    // Pie 1: Por Gestor
                    const gestorMap: Record<string, number> = {};
                    allTasks.forEach((t: any) => { 
                       const prof = Array.isArray(t.profiles) ? t.profiles[0] : t.profiles;
                       const name = (prof as any)?.nombre || 'Sin Asignar';
                       if (t.duration_seconds) gestorMap[name] = (gestorMap[name] || 0) + t.duration_seconds;
                    });
                    
                    const pieColors = [BRAND_YELLOW, rgb(0, 0.77, 0.62), rgb(1, 0.5, 0.26), rgb(0.2, 0.6, 1), GRAY];
                    const gestorSlices = Object.entries(gestorMap)
                         .sort((a,b) => b[1] - a[1])
                         .map(([label, value], idx) => ({ 
                             label: truncateText(label, 15), 
                             value, 
                             color: pieColors[idx % pieColors.length] 
                         }));

                    const cronoPie1X = marginX + cronoChartRadius + 20;
                    page.drawText("Por Gestor (Tiempo)", { x: cronoPie1X - 35, y: currentY, size: 8, font: bold, color: GRAY });
                    drawPieChart(page, cronoPie1X, cronoChartY, cronoChartRadius, gestorSlices, font, bold);

                    // Pie 2: Por Tipo
                    const tipoMap: Record<string, number> = {};
                    allTasks.forEach((t: any) => { 
                       const tipo = t.tipo_tarea || 'Otros';
                       if (t.duration_seconds) tipoMap[tipo] = (tipoMap[tipo] || 0) + t.duration_seconds;
                    });

                    const tipoSlices = Object.entries(tipoMap)
                         .sort((a,b) => b[1] - a[1])
                         .map(([label, value], idx) => ({ 
                             label: truncateText(label, 15), 
                             value, 
                             color: pieColors[(idx + 2) % pieColors.length] 
                         }));

                    const cronoPie2X = marginX + cronoChartRadius * 2 + 160;
                    page.drawText("Por Tipo Tarea (Tiempo)", { x: cronoPie2X - 40, y: currentY, size: 8, font: bold, color: GRAY });
                    drawPieChart(page, cronoPie2X, cronoChartY, cronoChartRadius, tipoSlices, font, bold);

                    const maxCronLegend = Math.max(2, gestorSlices.length, tipoSlices.length);
                    currentY = cronoChartY - cronoChartRadius - 18 - (maxCronLegend * 14) - 10;
                }

                // Detail table of direct tasks
                if (allTasks.length > 0) {
                    if (currentY < 100) { page = pdfDoc.addPage([A4.w, A4.h]); currentY = A4.h - 50; }
                    page.drawText("Detalle de Tareas Directas", { x: marginX + 5, y: currentY, size: 9, font: bold, color: BRAND_DARK });
                    currentY -= 15;

                    const cols = [
                        { label: "Fecha", width: 60 },
                        { label: "Usuario", width: 90 },
                        { label: "Nota", width: 220 },
                        { label: "Tipo Tarea", width: 70 },
                        { label: "Duración", width: 70 }
                    ];
                    currentY = drawTableHeader(page, cols, marginX, currentY, bold);

                    for (let i = 0; i < allTasks.length; i++) {
                        if (currentY < 60) {
                            page = pdfDoc.addPage([A4.w, A4.h]); currentY = A4.h - 50;
                            currentY = drawTableHeader(page, cols, marginX, currentY, bold);
                        }
                        const t = allTasks[i];
                        const prof = Array.isArray(t.profiles) ? t.profiles[0] : t.profiles;
                        const durStr = t.duration_seconds ? fmtDur(t.duration_seconds) : '-';
                        currentY = drawTableRow(page, [
                            formatDate(t.start_at),
                            (prof as any)?.nombre || '-',
                            t.nota || '-',
                            t.tipo_tarea || 'Otros',
                            durStr
                        ], cols, marginX, currentY, font, i % 2 === 1);
                    }
                } else {
                    page.drawText("No se encontraron tareas directas en este periodo.", { x: marginX + 5, y: currentY, size: 9, font, color: GRAY });
                    currentY -= 20;
                }
            } catch (e: any) {
                page.drawText(`Error de datos (Cronometraje): ${e.message}`, { x: marginX + 5, y: currentY, size: 9, font, color: rgb(0.8, 0, 0) });
                currentY -= 20;
            }
            currentY -= 20;
        }

        // ===== SECCION 4: EMAILS =====
        if (includeEmails) {
            console.log("[CommunityReport] Section: Emails");
            if (currentY < 150) { page = pdfDoc.addPage([A4.w, A4.h]); currentY = A4.h - 50; }
            currentY = drawSectionTitle(page, "GESTIÓN DE COMUNICACIONES (IA)", marginX, currentY, contentW, bold);

            try {
                const n8nRes = await fetch('https://serinwebhook.afcademia.com/webhook/135d1aad-2cd5-42b6-b51e-4307a4be5444', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        comunidad_nombre: communityName,
                        comunidad_id: inputId, // Still use OneDrive ID for n8n
                        fecha_inicio: finalStartDate,
                        fecha_fin: finalEndDate,
                    })
                });

                if (n8nRes.ok) {
                    let n8nData = await n8nRes.json();
                    if (Array.isArray(n8nData)) n8nData = n8nData[0];

                    if (n8nData.structured?.emails?.length > 0) {
                        const emails = n8nData.structured.emails;
                        page.drawText(`Emails analizados por IA: ${emails.length}`, { x: marginX + 5, y: currentY, size: 8, font, color: GRAY });
                        currentY -= 15;

                        for (const email of emails) {
                            if (currentY < 100) { page = pdfDoc.addPage([A4.w, A4.h]); currentY = A4.h - 50; }

                            page.drawText(`REMITENTE: ${email.remitente_nombre || email.remitente_email} (${formatDate(email.fecha)})`, {
                                x: marginX + 5, y: currentY, size: 8, font: bold, color: BRAND_DARK
                            });
                            currentY -= 12;

                            const wrap = drawWrappedText(page, email.resumen || "-", marginX + 15, currentY, contentW - 20, font, 8, 11, GRAY, pdfDoc);
                            currentY = wrap.y - 10;
                            page = wrap.page;
                        }
                    } else {
                        page.drawText("No se detectaron comunicaciones relevantes en este periodo.", { x: marginX + 5, y: currentY, size: 9, font, color: GRAY });
                        currentY -= 20;
                    }
                } else {
                    throw new Error("Conexión con n8n fallida");
                }
            } catch (e: any) {
                page.drawText(`Error de comunicaciones: ${e.message}`, { x: marginX + 5, y: currentY, size: 9, font, color: GRAY });
                currentY -= 20;
            }
        }
        // 5) Footers with brand styling
        const pages = pdfDoc.getPages();
        for (let i = 0; i < pages.length; i++) {
            const p = pages[i];
            // Yellow accent line at footer
            p.drawLine({ start: { x: marginX, y: 38 }, end: { x: A4.w - marginX, y: 38 }, thickness: 0.5, color: BRAND_YELLOW });
            p.drawText(`Página ${i + 1} de ${pages.length}  |  Serincosol AI Report  |  ${formatDate(new Date().toISOString())}`, {
                x: A4.w / 2 - 90, y: 25, size: 7, font, color: LIGHT_GRAY
            });
        }

        const pdfBytes = await pdfDoc.save();

        if (saveToHistory) {
            const safeName = (communityName || 'Comunidad').replace(/[^a-z0-9]/gi, '_');
            const timestamp = Date.now();
            const filePath = `community-reports/${safeName}/${timestamp}_informe.pdf`;

            await supabaseAdmin.storage.from("documentos").upload(filePath, pdfBytes, { contentType: 'application/pdf' });

            const { data: record } = await supabaseAdmin.from('email_reports').insert({
                community_id: inputId,
                community_name: communityName,
                title: `Informe Global: ${sections.join(", ")}`,
                period_start: finalStartDate,
                period_end: finalEndDate,
                pdf_path: filePath,
                emails_count: sections.length
            }).select().single();

            const { data: sign } = await supabaseAdmin.storage.from("documentos").createSignedUrl(filePath, 3600);

            return NextResponse.json({ success: true, pdfUrl: sign?.signedUrl, reportId: record?.id });
        }

        return new Response(pdfBytes as any, {
            headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="Informe_${communityName.replace(/\s/g, '_')}.pdf"` }
        });

    } catch (err: any) {
        console.error("[CommunityReport] Fatal:", err);
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
}
