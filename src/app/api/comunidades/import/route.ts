import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@supabase/supabase-js';

// Use the service role key to bypass RLS for admin import operations
interface ImportRow {
    codigo: string;
    nombre_cdad: string;
    cif: string | null;
}

export async function POST(req: NextRequest) {
    try {
        const { rows }: { rows: ImportRow[] } = await req.json();

        if (!rows || rows.length === 0) {
            return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
        }

        const results: { codigo: string; status: 'ok' | 'skipped' | 'error'; message?: string }[] = [];

        for (const row of rows) {
            try {
                // Try INSERT first
                const { error: insertError } = await supabaseAdmin
                    .from('comunidades')
                    .insert({
                        codigo: row.codigo,
                        nombre_cdad: row.nombre_cdad,
                        cif: row.cif || null,
                        activo: true,
                    });

                if (!insertError) {
                    results.push({ codigo: row.codigo, status: 'ok' });
                } else if (
                    insertError.code === '23505' ||
                    insertError.message?.toLowerCase().includes('duplicate') ||
                    insertError.message?.toLowerCase().includes('unique')
                ) {
                    // Duplicate → UPDATE
                    const { error: updateError } = await supabaseAdmin
                        .from('comunidades')
                        .update({ nombre_cdad: row.nombre_cdad, cif: row.cif || null })
                        .eq('codigo', row.codigo);

                    if (!updateError) {
                        results.push({ codigo: row.codigo, status: 'skipped', message: 'Actualizado (ya existía)' });
                    } else {
                        results.push({ codigo: row.codigo, status: 'error', message: `Update: ${updateError.message}` });
                    }
                } else {
                    results.push({ codigo: row.codigo, status: 'error', message: insertError.message });
                }
            } catch (err: any) {
                results.push({ codigo: row.codigo, status: 'error', message: err?.message || 'Error desconocido' });
            }
        }

        return NextResponse.json({ results });
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
    }
}
