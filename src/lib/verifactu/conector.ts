import { registrarAlta, registrarAnulacion, type AlmacenVerifactu, type Emisor, type FacturaParaRegistro } from './registrar'
import type { ConfigSistema } from './sistema-informatico'

/* ============================================================
   CONECTOR DE FACTURACIÓN: el panel de cada cliente habla SIEMPRE con esta
   interfaz, y se elige por configuración quién cumple VeriFactu:

     · "propio"  → nuestro módulo: registro encadenado + XML + QR.
                   Falta el envío a la AEAT (ver README) y la declaración
                   responsable del productor del software.
     · "externo" → un programa de facturación ya certificado: se le manda la
                   factura por su API y devuelve número, QR y PDF.
                   Se implementa cuando el cliente elija el programa.

   Así el panel no cambia si más adelante se pasa de una vía a la otra.
   ============================================================ */

export type ResultadoEmision =
  | { ok: true; referencia: string; huella?: string; qrUrl?: string; pdfUrl?: string }
  | { error: string }

export interface ProveedorFacturacion {
  readonly nombre: string
  emitir(f: FacturaParaRegistro): Promise<ResultadoEmision>
  anular(f: Pick<FacturaParaRegistro, 'id' | 'numero' | 'fechaEmision' | 'tipo' | 'cuotaTotal' | 'importeTotal'>): Promise<ResultadoEmision>
}

/** Vía 1: VeriFactu propio (este módulo). */
export function proveedorPropio(emisor: Emisor, sistema: ConfigSistema, almacen: AlmacenVerifactu): ProveedorFacturacion {
  return {
    nombre: 'propio',
    async emitir(f) {
      const r = await registrarAlta(f, emisor, sistema, almacen)
      return 'error' in r ? r : { ok: true, referencia: r.registroId, huella: r.huella, qrUrl: r.qrUrl }
    },
    async anular(f) {
      const r = await registrarAnulacion(f, emisor, sistema, almacen)
      return 'error' in r ? r : { ok: true, referencia: r.registroId, huella: r.huella }
    },
  }
}

/**
 * Vía 2: programa de facturación certificado (pendiente de elegir).
 * Plantilla: rellenar `emitir` y `anular` con las llamadas a su API.
 */
export function proveedorExterno(cfg: { nombre: string; urlApi?: string; claveApi?: string }): ProveedorFacturacion {
  const pendiente = async (): Promise<ResultadoEmision> =>
    ({ error: `Conector externo "${cfg.nombre}" sin implementar: falta elegir el programa certificado y su API` })
  return { nombre: `externo:${cfg.nombre}`, emitir: pendiente, anular: pendiente }
}
