import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseRouteClient } from "@/lib/supabase/route";
import { validarIdFiscal, type AlmacenVerifactu } from "@/lib/verifactu";

// Utilidades de servidor para /api/admin/facturacion. Nunca importar en cliente.

export const BUCKET_PDF = "facturacion";
export const BUCKET_ASSETS = "doc-assets";

/** Devuelve el id del usuario si es admin activo; si no, la respuesta de error. */
export async function requireAdmin(): Promise<{ userId: string } | { res: NextResponse }> {
    const supabase = await supabaseRouteClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { res: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };
    const { data } = await supabaseAdmin.from("profiles").select("rol, activo").eq("user_id", user.id).maybeSingle();
    if (data?.rol !== "admin" || data?.activo === false) return { res: NextResponse.json({ error: "No autorizado" }, { status: 403 }) };
    return { userId: user.id };
}

/** Mensaje de un error de Postgres lanzado a propósito por nuestras reglas (check_violation). */
export function errorDeRegla(err: unknown): string | null {
    const e = err as { code?: string; message?: string } | null;
    return e?.code === "23514" && e.message ? e.message : null;
}

/** NIF provisional que pone la migración hasta que se rellena el real. */
export const esNifPendiente = (nif: string) => nif.startsWith("PENDIENTE");

/** Almacén VeriFactu sobre Supabase: una cadena por NIF emisor. */
export const almacenSupabase: AlmacenVerifactu = {
    async ultimoRegistro(nifEmisor) {
        const { data, error } = await supabaseAdmin
            .from("verifactu_registros")
            .select("nif_emisor, numero_factura, fecha_emision, huella")
            .eq("nif_emisor", nifEmisor)
            .order("num_registro", { ascending: false })
            .limit(1)
            .maybeSingle();
        if (error) throw error;
        return data ? { emisorNif: data.nif_emisor, numero: data.numero_factura, fechaEmision: data.fecha_emision, huella: data.huella } : null;
    },
    async guardarRegistro(r) {
        const { data, error } = await supabaseAdmin.from("verifactu_registros").insert({
            factura_id: r.facturaId, tipo: r.tipo, huella: r.huella, huella_anterior: r.huellaAnterior,
            nif_emisor: r.nifEmisor, numero_factura: r.numeroFactura, fecha_emision: r.fechaEmision,
            tipo_factura_aeat: r.tipoFacturaAeat, cuota_total: r.cuotaTotal, importe_total: r.importeTotal,
            fecha_hora_generacion: r.fechaHoraGeneracion, xml_payload: r.xml,
            estado_envio: "sin_envio", // modo No VERI*FACTU: no se envía a la AEAT
        }).select("id").single();
        if (error?.code === "23505") return { conflicto: true };
        if (error) return { error: error.message };
        return { id: data.id };
    },
};

/** Configuración del sistema informático (bloque SistemaInformatico del registro). */
export function configSistema() {
    return {
        productorNombre: process.env.VERIFACTU_PRODUCTOR_NOMBRE || undefined,
        productorNif: process.env.VERIFACTU_PRODUCTOR_NIF || undefined,
        nombreSistema: "Panel Serincosol Facturación",
        idSistema: "SP",
        version: "1.0",
        numeroInstalacion: process.env.VERIFACTU_NUM_INSTALACION || "SERINCOSOL-01",
        soloVerifactu: false,
        multiplesObligados: true,
    };
}

export async function descargar(bucket: string, path: string | null): Promise<Uint8Array | null> {
    if (!path) return null;
    const { data, error } = await supabaseAdmin.storage.from(bucket).download(path);
    if (error || !data) return null;
    return new Uint8Array(await data.arrayBuffer());
}

export const cpCiudad = (cp?: string | null, ciudad?: string | null, provincia?: string | null) =>
    [cp, ciudad, provincia && provincia !== ciudad ? provincia : null].filter(Boolean).join(" ") || null;

/** NIF opcional normalizado; error si viene y no es válido. */
export function normalizarNif(nif: string | null): { nif: string | null } | { error: string } {
    if (!nif) return { nif: null };
    const v = validarIdFiscal(nif);
    return v.valido ? { nif: v.normalizado } : { error: `NIF no válido: ${v.error}` };
}

/** Campos que, en el facturador vinculado, mandan desde Ajustes Emisor (company_settings). */
export const CAMPOS_AJUSTES = ["razon_social", "nif", "direccion", "cp", "ciudad", "telefono", "iban", "logo_path"] as const;

/**
 * Copia los datos de Ajustes Emisor al facturador vinculado (origen_datos = 'ajustes_emisor').
 * Se llama al listar facturadores, al previsualizar y al emitir, así la factura sale
 * siempre con lo que haya en Ajustes Emisor. Devuelve un aviso si algo impide usarlos.
 */
export async function sincronizarAjustesEmisor(): Promise<{ aviso: string | null }> {
    const { data: e, error } = await supabaseAdmin.from("facturacion_emisores")
        .select("id, nif, razon_social, direccion, cp, ciudad, telefono, iban, logo_path")
        .eq("origen_datos", "ajustes_emisor").maybeSingle();
    if (error) throw error;
    if (!e) return { aviso: null };

    const { data: rows, error: e2 } = await supabaseAdmin.from("company_settings").select("setting_key, setting_value");
    if (e2) throw e2;
    const m = Object.fromEntries((rows ?? []).map((r) => [r.setting_key, (r.setting_value ?? "").trim()]));
    const avisos: string[] = [];

    const patch: Record<string, string | null> = {
        direccion: m.emisor_address || null, cp: m.emisor_cp || null, ciudad: m.emisor_city || null,
        telefono: m.emisor_phone || null, iban: m.emisor_iban || null, logo_path: m.logo_path || null,
    };
    if (m.emisor_name) patch.razon_social = m.emisor_name;
    else avisos.push("falta el nombre");

    const nif = m.emisor_cif ? validarIdFiscal(m.emisor_cif) : null;
    if (!nif) avisos.push("falta el CIF");
    else if (!nif.valido) avisos.push(`el CIF no es válido (${nif.error})`);
    else if (nif.normalizado !== e.nif) {
        const { count } = await supabaseAdmin.from("facturas").select("id", { count: "exact", head: true }).eq("emisor_id", e.id);
        if ((count ?? 0) > 0 && !esNifPendiente(e.nif)) avisos.push("el CIF ha cambiado y este facturador ya tiene facturas emitidas con el anterior");
        else patch.nif = nif.normalizado;
    }

    const cambia = Object.entries(patch).some(([k, v]) => (e as Record<string, unknown>)[k] !== v);
    if (cambia) {
        const { error: e3 } = await supabaseAdmin.from("facturacion_emisores")
            .update({ ...patch, updated_at: new Date().toISOString() }).eq("id", e.id);
        if (e3?.code === "23505") avisos.push("ese CIF ya lo usa otro facturador");
        else if (e3) throw e3;
    }
    return { aviso: avisos.length ? `En Ajustes Emisor ${avisos.join(", ")}.` : null };
}
