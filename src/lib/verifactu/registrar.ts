import { calcularHuellaAlta, calcularHuellaAnulacion } from './hash'
import { construirXmlAlta, construirXmlAnulacion, type EncadenamientoAlta, type LineaDesglose } from './xml-builder'
import { getSistemaInformatico, type ConfigSistema } from './sistema-informatico'
import { validarIdFiscal } from './nif'
import { urlQrAeat } from './qr'
import type { TipoFacturaAeat } from './tipo-factura'

/* ============================================================
   REGISTRO VERI*FACTU (alta y anulación), independiente de la base de datos.
   Cada proyecto aporta un "almacén" que sabe leer el último registro y guardar
   uno nuevo (Supabase, Postgres…). Hay UNA cadena por NIF emisor: si el panel
   factura para varias entidades, cada una encadena solo sus registros.
   La cadena se linealiza con un índice único en huella_anterior: si dos
   facturas compiten, una falla con conflicto y se reintenta leyendo de nuevo
   el último registro.
   ============================================================ */

export type UltimoRegistro = { emisorNif: string; numero: string; fechaEmision: string; huella: string }

export type NuevoRegistro = {
  facturaId: string
  tipo: 'alta' | 'anulacion'
  huella: string
  huellaAnterior: string | null
  nifEmisor: string
  numeroFactura: string
  fechaEmision: string
  tipoFacturaAeat: TipoFacturaAeat
  cuotaTotal: number
  importeTotal: number
  fechaHoraGeneracion: string
  xml: string
}

export interface AlmacenVerifactu {
  /** Último registro (alta o anulación) de la cadena de ESTE emisor. */
  ultimoRegistro(nifEmisor: string): Promise<UltimoRegistro | null>
  /** Inserta el registro. Devuelve { conflicto: true } si otro registro ya usó esa huella anterior. */
  guardarRegistro(r: NuevoRegistro): Promise<{ id: string } | { conflicto: true } | { error: string }>
}

export type Emisor = { nombreRazon: string; nif: string }

export type FacturaParaRegistro = {
  id: string
  numero: string
  fechaEmision: string            // YYYY-MM-DD
  tipo: TipoFacturaAeat
  cliente: { nombreRazon: string; nif: string | null } | null
  descripcion: string             // máx. 500 caracteres
  desglose: LineaDesglose[]
  cuotaTotal: number              // suma de cuotas de IVA
  importeTotal: number            // base + IVA (sin restar retenciones)
  rectificada?: { numero: string; fechaEmision: string; tipo: 'S' | 'I' }
}

export type Resultado = { ok: true; registroId: string; huella: string; qrUrl: string } | { error: string }

const REINTENTOS = 3

function encadenamiento(anterior: UltimoRegistro | null): EncadenamientoAlta {
  return anterior ? { primerRegistro: false, anterior } : { primerRegistro: true }
}

export async function registrarAlta(f: FacturaParaRegistro, emisor: Emisor, sistema: ConfigSistema, almacen: AlmacenVerifactu): Promise<Resultado> {
  const nif = validarIdFiscal(emisor.nif)
  if (!nif.valido) return { error: `NIF del emisor no válido: ${nif.error}` }
  let cliente = f.cliente
  if (f.tipo === 'F1' && !cliente?.nif) return { error: 'Una factura completa (F1) necesita el NIF del cliente' }
  if (cliente?.nif) {
    const n = validarIdFiscal(cliente.nif)
    if (!n.valido) return { error: `NIF del cliente no válido: ${n.error}` }
    cliente = { ...cliente, nif: n.normalizado }
  }
  const sumaCuotas = +f.desglose.reduce((t, l) => t + ('cuota' in l ? l.cuota : 0), 0).toFixed(2)
  if (Math.abs(sumaCuotas - f.cuotaTotal) > 0.005) return { error: 'La cuota total no cuadra con el desglose' }

  for (let intento = 0; intento <= REINTENTOS; intento++) {
    const anterior = await almacen.ultimoRegistro(nif.normalizado)
    const fechaHoraGeneracion = new Date()
    const { huella } = calcularHuellaAlta({
      nifEmisor: nif.normalizado, numeroFactura: f.numero, fechaEmision: f.fechaEmision, tipoFacturaAeat: f.tipo,
      cuotaTotal: f.cuotaTotal, importeTotal: f.importeTotal, huellaAnterior: anterior?.huella ?? null, fechaHoraGeneracion,
    })
    const xml = construirXmlAlta({
      emisor: { nombreRazon: emisor.nombreRazon, nif: nif.normalizado },
      factura: {
        numero: f.numero, fechaEmision: f.fechaEmision, tipoFacturaAeat: f.tipo, cliente,
        descripcionOperacion: (f.descripcion || 'Prestación de servicios').slice(0, 500),
        desglose: f.desglose, cuotaTotal: f.cuotaTotal, importeTotal: f.importeTotal,
        rectificativa: f.rectificada ? { tipo: f.rectificada.tipo, original: { emisorNif: nif.normalizado, numero: f.rectificada.numero, fechaEmision: f.rectificada.fechaEmision } } : undefined,
      },
      encadenamiento: encadenamiento(anterior),
      sistemaInformatico: getSistemaInformatico({ nombreRazon: emisor.nombreRazon, nif: nif.normalizado }, sistema),
      fechaHoraGeneracion, huella,
    })
    const r = await almacen.guardarRegistro({
      facturaId: f.id, tipo: 'alta', huella, huellaAnterior: anterior?.huella ?? null, nifEmisor: nif.normalizado,
      numeroFactura: f.numero, fechaEmision: f.fechaEmision, tipoFacturaAeat: f.tipo, cuotaTotal: f.cuotaTotal,
      importeTotal: f.importeTotal, fechaHoraGeneracion: fechaHoraGeneracion.toISOString(), xml,
    })
    if ('id' in r) return { ok: true, registroId: r.id, huella, qrUrl: urlQrAeat({ nifEmisor: nif.normalizado, numeroFactura: f.numero, fechaEmision: f.fechaEmision, importeTotal: f.importeTotal }) }
    if ('error' in r) return { error: r.error }
  }
  return { error: 'Conflicto de concurrencia persistente al registrar la factura. Reintenta en unos segundos.' }
}

export async function registrarAnulacion(
  f: Pick<FacturaParaRegistro, 'id' | 'numero' | 'fechaEmision' | 'tipo' | 'cuotaTotal' | 'importeTotal'>,
  emisor: Emisor, sistema: ConfigSistema, almacen: AlmacenVerifactu,
): Promise<Resultado> {
  const nif = validarIdFiscal(emisor.nif)
  if (!nif.valido) return { error: `NIF del emisor no válido: ${nif.error}` }
  for (let intento = 0; intento <= REINTENTOS; intento++) {
    const anterior = await almacen.ultimoRegistro(nif.normalizado)
    const fechaHoraGeneracion = new Date()
    const { huella } = calcularHuellaAnulacion({
      nifEmisor: nif.normalizado, numeroFactura: f.numero, fechaEmision: f.fechaEmision,
      huellaAnterior: anterior?.huella ?? null, fechaHoraGeneracion,
    })
    const xml = construirXmlAnulacion({
      emisor: { nombreRazon: emisor.nombreRazon, nif: nif.normalizado },
      factura: { numero: f.numero, fechaEmision: f.fechaEmision },
      encadenamiento: encadenamiento(anterior),
      sistemaInformatico: getSistemaInformatico({ nombreRazon: emisor.nombreRazon, nif: nif.normalizado }, sistema),
      fechaHoraGeneracion, huella,
    })
    const r = await almacen.guardarRegistro({
      facturaId: f.id, tipo: 'anulacion', huella, huellaAnterior: anterior?.huella ?? null, nifEmisor: nif.normalizado,
      numeroFactura: f.numero, fechaEmision: f.fechaEmision, tipoFacturaAeat: f.tipo, cuotaTotal: f.cuotaTotal,
      importeTotal: f.importeTotal, fechaHoraGeneracion: fechaHoraGeneracion.toISOString(), xml,
    })
    if ('id' in r) return { ok: true, registroId: r.id, huella, qrUrl: '' }
    if ('error' in r) return { error: r.error }
  }
  return { error: 'Conflicto de concurrencia persistente al anular la factura. Reintenta en unos segundos.' }
}
