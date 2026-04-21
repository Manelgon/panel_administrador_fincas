import type jsPDFType from 'jspdf';

export type PortadaKind = 'convocatoria' | 'acta';

export interface EmisorFooter {
    nombre?: string;
    direccion?: string;
    cp?: string;
    ciudad?: string;
    cif?: string;
    telefono?: string;
    email?: string;
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
    const maxH = pageH * 0.75;
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
    let y = imgH + 15;

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
    doc.text(`Cdad. Prop. ${data.comunidad}`, centerX, y, { align: 'center' });

    if (data.direccion) {
        y += 7;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(12);
        doc.setTextColor(60, 60, 60);
        doc.text(data.direccion, centerX, y, { align: 'center' });
    }

    // Pie de página con datos del emisor
    if (data.emisor) {
        const e = data.emisor;
        const line1 = [e.nombre, e.cif && `CIF ${e.cif}`].filter(Boolean).join(' · ');
        const line2 = [e.direccion, [e.cp, e.ciudad].filter(Boolean).join(' ')]
            .filter(Boolean)
            .join(', ');
        const line3 = [e.telefono && `Tel. ${e.telefono}`, e.email]
            .filter(Boolean)
            .join(' · ');

        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.2);
        doc.line(20, pageH - 22, pageW - 20, pageH - 22);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);
        if (line1) doc.text(line1, centerX, pageH - 17, { align: 'center' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(110, 110, 110);
        if (line2) doc.text(line2, centerX, pageH - 12, { align: 'center' });
        if (line3) doc.text(line3, centerX, pageH - 7,  { align: 'center' });
    }

    return doc.output('blob');
};

export const nombreArchivo = (kind: PortadaKind, tipoReunion: string, fechaIso: string) => {
    const fecha = fechaIso.replace(/[^0-9]/g, '');
    return `${kind === 'convocatoria' ? 'Convocatoria' : 'Acta'}_${tipoReunion}_${fecha}.pdf`;
};
