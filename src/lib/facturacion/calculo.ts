// Cálculo de importes de una factura. Se usa igual en pantalla (vista previa)
// y en el servidor (al emitir): así el PDF, la BD y la huella VeriFactu cuadran.

export type LineaEntrada = {
    cantidad: number;
    concepto: string;
    precio_unitario: number; // sin IVA
    tipo_iva: number;        // %
};

export type LineaCalculada = LineaEntrada & { base: number; cuota: number; total: number };

export type Totales = {
    lineas: LineaCalculada[];
    desglose: { tipoIva: number; base: number; cuota: number }[];
    base: number;
    cuota: number;
    retencionPct: number;
    retencion: number;
    importeTotal: number; // base + IVA (lo que va a la AEAT)
    aPagar: number;       // base + IVA - IRPF (lo que cobra el facturador)
};

export const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function calcularTotales(lineas: LineaEntrada[], retencionPct: number): Totales {
    const calc = lineas.map((l) => {
        const base = r2(l.cantidad * l.precio_unitario);
        const cuota = r2(base * l.tipo_iva / 100);
        return { ...l, base, cuota, total: r2(base + cuota) };
    });
    const porTipo = new Map<number, { base: number; cuota: number }>();
    for (const l of calc) {
        const t = porTipo.get(l.tipo_iva) ?? { base: 0, cuota: 0 };
        porTipo.set(l.tipo_iva, { base: r2(t.base + l.base), cuota: r2(t.cuota + l.cuota) });
    }
    const base = r2(calc.reduce((s, l) => s + l.base, 0));
    const cuota = r2(calc.reduce((s, l) => s + l.cuota, 0));
    const retencion = r2(base * retencionPct / 100);
    const importeTotal = r2(base + cuota);
    return {
        lineas: calc,
        desglose: [...porTipo.entries()].map(([tipoIva, v]) => ({ tipoIva, ...v })),
        base, cuota, retencionPct, retencion, importeTotal,
        aPagar: r2(importeTotal - retencion),
    };
}

/** 1234.5 → "1.234,50" */
export function moneda(n: number): string {
    return new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true }).format(n);
}
