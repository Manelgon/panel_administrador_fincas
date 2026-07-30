/**
 * Importación única de Contratos.xls a la tabla `contratos` (PRP-004, Fase 5).
 *
 * Uso:
 *   npx tsx scripts/import-contratos.ts             # dry-run: solo genera el reporte
 *   npx tsx scripts/import-contratos.ts --execute   # inserta en la BD
 *
 * Reglas:
 * - Patrón de fila doble: fila par = datos del contrato, fila impar = descripción.
 * - Comunidad sin match → NO se crea; se reporta para revisión manual.
 * - Proveedor sin match → se crea con nombre + activo:true.
 * - Tipo de servicio → se mapea al catálogo cerrado; sin match razonable → 'Otro'
 *   y el texto original se conserva prefijado en la descripción.
 * - Idempotente: no inserta si ya existe (comunidad_id, proveedor_id, tipo_servicio, fecha_alta).
 */
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import { TIPOS_SERVICIO_CONTRATO } from '../src/lib/tiposServicioContrato';

const ROOT = path.resolve(__dirname, '..');
const EXECUTE = process.argv.includes('--execute');

// --- Env ---
const envFile = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf-8');
const env: Record<string, string> = {};
for (const line of envFile.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// --- Normalización ---
function normalize(s: string): string {
    return s
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
}

// --- Mapeo de tipo de servicio del Excel → catálogo cerrado ---
// Claves normalizadas (sin tildes, mayúsculas).
const MAPEO_SERVICIO: Record<string, (typeof TIPOS_SERVICIO_CONTRATO)[number]> = {
    'SEGURO MULTIRRIESGO': 'Seguro multirriesgo',
    'ELECTRICIDAD': 'Electricidad',
    'INSPECCION ELECTRICA.': 'Electricidad',
    'ASCENSORES': 'Ascensores',
    'INSPECCION ASCENSORES': 'Ascensores',
    'TELEFONO ASCENSOR': 'Ascensores',
    'SALVAESCALERA': 'Ascensores',
    'LIMPIEZA': 'Limpieza',
    'MANTENIMIENTO Y LIMPIEZA': 'Limpieza',
    'SUMINISTRO DE AGUA': 'Suministro de agua',
    'AGUA': 'Suministro de agua',
    'EXTINTORES': 'Extintores / Contraincendios',
    'CONTRAINCENDIO': 'Extintores / Contraincendios',
    'PROTECCION CONTRA INCENDIOS': 'Extintores / Contraincendios',
    'GRUPO DE PRESION': 'Grupo de presión',
    'MANTENIMIENTO GRUPOS PRESION': 'Grupo de presión',
    'PROTECCION DE DATOS RGPD': 'Protección de datos RGPD',
    'ANTENAS': 'Antenas / Telecomunicaciones',
    'MANTENIMIENTO ANTENAS COLECTIVAS': 'Antenas / Telecomunicaciones',
    'TELECOMUNICACIONES': 'Antenas / Telecomunicaciones',
    'TELEFONIA': 'Antenas / Telecomunicaciones',
    'PORTERO ELECTRONICO': 'Antenas / Telecomunicaciones',
    'SISTEMA CONTROL TELEFONICO': 'Antenas / Telecomunicaciones',
    'CAMARAS DE SEGURIDAD': 'Cámaras / Seguridad',
    'SEGURIDAD': 'Cámaras / Seguridad',
    'PUERTAS GARAJE': 'Puertas de garaje',
    'MANTENIMIENTO PUERTAS GARAJE': 'Puertas de garaje',
    'DESINSECTACIONES': 'Control de plagas',
    'CONTROL DE PLAGAS': 'Control de plagas',
    'PISCINA': 'Piscina',
    'OBRAS Y REFORMAS': 'Obras y reformas',
    'ALBANILERIA': 'Obras y reformas',
    'PINTURAS': 'Obras y reformas',
    'JARDINERIA': 'Jardinería',
    'MANTENIMIENTO': 'Mantenimiento general',
    'MULTI MANTENIMIENTO': 'Mantenimiento general',
    'MANTENIMIENTO TECNICOS': 'Mantenimiento general',
    'PREVENCION DE RIESGOS LABORALES': 'Prevención de riesgos laborales',
    'INSTALACION SOLAR TERMICA': 'Energía solar',
    'MANTENIMIENTO INSTALACION SOLAR': 'Energía solar',
    'PLACAS SOLARES': 'Energía solar',
    'BANCA': 'Banca / Cuenta corriente',
    'CUENTA CORRIENTE': 'Banca / Cuenta corriente',
    'APODERAMIENTOS': 'Servicios jurídicos',
    'ABOGADO': 'Servicios jurídicos',
    'ITE': 'ITE',
};

function fechaISO(v: unknown): string | null {
    if (v instanceof Date && !isNaN(v.getTime())) {
        // Las fechas del .xls vienen como Date locales; formatear sin zona
        const y = v.getFullYear();
        const m = String(v.getMonth() + 1).padStart(2, '0');
        const d = String(v.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    return null;
}

interface ContratoRaw {
    fila: number;
    comunidad: string;
    proveedor: string;
    tipoServicio: string;
    descripcion: string;
    fechaAlta: string | null;
    fechaVencimiento: string | null;
    fechaPreaviso: string | null;
}

async function main() {
    // --- 1. Parseo del Excel (patrón de fila doble) ---
    const wb = XLSX.read(fs.readFileSync(path.join(ROOT, 'Contratos.xls')), { cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    const dataRows = rows.slice(1); // saltar cabecera

    const contratos: ContratoRaw[] = [];
    for (let i = 0; i + 1 < dataRows.length; i += 2) {
        const [comunidad, proveedor, tipo, alta, venc, preaviso] = dataRows[i];
        const descripcion = dataRows[i + 1]?.[0];
        if (!proveedor) {
            console.warn(`⚠️  Fila ${i + 2}: sin proveedor, se omite (patrón roto?)`);
            continue;
        }
        contratos.push({
            fila: i + 2,
            comunidad: String(comunidad ?? '').trim(),
            proveedor: String(proveedor).trim(),
            tipoServicio: String(tipo ?? '').trim(),
            descripcion: String(descripcion ?? '').trim(),
            fechaAlta: fechaISO(alta),
            fechaVencimiento: fechaISO(venc),
            fechaPreaviso: fechaISO(preaviso),
        });
    }
    console.log(`Parseados ${contratos.length} contratos de ${dataRows.length} filas`);

    // --- 2. Cargar referencias ---
    const { data: comunidades, error: e1 } = await supabase.from('comunidades').select('id, nombre_cdad');
    const { data: proveedores, error: e2 } = await supabase.from('proveedores').select('id, nombre');
    if (e1 || e2 || !comunidades || !proveedores) {
        throw new Error(`Error cargando referencias: ${e1?.message || e2?.message}`);
    }
    const comunidadPorNombre = new Map(comunidades.map(c => [normalize(c.nombre_cdad), c.id]));
    const proveedorPorNombre = new Map(proveedores.map(p => [normalize(p.nombre), p.id]));

    function matchComunidad(nombre: string): number | null {
        const n = normalize(nombre);
        if (comunidadPorNombre.has(n)) return comunidadPorNombre.get(n)!;
        // match aproximado: contención en cualquiera de las dos direcciones
        for (const [key, id] of comunidadPorNombre) {
            if (key.includes(n) || n.includes(key)) return id;
        }
        return null;
    }

    // --- 3. Resolución fila a fila ---
    const comunidadesNoMatcheadas = new Map<string, number>(); // nombre excel → nº contratos omitidos
    const proveedoresCreados: string[] = [];
    const tiposEnOtro = new Map<string, number>();
    const aInsertar: Array<Record<string, unknown>> = [];

    for (const c of contratos) {
        const comunidadId = matchComunidad(c.comunidad);
        if (!comunidadId) {
            comunidadesNoMatcheadas.set(c.comunidad, (comunidadesNoMatcheadas.get(c.comunidad) || 0) + 1);
            continue;
        }

        let proveedorId = proveedorPorNombre.get(normalize(c.proveedor));
        if (!proveedorId) {
            if (EXECUTE) {
                const { data, error } = await supabase
                    .from('proveedores')
                    .insert({ nombre: c.proveedor, activo: true })
                    .select('id')
                    .single();
                if (error || !data) throw new Error(`Error creando proveedor "${c.proveedor}": ${error?.message}`);
                proveedorId = data.id;
            } else {
                proveedorId = -1; // placeholder en dry-run
            }
            proveedorPorNombre.set(normalize(c.proveedor), proveedorId!);
            proveedoresCreados.push(c.proveedor);
        }

        // El histórico trae 3 contratos con alta > vencimiento (datos erróneos del
        // programa antiguo): violan el CHECK contratos_fechas_coherentes. Se anula
        // fecha_alta y se conserva la original en la descripción.
        let fechaAlta = c.fechaAlta;
        if (fechaAlta && c.fechaVencimiento && c.fechaVencimiento < fechaAlta) {
            c.descripcion = `[Fecha alta original incoherente: ${fechaAlta}] ${c.descripcion}`.trim();
            fechaAlta = null;
        }

        const tipoMapeado = MAPEO_SERVICIO[normalize(c.tipoServicio)];
        let tipoServicio: string = tipoMapeado || 'Otro';
        let descripcion = c.descripcion;
        if (!tipoMapeado) {
            tiposEnOtro.set(c.tipoServicio, (tiposEnOtro.get(c.tipoServicio) || 0) + 1);
            descripcion = `[Origen Excel: ${c.tipoServicio}] ${descripcion}`.trim();
        }

        aInsertar.push({
            comunidad_id: comunidadId,
            proveedor_id: proveedorId,
            tipo_servicio: tipoServicio,
            descripcion: descripcion || null,
            fecha_alta: fechaAlta,
            fecha_vencimiento: c.fechaVencimiento,
            fecha_preaviso: c.fechaPreaviso,
            activo: true,
        });
    }

    // --- 4. Idempotencia + inserción ---
    let insertados = 0;
    let duplicados = 0;
    if (EXECUTE) {
        // La descripción forma parte de la clave: hay contratos legítimos que solo
        // se distinguen por ella (ej. pólizas de agua de bloques distintos con la
        // misma comunidad, proveedor, tipo y fecha).
        const clave = (x: Record<string, unknown>) =>
            `${x.comunidad_id}|${x.proveedor_id}|${x.tipo_servicio}|${x.fecha_alta}|${x.descripcion ?? ''}`;
        const { data: existentes } = await supabase
            .from('contratos')
            .select('comunidad_id, proveedor_id, tipo_servicio, fecha_alta, descripcion');
        const claves = new Set((existentes || []).map(clave));
        const nuevos = aInsertar.filter(x => {
            const k = clave(x);
            if (claves.has(k)) { duplicados++; return false; }
            claves.add(k);
            return true;
        });
        for (let i = 0; i < nuevos.length; i += 100) {
            const lote = nuevos.slice(i, i + 100);
            const { error } = await supabase.from('contratos').insert(lote);
            if (error) throw new Error(`Error insertando lote ${i / 100 + 1}: ${error.message}`);
            insertados += lote.length;
        }
    }

    // --- 5. Reporte ---
    const omitidos = [...comunidadesNoMatcheadas.values()].reduce((a, b) => a + b, 0);
    const lineas = [
        `REPORTE DE IMPORTACIÓN DE CONTRATOS — ${EXECUTE ? 'EJECUCIÓN REAL' : 'DRY-RUN (sin escribir en BD)'}`,
        `Fecha: ${new Date().toISOString()}`,
        '',
        `Contratos parseados del Excel:      ${contratos.length}`,
        `Contratos preparados para insertar: ${aInsertar.length}`,
        EXECUTE ? `Contratos insertados:               ${insertados}` : '',
        EXECUTE ? `Duplicados omitidos (ya en BD):     ${duplicados}` : '',
        `Contratos omitidos (comunidad sin match): ${omitidos}`,
        '',
        `--- COMUNIDADES NO MATCHEADAS (${comunidadesNoMatcheadas.size}) — revisar manualmente ---`,
        ...[...comunidadesNoMatcheadas.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([nombre, n]) => `  ${String(n).padStart(3)} contrato(s) · "${nombre}"`),
        '',
        `--- PROVEEDORES ${EXECUTE ? 'CREADOS' : 'A CREAR'} (${proveedoresCreados.length}) ---`,
        ...proveedoresCreados.sort().map(p => `  · ${p}`),
        '',
        `--- TIPOS DE SERVICIO SIN MAPEO → 'Otro' (${tiposEnOtro.size}) ---`,
        ...[...tiposEnOtro.entries()].map(([t, n]) => `  ${String(n).padStart(3)} contrato(s) · "${t}"`),
        '',
    ].filter(l => l !== '');

    const reportDir = path.join(ROOT, 'scripts', 'reports');
    fs.mkdirSync(reportDir, { recursive: true });
    const reportPath = path.join(reportDir, 'contratos-import-report.txt');
    fs.writeFileSync(reportPath, lineas.join('\n'), 'utf-8');
    console.log(lineas.join('\n'));
    console.log(`\nReporte guardado en ${reportPath}`);
    if (!EXECUTE) console.log('\nDry-run. Ejecuta con --execute para insertar.');
}

main().catch(err => {
    console.error('ERROR:', err.message);
    process.exit(1);
});
