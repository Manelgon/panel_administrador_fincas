import { fmtFechaEsp, fmtImporte } from './format'
import { getQrValidacionAeatBase, type VerifactuEntorno } from './env'

// QR de la factura: apunta al servicio de cotejo de la AEAT con los datos de
// la factura (NIF emisor, número, fecha e importe total).
// ⚠️ Comprobar nombres de parámetros y tamaño/posición del QR en la
// especificación oficial de la AEAT antes de producción.
export function urlQrAeat(
  datos: { nifEmisor: string; numeroFactura: string; fechaEmision: string; importeTotal: number },
  entorno?: VerifactuEntorno,
): string {
  const p = new URLSearchParams({
    nif: datos.nifEmisor,
    numserie: datos.numeroFactura,
    fecha: fmtFechaEsp(datos.fechaEmision),
    importe: fmtImporte(datos.importeTotal),
  })
  return `${getQrValidacionAeatBase(entorno)}?${p.toString()}`
}

/** PNG del QR (necesita la librería `qrcode`). */
export async function generarQrPng(url: string): Promise<Uint8Array> {
  const QRCode = (await import('qrcode')).default
  const buf = await QRCode.toBuffer(url, { errorCorrectionLevel: 'M', type: 'png', margin: 1, width: 320 })
  return new Uint8Array(buf)
}
