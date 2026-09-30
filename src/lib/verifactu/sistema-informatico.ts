// Identificación del software que AEAT exige en cada registro
// (Anexo I de la Orden HAC/1177/2024, bloque SistemaInformatico).
//
// AEAT distingue dos papeles:
//   · Obligado tributario / emisor: quien factura (el cliente: clínica, despacho…).
//   · Productor del software: quien desarrolla el sistema de facturación.
//     El productor firma la DECLARACIÓN RESPONSABLE del sistema.
//
// Cada proyecto pasa su configuración: no hay valores por defecto con nombres
// de nadie. Si el productor es el propio emisor (software interno), se puede
// dejar vacío y se usan los datos del emisor.

export type SistemaInformatico = {
  nombreRazon: string
  nif: string
  nombreSistemaInformatico: string
  idSistemaInformatico: string  // 2 caracteres alfanuméricos
  version: string               // hasta 50 caracteres
  numeroInstalacion: string     // identifica la instalación concreta (una por cliente)
  tipoUsoPosibleSoloVerifactu: 'S' | 'N'
  tipoUsoPosibleMultiOT: 'S' | 'N'
  indicadorMultiplesOT: 'S' | 'N'
}

export type ConfigSistema = {
  productorNombre?: string
  productorNif?: string
  nombreSistema: string
  idSistema: string
  version: string
  numeroInstalacion: string
  /** true si el sistema SOLO funciona en modo VeriFactu (envío a la AEAT). Por defecto true. */
  soloVerifactu?: boolean
  /** true si la instalación factura para varios obligados tributarios (varios NIF emisores). */
  multiplesObligados?: boolean
}

export function getSistemaInformatico(emisor: { nombreRazon: string; nif: string }, cfg: ConfigSistema): SistemaInformatico {
  if (!/^[A-Za-z0-9]{2}$/.test(cfg.idSistema)) throw new Error('idSistema debe tener 2 caracteres alfanuméricos')
  if (!cfg.nombreSistema?.trim()) throw new Error('Falta el nombre del sistema informático')
  if (!cfg.numeroInstalacion?.trim()) throw new Error('Falta el número de instalación')
  return {
    nombreRazon: cfg.productorNombre?.trim() || emisor.nombreRazon,
    nif: cfg.productorNif?.trim() || emisor.nif,
    nombreSistemaInformatico: cfg.nombreSistema.trim(),
    idSistemaInformatico: cfg.idSistema,
    version: cfg.version?.trim() || '1.0',
    numeroInstalacion: cfg.numeroInstalacion.trim(),
    tipoUsoPosibleSoloVerifactu: cfg.soloVerifactu === false ? 'N' : 'S',
    tipoUsoPosibleMultiOT: cfg.multiplesObligados ? 'S' : 'N',
    indicadorMultiplesOT: cfg.multiplesObligados ? 'S' : 'N',
  }
}
