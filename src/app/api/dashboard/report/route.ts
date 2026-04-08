import { NextResponse } from "next/server";
import { supabaseRouteClient } from "@/lib/supabase/route";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { createClient } from "@supabase/supabase-js";
import { logActivity } from "@/lib/logActivity";
import { getEmisor } from "@/lib/getEmisor";

// --- CONSTANTS & HELPERS ---
const A4 = { w: 595.28, h: 841.89 };
const YELLOW = rgb(0.98, 0.84, 0.40);
const BORDER = rgb(0.82, 0.82, 0.82);
const BLACK = rgb(0, 0, 0);

// EMISOR se carga dinámicamente desde company_settings en el handler POST

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    const sanitize = (text: string) => (text || '')
        .replace(/\r\n|\n|\r/g, ' ')
        .split('').map(c => { const code = c.charCodeAt(0); return (code >= 0x20 && code <= 0xff) ? c : (code < 0x20 ? '' : ' '); }).join('')
        .replace(/\s{2,}/g, ' ').trim();
    const truncate = (text: string, max: number) => { const t = sanitize(text); return t.length > max ? t.slice(0, max - 3) + '...' : t || '-'; };
    const fmtDate = (d: string | null | undefined) => { if (!d) return '-'; try { const dt = new Date(d); if (isNaN(dt.getTime())) return d; return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`; } catch { return d; } };

    const communityFilter = selectedCommunityId && selectedCommunityId !== 'all' ? selectedCommunityId : null;
    let startIso: string | null = dateFrom ? dateFrom + 'T00:00:00' : null;
    let endIso: string | null = dateTo ? dateTo + 'T23:59:59' : null;

    // Fetch detail data
    let detailIncidencias: any[] = [];
    let detailDeudas: any[] = [];
    let detailTareas: any[] = [];
    let timelineByIncidencia: Map<number, { content: string; autor: string; created_at: string }[]> = new Map();
    let timelineByDeuda: Map<number, { content: string; autor: string; created_at: string }[]> = new Map();

    if (sections.includes('incidencias')) {
        let q = supabaseAdmin
            .from('incidencias')
            .select('id, nombre_cliente, urgencia, resuelto, estado, created_at, mensaje, comunidades(nombre_cdad), profiles:gestor_asignado(nombre)')
            .order('created_at', { ascending: false });
        if (communityFilter) q = q.eq('comunidad_id', communityFilter);
        if (startIso) q = q.gte('created_at', startIso);
        if (endIso) q = q.lte('created_at', endIso);
        const { data } = await q;
        detailIncidencias = data || [];

        if (includeTimeline && detailIncidencias.length > 0) {
            const incIds = detailIncidencias.map((i: any) => i.id);
            const { data: msgs } = await supabaseAdmin
                .from('record_messages')
                .select('entity_id, content, created_at, profiles:user_id(nombre)')
                .eq('entity_type', 'incidencia')
                .in('entity_id', incIds)
                .order('created_at', { ascending: true });
            for (const msg of (msgs || [])) {
                const prof = Array.isArray(msg.profiles) ? msg.profiles[0] : msg.profiles;
                const entry = { content: msg.content || '', autor: (prof as any)?.nombre || 'Sistema', created_at: msg.created_at };
                const list = timelineByIncidencia.get(msg.entity_id) || [];
                list.push(entry);
                timelineByIncidencia.set(msg.entity_id, list);
            }
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
        const { data } = await q;
        detailDeudas = data || [];

        if (includeTimeline && detailDeudas.length > 0) {
            const deudaIds = detailDeudas.map((d: any) => d.id);
            const { data: msgs } = await supabaseAdmin
                .from('record_messages')
                .select('entity_id, content, created_at, profiles:user_id(nombre)')
                .eq('entity_type', 'morosidad')
                .in('entity_id', deudaIds)
                .order('created_at', { ascending: true });
            for (const msg of (msgs || [])) {
                const prof = Array.isArray(msg.profiles) ? msg.profiles[0] : msg.profiles;
                const entry = { content: msg.content || '', autor: (prof as any)?.nombre || 'Sistema', created_at: msg.created_at };
                const list = timelineByDeuda.get(msg.entity_id) || [];
                list.push(entry);
                timelineByDeuda.set(msg.entity_id, list);
            }
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
        const { data } = await q;
        detailTareas = data || [];
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

        currentY -= 50; // Increased space between charts and table
        if (currentY < 180) { page = pdfDoc.addPage([A4.w, A4.h]); currentY = A4.h - 50; }

        // 5) User Performance Table
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
        }

        // 6) Cronometraje Section
        if (cronoStats) {
            currentY -= 30;
            if (currentY < 250) { page = pdfDoc.addPage([A4.w, A4.h]); currentY = A4.h - 50; }

            page.drawText("RENDIMIENTO DE CRONOMETRAJE", { x: marginX, y: currentY, size: 12, font: bold });
            currentY -= 25;

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

            if (charts.cronoTopCommunities) {
                if (currentY < 200) { page = pdfDoc.addPage([A4.w, A4.h]); currentY = A4.h - 50; }
                page.drawText("Top Comunidades por Tiempo", { x: marginX, y: currentY, size: 12, font: bold });
                currentY -= 15;
                currentY = await drawImage(pdfDoc, page, charts.cronoTopCommunities, marginX, currentY, contentW);
                currentY -= 20;
            }

            if (charts.cronoGestor) {
                if (currentY < 200) { page = pdfDoc.addPage([A4.w, A4.h]); currentY = A4.h - 50; }
                page.drawText("Rendimiento por Gestor", { x: marginX, y: currentY, size: 12, font: bold });
                currentY -= 15;
                currentY = await drawImage(pdfDoc, page, charts.cronoGestor, marginX, currentY, contentW);
                currentY -= 20;
            }

            if (charts.cronoWeekly) {
                if (currentY < 200) { page = pdfDoc.addPage([A4.w, A4.h]); currentY = A4.h - 50; }
                page.drawText("Evolución Semanal de Horas", { x: marginX, y: currentY, size: 12, font: bold });
                currentY -= 15;
                currentY = await drawImage(pdfDoc, page, charts.cronoWeekly, marginX, currentY, contentW);
                currentY -= 20;
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

        // ===== DETALLE: INCIDENCIAS =====
        if (sections.includes('incidencias')) {
            page = pdfDoc.addPage([A4.w, A4.h]);
            currentY = A4.h - 50;
            const incPend = detailIncidencias.filter((i: any) => !i.resuelto).length;
            const incRes = detailIncidencias.filter((i: any) => i.resuelto).length;
            drawSectionHeader(page, `DETALLE DE INCIDENCIAS (${detailIncidencias.length})`, `Pendientes: ${incPend}  |  Resueltas: ${incRes}  |  Total: ${detailIncidencias.length}`);
            if (detailIncidencias.length === 0) {
                page.drawText('No se encontraron incidencias en el periodo seleccionado.', { x: marginX+5, y: currentY, size: 9, font, color: rgb(0.5,0.5,0.5) });
            } else {
                const incCols = !communityFilter
                    ? [{label:'Fecha',w:58},{label:'Comunidad',w:110},{label:'Nombre',w:100},{label:'Urgencia',w:58},{label:'Estado',w:62},{label:'Gestor',w:75},{label:'Descripcion',w:32}]
                    : [{label:'Fecha',w:65},{label:'Nombre',w:140},{label:'Urgencia',w:65},{label:'Estado',w:70},{label:'Gestor',w:90},{label:'Descripcion',w:65}];
                drawTH(page, incCols);
                for (let i=0; i<detailIncidencias.length; i++) {
                    if (currentY < 50) { page = pdfDoc.addPage([A4.w, A4.h]); currentY = A4.h - 50; drawTH(page, incCols); }
                    const inc = detailIncidencias[i];
                    const prof = Array.isArray(inc.profiles) ? inc.profiles[0] : inc.profiles;
                    const gestor = truncate((prof as any)?.nombre||'-', 14);
                    const estado = inc.resuelto ? 'Resuelta' : (inc.estado||'Pendiente');
                    const urgColor = inc.urgencia==='Alta' ? 'red' : inc.urgencia==='Media' ? 'yellow' : 'green';
                    const estadoColor = inc.resuelto ? 'green' : 'yellow';
                    const comName = truncate((inc.comunidades as any)?.nombre_cdad||'-', 17);
                    if (!communityFilter) {
                        drawTR(page, [fmtDate(inc.created_at), comName, truncate(inc.nombre_cliente||'-',16), truncate(inc.urgencia||'-',9), truncate(estado,10), gestor, truncate(inc.mensaje||'-',5)], incCols, i, [null,'bold',null,urgColor,estadoColor,null,null]);
                    } else {
                        drawTR(page, [fmtDate(inc.created_at), truncate(inc.nombre_cliente||'-',22), truncate(inc.urgencia||'-',10), truncate(estado,11), gestor, truncate(inc.mensaje||'-',10)], incCols, i, [null,null,urgColor,estadoColor,null,null]);
                    }
                }
            }
            // Timeline incidencias
            if (includeTimeline && timelineByIncidencia.size > 0) {
                page = pdfDoc.addPage([A4.w, A4.h]);
                currentY = A4.h - 50;
                drawSectionHeader(page, "MENSAJES DEL TIMELINE — INCIDENCIAS", "");
                for (const inc of detailIncidencias) {
                    const msgs = timelineByIncidencia.get(inc.id);
                    if (!msgs || msgs.length === 0) continue;
                    if (currentY < 100) { page = pdfDoc.addPage([A4.w, A4.h]); currentY = A4.h - 50; }
                    const incTitle = truncate(inc.nombre_cliente || `Incidencia #${inc.id}`, 50);
                    const comLabel = (inc.comunidades as any)?.nombre_cdad ? ` — ${truncate((inc.comunidades as any).nombre_cdad, 25)}` : '';
                    page.drawRectangle({ x: marginX, y: currentY - 18, width: contentW, height: 18, color: rgb(0.95,0.95,0.95) });
                    page.drawRectangle({ x: marginX, y: currentY - 18, width: 3, height: 18, color: YELLOW });
                    page.drawText(`${incTitle}${comLabel}  (${msgs.length} mensaje${msgs.length !== 1 ? 's' : ''})`, { x: marginX+8, y: currentY-13, size: 8, font: bold, color: rgb(0.2,0.2,0.2) });
                    currentY -= 22;
                    for (const msg of msgs) {
                        if (currentY < 50) { page = pdfDoc.addPage([A4.w, A4.h]); currentY = A4.h - 50; }
                        page.drawText(`${fmtDate(msg.created_at)}  ${sanitize(msg.autor)}:`, { x: marginX+10, y: currentY, size: 7.5, font: bold, color: rgb(0.4,0.4,0.4) });
                        currentY -= 11;
                        let remaining = sanitize(msg.content);
                        while (remaining.length > 0) {
                            if (currentY < 50) { page = pdfDoc.addPage([A4.w, A4.h]); currentY = A4.h - 50; }
                            const line = remaining.length > 88 ? remaining.slice(0, 88) : remaining;
                            remaining = remaining.slice(line.length);
                            page.drawText(line, { x: marginX+14, y: currentY, size: 7.5, font, color: rgb(0.2,0.2,0.2) });
                            currentY -= 11;
                        }
                        currentY -= 3;
                    }
                    currentY -= 8;
                }
            }
        }

        // ===== DETALLE: DEUDAS =====
        if (sections.includes('deudas')) {
            page = pdfDoc.addPage([A4.w, A4.h]);
            currentY = A4.h - 50;
            const totalImporte = detailDeudas.reduce((s: number, d: any) => s + (d.importe||0), 0);
            const pendCount = detailDeudas.filter((d: any) => d.estado==='Pendiente').length;
            drawSectionHeader(page, `DETALLE DE DEUDAS / MOROSIDAD (${detailDeudas.length})`, `Pendientes: ${pendCount}  |  Importe total: ${totalImporte.toLocaleString('es-ES')} EUR  |  Registros: ${detailDeudas.length}`);
            if (detailDeudas.length === 0) {
                page.drawText('No se encontraron deudas en el periodo seleccionado.', { x: marginX+5, y: currentY, size: 9, font, color: rgb(0.5,0.5,0.5) });
            } else {
                const deudaCols = !communityFilter
                    ? [{label:'Fecha',w:58},{label:'Comunidad',w:100},{label:'Deudor',w:115},{label:'Importe',w:72},{label:'Estado',w:60},{label:'F.Notif.',w:65},{label:'Concepto',w:25}]
                    : [{label:'Fecha',w:65},{label:'Deudor',w:150},{label:'Importe',w:80},{label:'Estado',w:70},{label:'F.Notificacion',w:85},{label:'Concepto',w:45}];
                drawTH(page, deudaCols);
                for (let i=0; i<detailDeudas.length; i++) {
                    if (currentY < 50) { page = pdfDoc.addPage([A4.w, A4.h]); currentY = A4.h - 50; drawTH(page, deudaCols); }
                    const d = detailDeudas[i];
                    const isPagado = (d.estado||'').toLowerCase()==='pagado';
                    const stColor = isPagado ? 'green' : 'yellow';
                    const deudorName = truncate(`${d.nombre_deudor||''} ${d.apellidos||''}`.trim()||'-', 20);
                    const comName = truncate((d.comunidades as any)?.nombre_cdad||'-', 16);
                    if (!communityFilter) {
                        drawTR(page, [fmtDate(d.created_at), comName, deudorName, `${(d.importe||0).toLocaleString('es-ES')} EUR`, truncate(d.estado||'-',10), fmtDate(d.fecha_notificacion), truncate(d.titulo_documento||'-',4)], deudaCols, i, [null,'bold',null,'bold',stColor,null,null]);
                    } else {
                        drawTR(page, [fmtDate(d.created_at), deudorName, `${(d.importe||0).toLocaleString('es-ES')} EUR`, truncate(d.estado||'-',11), fmtDate(d.fecha_notificacion), truncate(d.titulo_documento||'-',8)], deudaCols, i, [null,null,'bold',stColor,null,null]);
                    }
                }
            }
            // Timeline deudas
            if (includeTimeline && timelineByDeuda.size > 0) {
                page = pdfDoc.addPage([A4.w, A4.h]);
                currentY = A4.h - 50;
                drawSectionHeader(page, "MENSAJES DEL TIMELINE — DEUDAS / MOROSIDAD", "");
                for (const d of detailDeudas) {
                    const msgs = timelineByDeuda.get(d.id);
                    if (!msgs || msgs.length === 0) continue;
                    if (currentY < 100) { page = pdfDoc.addPage([A4.w, A4.h]); currentY = A4.h - 50; }
                    const deudorLabel = truncate(`${d.nombre_deudor||''} ${d.apellidos||''}`.trim() || `Deuda #${d.id}`, 50);
                    const comLabel = (d.comunidades as any)?.nombre_cdad ? ` — ${truncate((d.comunidades as any).nombre_cdad, 25)}` : '';
                    page.drawRectangle({ x: marginX, y: currentY - 18, width: contentW, height: 18, color: rgb(0.95,0.95,0.95) });
                    page.drawRectangle({ x: marginX, y: currentY - 18, width: 3, height: 18, color: YELLOW });
                    page.drawText(`${deudorLabel}${comLabel}  (${msgs.length} mensaje${msgs.length !== 1 ? 's' : ''})`, { x: marginX+8, y: currentY-13, size: 8, font: bold, color: rgb(0.2,0.2,0.2) });
                    currentY -= 22;
                    for (const msg of msgs) {
                        if (currentY < 50) { page = pdfDoc.addPage([A4.w, A4.h]); currentY = A4.h - 50; }
                        page.drawText(`${fmtDate(msg.created_at)}  ${sanitize(msg.autor)}:`, { x: marginX+10, y: currentY, size: 7.5, font: bold, color: rgb(0.4,0.4,0.4) });
                        currentY -= 11;
                        let remaining = sanitize(msg.content);
                        while (remaining.length > 0) {
                            if (currentY < 50) { page = pdfDoc.addPage([A4.w, A4.h]); currentY = A4.h - 50; }
                            const line = remaining.length > 88 ? remaining.slice(0, 88) : remaining;
                            remaining = remaining.slice(line.length);
                            page.drawText(line, { x: marginX+14, y: currentY, size: 7.5, font, color: rgb(0.2,0.2,0.2) });
                            currentY -= 11;
                        }
                        currentY -= 3;
                    }
                    currentY -= 8;
                }
            }
        }

        // ===== DETALLE: CRONOMETRAJE =====
        if (sections.includes('cronometraje') && detailTareas.length > 0) {
            page = pdfDoc.addPage([A4.w, A4.h]);
            currentY = A4.h - 50;
            const totalSecs = detailTareas.reduce((s: number, t: any) => s + (t.duration_seconds||0), 0);
            drawSectionHeader(page, `DETALLE DE TAREAS / CRONOMETRAJE (${detailTareas.length})`, `Tareas: ${detailTareas.length}  |  Tiempo total: ${formatDuration(totalSecs)}`);
            const tCols = !communityFilter
                ? [{label:'Fecha',w:58},{label:'Comunidad',w:110},{label:'Gestor',w:90},{label:'Tipo',w:90},{label:'Duracion',w:65},{label:'Nota',w:82}]
                : [{label:'Fecha',w:65},{label:'Gestor',w:120},{label:'Tipo',w:110},{label:'Duracion',w:75},{label:'Nota',w:125}];
            drawTH(page, tCols);
            for (let i=0; i<detailTareas.length; i++) {
                if (currentY < 50) { page = pdfDoc.addPage([A4.w, A4.h]); currentY = A4.h - 50; drawTH(page, tCols); }
                const t = detailTareas[i];
                const prof = Array.isArray(t.profiles) ? t.profiles[0] : t.profiles;
                const comName = truncate((t.comunidades as any)?.nombre_cdad||'-', 18);
                if (!communityFilter) {
                    drawTR(page, [fmtDate(t.start_at), comName, truncate((prof as any)?.nombre||'-',14), truncate(t.tipo_tarea||'Otros',14), formatDuration(t.duration_seconds||0), truncate(t.nota||'-',13)], tCols, i, [null,'bold',null,null,null,null]);
                } else {
                    drawTR(page, [fmtDate(t.start_at), truncate((prof as any)?.nombre||'-',19), truncate(t.tipo_tarea||'Otros',17), formatDuration(t.duration_seconds||0), truncate(t.nota||'-',20)], tCols, i, [null,null,null,null,null]);
                }
            }
        }

        console.log("[Report] Adding footers...");
        const pages = pdfDoc.getPages();
        const footerText = "Serincosol | Administración de Fincas Málaga";
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
