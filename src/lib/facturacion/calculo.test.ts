import { describe, expect, it } from "vitest";
import { calcularTotales, moneda } from "./calculo";
import { formatearNumero } from "@/lib/verifactu";

// Casos de las dos facturas de ejemplo que ya se emitían fuera del panel.

describe("calcularTotales", () => {
    it("factura con IVA 21 % sin IRPF", () => {
        const t = calcularTotales([{ cantidad: 1, concepto: "Honorarios", precio_unitario: 21.63, tipo_iva: 21 }], 0);
        expect(t.base).toBe(21.63);
        expect(t.cuota).toBe(4.54);
        expect(t.aPagar).toBe(26.17);
    });

    it("factura con IVA 21 % e IRPF 15 %", () => {
        const t = calcularTotales([{ cantidad: 1, concepto: "Honorarios", precio_unitario: 4764.15, tipo_iva: 21 }], 15);
        expect(t.cuota).toBe(1000.47);
        expect(t.retencion).toBe(714.62);
        expect(t.importeTotal).toBe(5764.62);
        expect(t.aPagar).toBe(5050);
    });

    it("varias líneas y tipos de IVA", () => {
        const t = calcularTotales([
            { cantidad: 3, concepto: "A", precio_unitario: 10.1, tipo_iva: 21 },
            { cantidad: 1, concepto: "B", precio_unitario: 50, tipo_iva: 10 },
        ], 0);
        expect(t.base).toBe(80.3);
        expect(t.desglose).toEqual([{ tipoIva: 21, base: 30.3, cuota: 6.36 }, { tipoIva: 10, base: 50, cuota: 5 }]);
    });
});

describe("formatos", () => {
    it("moneda española", () => expect(moneda(5050)).toBe("5.050,00"));
    it("números de factura de los ejemplos", () => {
        expect(formatearNumero({ prefijo: "FCT", sep1: ":", anio: 4, sep2: "-", digitos: 2 }, 2026, 8)).toBe("FCT:2026-08");
        expect(formatearNumero({ prefijo: "FCT", sep1: ":", anio: 4, sep2: "", digitos: 3 }, 2026, 4)).toBe("FCT:2026004");
    });
});
