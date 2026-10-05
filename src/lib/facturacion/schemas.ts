import { z } from "zod";

// Validaciones de la facturación (cliente y servidor).

const texto = (max = 200) => z.string().trim().max(max).optional().nullable().transform((v) => v || null);
const pct = z.coerce.number().min(0).max(100);
const SEP = z.enum(["", "-", "/", ":", "."]);

export const facturadorSchema = z.object({
    razon_social: z.string().trim().min(1, "Falta la razón social").max(200),
    nombre_comercial: texto(),
    nif: z.string().trim().toUpperCase().min(1, "Falta el NIF").max(20),
    tipo_persona: z.enum(["fisica", "juridica"]),
    direccion: texto(),
    cp: texto(10),
    ciudad: texto(100),
    provincia: texto(100),
    email: z.string().trim().email("Email no válido").max(200).optional().nullable().or(z.literal("")).transform((v) => v || null),
    telefono: texto(40),
    iban: texto(40),
    iva_defecto: pct,
    irpf_defecto: pct,
    pie_legal: texto(3000),
    color_principal: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color no válido"),
    activo: z.boolean(),
});
export type FacturadorInput = z.infer<typeof facturadorSchema>;

export const numeracionSchema = z.object({
    prefijo: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{1,10}$/, "Prefijo: solo mayúsculas y números (máx. 10)"),
    sep1: SEP,
    anio_cifras: z.union([z.literal(0), z.literal(2), z.literal(4)]),
    sep2: SEP,
    digitos: z.coerce.number().int().min(1).max(6),
    reinicio_anual: z.boolean(),
    /** Próximo número del año en curso. Vacío = no cambiar. */
    siguiente: z.coerce.number().int().min(1).optional().nullable(),
});
export type NumeracionInput = z.infer<typeof numeracionSchema>;

export const clienteSchema = z.object({
    nombre: z.string().trim().min(1, "Falta el nombre").max(200),
    nif: z.string().trim().toUpperCase().max(20).optional().nullable().transform((v) => v || null),
    direccion: texto(),
    cp: texto(10),
    ciudad: texto(100),
    provincia: texto(100),
    email: z.string().trim().email("Email no válido").max(200).optional().nullable().or(z.literal("")).transform((v) => v || null),
});
export type ClienteInput = z.infer<typeof clienteSchema>;

export const lineaSchema = z.object({
    cantidad: z.coerce.number().positive("Cantidad mayor que 0").max(1_000_000),
    concepto: z.string().trim().min(1, "Falta el concepto").max(500),
    precio_unitario: z.coerce.number().min(-1_000_000).max(10_000_000),
    tipo_iva: pct,
});

export const borradorSchema = z.object({
    emisor_id: z.string().uuid(),
    cliente_id: z.string().uuid().nullable(),
    fecha_emision: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    lineas: z.array(lineaSchema).max(100),
    retencion_pct: pct,
    notas: texto(2000),
});
export type BorradorInput = z.infer<typeof borradorSchema>;

/** Primer mensaje legible de un error de Zod. */
export function primerError(err: z.ZodError): string {
    return err.issues[0]?.message ?? "Datos no válidos";
}
