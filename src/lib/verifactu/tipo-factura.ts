// Códigos de tipo de factura AEAT (Anexo I de la Orden HAC/1177/2024).
//
//   F1  Factura completa (con datos del destinatario)
//   F2  Factura simplificada (ticket, sin destinatario obligatorio)
//   F3  Factura emitida en sustitución de simplificadas
//   R1  Rectificativa por error fundado en derecho o art. 80.1/80.2/80.6 LIVA
//   R2  Rectificativa por concurso de acreedores (art. 80.3 LIVA)
//   R3  Rectificativa por créditos incobrables (art. 80.4 LIVA)
//   R4  Rectificativa, resto de causas
//   R5  Rectificativa de facturas simplificadas (solo si la original fue F2)
//
// El tipo lo decide cada proyecto al emitir. Regla práctica:
//   · Paciente/cliente que pide factura con su NIF → F1.
//   · Ticket de mostrador sin datos fiscales → F2.
//   · Corregir una F1 → R1 o R4 (según la causa). Corregir una F2 → R5.

export type TipoFacturaAeat = 'F1' | 'F2' | 'F3' | 'R1' | 'R2' | 'R3' | 'R4' | 'R5'

export const TIPOS_FACTURA: Record<TipoFacturaAeat, string> = {
  F1: 'Factura completa',
  F2: 'Factura simplificada',
  F3: 'Sustitutiva de simplificadas',
  R1: 'Rectificativa (error fundado en derecho)',
  R2: 'Rectificativa (concurso de acreedores)',
  R3: 'Rectificativa (créditos incobrables)',
  R4: 'Rectificativa (resto de causas)',
  R5: 'Rectificativa de simplificada',
}

export const esRectificativa = (t: TipoFacturaAeat) => t.startsWith('R')

/** Tipo de rectificativa válido según el tipo de la factura original. */
export function tipoRectificativaPara(original: TipoFacturaAeat, causa: 'error' | 'otra' = 'otra'): TipoFacturaAeat {
  if (original === 'F2') return 'R5'
  return causa === 'error' ? 'R1' : 'R4'
}
