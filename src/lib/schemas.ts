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
  proveedor_id?: number;
  aviso_proveedor?: string | boolean;
  proveedor?: { nombre: string };
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
  tipo: z.enum(['JGO', 'JGE', 'JV', 'JD']),
  confirmada: z.boolean(),
  estado_cuentas: z.boolean().nullable().default(null),
  pto_ordinario: z.boolean().nullable().default(null),
  informe_incidencias: z.boolean().nullable().default(null),
  morosos: z.boolean().nullable().default(null),
  citacion_email: z.boolean().nullable().default(null),
  citacion_carta: z.boolean().nullable().default(null),
  borrador_acta: z.boolean().nullable().default(null),
  redactar_acta: z.boolean().nullable().default(null),
  vb_pendiente: z.boolean().nullable().default(null),
  imprimir_acta: z.boolean().nullable().default(null),
  acta_email: z.boolean().nullable().default(null),
  acta_carta: z.boolean().nullable().default(null),
  pasar_acuerdos: z.boolean().nullable().default(null),
  enviado: z.boolean().default(false),
  notas: z.string().optional(),
});

export type ReunionFormData = z.infer<typeof reunionFormSchema>;

export interface Reunion {
  id: number;
  comunidad_id: number;
  comunidad?: string;
  codigo?: string;
  fecha_reunion: string;
  tipo: 'JGO' | 'JGE' | 'JV' | 'JD';
  confirmada: boolean;
  estado_cuentas: boolean | null;
  pto_ordinario: boolean | null;
  informe_incidencias: boolean | null;
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
  enviado: boolean;
  resuelto: boolean;
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
// ADMIN: USERS
// ============================================

export const createUserApiSchema = z.object({
  email: z.email('Email no válido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  nombre: z.string().min(1, 'El nombre es obligatorio'),
  apellido: z.string().optional().nullable(),
  telefono: z.string().optional().nullable(),
  rol: z.enum(['admin', 'empleado', 'gestor']),
});

export const updateUserApiSchema = z.object({
  userId: z.string().min(1, 'userId es obligatorio'),
  email: z.email('Email no válido').optional(),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').optional().or(z.literal('')),
  nombre: z.string().optional(),
  apellido: z.string().optional().nullable(),
  telefono: z.string().optional().nullable(),
  rol: z.enum(['admin', 'empleado', 'gestor']).optional(),
  activo: z.boolean().optional(),
});

export const deleteUserApiSchema = z.object({
  userId: z.string().min(1, 'userId es obligatorio'),
});

export const deleteIncidentApiSchema = z.object({
  id: z.union([z.string(), z.number()]),
  email: z.email('Email no válido'),
  password: z.string().min(1, 'Contraseña obligatoria'),
});

// ============================================
// API: VACATIONS
// ============================================

export const vacationRequestActionSchema = z.object({
  adminId: z.string().min(1, 'adminId obligatorio'),
  requestId: z.union([z.string(), z.number()]),
  status: z.enum(['PENDIENTE', 'APROBADA', 'RECHAZADA', 'CANCELADA', 'MODIFICADA']),
  commentAdmin: z.string().optional().nullable(),
});

export const vacationBalancePatchSchema = z.object({
  adminId: z.string().min(1, 'adminId obligatorio'),
  userId: z.string().min(1, 'userId obligatorio'),
  year: z.coerce.number().int().min(2020).max(2100),
  balances: z.object({
    vacaciones_total: z.coerce.number().int().min(0).optional(),
    vacaciones_usados: z.coerce.number().int().min(0).optional(),
    retribuidos_total: z.coerce.number().int().min(0).optional(),
    retribuidos_usados: z.coerce.number().int().min(0).optional(),
    no_retribuidos_total: z.coerce.number().int().min(0).optional(),
    no_retribuidos_usados: z.coerce.number().int().min(0).optional(),
  }),
});

export const vacationSettingsActionSchema = z.object({
  adminId: z.string().min(1, 'adminId obligatorio'),
  action: z.enum(['update_policy', 'add_blocked_date', 'delete_blocked_date']),
  data: z.record(z.string(), z.any()),
});

export const universalDeleteApiSchema = z.object({
  id: z.union([z.string(), z.number()]),
  type: z.enum([
    'incidencia',
    'sofia_incidencia',
    'morosidad',
    'comunidad',
    'perfil',
    'document',
    'proveedor',
    'task_timer',
  ]),
  email: z.email('Email no válido').optional(),
  password: z.string().optional(),
});

// ============================================
// API: INCIDENCIA / MOROSIDAD (server-side body)
// ============================================

export const incidenciaApiSchema = z.object({
  comunidad_id: z.coerce.number().int().positive('comunidad_id inválido'),
  nombre_cliente: z.string().optional().nullable(),
  telefono: z.string().optional().nullable(),
  email: z.email('Email no válido').optional().nullable().or(z.literal('')),
  motivo_ticket: z.string().optional().nullable(),
  mensaje: z.string().min(1, 'El mensaje es obligatorio'),
  urgencia: z.enum(['Baja', 'Media', 'Alta']).optional().nullable(),
  source: z.string().optional().nullable(),
  gestor_asignado: z.string().optional().nullable(),
  proveedor_id: z.coerce.number().int().positive().optional().nullable(),
});

export const morosidadApiSchema = z.object({
  comunidad_id: z.coerce.number().int().positive('comunidad_id inválido'),
  nombre_deudor: z.string().min(1, 'El nombre del deudor es obligatorio'),
  apellidos: z.string().optional().nullable(),
  telefono_deudor: z.string().optional().nullable(),
  email_deudor: z.email('Email no válido').optional().nullable().or(z.literal('')),
  titulo_documento: z.string().min(1, 'titulo_documento obligatorio'),
  fecha_notificacion: z.string().optional().nullable(),
  importe: z.coerce.number().nonnegative('Importe no válido'),
  observaciones: z.string().optional().nullable(),
  gestor: z.string().optional().nullable(),
  documento: z.string().optional().nullable(),
});

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
