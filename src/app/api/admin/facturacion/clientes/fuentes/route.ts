import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { safeApiError } from "@/lib/errorMessage";
import { requireAdmin, esNifPendiente } from "@/lib/facturacion/server";

export const dynamic = "force-dynamic";

// Importar clientes desde comunidades, proveedores u otro facturador.

type Fuente = { id: string; nombre: string; nif: string | null; direccion: string | null; cp: string | null; ciudad: string | null; provincia: string | null; email: string | null };
const tipoSchema = z.enum(["comunidad", "proveedor", "facturador"]);

/** Solo los campos con valor: al refrescar no se pisa lo que se completó a mano en la agenda */
const sinVacios = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== ""));

async function buscar(tipo: z.infer<typeof tipoSchema>, q: string, id?: string): Promise<Fuente[]> {
    const like = `%${q.replace(/[%_,()]/g, " ").trim()}%`;
    if (tipo === "comunidad") {
        let s = supabaseAdmin.from("comunidades").select("id, codigo, nombre_cdad, cif, direccion, cp, ciudad, provincia").eq("activo", true).limit(30);
        s = id ? s.eq("id", id) : q ? s.or(`nombre_cdad.ilike.${like},codigo.ilike.${like},cif.ilike.${like}`) : s;
        const { data, error } = await s.order("nombre_cdad");
        if (error) throw error;
        return (data ?? []).map((c) => ({ id: String(c.id), nombre: c.nombre_cdad, nif: c.cif, direccion: c.direccion, cp: c.cp, ciudad: c.ciudad, provincia: c.provincia, email: null }));
    }
    if (tipo === "proveedor") {
        let s = supabaseAdmin.from("proveedores").select("id, nombre, cif, direccion, cp, ciudad, provincia, email").eq("activo", true).limit(30);
        s = id ? s.eq("id", id) : q ? s.or(`nombre.ilike.${like},cif.ilike.${like}`) : s;
        const { data, error } = await s.order("nombre");
        if (error) throw error;
        return (data ?? []).map((p) => ({ id: String(p.id), nombre: p.nombre, nif: p.cif, direccion: p.direccion, cp: p.cp, ciudad: p.ciudad, provincia: p.provincia, email: p.email }));
    }
    let s = supabaseAdmin.from("facturacion_emisores").select("id, razon_social, nif, direccion, cp, ciudad, provincia, email");
    s = id ? s.eq("id", id) : q ? s.ilike("razon_social", like) : s;
    const { data, error } = await s.order("orden");
    if (error) throw error;
    return (data ?? []).map((e) => ({ id: e.id, nombre: e.razon_social, nif: esNifPendiente(e.nif) ? null : e.nif, direccion: e.direccion, cp: e.cp, ciudad: e.ciudad, provincia: e.provincia, email: e.email }));
}

// GET ?tipo=comunidad|proveedor|facturador&q=texto
export async function GET(req: Request) {
    try {
        const auth = await requireAdmin();
        if ("res" in auth) return auth.res;
        const url = new URL(req.url);
        const tipo = tipoSchema.safeParse(url.searchParams.get("tipo"));
        if (!tipo.success) return NextResponse.json({ error: "Tipo no válido" }, { status: 400 });
        return NextResponse.json({ ok: true, resultados: await buscar(tipo.data, url.searchParams.get("q") ?? "") });
    } catch (err: unknown) {
        return NextResponse.json({ error: safeApiError(err, "facturacion/fuentes") }, { status: 500 });
    }
}

// POST { tipo, id } — copia a la agenda (o devuelve el que ya estaba importado)
export async function POST(req: Request) {
    try {
        const auth = await requireAdmin();
        if ("res" in auth) return auth.res;
        const body = z.object({ tipo: tipoSchema, id: z.string().min(1) }).safeParse(await req.json());
        if (!body.success) return NextResponse.json({ error: "Datos no válidos" }, { status: 400 });

        const [f] = await buscar(body.data.tipo, "", body.data.id);
        if (!f) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
        const { id: origenId, ...datos } = f;
        const fila = { ...datos, nif: datos.nif?.trim().toUpperCase() || null, activo: true };

        // Si ya se importó antes, se refresca con los datos actuales del origen (p. ej. un CIF corregido)
        const { data: ya } = await supabaseAdmin.from("clientes_facturacion").select("id")
            .eq("origen", body.data.tipo).eq("origen_id", origenId).maybeSingle();
        const { data, error } = ya
            ? await supabaseAdmin.from("clientes_facturacion")
                .update({ ...sinVacios(fila), activo: true, updated_at: new Date().toISOString() }).eq("id", ya.id).select("*").single()
            : await supabaseAdmin.from("clientes_facturacion")
                .insert({ ...fila, origen: body.data.tipo, origen_id: origenId }).select("*").single();
        if (error) throw error;
        return NextResponse.json({ ok: true, cliente: data });
    } catch (err: unknown) {
        return NextResponse.json({ error: safeApiError(err, "facturacion/fuentes/post") }, { status: 500 });
    }
}
