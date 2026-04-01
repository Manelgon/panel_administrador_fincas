import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

const SOURCE_MAP: Record<string, string> = {
  'whatsapp': 'Whatsapp',
  'ha enviado email': 'Email',
  'ha enviado e-mail': 'Email',
  'ha llamado': 'Llamada',
  'visita a comunidad': 'Presencial',
  'ha venido': 'Presencial',
  'tratar proxima junta': 'Acuerdo Junta',
  'por acuerdo en junta': 'Acuerdo Junta',
  'por correspondencia': 'Email',
}

const VALID_SOURCES = ['Llamada', 'Presencial', 'Email', 'Whatsapp', 'App 360', 'Acuerdo Junta']

const SOURCE_PATTERNS = [
  'Por acuerdo en Junta',
  'Tratar proxima Junta',
  'Ha enviado EMail',
  'Ha enviado E-Mail',
  'Visita a Comunidad',
  'Por correspondencia',
  'Ha llamado',
  'Ha venido',
  'Whatsapp',
]

// Pattern: [HH:MM, D/M/YYYY] Author: content
const WA_HEADER_PATTERN = /\[(\d{1,2}:\d{2}),\s+(\d{1,2}\/\d{1,2}\/\d{4})\]\s+([^:[\]]+):/g

type EstadoImport = 'Pendiente' | 'Resuelto'

interface ChatMessage {
  author: string
  content: string
  created_at: string
}

interface ParsedIncident {
  comunidad_name: string
  source_raw: string
  motivo_ticket: string
  mensaje: string
  created_at: string
  chat_messages: ChatMessage[]
  has_preamble: boolean
}

interface PreviewRecord {
  status: 'ok' | 'skip'
  comunidad_name: string
  comunidad_matched?: string
  motivo: string
  mensaje: string
  fecha: string
  source_raw: string
  source_mapped?: string | null
  reason?: string
  chat_count: number
}

type Comunidad = { id: number; nombre_cdad: string; codigo: string }

function matchCommunity(name: string, comunidades: Comunidad[]): Comunidad | undefined {
  const normalized = name.toLowerCase().trim()
  return comunidades.find(
    (c) =>
      c.nombre_cdad?.toLowerCase().trim() === normalized ||
      c.nombre_cdad?.toLowerCase().includes(normalized) ||
      normalized.includes(c.nombre_cdad?.toLowerCase() ?? '')
  )
}

function mapSource(sourceRaw: string): string | null {
  const mapped = SOURCE_MAP[sourceRaw.toLowerCase()] ?? null
  return VALID_SOURCES.includes(mapped ?? '') ? mapped : null
}

function parseWhatsAppMessages(bodyText: string): { messages: ChatMessage[]; hasPreamble: boolean } {
  const messages: ChatMessage[] = []
  const regex = new RegExp(WA_HEADER_PATTERN.source, 'g')

  const firstMatch = regex.exec(bodyText)
  if (!firstMatch) {
    // No WhatsApp messages at all
    return { messages: [], hasPreamble: bodyText.trim().length > 0 }
  }

  const hasPreamble = firstMatch.index > 0 && bodyText.slice(0, firstMatch.index).trim().length > 0

  // Restart and collect all messages
  regex.lastIndex = 0
  let prevEnd = 0
  let prevAuthor = ''
  let prevTimestamp = ''
  let isFirst = true

  let match: RegExpExecArray | null
  while ((match = regex.exec(bodyText)) !== null) {
    if (!isFirst) {
      const content = bodyText.slice(prevEnd, match.index).trim()
      if (content) messages.push({ author: prevAuthor, content, created_at: prevTimestamp })
    }

    const [timePart, datePart, author] = [match[1], match[2], match[3].trim()]
    const [day, month, year] = datePart.split('/')
    prevTimestamp = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${timePart}:00`
    prevAuthor = author
    prevEnd = match.index + match[0].length
    isFirst = false
  }

  // Last message
  if (!isFirst) {
    const content = bodyText.slice(prevEnd).trim()
    if (content) messages.push({ author: prevAuthor, content, created_at: prevTimestamp })
  }

  return { messages, hasPreamble }
}

function parseNetFincasPdf(text: string): ParsedIncident[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const incidents: ParsedIncident[] = []

  const dateOnlyPattern = /^\d{2}\/\d{2}\/\d{4}$/
  const timePattern = /^\d{2}:\d{2}:\d{2}$/

  // Anchor on header lines: lines that contain a SOURCE_PATTERN with comunidad text before it
  const headerIndices: number[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    for (const sp of SOURCE_PATTERNS) {
      const idx = line.indexOf(sp)
      if (idx !== -1 && line.substring(0, idx).trim().length > 0) {
        headerIndices.push(i)
        break
      }
    }
  }

  for (let h = 0; h < headerIndices.length; h++) {
    const headerIdx = headerIndices[h]
    const nextHeaderIdx = h + 1 < headerIndices.length ? headerIndices[h + 1] : lines.length
    const headerLine = lines[headerIdx]

    let sourceRaw = ''
    let comunidadName = ''
    let motivoStart = ''

    for (const sp of SOURCE_PATTERNS) {
      const idx = headerLine.indexOf(sp)
      if (idx !== -1) {
        comunidadName = headerLine.substring(0, idx).trim()
        sourceRaw = sp
        motivoStart = headerLine.substring(idx + sp.length).trim()
        break
      }
    }

    if (!sourceRaw || !comunidadName) continue

    // Case A: date at end of header line (short motivo)
    const headerDateMatch = headerLine.match(/(\d{2}\/\d{2}\/\d{4})$/)
    let date = ''
    let dateIdx = -1

    if (headerDateMatch) {
      date = headerDateMatch[1]
      dateIdx = headerIdx
      motivoStart = motivoStart.replace(/\s*\d{2}\/\d{2}\/\d{4}$/, '').trim()
    } else {
      // Case B: date on its own line
      for (let j = headerIdx + 1; j < nextHeaderIdx; j++) {
        if (dateOnlyPattern.test(lines[j])) {
          date = lines[j]
          dateIdx = j
          break
        }
      }
    }

    if (!date) continue

    let time = '00:00:00'
    let bodyStart = dateIdx + 1
    if (dateIdx + 1 < nextHeaderIdx && timePattern.test(lines[dateIdx + 1])) {
      time = lines[dateIdx + 1]
      bodyStart = dateIdx + 2
    }

    const motivoContinuation: string[] = []
    if (dateIdx > headerIdx) {
      for (let j = headerIdx + 1; j < dateIdx; j++) {
        if (!timePattern.test(lines[j])) motivoContinuation.push(lines[j])
      }
    }
    const motivoTicket = [motivoStart, ...motivoContinuation].filter(Boolean).join(' ').trim()

    // Keep body lines for WhatsApp parsing (join with space, WA pattern doesn't need newlines)
    const bodyText = lines.slice(bodyStart, nextHeaderIdx).join(' ').trim()
    const mensaje = bodyText ? `${motivoTicket} ${bodyText}` : motivoTicket

    const { messages: chat_messages, hasPreamble: has_preamble } = parseWhatsAppMessages(bodyText)

    const [day, month, year] = date.split('/')

    if (comunidadName && motivoTicket) {
      incidents.push({
        comunidad_name: comunidadName,
        source_raw: sourceRaw,
        motivo_ticket: motivoTicket,
        mensaje,
        created_at: `${year}-${month}-${day}T${time}`,
        chat_messages,
        has_preamble,
      })
    }
  }

  return incidents
}

export async function POST(req: NextRequest) {
  try {
    const dryRun = req.nextUrl.searchParams.get('dryRun') === 'true'

    const formData = await req.formData()
    const file = formData.get('pdf') as File | null
    const receptorId = (formData.get('receptor_id') as string | null) ?? null
    const estadosRaw = formData.get('estados') as string | null
    const estadosArray: EstadoImport[] = estadosRaw
      ? (JSON.parse(estadosRaw) as string[]).map((e) => (e === 'Resuelto' ? 'Resuelto' : 'Pendiente'))
      : []

    if (!file) {
      return NextResponse.json({ error: 'No se recibió archivo PDF' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const [pdfData, { data: comunidades, error: comunidadesError }] = await Promise.all([
      require('pdf-parse/lib/pdf-parse.js')(buffer),
      supabaseAdmin.from('comunidades').select('id, nombre_cdad, codigo').eq('activo', true),
    ])

    if (comunidadesError) {
      return NextResponse.json({ error: 'Error al obtener comunidades' }, { status: 500 })
    }

    const incidents = parseNetFincasPdf(pdfData.text)
    const allComunidades: Comunidad[] = comunidades ?? []

    if (dryRun) {
      let toInsert = 0
      let toSkip = 0
      const records: PreviewRecord[] = []

      for (const incident of incidents) {
        const community = matchCommunity(incident.comunidad_name, allComunidades)
        if (!community) {
          toSkip++
          records.push({
            status: 'skip',
            comunidad_name: incident.comunidad_name,
            motivo: incident.motivo_ticket,
            mensaje: incident.mensaje,
            fecha: incident.created_at,
            source_raw: incident.source_raw,
            reason: `Comunidad no encontrada en el sistema: "${incident.comunidad_name}"`,
            chat_count: incident.chat_messages.length,
          })
          continue
        }
        toInsert++
        records.push({
          status: 'ok',
          comunidad_name: incident.comunidad_name,
          comunidad_matched: community.nombre_cdad,
          motivo: incident.motivo_ticket,
          mensaje: incident.mensaje,
          fecha: incident.created_at,
          source_raw: incident.source_raw,
          source_mapped: mapSource(incident.source_raw),
          chat_count: incident.chat_messages.length,
        })
      }

      return NextResponse.json({ dryRun: true, total_parsed: incidents.length, to_insert: toInsert, to_skip: toSkip, records })
    }

    const inserted: { id: number }[] = []
    const skipped: { motivo: string; reason: string }[] = []
    const errors: { motivo: string; error: string }[] = []
    let okIndex = 0

    for (const incident of incidents) {
      const community = matchCommunity(incident.comunidad_name, allComunidades)

      if (!community) {
        skipped.push({ motivo: incident.motivo_ticket, reason: `Comunidad no encontrada: "${incident.comunidad_name}"` })
        continue
      }

      const estado: EstadoImport = estadosArray[okIndex] ?? 'Pendiente'
      okIndex++

      const { data, error } = await supabaseAdmin
        .from('incidencias')
        .insert({
          comunidad_id: community.id,
          motivo_ticket: incident.motivo_ticket,
          mensaje: incident.mensaje,
          source: mapSource(incident.source_raw),
          urgencia: 'Alta',
          categoria: 'Incidencias',
          estado,
          created_at: incident.created_at,
          nombre_cliente: '',
          quien_lo_recibe: receptorId,
          gestor_asignado: receptorId,
        })
        .select('id')
        .single()

      if (error) {
        errors.push({ motivo: incident.motivo_ticket, error: error.message })
        continue
      }

      inserted.push(data)

      // Only create timeline entries if there are WhatsApp messages to add
      if (incident.chat_messages.length > 0 && receptorId) {
        const timelineRows: {
          user_id: string
          entity_type: string
          entity_id: number
          content: string
          created_at: string
        }[] = []

        // If body starts directly with WhatsApp (no preamble), add motivo as first entry
        if (!incident.has_preamble) {
          timelineRows.push({
            user_id: receptorId,
            entity_type: 'incidencia',
            entity_id: data.id,
            content: incident.motivo_ticket,
            created_at: incident.created_at,
          })
        }

        for (const msg of incident.chat_messages) {
          timelineRows.push({
            user_id: receptorId,
            entity_type: 'incidencia',
            entity_id: data.id,
            content: `[${msg.author}] ${msg.content}`,
            created_at: msg.created_at,
          })
        }

        await supabaseAdmin.from('record_messages').insert(timelineRows)
      }
    }

    return NextResponse.json({
      ok: true,
      total_parsed: incidents.length,
      inserted: inserted.length,
      skipped: skipped.length,
      errors: errors.length,
      skipped_details: skipped.slice(0, 20),
      error_details: errors.slice(0, 10),
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Error importando PDF:', msg)
    return NextResponse.json({ error: `Error procesando el PDF: ${msg}` }, { status: 500 })
  }
}
