import { create } from 'xmlbuilder2'
import type { TipoFacturaAeat } from './tipo-factura'
import type { SistemaInformatico } from './sistema-informatico'
import { fmtImporte, fmtFechaEsp, fmtFechaHoraUtc } from './format'

// Esquema oficial Suministro LR (sede AEAT).
const NS_SUM  = 'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroLR.xsd'
const NS_SUM1 = 'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroInformacion.xsd'


// =============================================================================
// REGISTRO DE ALTA
// =============================================================================
export type EncadenamientoAlta =
  | { primerRegistro: true }
  | {
      primerRegistro: false
      anterior: {
        emisorNif: string
        numero: string
        fechaEmision: string  // YYYY-MM-DD
        huella: string
      }
    }

/**
 * Una línea del desglose fiscal: una por cada tipo de IVA (o exención) de la factura.
 *   · Sujeta no exenta (S1): tipo de IVA, base y cuota.
 *   · Exenta (E1…E6): solo base. E1 = exenta por el art. 20 LIVA (p. ej. asistencia sanitaria).
 * ⚠️ Revisar contra el XSD oficial de la AEAT antes de pasar a producción.
 */
export type LineaDesglose =
  | { calificacion: 'S1'; tipoIva: number; base: number; cuota: number; claveRegimen?: string }
  | { exenta: 'E1' | 'E2' | 'E3' | 'E4' | 'E5' | 'E6'; base: number; claveRegimen?: string }

export type InputXmlAlta = {
  emisor: { nombreRazon: string; nif: string }
  factura: {
    numero: string
    fechaEmision: string  // YYYY-MM-DD
    tipoFacturaAeat: TipoFacturaAeat
    cliente: { nombreRazon: string; nif: string | null } | null  // null en simplificadas (F2) sin datos
    descripcionOperacion: string
    desglose: LineaDesglose[]
    cuotaTotal: number
    importeTotal: number
    rectificativa?: {
      tipo: 'S' | 'I'  // S=sustitutiva, I=por diferencias
      original: { emisorNif: string; numero: string; fechaEmision: string }
    }
  }
  encadenamiento: EncadenamientoAlta
  sistemaInformatico: SistemaInformatico
  fechaHoraGeneracion: Date
  huella: string
}

export function construirXmlAlta(input: InputXmlAlta): string {
  const doc = create({ version: '1.0', encoding: 'UTF-8' })
  const root = doc.ele(NS_SUM, 'sum:RegFactuSistemaFacturacion')
    .att('xmlns:sum', NS_SUM)
    .att('xmlns:sum1', NS_SUM1)

  // Cabecera
  const cabecera = root.ele('sum:Cabecera')
  const obligado = cabecera.ele('sum1:ObligadoEmision')
  obligado.ele('sum1:NombreRazon').txt(input.emisor.nombreRazon)
  obligado.ele('sum1:NIF').txt(input.emisor.nif)

  // RegistroFactura > RegistroAlta
  const regFactura = root.ele('sum:RegistroFactura')
  const alta = regFactura.ele('sum1:RegistroAlta')

  alta.ele('sum1:IDVersion').txt('1.0')

  const idFactura = alta.ele('sum1:IDFactura')
  idFactura.ele('sum1:IDEmisorFactura').txt(input.emisor.nif)
  idFactura.ele('sum1:NumSerieFactura').txt(input.factura.numero)
  idFactura.ele('sum1:FechaExpedicionFactura').txt(fmtFechaEsp(input.factura.fechaEmision))

  alta.ele('sum1:NombreRazonEmisor').txt(input.emisor.nombreRazon)
  alta.ele('sum1:TipoFactura').txt(input.factura.tipoFacturaAeat)

  // Rectificativa: tipo + factura original
  if (input.factura.rectificativa) {
    alta.ele('sum1:TipoRectificativa').txt(input.factura.rectificativa.tipo)
    const fr = alta.ele('sum1:FacturasRectificadas').ele('sum1:IDFacturaRectificada')
    fr.ele('sum1:IDEmisorFactura').txt(input.factura.rectificativa.original.emisorNif)
    fr.ele('sum1:NumSerieFactura').txt(input.factura.rectificativa.original.numero)
    fr.ele('sum1:FechaExpedicionFactura').txt(fmtFechaEsp(input.factura.rectificativa.original.fechaEmision))
  }

  alta.ele('sum1:DescripcionOperacion').txt(input.factura.descripcionOperacion)

  // Destinatario (cliente): obligatorio en completas (F1), opcional en simplificadas (F2)
  if (input.factura.cliente?.nif) {
    const dest = alta.ele('sum1:Destinatarios').ele('sum1:IDDestinatario')
    dest.ele('sum1:NombreRazon').txt(input.factura.cliente.nombreRazon)
    dest.ele('sum1:NIF').txt(input.factura.cliente.nif)
  }

  // Desglose: un bloque por tipo de IVA o exención
  if (!input.factura.desglose.length) throw new Error('La factura no tiene desglose fiscal')
  const bloque = alta.ele('sum1:Desglose')
  for (const l of input.factura.desglose) {
    const d = bloque.ele('sum1:DetalleDesglose')
    d.ele('sum1:Impuesto').txt('01')                         // 01 = IVA
    d.ele('sum1:ClaveRegimen').txt(l.claveRegimen ?? '01')   // 01 = Régimen general
    if ('exenta' in l) {
      d.ele('sum1:OperacionExenta').txt(l.exenta)
      d.ele('sum1:BaseImponibleOimporteNoSujeto').txt(fmtImporte(l.base))
    } else {
      d.ele('sum1:CalificacionOperacion').txt(l.calificacion) // S1 = Sujeta no exenta
      d.ele('sum1:TipoImpositivo').txt(fmtImporte(l.tipoIva))
      d.ele('sum1:BaseImponibleOimporteNoSujeto').txt(fmtImporte(l.base))
      d.ele('sum1:CuotaRepercutida').txt(fmtImporte(l.cuota))
    }
  }

  alta.ele('sum1:CuotaTotal').txt(fmtImporte(input.factura.cuotaTotal))
  alta.ele('sum1:ImporteTotal').txt(fmtImporte(input.factura.importeTotal))

  // Encadenamiento
  const enc = alta.ele('sum1:Encadenamiento')
  if (input.encadenamiento.primerRegistro) {
    enc.ele('sum1:PrimerRegistro').txt('S')
  } else {
    const ant = enc.ele('sum1:RegistroAnterior')
    ant.ele('sum1:IDEmisorFactura').txt(input.encadenamiento.anterior.emisorNif)
    ant.ele('sum1:NumSerieFactura').txt(input.encadenamiento.anterior.numero)
    ant.ele('sum1:FechaExpedicionFactura').txt(fmtFechaEsp(input.encadenamiento.anterior.fechaEmision))
    ant.ele('sum1:Huella').txt(input.encadenamiento.anterior.huella)
  }

  // Sistema informático (productor)
  const si = alta.ele('sum1:SistemaInformatico')
  si.ele('sum1:NombreRazon').txt(input.sistemaInformatico.nombreRazon)
  if (input.sistemaInformatico.nif) si.ele('sum1:NIF').txt(input.sistemaInformatico.nif)
  si.ele('sum1:NombreSistemaInformatico').txt(input.sistemaInformatico.nombreSistemaInformatico)
  si.ele('sum1:IdSistemaInformatico').txt(input.sistemaInformatico.idSistemaInformatico)
  si.ele('sum1:Version').txt(input.sistemaInformatico.version)
  si.ele('sum1:NumeroInstalacion').txt(input.sistemaInformatico.numeroInstalacion)
  si.ele('sum1:TipoUsoPosibleSoloVerifactu').txt(input.sistemaInformatico.tipoUsoPosibleSoloVerifactu)
  si.ele('sum1:TipoUsoPosibleMultiOT').txt(input.sistemaInformatico.tipoUsoPosibleMultiOT)
  si.ele('sum1:IndicadorMultiplesOT').txt(input.sistemaInformatico.indicadorMultiplesOT)

  alta.ele('sum1:FechaHoraHusoGenRegistro').txt(fmtFechaHoraUtc(input.fechaHoraGeneracion))
  alta.ele('sum1:TipoHuella').txt('01')  // 01 = SHA-256
  alta.ele('sum1:Huella').txt(input.huella)

  return doc.end({ prettyPrint: true })
}


// =============================================================================
// REGISTRO DE ANULACIÓN
// =============================================================================
export type InputXmlAnulacion = {
  emisor: { nombreRazon: string; nif: string }
  factura: {
    numero: string
    fechaEmision: string
  }
  encadenamiento: EncadenamientoAlta
  sistemaInformatico: SistemaInformatico
  fechaHoraGeneracion: Date
  huella: string
}

export function construirXmlAnulacion(input: InputXmlAnulacion): string {
  const doc = create({ version: '1.0', encoding: 'UTF-8' })
  const root = doc.ele(NS_SUM, 'sum:RegFactuSistemaFacturacion')
    .att('xmlns:sum', NS_SUM)
    .att('xmlns:sum1', NS_SUM1)

  // Cabecera
  const cabecera = root.ele('sum:Cabecera')
  const obligado = cabecera.ele('sum1:ObligadoEmision')
  obligado.ele('sum1:NombreRazon').txt(input.emisor.nombreRazon)
  obligado.ele('sum1:NIF').txt(input.emisor.nif)

  // RegistroFactura > RegistroAnulacion
  const regFactura = root.ele('sum:RegistroFactura')
  const anul = regFactura.ele('sum1:RegistroAnulacion')

  anul.ele('sum1:IDVersion').txt('1.0')

  const idFactura = anul.ele('sum1:IDFactura')
  idFactura.ele('sum1:IDEmisorFacturaAnulada').txt(input.emisor.nif)
  idFactura.ele('sum1:NumSerieFacturaAnulada').txt(input.factura.numero)
  idFactura.ele('sum1:FechaExpedicionFacturaAnulada').txt(fmtFechaEsp(input.factura.fechaEmision))

  // Encadenamiento
  const enc = anul.ele('sum1:Encadenamiento')
  if (input.encadenamiento.primerRegistro) {
    enc.ele('sum1:PrimerRegistro').txt('S')
  } else {
    const ant = enc.ele('sum1:RegistroAnterior')
    ant.ele('sum1:IDEmisorFactura').txt(input.encadenamiento.anterior.emisorNif)
    ant.ele('sum1:NumSerieFactura').txt(input.encadenamiento.anterior.numero)
    ant.ele('sum1:FechaExpedicionFactura').txt(fmtFechaEsp(input.encadenamiento.anterior.fechaEmision))
    ant.ele('sum1:Huella').txt(input.encadenamiento.anterior.huella)
  }

  // Sistema informático
  const si = anul.ele('sum1:SistemaInformatico')
  si.ele('sum1:NombreRazon').txt(input.sistemaInformatico.nombreRazon)
  if (input.sistemaInformatico.nif) si.ele('sum1:NIF').txt(input.sistemaInformatico.nif)
  si.ele('sum1:NombreSistemaInformatico').txt(input.sistemaInformatico.nombreSistemaInformatico)
  si.ele('sum1:IdSistemaInformatico').txt(input.sistemaInformatico.idSistemaInformatico)
  si.ele('sum1:Version').txt(input.sistemaInformatico.version)
  si.ele('sum1:NumeroInstalacion').txt(input.sistemaInformatico.numeroInstalacion)
  si.ele('sum1:TipoUsoPosibleSoloVerifactu').txt(input.sistemaInformatico.tipoUsoPosibleSoloVerifactu)
  si.ele('sum1:TipoUsoPosibleMultiOT').txt(input.sistemaInformatico.tipoUsoPosibleMultiOT)
  si.ele('sum1:IndicadorMultiplesOT').txt(input.sistemaInformatico.indicadorMultiplesOT)

  anul.ele('sum1:FechaHoraHusoGenRegistro').txt(fmtFechaHoraUtc(input.fechaHoraGeneracion))
  anul.ele('sum1:TipoHuella').txt('01')
  anul.ele('sum1:Huella').txt(input.huella)

  return doc.end({ prettyPrint: true })
}
