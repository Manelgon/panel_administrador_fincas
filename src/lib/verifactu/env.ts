
// Entorno del servicio AEAT al que se enviarán los registros Veri*factu.
//
// La AEAT publica dos servicios SOAP:
//   - PRE  → preproducción / sandbox. Acepta el certificado de pruebas o el real,
//            pero no produce efectos fiscales. URL: prewww1.aeat.es
//   - PROD → producción. URL: www1.agenciatributaria.gob.es
//
// Hasta tener el certificado digital del emisor y validar el flujo
// completo en PRE, este valor debe quedarse en 'pre'.
//
// Configurar con la env var VERIFACTU_ENV (server-side, NO NEXT_PUBLIC_).

export type VerifactuEntorno = 'pre' | 'prod'

const VALORES: readonly VerifactuEntorno[] = ['pre', 'prod'] as const

export function getVerifactuEntorno(): VerifactuEntorno {
  const raw = process.env.VERIFACTU_ENV?.trim().toLowerCase()
  if (raw && (VALORES as readonly string[]).includes(raw)) {
    return raw as VerifactuEntorno
  }
  return 'pre'
}

// Endpoints SOAP oficiales según el documento de la AEAT
// "Especificaciones técnicas servicio SistemaFacturacion".
const ENDPOINTS: Record<VerifactuEntorno, { altaUrl: string; consultaUrl: string }> = {
  pre: {
    altaUrl:     'https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP',
    consultaUrl: 'https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/ConsultaLR',
  },
  prod: {
    altaUrl:     'https://www1.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP',
    consultaUrl: 'https://www1.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/ConsultaLR',
  },
}

export function getEndpointsAeat(entorno: VerifactuEntorno = getVerifactuEntorno()) {
  return ENDPOINTS[entorno]
}

// URL pública de validación de QR de la AEAT (cotejo manual).
// Una vez se envíe en producción, el QR del PDF apuntará a esta URL en lugar
// de a nuestra /verificar/[id].
export function getQrValidacionAeatBase(entorno: VerifactuEntorno = getVerifactuEntorno()): string {
  return entorno === 'prod'
    ? 'https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR'
    : 'https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR'
}
