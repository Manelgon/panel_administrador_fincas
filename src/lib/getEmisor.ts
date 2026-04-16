import { supabaseAdmin } from "@/lib/supabase/admin";

export interface EmisorData {
    nombre: string;
    direccion: string;
    ciudad: string;
    cp: string;
    cif: string;
    colegiado: string;
    colegioCiudad: string;
    iban: string;
    logoPath: string;
    firmaPath: string;
    headerPath: string;
}

/**
 * Lee los datos del emisor desde company_settings (Supabase).
 * Usa service role key — seguro para llamar desde API routes de servidor.
 * Fallback a env vars si la tabla no tiene datos aún.
 */
export async function getEmisor(): Promise<EmisorData> {
    const { data, error } = await supabaseAdmin
        .from("company_settings")
        .select("setting_key, setting_value");

    if (error || !data || data.length === 0) {
        return {
            nombre: process.env.EMISOR_NAME || "EMPRESA",
            direccion: process.env.EMISOR_ADDRESS || "",
            ciudad: process.env.EMISOR_CITY || "",
            cp: "",
            cif: process.env.EMISOR_CIF || "",
            colegiado: "",
            colegioCiudad: "",
            iban: "",
            logoPath: "",
            firmaPath: "",
            headerPath: "",
        };
    }

    const map: Record<string, string> = {};
    for (const row of data) {
        map[row.setting_key] = row.setting_value;
    }

    return {
        nombre: map["emisor_name"] || process.env.EMISOR_NAME || "EMPRESA",
        direccion: map["emisor_address"] || process.env.EMISOR_ADDRESS || "",
        ciudad: map["emisor_city"] || process.env.EMISOR_CITY || "",
        cp: map["emisor_cp"] || "",
        cif: map["emisor_cif"] || process.env.EMISOR_CIF || "",
        colegiado: map["colegiado_nombre"] || "",
        colegioCiudad: map["colegio_ciudad"] || "",
        iban: map["emisor_iban"] || "",
        logoPath: map["logo_path"] || "",
        firmaPath: map["firma_path"] || "",
        headerPath: map["header_path"] || "",
    };
}
