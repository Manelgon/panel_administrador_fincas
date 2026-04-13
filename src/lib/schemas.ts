import { z } from 'zod';

// ============================================
// SHARED VALIDATORS
// ============================================

/** Spanish phone: exactly 9 digits */
const phoneSchema = z
  .string()
  .regex(/^\d{9}$/, 'El teléfono debe tener exactamente 9 dígitos')
  .or(z.literal(''));

const emailSchema = z
  .string()
  .email('El formato del email no es válido')
  .or(z.literal(''));

// ============================================
// COMUNIDAD
// ============================================

export const comunidadFormSchema = z.object({
  codigo: z.string().optional().default(''),
  nombre_cdad: z.string().min(1, 'El nombre es obligatorio'),
  direccion: z.string().optional().default(''),
  cp: z.string().optional().default(''),
  ciudad: z.string().optional().default(''),
  provincia: z.string().optional().default(''),
  cif: z.string().optional().default(''),
  tipo: z.enum(['comunidad de propietarios', 'trasteros y aparcamientos']),
});

export type ComunidadFormData = z.infer<typeof comunidadFormSchema>;

export interface Comunidad {
  id: number;
  codigo: string;
  nombre_cdad: string;
  direccion: string;
  cp: string;
  ciudad: string;
  provincia: string;
  cif: string;
  tipo: 'comunidad de propietarios' | 'trasteros y aparcamientos';
  activo: boolean;
  created_at?: string;
}

// ============================================
// INCIDENCIA
// ============================================

export const incidenciaFormSchema = z.object({
  comunidad_id: z.string().min(1, 'Selecciona una comunidad'),
  nombre_cliente: z.string().optional().default(''),
  telefono: phoneSchema.optional().default(''),
  email: emailSchema.optional().default(''),
  motivo_ticket: z.string().optional().default(''),
  mensaje: z.string().min(1, 'El mensaje es obligatorio'),
  recibido_por: z.string().optional().default(''),
  gestor_asignado: z.string().optional().default(''),
  proveedor: z.string().optional().default(''),
  source: z.string().optional().default(''),
});

export type IncidenciaFormData = z.infer<typeof incidenciaFormSchema>;

export interface Incidencia {
  id: number;
  comunidad_id: number;
  nombre_cliente: string;
  telefono: string;
  email: string;
  motivo_ticket?: string;
  mensaje: string;
  urgencia?: 'Baja' | 'Media' | 'Alta';
  resuelto: boolean;
  estado?: 'Pendiente' | 'Resuelto' | 'Aplazado' | 'Cancelado';
  fecha_recordatorio?: string;
  created_at: string;
  comunidades?: { nombre_cdad: string; codigo?: string };
  quien_lo_recibe?: string;
  comunidad?: string;
  codigo?: string;
  gestor_asignado?: string;
  gestor?: { nombre: string };
  receptor?: { nombre: string };
  sentimiento?: string;
  categoria?: string;
  nota_gestor?: string;
  nota_propietario?: string;
  todas_notas_propietario?: string;
  dia_resuelto?: string;
  resuelto_por?: string;
  resolver?: { nombre: string };
  adjuntos?: string[];
  aviso?: string | boolean;
  id_email_gestion?: string;
  source?: string;
}

// ============================================
// MOROSIDAD (DEUDA)
// ============================================

export const deudaFormSchema = z.object({
  comunidad_id: z.string().min(1, 'Selecciona una comunidad'),
  nombre_deudor: z.string().min(1, 'El nombre del deudor es obligatorio'),
  apellidos: z.string().optional().default(''),
  telefono_deudor: phoneSchema.optional().default(''),
  email_deudor: emailSchema.optional().default(''),
  titulo_documento: z.string().min(1, 'Selecciona un concepto'),
  fecha_notificacion: z.string().min(1, 'Indica la fecha de notificación'),
  importe: z
    .string()
    .min(1, 'Indica el importe')
    .refine(
      (val) => !isNaN(parseFloat(val.replace(',', '.'))),
      'El importe debe ser un número válido'
    ),
  observaciones: z.string().optional().default(''),
  gestor: z.string().optional().default(''),
  documento: z.string().optional().default(''),
  aviso: z.string().nullable().optional().default(null),
  id_email_deuda: z.string().optional().default(''),
});

export type DeudaFormData = z.infer<typeof deudaFormSchema>;

export interface Morosidad {
  id: number;
  comunidad_id: number;
  nombre_deudor: string;
  apellidos: string;
  telefono_deudor: string;
  email_deudor: string;
  titulo_documento: string;
  fecha_notificacion: string;
  importe: number;
  observaciones: string;
  ref?: string;
  estado: 'Pendiente' | 'Pagado' | 'En disputa';
  fecha_pago: string;
  gestor: string;
  aviso?: string | null;
  id_email_deuda?: string;
  documento: string;
  created_at: string;
  comunidades?: { nombre_cdad: string; codigo?: string };
  resuelto_por?: string;
  fecha_resuelto?: string;
  resolver?: { nombre: string };
}

// ============================================
// REUNIONES
// ============================================

export const reunionFormSchema = z.object({
  comunidad_id: z.coerce.number().positive('Selecciona una comunidad'),
  fecha_reunion: z.string().min(1, 'La fecha es obligatoria'),
  tipo: z.enum(['JGO', 'JGE', 'JV']),
  estado_cuentas: z.boolean().default(false),
  pto_ordinario: z.boolean().default(false),
  pto_extra: z.boolean().default(false),
  morosos: z.boolean().default(false),
  citacion_email: z.boolean().default(false),
  citacion_carta: z.boolean().default(false),
  redactar_acta: z.boolean().default(false),
  vb_pendiente: z.boolean().default(false),
  acta_email: z.boolean().default(false),
  acta_carta: z.boolean().default(false),
  pasar_acuerdos: z.boolean().default(false),
  notas: z.string().optional(),
});

export type ReunionFormData = z.infer<typeof reunionFormSchema>;

export interface Reunion {
  id: number;
  comunidad_id: number;
  comunidad?: string;
  codigo?: string;
  fecha_reunion: string;
  tipo: 'JGO' | 'JGE' | 'JV';
  estado_cuentas: boolean;
  pto_ordinario: boolean;
  pto_extra: boolean;
  morosos: boolean;
  citacion_email: boolean;
  citacion_carta: boolean;
  redactar_acta: boolean;
  vb_pendiente: boolean;
  acta_email: boolean;
  acta_carta: boolean;
  pasar_acuerdos: boolean;
  notas?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// SHARED / AUXILIARY TYPES
// ============================================

export interface Profile {
  user_id: string;
  nombre: string;
  rol: 'admin' | 'empleado' | 'gestor';
  apellido?: string;
  telefono?: string;
  email?: string;
  activo?: boolean;
  avatar_url?: string;
}

export interface ComunidadOption {
  id: number;
  nombre_cdad: string;
  codigo: string;
  direccion?: string;
}

export interface DeleteCredentials {
  email: string;
  password: string;
}

// ============================================
// HELPER: validate & extract errors
// ============================================

/**
 * Validates form data using a Zod schema.
 * Returns `{ success: true, data }` or `{ success: false, error: string }`.
 */
export function validateForm<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  // Return first error only (user-friendly)
  const firstError = result.error.issues[0];
  return { success: false, error: firstError?.message || 'Datos no válidos' };
}
