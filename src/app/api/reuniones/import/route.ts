import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

interface ImportRow {
    comunidad_id: number;
    fecha_reunion: string;
    tipo: string;
    estado_cuentas: boolean | null;
    pto_ordinario: boolean | null;
    pto_extra: boolean | null;
    morosos: boolean | null;
    citacion_email: boolean | null;
    citacion_carta: boolean | null;
    borrador_acta: boolean | null;
    redactar_acta: boolean | null;
    vb_pendiente: boolean | null;
    imprimir_acta: boolean | null;
    acta_email: boolean | null;
    acta_carta: boolean | null;
    pasar_acuerdos: boolean | null;
    resuelto: boolean;
}

export async function POST(req: NextRequest) {
    try {
        const { rows }: { rows: ImportRow[] } = await req.json();

        if (!rows || rows.length === 0) {
            return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
        }

        const results: { status: 'ok' | 'skipped' | 'error'; message?: string }[] = [];

        for (const row of rows) {
            try {
                // Comprueba si ya existe la misma reunión (misma comunidad + fecha)
                const { data: existing } = await supabaseAdmin
                    .from('reuniones')
                    .select('id')
                    .eq('comunidad_id', row.comunidad_id)
                    .eq('fecha_reunion', row.fecha_reunion)
                    .maybeSingle();

                if (existing) {
                    results.push({ status: 'skipped', message: 'Ya existe (misma comunidad + fecha)' });
                    continue;
                }

                const { error } = await supabaseAdmin.from('reuniones').insert({
                    comunidad_id:   row.comunidad_id,
                    fecha_reunion:  row.fecha_reunion,
                    tipo:           row.tipo,
                    estado_cuentas: row.estado_cuentas,
                    pto_ordinario:  row.pto_ordinario,
                    pto_extra:      row.pto_extra,
                    morosos:        row.morosos,
                    citacion_email: row.citacion_email,
                    citacion_carta: row.citacion_carta,
                    borrador_acta:  row.borrador_acta,
                    redactar_acta:  row.redactar_acta,
                    vb_pendiente:   row.vb_pendiente,
                    imprimir_acta:  row.imprimir_acta,
                    acta_email:     row.acta_email,
                    acta_carta:     row.acta_carta,
                    pasar_acuerdos: row.pasar_acuerdos,
                    resuelto:       row.resuelto,
                });

                if (error) {
                    results.push({ status: 'error', message: error.message });
                } else {
                    results.push({ status: 'ok' });
                }
            } catch (err: unknown) {
                results.push({ status: 'error', message: err instanceof Error ? err.message : 'Error desconocido' });
            }
        }

        return NextResponse.json({ results });
    } catch (err: unknown) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
    }
}
