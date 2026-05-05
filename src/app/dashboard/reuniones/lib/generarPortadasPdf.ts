import type jsPDFType from 'jspdf';

export type PortadaKind = 'convocatoria' | 'acta';

export interface EmisorFooter {
    direccion?: string;
    telefono?: string;
    cif?: string;
}

export interface PortadaData {
    kind: PortadaKind;
    tipoReunion: string;
    fecha: string;
    comunidad: string;
    direccion: string;
    emisor?: EmisorFooter;
}

const TIPO_LABELS: Record<string, string> = {
    JGO: 'Junta General Ordinaria',
    JGE: 'Junta General Extraordinaria',
    JV:  'Junta de Vocales',
    JD:  'Junta Directiva',
};

const loadFondo = async (): Promise<{ dataUrl: string; width: number; height: number }> => {
    const res = await fetch('/fondo-portada.png');
    if (!res.ok) throw new Error('No se pudo cargar la imagen de fondo');
    const blob = await res.blob();
    const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
    const { width, height } = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = reject;
        img.src = dataUrl;
    });
    return { dataUrl, width, height };
};

export const generarPortadaPdf = async (data: PortadaData): Promise<Blob> => {
    const { default: jsPDF } = await import('jspdf');
    const doc: jsPDFType = new jsPDF('portrait', 'mm', 'a4');

    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    // Imagen al ancho completo manteniendo proporción.
    // Si es más alta de lo permitido (3/4 de la página), se recorta el exceso inferior.
    const maxH = pageH * 0.82;
    let imgH = maxH;
    try {
        const fondo = await loadFondo();
        const scale = pageW / fondo.width;
        const drawW = pageW;
        const fullDrawH = fondo.height * scale;

        if (fullDrawH <= maxH) {
            // Cabe entera: dibujar normal
            doc.addImage(fondo.dataUrl, 'PNG', 0, 0, drawW, fullDrawH);
            imgH = fullDrawH;
        } else {
            // Excede la zona: dibujarla entera y tapar el exceso con blanco
            doc.addImage(fondo.dataUrl, 'PNG', 0, 0, drawW, fullDrawH);
            doc.setFillColor(255, 255, 255);
            doc.rect(0, maxH, drawW, fullDrawH - maxH, 'F');
            imgH = maxH;
        }

        // Tapa una posible línea de 1px del borde inferior visible de la imagen
        doc.setFillColor(255, 255, 255);
        doc.rect(0, imgH - 0.8, drawW, 1.5, 'F');
    } catch (err) {
        console.error('[generarPortadaPdf] fondo error:', err);
    }

    const tipoLabel = TIPO_LABELS[data.tipoReunion] ?? data.tipoReunion;
    const titulo = data.kind === 'convocatoria' ? 'Convocatoria' : 'Acta';

    // Bloque de texto centrado horizontalmente debajo de la imagen
    const centerX = pageW / 2;
    let y = imgH + 5.5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(20, 20, 20);
    doc.text(`${titulo} ${tipoLabel}`, centerX, y, { align: 'center' });

    y += 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(60, 60, 60);
    doc.text(`Fecha: ${data.fecha}`, centerX, y, { align: 'center' });

    y += 12;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(20, 20, 20);
    doc.text(`CDAD. PROP. ${data.comunidad}`, centerX, y, { align: 'center' });

    if (data.direccion) {
        y += 7;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(12);
        doc.setTextColor(60, 60, 60);
        doc.text(data.direccion, centerX, y, { align: 'center' });
    }

    if (data.emisor) {
        const e = data.emisor;
        const marginX = 15;
        const footerY = pageH - 4;
        const usableW = pageW - marginX * 2;
        const colW = usableW / 3;

        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.2);
        doc.line(marginX, footerY - 6, pageW - marginX, footerY - 6);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(90, 90, 90);

        if (e.direccion) doc.text(e.direccion, marginX + colW / 2, footerY, { align: 'center' });
        if (e.telefono)  doc.text(`Tel. ${e.telefono}`, marginX + colW + colW / 2, footerY, { align: 'center' });
        if (e.cif)       doc.text(`CIF ${e.cif}`, marginX + colW * 2 + colW / 2, footerY, { align: 'center' });
    }

    return doc.output('blob');
};

/** Segmento seguro para nombres de archivo (sin espacios ni caracteres raros). */
const safeFileSegment = (s: string | undefined, fallback: string) => {
    const t = String(s || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9\-_.]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
    return t || fallback;
};

/**
 * Acta_TIPO_codigo_NombreComunidad_DDMMYYYY.pdf · Convocatoria_TIPO_codigo_NombreComunidad_DDMMYYYY.pdf
 * Si no hay código, se usa solo el nombre de la comunidad.
 */
export const nombreArchivo = (
    kind: PortadaKind,
    tipoReunion: string,
    codigoComunidad: string | undefined,
    fechaIso: string,
    nombreComunidad?: string
) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fechaIso || '');
    const fecha = m ? `${m[3]}-${m[2]}-${m[1]}` : (fechaIso || '').replace(/[^0-9]/g, '');
    const tag = kind === 'convocatoria' ? 'Convocatoria' : 'Acta';
    const tipo = safeFileSegment(tipoReunion, 'TIPO');
    const codigo = safeFileSegment(codigoComunidad, '');
    const nombre = safeFileSegment(nombreComunidad, '');
    const comunidad = [codigo, nombre].filter(Boolean).join('_') || 'SIN_COMUNIDAD';
    return `${tag}_${tipo}_${comunidad}_${fecha}.pdf`;
};
