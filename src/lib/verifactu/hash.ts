import { createHash } from 'node:crypto'
import type { TipoFacturaAeat } from './tipo-factura'
import { fmtImporte, fmtFechaEsp, fmtFechaHoraUtc } from './format'

// Cálculo de la "huella" SHA-256 de un registro Verifactu según el Anexo I
// de la Orden HAC/1177/2024. El payload es una concatenación de pares
// clave=valor separados por '&', SIN url-encoding y SIN espacios extra.
// El orden de los campos es VINCULANTE.

function sha256HexUpper(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex').toUpperCase()
}


export type InputHashAlta = {
  nifEmisor: string
  numeroFactura: string
  fechaEmision: string  // YYYY-MM-DD
  tipoFacturaAeat: TipoFacturaAeat
  cuotaTotal: number
  importeTotal: number
  huellaAnterior: string | null
  fechaHoraGeneracion: Date
}

export function calcularHuellaAlta(input: InputHashAlta): { huella: string; payload: string } {
  const payload =
    'IDEmisorFactura=' + input.nifEmisor +
    '&NumSerieFactura=' + input.numeroFactura +
    '&FechaExpedicionFactura=' + fmtFechaEsp(input.fechaEmision) +
    '&TipoFactura=' + input.tipoFacturaAeat +
    '&CuotaTotal=' + fmtImporte(input.cuotaTotal) +
    '&ImporteTotal=' + fmtImporte(input.importeTotal) +
    '&Huella=' + (input.huellaAnterior ?? '') +
    '&FechaHoraHusoGenRegistro=' + fmtFechaHoraUtc(input.fechaHoraGeneracion)

  return { huella: sha256HexUpper(payload), payload }
}


export type InputHashAnulacion = {
  nifEmisor: string
  numeroFactura: string
  fechaEmision: string
  huellaAnterior: string | null
  fechaHoraGeneracion: Date
}

export function calcularHuellaAnulacion(input: InputHashAnulacion): { huella: string; payload: string } {
  // Para anulación AEAT usa otra plantilla (sin importes ni tipo).
  const payload =
    'IDEmisorFacturaAnulada=' + input.nifEmisor +
    '&NumSerieFacturaAnulada=' + input.numeroFactura +
    '&FechaExpedicionFacturaAnulada=' + fmtFechaEsp(input.fechaEmision) +
    '&Huella=' + (input.huellaAnterior ?? '') +
    '&FechaHoraHusoGenRegistro=' + fmtFechaHoraUtc(input.fechaHoraGeneracion)

  return { huella: sha256HexUpper(payload), payload }
}
