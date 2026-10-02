import { supabaseAdmin } from "@/lib/supabase/admin";
import { registrarAlta, generarQrPng, validarIdFiscal, type LineaDesglose } from "@/lib/verifactu";
import { calcularTotales } from "./calculo";
import { construirFacturaPdf, type DatosPdf } from "./pdf";
import { borradorSchema } from "./schemas";
import { almacenSupabase, configSistema, cpCiudad, descargar, esNifPendiente, sincronizarAjustesEmisor, BUCKET_ASSETS, BUCKET_PDF } from "./server";

// Borrador → factura emitida:
//   1. valida datos (NIF reales, líneas, fecha)
//   2. facturacion_emitir (SQL): número + factura congelada + líneas, en una transacción
//   3. registro VeriFactu encadenado (huella + XML) y QR
//   4. PDF al bucket privado y borrado del borrador
// Si 3 o 4 fallan, la factura ya existe y se puede reintentar con `completarFactura`.

type Emisor = {
    id: string; razon_social: string; nombre_comercial: string | null; nif: string; direccion: string | null;
    cp: string | null; ciudad: string | null; provincia: string | null; iban: string | null;
    pie_legal: string | null; color_principal: string; logo_path: string | null; activo: boolean;
    origen_datos: "propio" | "ajustes_emisor";
};

/**
 * QR tributario en el PDF: APAGADO por defecto hasta que VeriFactu se aplique de verdad.
 * Se enciende con FACTURACION_QR=si en las variables del servidor. El registro encadenado
 * y la URL del QR se siguen guardando igualmente; solo cambia si se imprime en la factura.
 */
const qrEnPdf = () => process.env.FACTURACION_QR?.trim().toLowerCase() === "si";

export type ResultadoEmitir = { ok: true; facturaId: string; numero: string } | { error: string; status?: number };

async function cargarBorrador(id: string) {
    await sincronizarAjustesEmisor();
    const { data: b, error } = await supabaseAdmin.from("factura_borradores").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!b) return null;
    const [{ data: emisor }, { data: cliente }] = await Promise.all([
        supabaseAdmin.from("facturacion_emisores").select("*").eq("id", b.emisor_id).single<Emisor>(),
        b.cliente_id
            ? supabaseAdmin.from("clientes_facturacion").select("*").eq("id", b.cliente_id).maybeSingle()
            : Promise.resolve({ data: null }),
    ]);
    return { b, emisor, cliente };
}

/** Datos para el PDF a partir de un borrador (vista previa, sin número ni QR). */
export async function datosPdfBorrador(id: string): Promise<DatosPdf | null> {
    const r = await cargarBorrador(id);
    if (!r?.emisor) return null;
    const { b, emisor, cliente } = r;
    return {
        numero: null,
        fecha: b.fecha_emision ?? new Date().toISOString().slice(0, 10),
        emisor: datosEmisorPdf(emisor),
        cliente: {
            nombre: cliente?.nombre ?? "(sin cliente)", direccion: cliente?.direccion ?? null,
            cpCiudad: cpCiudad(cliente?.cp, cliente?.ciudad, cliente?.provincia), nif: cliente?.nif ?? null,
        },
        lineas: b.lineas, retencionPct: Number(b.retencion_pct),
        logo: await descargar(BUCKET_ASSETS, emisor.logo_path),
    };
}

function datosEmisorPdf(e: Emisor): DatosPdf["emisor"] {
    return {
        nombre: e.razon_social, direccion: e.direccion, cpCiudad: cpCiudad(e.cp, e.ciudad, e.provincia),
        nif: e.nif, iban: e.iban, pieLegal: e.pie_legal, color: e.color_principal,
    };
}

export async function emitirBorrador(borradorId: string, userId: string): Promise<ResultadoEmitir> {
    const r = await cargarBorrador(borradorId);
    if (!r) return { error: "El borrador no existe", status: 404 };
    const { b, emisor, cliente } = r;
    if (!emisor?.activo) return { error: "El facturador no está activo" };

    const parsed = borradorSchema.safeParse({ ...b, retencion_pct: Number(b.retencion_pct) });
    if (!parsed.success) return { error: "El borrador tiene datos no válidos. Revísalo y guarda de nuevo." };
    const d = parsed.data;
    if (!d.lineas.length) return { error: "Añade al menos una línea" };
    if (!d.fecha_emision) return { error: "Falta la fecha de emisión" };
    if (!cliente) return { error: "Elige un cliente" };

    const dondeSeEdita = emisor.origen_datos === "ajustes_emisor" ? "Ajustes Emisor" : "su ficha";
    if (esNifPendiente(emisor.nif)) return { error: `Completa el NIF real de ${emisor.razon_social} en ${dondeSeEdita} antes de emitir` };
    const nifEmisor = validarIdFiscal(emisor.nif);
    if (!nifEmisor.valido) return { error: `NIF del facturador no válido: ${nifEmisor.error}` };
    if (!emisor.direccion) return { error: `Completa la dirección de ${emisor.razon_social} en ${dondeSeEdita}` };
    if (!cliente.nif) return { error: "El cliente necesita NIF para una factura completa" };
    const nifCliente = validarIdFiscal(cliente.nif);
    if (!nifCliente.valido) return { error: `NIF del cliente no válido: ${nifCliente.error}` };

    const { data: serie } = await supabaseAdmin.from("facturacion_series")
        .select("id").eq("emisor_id", emisor.id).eq("tipo", "normal").eq("por_defecto", true).eq("activa", true).maybeSingle();
    if (!serie) return { error: `Configura la numeración de ${emisor.razon_social} en su ficha` };

    const t = calcularTotales(d.lineas, d.retencion_pct);
    const emisorPdf = datosEmisorPdf(emisor);
    const clienteDir = cpCiudad(cliente.cp, cliente.ciudad, cliente.provincia);

    const { data: factura, error } = await supabaseAdmin.rpc("facturacion_emitir", {
        p_serie_id: serie.id,
        p_factura: {
            tipo_aeat: "F1", fecha_emision: d.fecha_emision,
            emisor_nombre: emisor.razon_social, emisor_nif: nifEmisor.normalizado,
            emisor_direccion: [emisor.direccion, emisorPdf.cpCiudad].filter(Boolean).join(", "),
            cliente_nombre: cliente.nombre, cliente_nif: nifCliente.normalizado,
            cliente_direccion: [cliente.direccion, clienteDir].filter(Boolean).join(", ") || null,
            cliente_email: cliente.email,
            base_total: t.base, cuota_total: t.cuota, retencion_pct: t.retencionPct, retencion_total: t.retencion, importe_total: t.importeTotal,
            datos_impresion: {
                emisor: { ...emisorPdf, nif: nifEmisor.normalizado, logo_path: emisor.logo_path },
                cliente: { id: cliente.id, nombre: cliente.nombre, direccion: cliente.direccion, cpCiudad: clienteDir, nif: nifCliente.normalizado },
            },
            origen_tipo: "borrador", origen_id: borradorId, notas: d.notas, creada_por: userId,
        },
        p_lineas: t.lineas.map((l, i) => ({
            orden: i, concepto: l.concepto, cantidad: l.cantidad, precio_unitario: l.precio_unitario,
            tipo_iva: l.tipo_iva, base: l.base, cuota: l.cuota,
        })),
    }).single<{ id: string; numero: string }>();
    if (error) {
        if (error.code === "23514" || error.code === "P0001") return { error: error.message };
        throw error;
    }

    await supabaseAdmin.from("factura_borradores").delete().eq("id", borradorId);
    const fin = await completarFactura(factura.id);
    if ("error" in fin) return { error: `Factura ${factura.numero} emitida, pero falta: ${fin.error}. Pulsa "Completar" en el listado.` };
    return { ok: true, facturaId: factura.id, numero: factura.numero };
}

/** Registro VeriFactu + QR + PDF de una factura ya emitida. Se puede repetir sin riesgo. */
export async function completarFactura(facturaId: string): Promise<{ ok: true } | { error: string }> {
    const { data: f, error } = await supabaseAdmin.from("facturas")
        .select("*, factura_lineas(*)").eq("id", facturaId).single();
    if (error) throw error;
    const imp = f.datos_impresion as { emisor: DatosPdf["emisor"] & { logo_path: string | null }; cliente: DatosPdf["cliente"] };

    let qrUrl: string | null = f.qr_url;
    if (!f.verifactu_alta_id) {
        const porTipo = new Map<number, { base: number; cuota: number }>();
        for (const l of f.factura_lineas as { tipo_iva: number; base: number; cuota: number }[]) {
            const k = Number(l.tipo_iva); const v = porTipo.get(k) ?? { base: 0, cuota: 0 };
            porTipo.set(k, { base: v.base + Number(l.base), cuota: v.cuota + Number(l.cuota) });
        }
        const desglose: LineaDesglose[] = [...porTipo.entries()].map(([tipoIva, v]) =>
            ({ calificacion: "S1", tipoIva, base: Math.round(v.base * 100) / 100, cuota: Math.round(v.cuota * 100) / 100 }));
        const reg = await registrarAlta({
            id: f.id, numero: f.numero, fechaEmision: f.fecha_emision, tipo: f.tipo_aeat,
            cliente: { nombreRazon: f.cliente_nombre, nif: f.cliente_nif },
            descripcion: (f.factura_lineas as { concepto: string }[]).map((l) => l.concepto).join("; "),
            desglose, cuotaTotal: Number(f.cuota_total), importeTotal: Number(f.importe_total),
        }, { nombreRazon: f.emisor_nombre, nif: f.emisor_nif }, configSistema(), almacenSupabase);
        if ("error" in reg) return { error: `registro VeriFactu (${reg.error})` };
        qrUrl = reg.qrUrl;
        const { error: e2 } = await supabaseAdmin.from("facturas").update({ verifactu_alta_id: reg.registroId, qr_url: qrUrl }).eq("id", f.id);
        if (e2) throw e2;
    }

    const lineas = (f.factura_lineas as { orden: number; cantidad: number; concepto: string; precio_unitario: number; tipo_iva: number }[])
        .sort((a, b) => a.orden - b.orden)
        .map((l) => ({ cantidad: Number(l.cantidad), concepto: l.concepto, precio_unitario: Number(l.precio_unitario), tipo_iva: Number(l.tipo_iva) }));
    const pdf = await construirFacturaPdf({
        numero: f.numero, fecha: f.fecha_emision, emisor: imp.emisor, cliente: imp.cliente,
        lineas, retencionPct: Number(f.retencion_pct),
        logo: await descargar(BUCKET_ASSETS, imp.emisor.logo_path),
        qrPng: qrUrl && qrEnPdf() ? await generarQrPng(qrUrl) : null,
    });
    const path = `${f.emisor_id}/${f.anio}/${f.numero.replace(/[^A-Za-z0-9_-]/g, "_")}.pdf`;
    const { error: up } = await supabaseAdmin.storage.from(BUCKET_PDF).upload(path, pdf, { contentType: "application/pdf", upsert: true });
    if (up) return { error: `subida del PDF (${up.message})` };
    const { error: e3 } = await supabaseAdmin.from("facturas").update({ pdf_url: path }).eq("id", f.id);
    if (e3) throw e3;
    return { ok: true };
}
