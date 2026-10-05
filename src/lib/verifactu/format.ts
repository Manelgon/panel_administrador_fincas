
// Formatters compartidos entre hash.ts y xml-builder.ts.
// Cualquier divergencia entre el string del hash y el del XML hace que la
// AEAT rechace el registro: por eso TIENEN que ser la misma función.

export function fmtImporte(n: number): string {
  // Dos decimales con punto, sin separadores de millar.
  return (Math.round(n * 100) / 100).toFixed(2)
}

export function fmtFechaEsp(iso: string): string {
  // YYYY-MM-DD → DD-MM-YYYY (formato AEAT)
  const [y, m, d] = iso.split('-')
  return `${d}-${m}-${y}`
}

export function fmtFechaHoraUtc(d: Date): string {
  // ISO 8601 en UTC sin milisegundos: YYYY-MM-DDTHH:MM:SSZ
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z')
}
