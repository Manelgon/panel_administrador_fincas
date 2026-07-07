/**
 * Utilidades de formateo compartidas.
 * Centraliza formateo de fechas e importes que antes estaba copiado inline
 * en varias rutas de generación de documentos.
 */

/**
 * Formatea una fecha a formato europeo con guiones (DD-MM-YYYY).
 * Acepta "YYYY-MM-DD" o ISO con "T"; cualquier otro valor se devuelve tal cual.
 * Devuelve "" si el valor está vacío.
 */
export function formatDateEU(v: unknown): string {
    const s = String(v ?? "").trim();
    if (!s) return "";
    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        const [y, m, d] = s.split("-");
        return `${d}-${m}-${y}`;
    }
    // ISO con T
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
        const [datePart] = s.split("T");
        const [y, m, d] = datePart.split("-");
        return `${d}-${m}-${y}`;
    }
    return s;
}

/**
 * Formatea un importe en formato español (es-ES).
 * @param value número o cadena numérica (admite coma decimal)
 * @param opts.symbol sufijo a añadir: "€" | "EUR" | "" (por defecto "€")
 * @param opts.decimals nº de decimales fijos; si se omite, sin forzar decimales
 */
export function formatCurrencyEU(
    value: unknown,
    opts: { symbol?: "€" | "EUR" | ""; decimals?: number } = {}
): string {
    const { symbol = "€", decimals } = opts;
    const num =
        typeof value === "number"
            ? value
            : Number(String(value ?? "").replace(",", "."));
    const safe = Number.isFinite(num) ? num : 0;
    const formatted =
        decimals != null
            ? safe.toLocaleString("es-ES", {
                  minimumFractionDigits: decimals,
                  maximumFractionDigits: decimals,
              })
            : safe.toLocaleString("es-ES");
    return symbol ? `${formatted} ${symbol}` : formatted;
}
