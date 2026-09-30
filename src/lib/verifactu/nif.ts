// Validador de NIF / NIE / CIF español.
// Crítico para Verifactu: un NIF inválido contamina toda la cadena de huellas
// y AEAT rechazará el envío. Mejor abortar antes de firmar.
//
// Algoritmos:
//   NIF: 8 dígitos + letra control = "TRWAGMYFPDXBNJZSQVHLCKE"[num % 23]
//   NIE: X/Y/Z (=0/1/2) + 7 dígitos + letra control (mismo cálculo que NIF)
//   CIF: letra entidad + 7 dígitos + dígito/letra control (algoritmo Luhn-like)

const LETRAS_NIF = 'TRWAGMYFPDXBNJZSQVHLCKE'
const LETRAS_CIF_CONTROL = 'JABCDEFGHI'  // posición = dígito control (0-9)

function normalizar(input: string): string {
  return input.trim().toUpperCase().replace(/[\s-]/g, '')
}

function validarNif(s: string): boolean {
  if (!/^\d{8}[A-Z]$/.test(s)) return false
  const num = parseInt(s.slice(0, 8), 10)
  return s[8] === LETRAS_NIF[num % 23]
}

function validarNie(s: string): boolean {
  if (!/^[XYZ]\d{7}[A-Z]$/.test(s)) return false
  const prefijo = { X: '0', Y: '1', Z: '2' }[s[0] as 'X' | 'Y' | 'Z']
  const num = parseInt(prefijo + s.slice(1, 8), 10)
  return s[8] === LETRAS_NIF[num % 23]
}

function validarCif(s: string): boolean {
  if (!/^[ABCDEFGHJKLMNPQRSUVW]\d{7}[\dA-J]$/.test(s)) return false
  const digitos = s.slice(1, 8)
  let sumaPar = 0
  let sumaImpar = 0
  for (let i = 0; i < 7; i++) {
    const d = parseInt(digitos[i], 10)
    if (i % 2 === 0) {
      // posiciones impares (1ª, 3ª, 5ª, 7ª): doblar y sumar dígitos
      const doble = d * 2
      sumaImpar += Math.floor(doble / 10) + (doble % 10)
    } else {
      sumaPar += d
    }
  }
  const total = sumaPar + sumaImpar
  const digitoControl = (10 - (total % 10)) % 10
  const ultimo = s[8]
  // Letras P, Q, R, S, W, N y entidades extranjeras → control letra
  // Resto admite tanto dígito como letra equivalente
  const letraEsperada = LETRAS_CIF_CONTROL[digitoControl]
  const exigeLetra = 'PQRSNW'.includes(s[0])
  if (exigeLetra) return ultimo === letraEsperada
  return ultimo === String(digitoControl) || ultimo === letraEsperada
}

export type TipoIdFiscal = 'NIF' | 'NIE' | 'CIF'

export type ResultadoValidacionNif =
  | { valido: true; normalizado: string; tipo: TipoIdFiscal }
  | { valido: false; error: string }

export function validarIdFiscal(input: string | null | undefined): ResultadoValidacionNif {
  if (!input || !input.trim()) {
    return { valido: false, error: 'NIF/CIF vacío' }
  }
  const s = normalizar(input)
  if (s.length !== 9) {
    return { valido: false, error: `NIF/CIF debe tener 9 caracteres (recibido: "${input}")` }
  }
  if (/^\d{8}[A-Z]$/.test(s)) {
    return validarNif(s)
      ? { valido: true, normalizado: s, tipo: 'NIF' }
      : { valido: false, error: `NIF con letra de control incorrecta: "${input}"` }
  }
  if (/^[XYZ]\d{7}[A-Z]$/.test(s)) {
    return validarNie(s)
      ? { valido: true, normalizado: s, tipo: 'NIE' }
      : { valido: false, error: `NIE con letra de control incorrecta: "${input}"` }
  }
  if (/^[A-Z]\d{7}[\dA-J]$/.test(s)) {
    return validarCif(s)
      ? { valido: true, normalizado: s, tipo: 'CIF' }
      : { valido: false, error: `CIF con dígito de control incorrecto: "${input}"` }
  }
  return { valido: false, error: `Formato no reconocido como NIF/NIE/CIF: "${input}"` }
}
