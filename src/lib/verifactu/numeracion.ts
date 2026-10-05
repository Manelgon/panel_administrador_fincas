// Formato del número de factura de una serie.
//
//   {prefijo}{sep1}{año}{sep2}{correlativo con N cifras}
//
// Ejemplos: FCT:2026-08 (sep1 ':', año 4, sep2 '-', 2 cifras)
//           FCT:2026004 (sep1 ':', año 4, sep2 '',  3 cifras)
//           A-0012      (sep1 '-', sin año,          4 cifras)
//
// ⚠️ La función SQL `facturacion_formatear_numero` (sql/001_facturas.sql)
//    hace exactamente lo mismo: es la que manda al emitir. Esta sirve para la
//    vista previa en pantalla. Si cambias una, cambia la otra.

export type FormatoNumero = {
  prefijo: string
  sep1: string          // separador tras el prefijo ('' si no hay)
  anio: 0 | 2 | 4       // cifras del año (0 = sin año)
  sep2: string          // separador tras el año ('' si no hay; se ignora sin año)
  digitos: number       // cifras mínimas del correlativo (1–6)
}

export const SEPARADORES = ['', '-', '/', ':', '.'] as const

export function formatearNumero(f: FormatoNumero, anio: number, correlativo: number): string {
  const y = f.anio === 4 ? String(anio) : f.anio === 2 ? String(anio).slice(-2) : ''
  const sep2 = y ? f.sep2 : ''
  const n = String(Math.max(1, Math.trunc(correlativo))).padStart(Math.min(6, Math.max(1, Math.trunc(f.digitos))), '0')
  return `${f.prefijo}${f.sep1}${y}${sep2}${n}`
}

/**
 * Comprueba que el número cabe en el campo NumSerieFactura de la AEAT.
 * ⚠️ Límite de 60 caracteres ASCII imprimibles según lo conocido; confirmar
 *    contra el XSD oficial antes de producción.
 */
export function validarNumero(numero: string): { valido: true } | { valido: false; error: string } {
  if (!numero) return { valido: false, error: 'El número está vacío' }
  if (numero.length > 60) return { valido: false, error: 'Máximo 60 caracteres' }
  if (!/^[\x20-\x7E]+$/.test(numero)) return { valido: false, error: 'Solo letras sin tilde, números y signos simples' }
  return { valido: true }
}

export function validarFormato(f: FormatoNumero): { valido: true } | { valido: false; error: string } {
  if (!/^[A-Z0-9]{1,10}$/.test(f.prefijo)) return { valido: false, error: 'El prefijo solo admite mayúsculas y números (máx. 10)' }
  if (!(SEPARADORES as readonly string[]).includes(f.sep1) || !(SEPARADORES as readonly string[]).includes(f.sep2))
    return { valido: false, error: 'Separador no válido' }
  if (![0, 2, 4].includes(f.anio)) return { valido: false, error: 'Año no válido' }
  if (!Number.isInteger(f.digitos) || f.digitos < 1 || f.digitos > 6) return { valido: false, error: 'Cifras entre 1 y 6' }
  return { valido: true }
}
