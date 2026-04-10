import { NextResponse } from "next/server";
import { supabaseRouteClient } from "@/lib/supabase/route";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/logActivity";
import { getEmisor } from "@/lib/getEmisor";

// --- CONSTANTS & HELPERS ---
const A4 = { w: 595.28, h: 841.89 };
const YELLOW = rgb(0.98, 0.84, 0.40);
const BORDER = rgb(0.82, 0.82, 0.82);
const BLACK = rgb(0, 0, 0);

// EMISOR se carga dinámicamente desde company_settings en el handler POST

async function downloadAssetPng(path: string): Promise<Uint8Array> {
    let { data, error } = await supabaseAdmin.storage
        .from("doc-assets")
        .download(path);

    if (error || !data) {
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
    const { page, x, yTop, w, lineH, paddingX, paddingY, lines, font, size, color, bg } = params;
    const h = paddingY * 2 + lines.length * lineH;
    const y = yTop - h;
    page.drawRectangle({ x, y, width: w, height: h, color: bg, borderColor: BORDER, borderWidth: 1 });
    let ty = yTop - paddingY - size;
    for (const line of lines) {
        page.drawText(line ?? "", { x: x + paddingX, y: +ty + 2, size, font, color });
        ty -= lineH;
    }
    return { h, yBottom: y };
}

async function drawImage(pdfDoc: any, page: any, base64: string, x: number, yTop: number, maxW: number) {
    if (!base64 || !base64.startsWith('data:image')) return yTop;
    try {
        const base64Data = base64.split(',')[1];
        const imageBytes = Buffer.from(base64Data, 'base64');
        const img = base64.includes('png') ? await pdfDoc.embedPng(imageBytes) : await pdfDoc.embedJpg(imageBytes);
        const ratio = img.height / img.width;

        // Force scaling to maxW for consistent chart sizes
        const w = maxW;
        const h = w * ratio;

        const y = yTop - h;
        page.drawImage(img, { x, y, width: w, height: h });
        return y - 10;
    } catch (e) {
        console.error("Error drawing image:", e);
        return yTop;
    }
}

// ---- Community-report style helpers (shared) ----
const BRAND_DARK = rgb(0.09, 0.09, 0.11);
const BRAND_YELLOW = rgb(0.98, 0.84, 0.40);
const BRAND_YELLOW_LIGHT = rgb(0.99, 0.95, 0.84);
const BORDER_LIGHT = rgb(0.90, 0.90, 0.90);
const GRAY_TEXT = rgb(0.3, 0.3, 0.3);
const LIGHT_GRAY_TEXT = rgb(0.5, 0.5, 0.5);
const WHITE = rgb(1, 1, 1);
const ACCENT_TEXT = rgb(0.56, 0.49, 0.02);

function sanitizeForPdf(text: string): string {
    return (text || '')
        .replace(/\r\n|\n|\r/g, ' ')
        .split('').map(c => { const code = c.charCodeAt(0); return (code >= 0x20 && code <= 0xff) ? c : (code < 0x20 ? '' : ' '); }).join('')
        .replace(/\s{2,}/g, ' ').trim();
}

function drawWrappedTextBlock(
    page: any, text: string, x: number, y: number, maxWidth: number,
    font: any, size: number, lineHeight: number, color: any, pdfDoc: any
): { y: number; page: any } {
    const words = sanitizeForPdf(text).split(' ');
    let line = '';
    let currentY = y;
    let currentPage = page;
    for (const word of words) {
        const testLine = line + word + ' ';
        if (font.widthOfTextAtSize(testLine, size) > maxWidth && line.length > 0) {
            currentPage.drawText(line.trim(), { x, y: currentY, size, font, color });
            currentY -= lineHeight;
            line = word + ' ';
            if (currentY < 60) { currentPage = pdfDoc.addPage([A4.w, A4.h]); currentY = A4.h - 50; }
        } else { line = testLine; }
    }
    if (line.trim()) { currentPage.drawText(line.trim(), { x, y: currentY, size, font, color }); currentY -= lineHeight; }
    return { y: currentY, page: currentPage };
}

export async function POST(req: Request) {
    console.log("[Report] Starting PDF generation...");
    const supabase = await supabaseRouteClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Body inválido" }, { status: 400 });

    const { stats, period, communityName, charts, userPerformance, cronoStats,
            sections = ['incidencias', 'rendimiento', 'deudas', 'cronometraje'],
            includeTimeline = false,
            selectedCommunityId, dateFrom, dateTo } = body;

    const formatDuration = (totalSeconds: number) => {
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        return `${h}h ${m}m`;
    };

    const sanitize = sanitizeForPdf;
    const truncate = (text: string, max: number) => { const t = sanitize(text); return t.length > max ? t.slice(0, max - 3) + '...' : t || '-'; };
    const fmtDate = (d: string | null | undefined) => { if (!d) return '-'; try { const dt = new Date(d); if (isNaN(dt.getTime())) return d; return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`; } catch { return d; } };
    const fmtDateTime = (d: string | null | undefined) => { if (!d) return '-'; try { const dt = new Date(d); if (isNaN(dt.getTime())) return d; return `${fmtDate(d)} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`; } catch { return d; } };

    // Build date range — si no hay fechas explícitas, usar period (30/90 días)
    let startIso: string | null = dateFrom ? dateFrom + 'T00:00:00' : null;
    let endIso: string | null = dateTo ? dateTo + 'T23:59:59' : null;

    if (!startIso && period && period !== 'all') {
        const d = new Date();
        d.setDate(d.getDate() - parseInt(period));
        startIso = d.toISOString();
    }

    const communityFilter = selectedCommunityId && selectedCommunityId !== 'all' ? selectedCommunityId : null;

    // Fetch detail data from DB — no hard limit so all rows are returned
    let detailIncidencias: any[] = [];
    let detailDeudas: any[] = [];
    let detailTareas: any[] = [];
    // Map: entity id → messages[]
    let timelineByIncidencia: Map<number, { content: string; autor: string; created_at: string }[]> = new Map();
    let timelineByDeuda: Map<number, { content: string; autor: string; created_at: string }[]> = new Map();

    if (sections.includes('incidencias')) {
        let q = supabaseAdmin
            .from('incidencias')
            .select('id, nombre_cliente, urgencia, resuelto, estado, created_at, dia_resuelto, mensaje, comunidades(nombre_cdad), profiles:gestor_asignado(nombre)')
            .order('created_at', { ascending: false });
        if (communityFilter) q = q.eq('comunidad_id', communityFilter);
        if (startIso) q = q.gte('created_at', startIso);
        if (endIso) q = q.lte('created_at', endIso);
        const { data, error } = await q;
        if (error) console.error('[Report] incidencias error:', error.message);
        detailIncidencias = data || [];
        console.log(`[Report] incidencias fetched: ${detailIncidencias.length}`);

        // Fetch timeline messages for these incidencias if requested
        if (includeTimeline && detailIncidencias.length > 0) {
            const incIds = detailIncidencias.map((i: any) => i.id);
            const { data: msgs, error: msgsErr } = await supabaseAdmin
                .from('record_messages')
                .select('entity_id, content, created_at, profiles:user_id(nombre)')
                .eq('entity_type', 'incidencia')
                .in('entity_id', incIds)
                .order('created_at', { ascending: true });
            if (msgsErr) console.error('[Report] timeline error:', msgsErr.message);
            for (const msg of (msgs || [])) {
                const prof = Array.isArray(msg.profiles) ? msg.profiles[0] : msg.profiles;
                const entry = { content: msg.content || '', autor: (prof as any)?.nombre || 'Sistema', created_at: msg.created_at };
                const list = timelineByIncidencia.get(msg.entity_id) || [];
                list.push(entry);
                timelineByIncidencia.set(msg.entity_id, list);
            }
            console.log(`[Report] timeline messages loaded for ${timelineByIncidencia.size} incidencias`);
        }
    }

    if (sections.includes('deudas')) {
        let q = supabaseAdmin
            .from('morosidad')
            .select('id, nombre_deudor, apellidos, titulo_documento, importe, estado, created_at, fecha_notificacion, comunidades(nombre_cdad)')
            .order('created_at', { ascending: false });
        if (communityFilter) q = q.eq('comunidad_id', communityFilter);
        if (startIso) q = q.gte('created_at', startIso);
        if (endIso) q = q.lte('created_at', endIso);
        const { data, error } = await q;
        if (error) console.error('[Report] morosidad error:', error.message);
        detailDeudas = data || [];
        console.log(`[Report] deudas fetched: ${detailDeudas.length}`);

        // Fetch timeline messages for deudas if requested
        if (includeTimeline && detailDeudas.length > 0) {
            const deudaIds = detailDeudas.map((d: any) => d.id);
            const { data: msgs, error: msgsErr } = await supabaseAdmin
                .from('record_messages')
                .select('entity_id, content, created_at, profiles:user_id(nombre)')
                .eq('entity_type', 'morosidad')
                .in('entity_id', deudaIds)
                .order('created_at', { ascending: true });
            if (msgsErr) console.error('[Report] timeline deudas error:', msgsErr.message);
            for (const msg of (msgs || [])) {
                const prof = Array.isArray(msg.profiles) ? msg.profiles[0] : msg.profiles;
                const entry = { content: msg.content || '', autor: (prof as any)?.nombre || 'Sistema', created_at: msg.created_at };
                const list = timelineByDeuda.get(msg.entity_id) || [];
                list.push(entry);
                timelineByDeuda.set(msg.entity_id, list);
            }
            console.log(`[Report] timeline messages loaded for ${timelineByDeuda.size} deudas`);
        }
    }

    if (sections.includes('cronometraje')) {
        let q = supabaseAdmin
            .from('task_timers')
            .select('nota, start_at, duration_seconds, tipo_tarea, comunidades(nombre_cdad), profiles:user_id(nombre)')
            .not('duration_seconds', 'is', null)
            .order('start_at', { ascending: false });
        if (communityFilter) q = q.eq('comunidad_id', communityFilter);
        if (startIso) q = q.gte('start_at', startIso);
        if (endIso) q = q.lte('start_at', endIso);
        const { data, error } = await q;
        if (error) console.error('[Report] task_timers error:', error.message);
        detailTareas = data || [];
        console.log(`[Report] tareas fetched: ${detailTareas.length}`);
    }

    // Log report generation
    await logActivity({
        action: 'generate',
        entityType: 'documento',
        entityName: `Reporte Control Gestión - ${communityName || 'Todas'}`,
        details: { period, community: communityName || 'Todas' },
        supabaseClient: supabase
    });

    try {
        const pdfDoc = await PDFDocument.create();
        let page = pdfDoc.addPage([A4.w, A4.h]);
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const marginX = 50;
        const contentW = A4.w - marginX * 2;

        // 0) Leer datos del emisor desde BD
        const emisorData = await getEmisor();

        // 1) Logo (Optional) — usa logo de company_settings, fallback al logo por defecto
        let currentY = A4.h - 50;
        try {
            const headerStoragePath = emisorData.headerPath || "certificados/logo-retenciones.png";
            const logoBytes = await downloadAssetPng(headerStoragePath);
            const img = await pdfDoc.embedPng(logoBytes);
            const targetW = A4.w - 20;
            const targetH = (img.height / img.width) * targetW;
            page.drawImage(img, { x: 10, y: A4.h - 10 - targetH, width: targetW, height: targetH });
            currentY = A4.h - 20 - targetH - 30;
            console.log("[Report] Logo added.");
        } catch (e) {
            console.warn("[Report] Logo skip:", e);
        }

        // 2) Header Title
        page.drawText("REPORTE DE CONTROL DE GESTIÓN", { x: marginX, y: currentY, size: 16, font: bold, color: BLACK });
        currentY -= 20;
        page.drawText(`Comunidad: ${communityName || 'Todas'}`, { x: marginX, y: currentY, size: 10, font, color: rgb(0.3, 0.3, 0.3) });
        currentY -= 14;
        page.drawText(`Periodo: ${period === 'all' ? 'Todo' : period + ' días'}`, { x: marginX, y: currentY, size: 10, font, color: rgb(0.3, 0.3, 0.3) });
        currentY -= 14;
        page.drawText(`Fecha del Informe: ${new Date().toLocaleString()}`, { x: marginX, y: currentY, size: 10, font, color: rgb(0.3, 0.3, 0.3) });
        currentY -= 30;

        // 3) KPIs
        const kpiW = (contentW - 20) / 3;
        const kpiY = currentY;

        drawYellowBlock({
            page, x: marginX, yTop: kpiY, w: kpiW, lineH: 18, paddingX: 10, paddingY: 10,
            lines: ["COMUNIDADES", String(communityName || 'Todas')], font: bold, size: 10, color: BLACK, bg: YELLOW
        });

        drawYellowBlock({
            page, x: marginX + kpiW + 10, yTop: kpiY, w: kpiW, lineH: 18, paddingX: 10, paddingY: 10,
            lines: ["INCIDENCIAS", `Pend: ${stats.incidenciasPendientes}   Res: ${stats.incidenciasResueltas}`], font: bold, size: 10, color: BLACK, bg: YELLOW
        });

        drawYellowBlock({
            page, x: marginX + (kpiW + 10) * 2, yTop: kpiY, w: kpiW, lineH: 18, paddingX: 10, paddingY: 10,
            lines: ["DEUDA TOTAL", stats.totalDeuda], font: bold, size: 10, color: BLACK, bg: YELLOW
        });

        currentY -= 80;

        // 4) Charts
        if (charts) {
            console.log("[Report] Drawing charts...");
            if (charts.evolution) {
                page.drawText("Evolución de Incidencias", { x: marginX, y: currentY, size: 12, font: bold });
                currentY -= 15;
                currentY = await drawImage(pdfDoc, page, charts.evolution, marginX, currentY, contentW);
                currentY -= 20;
            }

            if (charts.topCommunities) {
                if (currentY < 200) { page = pdfDoc.addPage([A4.w, A4.h]); currentY = A4.h - 50; }
                page.drawText("Comunidades con Más Incidencias", { x: marginX, y: currentY, size: 12, font: bold });
                currentY -= 15;
                currentY = await drawImage(pdfDoc, page, charts.topCommunities, marginX, currentY, contentW);
                currentY -= 20;
            }

            if (charts.debtByCommunity) {
                if (currentY < 200) { page = pdfDoc.addPage([A4.w, A4.h]); currentY = A4.h - 50; }
                page.drawText("Deuda por Comunidad", { x: marginX, y: currentY, size: 12, font: bold });
                currentY -= 15;
                currentY = await drawImage(pdfDoc, page, charts.debtByCommunity, marginX, currentY, contentW);
                currentY -= 20;
            }

            if (currentY < 300) { page = pdfDoc.addPage([A4.w, A4.h]); currentY = A4.h - 50; }

            const diagnosticCharts = [
                { id: 'incidentStatus', label: 'Incidencias', img: charts.incidentStatus },
                { id: 'urgency', label: 'Urgencia', img: charts.urgency },
                { id: 'sentiment', label: 'Sentimiento', img: charts.sentiment },
                { id: 'debtStatus', label: 'Estado Deuda', img: charts.debtStatus }
            ].filter(c => c.img);

            if (diagnosticCharts.length > 0) {
                const gap = 10;
                // Use 4 columns layout to fit all indicators together if they exist
                const chartW = (contentW - (gap * 3)) / 4;
                let minCharY = currentY;

                for (let i = 0; i < diagnosticCharts.length; i++) {
                    const c = diagnosticCharts[i];
                    const x = marginX + (chartW + gap) * i;
                    page.drawText(c.label, { x, y: currentY, size: 10, font: bold });
                    const resY = await drawImage(pdfDoc, page, c.img, x, currentY - 15, chartW);
                    if (resY < minCharY) minCharY = resY;
                }
                currentY = minCharY - 20;
            }
        }

        currentY -= 20;
        if (currentY < 180) { page = pdfDoc.addPage([A4.w, A4.h]); currentY = A4.h - 50; }

        // 5) User Performance Table + gráfica de barras nativa
        if (userPerformance && userPerformance.length > 0) {
            console.log("[Report] Drawing performance table...");
            page.drawText("RENDIMIENTO DEL EQUIPO", { x: marginX, y: currentY, size: 12, font: bold });
            currentY -= 15;

            const colW = { name: 150, ass: 80, res: 80, eff: 80 };
            let x = marginX;

            page.drawRectangle({ x, y: currentY - 20, width: contentW, height: 20, color: YELLOW });
            page.drawText("Usuario", { x: x + 5, y: currentY - 15, size: 9, font: bold }); x += colW.name;
            page.drawText("Asignadas", { x: x + 5, y: currentY - 15, size: 9, font: bold }); x += colW.ass;
            page.drawText("Resueltas", { x: x + 5, y: currentY - 15, size: 9, font: bold }); x += colW.res;
            page.drawText("Eficacia", { x: x + 5, y: currentY - 15, size: 9, font: bold });

            currentY -= 20;

            for (const u of userPerformance) {
                if (currentY < 50) { page = pdfDoc.addPage([A4.w, A4.h]); currentY = A4.h - 50; }
                let xx = marginX;
                page.drawText(u.name || "N/A", { x: xx + 5, y: currentY - 15, size: 9, font }); xx += colW.name;
                page.drawText(String(u.assigned || 0), { x: xx + 5, y: currentY - 15, size: 9, font }); xx += colW.ass;
                page.drawText(String(u.resolved || 0), { x: xx + 5, y: currentY - 15, size: 9, font }); xx += colW.res;
                page.drawText(`${u.efficiency || 0}%`, { x: xx + 5, y: currentY - 15, size: 9, font });

                page.drawLine({ start: { x: marginX, y: currentY - 20 }, end: { x: marginX + contentW, y: currentY - 20 }, thickness: 0.5, color: BORDER });
                currentY -= 20;
            }

            // Gráfica de barras nativa (asignadas vs resueltas por gestor)
            currentY -= 20;
            if (currentY < 220) { page = pdfDoc.addPage([A4.w, A4.h]); currentY = A4.h - 50; }
            page.drawText("Rendimiento por Gestor", { x: marginX, y: currentY, size: 11, font: bold, color: BLACK });
            currentY -= 15;

            const barMaxH = 80;
            const barW = Math.min(40, (contentW - 20) / userPerformance.length - 10);
            const barGap = Math.min(20, (contentW - userPerformance.length * barW) / (userPerformance.length + 1));
            const maxVal = Math.max(...userPerformance.map((u: any) => u.assigned || 0), 1);
            const GREEN = rgb(0, 0.77, 0.62);

            let bx = marginX + barGap;
            for (const u of userPerformance) {
                const assignedH = ((u.assigned || 0) / maxVal) * barMaxH;
                const resolvedH = ((u.resolved || 0) / maxVal) * barMaxH;
                const baseY = currentY - barMaxH;
                page.drawRectangle({ x: bx, y: baseY, width: barW * 0.45, height: assignedH || 1, color: YELLOW });
                page.drawRectangle({ x: bx + barW * 0.5, y: baseY, width: barW * 0.45, height: resolvedH || 1, color: GREEN });
                const nameShort = (u.name || 'N/A').split(' ')[0].substring(0, 8);
                page.drawText(nameShort, { x: bx, y: baseY - 12, size: 7, font, color: BLACK });
                bx += barW + barGap;
            }

            const legY = currentY - barMaxH - 25;
            page.drawRectangle({ x: marginX, y: legY - 8, width: 10, height: 8, color: YELLOW });
            page.drawText("Asignadas", { x: marginX + 13, y: legY - 7, size: 7, font, color: BLACK });
            page.drawRectangle({ x: marginX + 70, y: legY - 8, width: 10, height: 8, color: GREEN });
            page.drawText("Resueltas", { x: marginX + 83, y: legY - 7, size: 7, font, color: BLACK });
            currentY = legY - 20;
        }

        // 6) Cronometraje Section
        if (cronoStats && sections.includes('cronometraje')) {
            page = pdfDoc.addPage([A4.w, A4.h]);
            currentY = A4.h - 50;

            // Section header bar
            page.drawRectangle({ x: marginX, y: currentY - 30, width: contentW, height: 30, color: rgb(0.09, 0.09, 0.11) });
            page.drawRectangle({ x: marginX, y: currentY - 30, width: 4, height: 30, color: YELLOW });
            page.drawText("RENDIMIENTO DE CRONOMETRAJE", { x: marginX + 14, y: currentY - 20, size: 12, font: bold, color: WHITE });
            currentY -= 50;

            // KPI blocks
            const cronoKpiW = (contentW - 20) / 3;
            drawYellowBlock({
                page, x: marginX, yTop: currentY, w: cronoKpiW, lineH: 18, paddingX: 10, paddingY: 10,
                lines: ["TOTAL HORAS", formatDuration(cronoStats.totalSeconds || 0)], font: bold, size: 10, color: BLACK, bg: YELLOW
            });
            drawYellowBlock({
                page, x: marginX + cronoKpiW + 10, yTop: currentY, w: cronoKpiW, lineH: 18, paddingX: 10, paddingY: 10,
                lines: ["TAREAS REALIZADAS", String(cronoStats.totalTasks || 0)], font: bold, size: 10, color: BLACK, bg: YELLOW
            });
            drawYellowBlock({
                page, x: marginX + (cronoKpiW + 10) * 2, yTop: currentY, w: cronoKpiW, lineH: 18, paddingX: 10, paddingY: 10,
                lines: ["MEDIA POR TAREA", formatDuration(cronoStats.avgSeconds || 0)], font: bold, size: 10, color: BLACK, bg: YELLOW
            });
            currentY -= 80;

            // Gráficas crono: top comunidades + gestor en paralelo (dos columnas)
            const hasCronoTopComm = !!charts.cronoTopCommunities;
            const hasCronoGestor = !!charts.cronoGestor;

            if (hasCronoTopComm || hasCronoGestor) {
                if (currentY < 220) { page = pdfDoc.addPage([A4.w, A4.h]); currentY = A4.h - 50; }
                const halfW = (contentW - 10) / 2;
                let y1 = currentY, y2 = currentY;

                if (hasCronoTopComm) {
                    page.drawText("Top Comunidades por Tiempo", { x: marginX, y: currentY, size: 10, font: bold, color: BLACK });
                    y1 = await drawImage(pdfDoc, page, charts.cronoTopCommunities, marginX, currentY - 14, halfW);
                }
                if (hasCronoGestor) {
                    const col2X = marginX + halfW + 10;
                    page.drawText("Rendimiento por Gestor", { x: col2X, y: currentY, size: 10, font: bold, color: BLACK });
                    y2 = await drawImage(pdfDoc, page, charts.cronoGestor, col2X, currentY - 14, halfW);
                }
                currentY = Math.min(y1, y2) - 10;
            }

            // Evolución semanal (ancho completo)
            if (charts.cronoWeekly) {
                if (currentY < 220) { page = pdfDoc.addPage([A4.w, A4.h]); currentY = A4.h - 50; }
                page.drawText("Evolución Semanal de Horas", { x: marginX, y: currentY, size: 10, font: bold, color: BLACK });
                currentY -= 14;
                currentY = await drawImage(pdfDoc, page, charts.cronoWeekly, marginX, currentY, contentW);
                currentY -= 15;
            }

            // Distribución por tipo de tarea (ancho completo)
            if (charts.cronoDistType) {
                if (currentY < 220) { page = pdfDoc.addPage([A4.w, A4.h]); currentY = A4.h - 50; }
                page.drawText("Distribución por Tipo de Tarea", { x: marginX, y: currentY, size: 10, font: bold, color: BLACK });
                currentY -= 14;
                currentY = await drawImage(pdfDoc, page, charts.cronoDistType, marginX, currentY, contentW);
                currentY -= 15;
            }

            // Tabla nativa resumen por gestor
            const cronoByGestor = body.cronoByGestor || [];
            if (cronoByGestor.length > 0) {
                if (currentY < 150) { page = pdfDoc.addPage([A4.w, A4.h]); currentY = A4.h - 50; }
                page.drawText("Resumen por Gestor", { x: marginX, y: currentY, size: 10, font: bold, color: BLACK });
                currentY -= 14;

                const gCols = [{ label: 'Gestor', w: 160 }, { label: 'Tareas', w: 80 }, { label: 'Tiempo Total', w: 100 }, { label: 'Media por Tarea', w: 120 }];
                const gTotalW = gCols.reduce((s, c) => s + c.w, 0);
                page.drawRectangle({ x: marginX, y: currentY - 20, width: gTotalW, height: 20, color: rgb(0.97,0.97,0.97) });
                page.drawLine({ start: { x: marginX, y: currentY - 20 }, end: { x: marginX + gTotalW, y: currentY - 20 }, thickness: 1, color: YELLOW });
                let ghx = marginX;
                for (const col of gCols) { page.drawText(col.label.toUpperCase(), { x: ghx + 5, y: currentY - 14, size: 7, font: bold, color: rgb(0.09,0.09,0.11) }); ghx += col.w; }
                currentY -= 20;

                for (let i = 0; i < cronoByGestor.length; i++) {
                    if (currentY < 50) { page = pdfDoc.addPage([A4.w, A4.h]); currentY = A4.h - 50; }
                    const g = cronoByGestor[i];
                    const rowH = 18;
                    if (i % 2 === 1) page.drawRectangle({ x: marginX, y: currentY - rowH, width: gTotalW, height: rowH, color: rgb(0.98,0.98,0.98) });
                    page.drawLine({ start: { x: marginX, y: currentY - rowH }, end: { x: marginX + gTotalW, y: currentY - rowH }, thickness: 0.3, color: BORDER });
                    const avgSecsG = g.tasks > 0 ? Math.round(g.seconds / g.tasks) : 0;
                    const vals = [g.name || '-', String(g.tasks || 0), formatDuration(g.seconds || 0), formatDuration(avgSecsG)];
                    let gvx = marginX;
                    for (let j = 0; j < gCols.length; j++) {
                        page.drawText(vals[j], { x: gvx + 5, y: currentY - 13, size: 7.5, font: j === 0 ? bold : font, color: rgb(0.3,0.3,0.3) });
                        gvx += gCols[j].w;
                    }
                    currentY -= rowH;
                }
            }
        }

        // Helpers para tablas de detalle
        const drawTH = (p: any, cols: {label:string;w:number}[]) => {
            const tw = cols.reduce((s,c)=>s+c.w,0);
            p.drawRectangle({ x: marginX, y: currentY - 22, width: tw, height: 22, color: rgb(0.97,0.97,0.97) });
            p.drawLine({ start:{x:marginX,y:currentY-22}, end:{x:marginX+tw,y:currentY-22}, thickness:1, color:YELLOW });
            let hx = marginX;
            for (const col of cols) { p.drawText(col.label.toUpperCase(), { x:hx+5, y:currentY-15, size:7, font:bold, color:rgb(0.09,0.09,0.11) }); hx+=col.w; }
            currentY -= 22;
        };
        const drawTR = (p: any, vals: string[], cols: {label:string;w:number}[], rowIdx: number, colors?: (string|null)[]) => {
            const tw = cols.reduce((s,c)=>s+c.w,0);
            const rowH = 18;
            if (rowIdx % 2 === 1) p.drawRectangle({ x:marginX, y:currentY-rowH, width:tw, height:rowH, color:rgb(0.98,0.98,0.98) });
            p.drawLine({ start:{x:marginX,y:currentY-rowH}, end:{x:marginX+tw,y:currentY-rowH}, thickness:0.3, color:BORDER });
            let vx = marginX;
            for (let j=0; j<cols.length; j++) {
                let col_color = rgb(0.3,0.3,0.3);
                if (colors && colors[j]) {
                    const c = colors[j]!;
                    if (c === 'bold') col_color = rgb(0.09,0.09,0.11);
                    else if (c === 'red') col_color = rgb(0.9,0.3,0.1);
                    else if (c === 'green') col_color = rgb(0,0.7,0.5);
                    else if (c === 'yellow') col_color = rgb(0.7,0.6,0);
                }
                p.drawText(vals[j]||'-', { x:vx+5, y:currentY-13, size:7.5, font: (colors&&colors[j]==='bold')||j===0 ? bold : font, color:col_color });
                vx += cols[j].w;
            }
            currentY -= rowH;
        };
        const drawSectionHeader = (p: any, title: string, subtitle: string) => {
            p.drawRectangle({ x: marginX, y: currentY - 30, width: contentW, height: 30, color: rgb(0.09, 0.09, 0.11) });
            p.drawRectangle({ x: marginX, y: currentY - 30, width: 4, height: 30, color: YELLOW });
            p.drawText(title, { x: marginX + 14, y: currentY - 20, size: 11, font: bold, color: rgb(1,1,1) });
            currentY -= 42;
            if (subtitle) { p.drawText(subtitle, { x: marginX + 5, y: currentY, size: 8.5, font: bold, color: YELLOW }); currentY -= 18; }
        };

        // ===== DETALLE: INCIDENCIAS — estilo cards (igual que community-report) =====
        if (sections.includes('incidencias')) {
            page = pdfDoc.addPage([A4.w, A4.h]);
            currentY = A4.h - 50;
            const incPend = detailIncidencias.filter((i: any) => !i.resuelto).length;
            const incRes = detailIncidencias.filter((i: any) => i.resuelto).length;
            drawSectionHeader(page, `DETALLE DE INCIDENCIAS (${detailIncidencias.length})`, `Pendientes: ${incPend}  |  Resueltas: ${incRes}  |  Total: ${detailIncidencias.length}`);
            if (detailIncidencias.length === 0) {
                page.drawText('No se encontraron incidencias en el periodo seleccionado.', { x: marginX+5, y: currentY, size: 9, font, color: LIGHT_GRAY_TEXT });
            } else {
                const statsText = `Total: ${detailIncidencias.length}  |  Resueltas: ${incRes}  |  Pendientes: ${incPend}`;
                page.drawText(statsText, { x: marginX+5, y: currentY, size: 8.5, font: bold, color: ACCENT_TEXT });
                currentY -= 22;

                for (const inc of detailIncidencias) {
                    const prof = Array.isArray(inc.profiles) ? inc.profiles[0] : inc.profiles;
                    const gestorName = sanitize((prof as any)?.nombre || '-');
                    const messages = includeTimeline ? (timelineByIncidencia.get(inc.id) || []) : [];
                    const comName = sanitize((inc.comunidades as any)?.nombre_cdad || '-');

                    // Estimar altura de la card para salto de página
                    const descLines = Math.ceil(sanitize(inc.mensaje || '').length / 90) + 1;
                    const msgLines = messages.reduce((acc: number, m: any) => acc + Math.ceil(sanitize(m.content || '').length / 90) + 1, 0);
                    const estimatedH = 100 + (descLines * 13) + (messages.length > 0 ? 24 + msgLines * 13 : 0);
                    if (currentY - estimatedH < 60) { page = pdfDoc.addPage([A4.w, A4.h]); currentY = A4.h - 50; }

                    const cardX = marginX;
                    const cardW = contentW;
                    const urgColor = inc.urgencia === 'Alta' ? rgb(1, 0.5, 0.26) : inc.urgencia === 'Media' ? BRAND_YELLOW : rgb(0, 0.77, 0.62);

                    // — Header bar —
                    const headerH = 28;
                    page.drawRectangle({ x: cardX, y: currentY - headerH, width: cardW, height: headerH, color: BRAND_DARK });
                    page.drawRectangle({ x: cardX, y: currentY - headerH, width: 5, height: headerH, color: urgColor });
                    page.drawText(`#${inc.id}  ${sanitize(inc.nombre_cliente || 'Sin nombre')}`, { x: cardX + 14, y: currentY - 19, size: 10, font: bold, color: WHITE });

                    const estadoText = inc.resuelto ? 'RESUELTO' : (inc.estado || 'PENDIENTE');
                    const estadoColor = inc.resuelto ? rgb(0, 0.77, 0.62) : rgb(1, 0.5, 0.26);
                    page.drawText(estadoText, { x: cardX + cardW - 68, y: currentY - 19, size: 8, font: bold, color: estadoColor });
                    currentY -= headerH + 10;

                    // — Meta info —
                    const pad = 10;
                    const col1X = cardX + pad;
                    const col2X = cardX + cardW * 0.35;
                    const col3X = cardX + cardW * 0.66;
                    const metaSize = 8.5;
                    const metaGap = 15;

                    page.drawText("Apertura:", { x: col1X, y: currentY, size: metaSize, font: bold, color: LIGHT_GRAY_TEXT });
                    page.drawText(fmtDate(inc.created_at), { x: col1X + 50, y: currentY, size: metaSize, font, color: BRAND_DARK });
                    page.drawText("Urgencia:", { x: col2X, y: currentY, size: metaSize, font: bold, color: LIGHT_GRAY_TEXT });
                    page.drawText(sanitize(inc.urgencia || '-'), { x: col2X + 50, y: currentY, size: metaSize, font: bold, color: urgColor });
                    if (!communityFilter) {
                        page.drawText("Comunidad:", { x: col3X, y: currentY, size: metaSize, font: bold, color: LIGHT_GRAY_TEXT });
                        page.drawText(truncate(comName, 22), { x: col3X + 58, y: currentY, size: metaSize, font, color: BRAND_DARK });
                    }
                    currentY -= metaGap;

                    page.drawText("Gestor:", { x: col1X, y: currentY, size: metaSize, font: bold, color: LIGHT_GRAY_TEXT });
                    page.drawText(truncate(gestorName, 24), { x: col1X + 40, y: currentY, size: metaSize, font, color: BRAND_DARK });
                    if (inc.dia_resuelto && inc.resuelto) {
                        page.drawText("Resuelto:", { x: col2X, y: currentY, size: metaSize, font: bold, color: LIGHT_GRAY_TEXT });
                        page.drawText(fmtDate(inc.dia_resuelto), { x: col2X + 50, y: currentY, size: metaSize, font, color: rgb(0, 0.77, 0.62) });
                    }
                    currentY -= metaGap + 4;

                    // — Separador —
                    page.drawLine({ start:{x: cardX+pad, y: currentY}, end:{x: cardX+cardW-pad, y: currentY}, thickness: 0.5, color: BORDER_LIGHT });
                    currentY -= 12;

                    // — Descripción —
                    page.drawText("Descripcion:", { x: col1X, y: currentY, size: 9, font: bold, color: BRAND_DARK });
                    currentY -= 13;
                    const descResult = drawWrappedTextBlock(page, inc.mensaje || '-', col1X + 6, currentY, cardW - 24, font, 8.5, 13, GRAY_TEXT, pdfDoc);
                    page = descResult.page; currentY = descResult.y;
                    currentY -= 8;

                    // — Timeline —
                    if (messages.length > 0) {
                        page.drawLine({ start:{x: cardX+pad, y: currentY}, end:{x: cardX+cardW-pad, y: currentY}, thickness: 0.5, color: BORDER_LIGHT });
                        currentY -= 12;
                        page.drawText(`TIMELINE (${messages.length} mensaje${messages.length !== 1 ? 's' : ''})`, { x: col1X, y: currentY, size: 9, font: bold, color: BRAND_DARK });
                        currentY -= 14;
                        for (const msg of messages) {
                            if (currentY < 60) { page = pdfDoc.addPage([A4.w, A4.h]); currentY = A4.h - 50; }
                            const msgAuthor = sanitize(msg.autor || 'Sistema');
                            page.drawCircle({ x: col1X + 5, y: currentY - 2, size: 4, color: BRAND_YELLOW });
                            page.drawText(`${msgAuthor}  -  ${fmtDateTime(msg.created_at)}`, { x: col1X + 14, y: currentY, size: 8.5, font: bold, color: BRAND_DARK });
                            currentY -= 13;
                            const res = drawWrappedTextBlock(page, msg.content || '', col1X + 14, currentY, cardW - 30, font, 8.5, 13, GRAY_TEXT, pdfDoc);
                            page = res.page; currentY = res.y;
                            currentY -= 6;
                        }
                    }

                    currentY -= 8;
                    page.drawLine({ start:{x: cardX, y: currentY}, end:{x: cardX+cardW, y: currentY}, thickness: 0.6, color: BORDER_LIGHT });
                    currentY -= 14;
                }
            }
        }

        // ===== DETALLE: DEUDAS — estilo cards (igual que community-report) =====
        if (sections.includes('deudas')) {
            page = pdfDoc.addPage([A4.w, A4.h]);
            currentY = A4.h - 50;
            const totalImporte = detailDeudas.reduce((s: number, d: any) => s + (d.importe||0), 0);
            const pendCount = detailDeudas.filter((d: any) => d.estado==='Pendiente').length;
            drawSectionHeader(page, `DETALLE DE DEUDAS / MOROSIDAD (${detailDeudas.length})`, `Pendientes: ${pendCount}  |  Importe total: ${totalImporte.toLocaleString('es-ES')} EUR  |  Registros: ${detailDeudas.length}`);
            if (detailDeudas.length === 0) {
                page.drawText('No se encontraron deudas en el periodo seleccionado.', { x: marginX+5, y: currentY, size: 9, font, color: LIGHT_GRAY_TEXT });
            } else {
                const statsText = `Registros: ${detailDeudas.length}  |  Pendientes: ${pendCount}  |  Importe total: ${totalImporte.toLocaleString('es-ES')} EUR`;
                page.drawText(statsText, { x: marginX+5, y: currentY, size: 8.5, font: bold, color: ACCENT_TEXT });
                currentY -= 22;

                for (const d of detailDeudas) {
                    const messages = includeTimeline ? (timelineByDeuda.get(d.id) || []) : [];
                    const deudorFull = sanitize(`${d.nombre_deudor||''} ${d.apellidos||''}`.trim() || '-');
                    const comName = sanitize((d.comunidades as any)?.nombre_cdad || '-');
                    const isPagado = (d.estado || '').toLowerCase() === 'pagado';
                    const estadoColor = isPagado ? rgb(0, 0.77, 0.62) : rgb(1, 0.5, 0.26);

                    // Estimar altura
                    const msgLines = messages.reduce((acc: number, m: any) => acc + Math.ceil(sanitize(m.content || '').length / 90) + 1, 0);
                    const estimatedH = 90 + (messages.length > 0 ? 24 + msgLines * 13 : 0);
                    if (currentY - estimatedH < 60) { page = pdfDoc.addPage([A4.w, A4.h]); currentY = A4.h - 50; }

                    const cardX = marginX;
                    const cardW = contentW;

                    // — Header bar —
                    const headerH = 28;
                    page.drawRectangle({ x: cardX, y: currentY - headerH, width: cardW, height: headerH, color: BRAND_DARK });
                    page.drawRectangle({ x: cardX, y: currentY - headerH, width: 5, height: headerH, color: BRAND_YELLOW });
                    page.drawText(`${deudorFull}`, { x: cardX + 14, y: currentY - 19, size: 10, font: bold, color: WHITE });
                    page.drawText(sanitize(d.estado || 'Pendiente'), { x: cardX + cardW - 68, y: currentY - 19, size: 8, font: bold, color: estadoColor });
                    currentY -= headerH + 10;

                    // — Meta info —
                    const pad = 10;
                    const col1X = cardX + pad;
                    const col2X = cardX + cardW * 0.35;
                    const col3X = cardX + cardW * 0.66;
                    const metaSize = 8.5;
                    const metaGap = 15;

                    page.drawText("Fecha:", { x: col1X, y: currentY, size: metaSize, font: bold, color: LIGHT_GRAY_TEXT });
                    page.drawText(fmtDate(d.created_at), { x: col1X + 36, y: currentY, size: metaSize, font, color: BRAND_DARK });
                    page.drawText("Importe:", { x: col2X, y: currentY, size: metaSize, font: bold, color: LIGHT_GRAY_TEXT });
                    page.drawText(`${(d.importe||0).toLocaleString('es-ES')} EUR`, { x: col2X + 46, y: currentY, size: metaSize, font: bold, color: BRAND_DARK });
                    if (!communityFilter) {
                        page.drawText("Comunidad:", { x: col3X, y: currentY, size: metaSize, font: bold, color: LIGHT_GRAY_TEXT });
                        page.drawText(truncate(comName, 22), { x: col3X + 58, y: currentY, size: metaSize, font, color: BRAND_DARK });
                    }
                    currentY -= metaGap;

                    page.drawText("F.Notif.:", { x: col1X, y: currentY, size: metaSize, font: bold, color: LIGHT_GRAY_TEXT });
                    page.drawText(fmtDate(d.fecha_notificacion), { x: col1X + 48, y: currentY, size: metaSize, font, color: BRAND_DARK });
                    page.drawText("Concepto:", { x: col2X, y: currentY, size: metaSize, font: bold, color: LIGHT_GRAY_TEXT });
                    page.drawText(truncate(d.titulo_documento || '-', 30), { x: col2X + 52, y: currentY, size: metaSize, font, color: BRAND_DARK });
                    currentY -= metaGap + 4;

                    // — Timeline —
                    if (messages.length > 0) {
                        page.drawLine({ start:{x: cardX+pad, y: currentY}, end:{x: cardX+cardW-pad, y: currentY}, thickness: 0.5, color: BORDER_LIGHT });
                        currentY -= 12;
                        page.drawText(`TIMELINE (${messages.length} mensaje${messages.length !== 1 ? 's' : ''})`, { x: col1X, y: currentY, size: 9, font: bold, color: BRAND_DARK });
                        currentY -= 14;
                        for (const msg of messages) {
                            if (currentY < 60) { page = pdfDoc.addPage([A4.w, A4.h]); currentY = A4.h - 50; }
                            const msgAuthor = sanitize(msg.autor || 'Sistema');
                            page.drawCircle({ x: col1X + 5, y: currentY - 2, size: 4, color: BRAND_YELLOW });
                            page.drawText(`${msgAuthor}  -  ${fmtDateTime(msg.created_at)}`, { x: col1X + 14, y: currentY, size: 8.5, font: bold, color: BRAND_DARK });
                            currentY -= 13;
                            const res = drawWrappedTextBlock(page, msg.content || '', col1X + 14, currentY, cardW - 30, font, 8.5, 13, GRAY_TEXT, pdfDoc);
                            page = res.page; currentY = res.y;
                            currentY -= 6;
                        }
                    }

                    currentY -= 8;
                    page.drawLine({ start:{x: cardX, y: currentY}, end:{x: cardX+cardW, y: currentY}, thickness: 0.6, color: BORDER_LIGHT });
                    currentY -= 14;
                }
            }
        }

        // ===== DETALLE: CRONOMETRAJE — estilo cards (igual que community-report) =====
        if (sections.includes('cronometraje') && detailTareas.length > 0) {
            page = pdfDoc.addPage([A4.w, A4.h]);
            currentY = A4.h - 50;
            const totalSecs = detailTareas.reduce((s: number, t: any) => s + (t.duration_seconds||0), 0);
            const avgSecs = detailTareas.length > 0 ? Math.round(totalSecs / detailTareas.length) : 0;
            drawSectionHeader(page, `DETALLE DE TAREAS / CRONOMETRAJE (${detailTareas.length})`, `Tareas: ${detailTareas.length}  |  Tiempo total: ${formatDuration(totalSecs)}`);

            // — KPIs —
            const kpiW = (contentW - 20) / 3;
            const kpiH = 46;
            const kpiY = currentY;

            page.drawRectangle({ x: marginX, y: kpiY - kpiH, width: kpiW, height: kpiH, color: BRAND_YELLOW_LIGHT, borderColor: BORDER_LIGHT, borderWidth: 1 });
            page.drawText("TOTAL HORAS", { x: marginX + 10, y: kpiY - 16, size: 7, font: bold, color: ACCENT_TEXT });
            page.drawText(formatDuration(totalSecs), { x: marginX + 10, y: kpiY - 32, size: 12, font: bold, color: BRAND_DARK });

            const kpi2X = marginX + kpiW + 10;
            page.drawRectangle({ x: kpi2X, y: kpiY - kpiH, width: kpiW, height: kpiH, color: BRAND_YELLOW_LIGHT, borderColor: BORDER_LIGHT, borderWidth: 1 });
            page.drawText("TAREAS REALIZADAS", { x: kpi2X + 10, y: kpiY - 16, size: 7, font: bold, color: ACCENT_TEXT });
            page.drawText(`${detailTareas.length} Tareas`, { x: kpi2X + 10, y: kpiY - 32, size: 12, font: bold, color: BRAND_DARK });

            const kpi3X = marginX + (kpiW + 10) * 2;
            page.drawRectangle({ x: kpi3X, y: kpiY - kpiH, width: kpiW, height: kpiH, color: BRAND_YELLOW_LIGHT, borderColor: BORDER_LIGHT, borderWidth: 1 });
            page.drawText("MEDIA POR TAREA", { x: kpi3X + 10, y: kpiY - 16, size: 7, font: bold, color: ACCENT_TEXT });
            page.drawText(`${formatDuration(avgSecs)} / Tarea`, { x: kpi3X + 10, y: kpiY - 32, size: 12, font: bold, color: BRAND_DARK });

            currentY = kpiY - kpiH - 24;

            // — Cards por tarea —
            const pieColors = [BRAND_YELLOW, rgb(0, 0.77, 0.62), rgb(1, 0.5, 0.26), rgb(0.2, 0.6, 1), GRAY_TEXT];

            for (let i = 0; i < detailTareas.length; i++) {
                const t = detailTareas[i];
                const prof = Array.isArray(t.profiles) ? t.profiles[0] : t.profiles;
                const gestorName = sanitize((prof as any)?.nombre || '-');
                const comName = sanitize((t.comunidades as any)?.nombre_cdad || '-');
                const durStr = formatDuration(t.duration_seconds || 0);
                const accentColor = pieColors[i % pieColors.length];

                const estimatedH = 90 + Math.ceil(sanitize(t.nota || '').length / 90) * 13;
                if (currentY - estimatedH < 60) { page = pdfDoc.addPage([A4.w, A4.h]); currentY = A4.h - 50; }

                const cardX = marginX;
                const cardW = contentW;

                // — Header bar —
                const headerH = 28;
                page.drawRectangle({ x: cardX, y: currentY - headerH, width: cardW, height: headerH, color: BRAND_DARK });
                page.drawRectangle({ x: cardX, y: currentY - headerH, width: 5, height: headerH, color: accentColor });
                const tipoLabel = sanitize(t.tipo_tarea || 'Tarea');
                page.drawText(tipoLabel, { x: cardX + 14, y: currentY - 19, size: 10, font: bold, color: WHITE });
                page.drawText(durStr, { x: cardX + cardW - 60, y: currentY - 19, size: 10, font: bold, color: BRAND_YELLOW });
                currentY -= headerH + 10;

                // — Meta info —
                const pad = 10;
                const col1X = cardX + pad;
                const col2X = cardX + cardW * 0.35;
                const col3X = cardX + cardW * 0.66;
                const metaSize = 8.5;
                const metaGap = 15;

                page.drawText("Fecha:", { x: col1X, y: currentY, size: metaSize, font: bold, color: LIGHT_GRAY_TEXT });
                page.drawText(fmtDate(t.start_at), { x: col1X + 36, y: currentY, size: metaSize, font, color: BRAND_DARK });
                page.drawText("Gestor:", { x: col2X, y: currentY, size: metaSize, font: bold, color: LIGHT_GRAY_TEXT });
                page.drawText(truncate(gestorName, 24), { x: col2X + 42, y: currentY, size: metaSize, font, color: BRAND_DARK });
                if (!communityFilter) {
                    page.drawText("Comunidad:", { x: col3X, y: currentY, size: metaSize, font: bold, color: LIGHT_GRAY_TEXT });
                    page.drawText(truncate(comName, 20), { x: col3X + 58, y: currentY, size: metaSize, font, color: BRAND_DARK });
                }
                currentY -= metaGap + 4;

                // — Separador + Nota —
                page.drawLine({ start:{x: cardX+pad, y: currentY}, end:{x: cardX+cardW-pad, y: currentY}, thickness: 0.5, color: BORDER_LIGHT });
                currentY -= 12;
                page.drawText("Nota:", { x: col1X, y: currentY, size: 9, font: bold, color: BRAND_DARK });
                currentY -= 13;
                const noteResult = drawWrappedTextBlock(page, t.nota || '-', col1X + 6, currentY, cardW - 24, font, 8.5, 13, GRAY_TEXT, pdfDoc);
                page = noteResult.page; currentY = noteResult.y;

                currentY -= 8;
                page.drawLine({ start:{x: cardX, y: currentY}, end:{x: cardX+cardW, y: currentY}, thickness: 0.6, color: BORDER_LIGHT });
                currentY -= 14;
            }
        }

        console.log("[Report] Adding footers...");
        const pages = pdfDoc.getPages();
        const footerText = emisorData.nombre || "Serincosol | Administración de Fincas Málaga";
        const footerSize = 8;
        const footerFont = font;

        for (const p of pages) {
            const { width } = p.getSize();
            const textWidth = footerFont.widthOfTextAtSize(footerText, footerSize);
            p.drawText(footerText, {
                x: width / 2 - textWidth / 2,
                y: 25,
                size: footerSize,
                font: footerFont,
                color: rgb(0.5, 0.5, 0.5),
            });
        }

        console.log("[Report] Saving PDF...");
        const pdfBytes = await pdfDoc.save();

        const now = new Date();
        const dateStr = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
        const safeName = (communityName || 'Todas').replace(/[^a-z0-9]/gi, '_');
        const filename = `${dateStr}_Reporte_${safeName}.pdf`;

        return new Response(pdfBytes as any, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`
            }
        });

    } catch (err: any) {
        console.error("[Report] Final error:", err);
        return NextResponse.json({ error: "Error interno: " + err.message }, { status: 500 });
    }
}
