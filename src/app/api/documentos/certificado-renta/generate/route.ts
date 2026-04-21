
import { NextResponse } from "next/server";
import { supabaseRouteClient } from "@/lib/supabase/route";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fs from "node:fs/promises";
import path from "node:path";
import { getEmisor } from "@/lib/getEmisor";

// Helper: Service Role Client to bypass RLS for assets
// ---------- helpers ----------
const pageW = 595.28; // A4
const pageH = 841.89;

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

function v(val: any) {
    return String(val ?? "").trim();
}

// Nueva función de descarga desde Supabase Storage (usando Admin)
async function downloadAssetPng(filePath: string) {
    // Try primary path
    let { data, error } = await supabaseAdmin.storage
        .from("doc-assets")
        .download(filePath);

    // Fallback: try root if not found in folder
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
        console.warn(`Asset ${filePath} not found (even with admin):`, error?.message);
        return null;
    }

    const ab = await data.arrayBuffer();
    return Buffer.from(ab);
}

// Builder actualizado para recibir Buffers
export async function buildRentaCertificatePdf(
    data: any,
    assets: { logoBytes?: Buffer | null; selloBytes?: Buffer | null }
) {
    const { nombre: emisorNombre, colegiado: colegiadoNombre, colegioCiudad } = await getEmisor();
    const adminName = colegiadoNombre || "Roberto Díaz Rodríguez";
    const provinciaCol = colegioCiudad || "Málaga";

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([pageW, pageH]);

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const BLACK = rgb(0, 0, 0);
    const GREY = rgb(0.35, 0.35, 0.35);

    const marginX = 70;
    const maxTextW = pageW - marginX * 2;

    // 1) Cabecera: logo
    let headerBottomY = pageH - 30;

    if (assets.logoBytes) {
        try {
            const img = await pdfDoc.embedPng(assets.logoBytes);
            const targetW = pageW - 20;
            const targetH = (img.height / img.width) * targetW;
            const x = 10;
            const y = pageH - 10 - targetH;
            page.drawImage(img, { x, y, width: targetW, height: targetH });
            headerBottomY = y - 10;
        } catch (e) {
            console.error("Error embedding logo", e);
        }
    }

    // 2) Título
    const title = "CERTIFICADO DE IMPUTACIÓN DE RENTAS";
    const titleSize = 14;
    const titleW = bold.widthOfTextAtSize(title, titleSize);
    page.drawText(title, {
        x: (pageW - titleW) / 2,
        y: headerBottomY - 40,
        size: titleSize,
        font: bold,
        color: BLACK,
    });

    // 3) Texto principal
    const nombre = v(data["Nombre"]);
    const apellidos = v(data["Apellidos"]);
    const nif = v(data["Nif"]);
    const dir2 = v(data["Dirección 2"]);
    const piso = v(data["Piso"]);
    const cp = v(data["CP"]);
    const poblacion = v(data["Poblacion"]);
    const provincia = v(data["Provincia"]);

    const dias = v(data["DIAS"]);
    const porcentaje = v(data["%"]);
    const participacion = v(data["Participación"]);
    const ganancia = v(data["Ganancia"]);
    const retenciones = v(data["Retenciones"]);

    const clave1 = v(data["Clave 1"]);
    const subclave = v(data["Subclave"]);
    const clave2 = v(data["Clave 2"]);
    const naturaleza = v(data["Naturaleza"]);
    const situacion = v(data["Situación"]);
    const declarado = v(data["Declarado"]);

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

    const fechaEmision = formatDateEU(data["Fecha emisión"]);

    // Texto legal
    const p1 =
        `${adminName}, Administrador de Fincas colegiado, actuando en calidad de Secretario–Administrador, ` +
        `CERTIFICA que en relación con el titular:\n` +
        `${apellidos}${apellidos && nombre ? ", " : ""}${nombre} con DNI/NIF ${nif}, ` +
        `domiciliado en ${dir2}${piso ? `, ${piso}` : ""}, ${cp} ${poblacion} (${provincia}).`;

    const p2 =
        `Que, a efectos de imputación de rentas, constan los siguientes datos:\n` +
        `- Días: ${dias}\n` +
        `- %: ${porcentaje}\n` +
        `- Participación: ${participacion}\n` +
        `- Ganancia: ${ganancia}\n` +
        `- Retenciones: ${retenciones}\n` +
        `- Clave 1: ${clave1}   Subclave: ${subclave}   Clave 2: ${clave2}\n` +
        `- Naturaleza: ${naturaleza}\n` +
        `- Situación: ${situacion}\n` +
        `- Declarado: ${declarado}`;

    // 4) Render del texto
    let y = headerBottomY - 85;
    const bodySize = 10.5;
    const lineH = 15;

    const drawParagraph = (text: string, opts?: { bold?: boolean }) => {
        const f = opts?.bold ? bold : font;
        const blocks = String(text).split("\n");
        for (const b of blocks) {
            if (!b.trim()) {
                y -= lineH;
                continue;
            }
            const lines = wrapText(b, f, bodySize, maxTextW);
            for (const ln of lines) {
                page.drawText(ln, { x: marginX, y, size: bodySize, font: f, color: BLACK });
                y -= lineH;
            }
        }
    };

    drawParagraph(p1);
    y -= 10;

    // CERTIFICO
    const cert = "CERTIFICO";
    const certSize = 12;
    const certW = bold.widthOfTextAtSize(cert, certSize);
    page.drawText(cert, {
        x: (pageW - certW) / 2,
        y,
        size: certSize,
        font: bold,
        color: BLACK,
    });
    y -= 26;

    drawParagraph(p2);
    y -= 18;

    // 5) Pie
    const now = new Date();
    const todayEU = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
    const fechaStr = fechaEmision || todayEU;
    const pie = `Lo que certifica a los efectos oportunos en ${provinciaCol} a ${fechaStr}.`;

    const pieLines = wrapText(pie, font, bodySize, maxTextW);
    for (const ln of pieLines) {
        page.drawText(ln, { x: marginX, y, size: bodySize, font, color: GREY });
        y -= lineH;
    }

    // 6) Sello y firma
    if (assets.selloBytes) {
        try {
            const seal = await pdfDoc.embedPng(assets.selloBytes);
            const sealW = 160;
            const sealH = (seal.height / seal.width) * sealW;
            const sx = marginX;
            const sy = 160;
            page.drawImage(seal, { x: sx, y: sy, width: sealW, height: sealH });
        } catch (e) {
            console.error("Error embedding seal", e);
        }
    }

    // Firma texto
    page.drawText(adminName, { x: marginX, y: 120, size: 10.5, font: bold, color: BLACK });
    page.drawText("Administrador de fincas", { x: marginX, y: 102, size: 10.5, font, color: BLACK });

    // 7. Global Footer
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

// POST Handler
const DOC_KEY = "certificado_renta";
const TITLE_LOG = "Certificado Imputación Renta";

export async function POST(req: Request) {
    const supabase = await supabaseRouteClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const payload = await req.json().catch(() => null);
    if (!payload) return NextResponse.json({ error: "Body inválido" }, { status: 400 });

    try {
        // 1) Descargar assets (header y firma) usando la configuración del emisor
        const { headerPath, firmaPath } = await getEmisor();
        const logoBytes = await downloadAssetPng(headerPath || "certificados/logo-retenciones.png");
        const selloBytes = firmaPath ? await downloadAssetPng(firmaPath) : null;

        // 2) Generar PDF usando assets descargados
        const pdfBytes = await buildRentaCertificatePdf(payload, { logoBytes, selloBytes });

        // 3) Subir a Storage (documento generado)
        const clean = (s: string) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9\-_.]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
        const now = new Date();
        const dateStr = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;

        const pisoSafe = clean(payload["Piso"] || "0");
        const nombreFull = clean((payload["Apellidos"] || "") + " " + (payload["Nombre"] || ""));

        // CERT_RENTA_Piso_'Apellidos y Nombre_fecha europea actual
        const fileName = `CERT_RENTA_${pisoSafe}_${nombreFull}_${dateStr}.pdf`;
        const filePath = `certificados/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('documentos_administrativos')
            .upload(filePath, pdfBytes, { contentType: 'application/pdf', upsert: true });

        if (uploadError) throw uploadError;

        // 4) Log submission
        const { data: submission } = await supabase.from("doc_submissions").insert({
            user_id: user.id,
            doc_key: DOC_KEY,
            title: `${TITLE_LOG} - ${payload.Nombre || 'Sin nombre'}`,
            payload,
            pdf_path: filePath,
        }).select().single();

        // 5) Log Activity (Server-side insert)
        await supabase.from('activity_logs').insert({
            user_id: user.id,
            user_name: user.user_metadata?.nombre || user.email || 'Sistema',
            action: 'generate',
            entity_type: 'documento',
            entity_id: submission?.id || 0,
            entity_name: TITLE_LOG,
            details: JSON.stringify({
                doc_key: DOC_KEY,
                titulo: TITLE_LOG,
                cliente: payload.Nombre || "Desconocido",
            })
        });

        // 6) Signed URL
        const { data: signedData } = await supabase.storage
            .from("documentos_administrativos")
            .createSignedUrl(filePath, 60 * 10);

        return NextResponse.json({
            pdfUrl: signedData?.signedUrl,
            submissionId: submission?.id
        });

    } catch (e: any) {
        console.error("Endpoint error:", e);
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
}
