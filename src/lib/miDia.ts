import { supabase } from '@/lib/supabaseClient';
import { logActivity } from '@/lib/logActivity';

/** Datos de la página "Mi día": lo pendiente del usuario conectado y algunos bloques generales. */

export type ComunidadRef = { codigo: string | null; nombre_cdad: string } | null;

export interface MiTarea {
    id: number;
    titulo: string;
    cliente: string | null;
    comunidad: ComunidadRef;
    urgencia: string | null;
    estado: string | null;
    fecha_recordatorio: string | null;
}

export interface MiPuntoChecklist {
    id: number;
    titulo: string;
    fecha_limite: string | null;
    checklist_id: number;
    checklist: string;
    comunidad: ComunidadRef;
}

export interface MiAviso {
    id: number;
    title: string;
    body: string | null;
    entity_type: string | null;
    entity_id: number | null;
    created_at: string;
}

export interface DeudaAbierta {
    id: number;
    deudor: string;
    estado: string;
    fecha_notificacion: string | null;
    comunidad: ComunidadRef;
}

export interface TrabajoReciente {
    id: number;
    comunidad_id: number | null;
    comunidad: ComunidadRef;
    tipo_tarea: string | null;
    nota: string | null;
    incidencia_id: number | null;
    morosidad_id: number | null;
    duration_seconds: number | null;
    start_at: string;
}

export interface ReunionProxima {
    id: number;
    tipo: string | null;
    fecha_reunion: string;
    comunidad: ComunidadRef;
}

export interface MisVacaciones {
    proximas: { id: number; date_from: string; date_to: string; status: string; type: string }[];
    diasDisponibles: number | null;
    pendientesDeAprobar: number | null; // solo admins
}

export interface Lista<T> { items: T[]; total: number }

const HOY = () => new Date().toISOString().slice(0, 10);

/** Supabase devuelve las relaciones a veces como objeto y a veces como array */
function uno<T>(v: T | T[] | null | undefined): T | null {
    if (Array.isArray(v)) return v[0] ?? null;
    return v ?? null;
}

async function uid(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id ?? null;
}

// ---------- Mis tareas ----------

const PESO_URGENCIA: Record<string, number> = { Alta: 0, Media: 1, Baja: 2 };

/** Vencidas primero (recordatorio hoy o pasado), luego pendientes por urgencia, luego aplazadas a futuro */
function prioridadTarea(t: MiTarea, hoy: string): number {
    if (t.fecha_recordatorio && t.fecha_recordatorio.slice(0, 10) <= hoy) return 0;
    if (t.estado === 'Aplazado') return 10;
    return 1 + (PESO_URGENCIA[t.urgencia ?? ''] ?? 3);
}

export async function cargarMisTareas(limite = 8): Promise<Lista<MiTarea>> {
    const id = await uid();
    if (!id) return { items: [], total: 0 };
    const { data, error, count } = await supabase
        .from('incidencias')
        .select('id, motivo_ticket, mensaje, nombre_cliente, urgencia, estado, fecha_recordatorio, created_at, comunidades(codigo, nombre_cdad)', { count: 'exact' })
        .eq('gestor_asignado', id)
        .eq('resuelto', false)
        .or('estado.is.null,estado.in.(Pendiente,Aplazado)')
        .order('created_at', { ascending: true })
        .limit(200);
    if (error) throw error;

    const hoy = HOY();
    const items: MiTarea[] = (data ?? []).map(r => ({
        id: r.id,
        titulo: (r.motivo_ticket || r.mensaje || 'Tarea sin descripción').trim(),
        cliente: r.nombre_cliente,
        comunidad: uno(r.comunidades as ComunidadRef | ComunidadRef[]),
        urgencia: r.urgencia,
        estado: r.estado,
        fecha_recordatorio: r.fecha_recordatorio,
    }));
    items.sort((a, b) => prioridadTarea(a, hoy) - prioridadTarea(b, hoy));
    return { items: items.slice(0, limite), total: count ?? items.length };
}

export async function resolverTarea(t: MiTarea) {
    const id = await uid();
    const { error } = await supabase
        .from('incidencias')
        .update({ resuelto: true, estado: 'Resuelto', dia_resuelto: new Date().toISOString(), resuelto_por: id, fecha_recordatorio: null })
        .eq('id', t.id);
    if (error) throw error;
    await logActivity({
        action: 'update', entityType: 'incidencia', entityId: t.id,
        entityName: `Incidencia - ${t.cliente ?? ''}`,
        details: { id: t.id, comunidad: t.comunidad?.nombre_cdad, resuelto: true, estado: 'Resuelto', origen: 'Mi día' },
    });
}

export async function aplazarTarea(t: MiTarea, fecha: string) {
    const id = await uid();
    const { error } = await supabase
        .from('incidencias')
        .update({ estado: 'Aplazado', resuelto: false, fecha_recordatorio: fecha })
        .eq('id', t.id);
    if (error) throw error;
    const fechaEs = new Date(fecha + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    if (id) {
        await supabase.from('record_messages').insert([{
            entity_type: 'incidencia', entity_id: t.id, user_id: id,
            content: `⏱️ TICKET APLAZADO HASTA: ${fechaEs}`,
        }]);
    }
    await logActivity({
        action: 'update', entityType: 'incidencia', entityId: t.id,
        entityName: `Incidencia - ${t.cliente ?? ''}`,
        details: { acción: 'Ticket aplazado', fecha_recordatorio: fechaEs, comunidad: t.comunidad?.nombre_cdad || 'N/A', origen: 'Mi día' },
    });
}

// ---------- Mi checklist ----------

/** Mismo evento que escucha el contador de checklists del menú, para que se actualice al tachar aquí */
export const EVENTO_CHECKLISTS = 'checklistsChanged';

export async function marcarPuntoHecho(id: number) {
    const { error } = await supabase.from('checklist_items').update({ hecho: true }).eq('id', id);
    if (error) throw error;
}

type FilaResponsable = {
    checklist_items: {
        id: number; titulo: string; fecha_limite: string | null; hecho: boolean; checklist_id: number;
        checklists: { nombre: string; activo: boolean; comunidades: ComunidadRef | ComunidadRef[] } | { nombre: string; activo: boolean; comunidades: ComunidadRef | ComunidadRef[] }[];
    } | null;
};

export async function cargarMiChecklist(limite = 8): Promise<Lista<MiPuntoChecklist>> {
    const id = await uid();
    if (!id) return { items: [], total: 0 };
    const { data, error } = await supabase
        .from('checklist_item_responsables')
        .select('checklist_items!inner(id, titulo, fecha_limite, hecho, checklist_id, checklists!inner(nombre, activo, comunidades(codigo, nombre_cdad)))')
        .eq('user_id', id)
        .eq('checklist_items.hecho', false)
        .eq('checklist_items.checklists.activo', true)
        .limit(300);
    if (error) throw error;

    const items: MiPuntoChecklist[] = ((data ?? []) as unknown as FilaResponsable[])
        .map(r => r.checklist_items)
        .filter((i): i is NonNullable<FilaResponsable['checklist_items']> => !!i)
        .map(i => {
            const cl = uno(i.checklists);
            return {
                id: i.id, titulo: i.titulo, fecha_limite: i.fecha_limite, checklist_id: i.checklist_id,
                checklist: cl?.nombre ?? '', comunidad: uno(cl?.comunidades ?? null),
            };
        });
    // Con fecha primero (la más cercana arriba); sin fecha al final
    items.sort((a, b) => (a.fecha_limite ?? '9999').localeCompare(b.fecha_limite ?? '9999'));
    return { items: items.slice(0, limite), total: items.length };
}

// ---------- Avisos ----------

export async function cargarMisAvisos(limite = 6): Promise<Lista<MiAviso>> {
    const id = await uid();
    if (!id) return { items: [], total: 0 };
    const { data, error, count } = await supabase
        .from('notifications')
        .select('id, title, body, entity_type, entity_id, created_at', { count: 'exact' })
        .eq('user_id', id)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(limite);
    if (error) throw error;
    return { items: data ?? [], total: count ?? 0 };
}

export function enlaceAviso(a: MiAviso): string {
    if (!a.entity_id) return '/dashboard/avisos';
    switch (a.entity_type) {
        case 'incidencia': case 'incidencias': return `/dashboard/incidencias?id=${a.entity_id}`;
        case 'morosidad': return `/dashboard/deudas?id=${a.entity_id}`;
        case 'checklist': return `/dashboard/checklists/${a.entity_id}`;
        default: return '/dashboard/avisos';
    }
}

export async function marcarAvisoLeido(id: number) {
    const res = await fetch('/api/notifications/read', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
    });
    if (!res.ok) throw new Error('No se pudo marcar el aviso como leído');
}

export async function marcarTodosLeidos() {
    const res = await fetch('/api/notifications/read-all', { method: 'POST' });
    if (!res.ok) throw new Error('No se pudieron marcar los avisos como leídos');
}

// ---------- Deudas (general) ----------

export async function cargarDeudasAbiertas(limite = 6): Promise<Lista<DeudaAbierta>> {
    const { data, error, count } = await supabase
        .from('morosidad')
        .select('id, nombre_deudor, apellidos, estado, fecha_notificacion, comunidades(codigo, nombre_cdad)', { count: 'exact' })
        .in('estado', ['Pendiente', 'En disputa'])
        .order('fecha_notificacion', { ascending: true, nullsFirst: false })
        .limit(limite);
    if (error) throw error;
    const items = (data ?? []).map(r => ({
        id: r.id,
        deudor: [r.nombre_deudor, r.apellidos].filter(Boolean).join(' ') || 'Sin nombre',
        estado: r.estado,
        fecha_notificacion: r.fecha_notificacion,
        comunidad: uno(r.comunidades as ComunidadRef | ComunidadRef[]),
    }));
    return { items, total: count ?? items.length };
}

// ---------- Lo último que he trabajado ----------

export async function cargarTrabajoReciente(limite = 5): Promise<TrabajoReciente[]> {
    const id = await uid();
    if (!id) return [];
    const { data, error } = await supabase
        .from('task_timers')
        .select('id, comunidad_id, tipo_tarea, nota, incidencia_id, morosidad_id, duration_seconds, start_at, comunidades(codigo, nombre_cdad)')
        .eq('user_id', id)
        .not('end_at', 'is', null)
        .order('start_at', { ascending: false })
        .limit(40);
    if (error) throw error;

    // Una sola fila por "misma tarea" (comunidad + tipo + ticket/deuda)
    const vistos = new Set<string>();
    const items: TrabajoReciente[] = [];
    for (const r of data ?? []) {
        const clave = [r.comunidad_id, r.tipo_tarea, r.incidencia_id, r.morosidad_id].join('|');
        if (vistos.has(clave)) continue;
        vistos.add(clave);
        items.push({ ...r, comunidad: uno(r.comunidades as ComunidadRef | ComunidadRef[]) });
        if (items.length === limite) break;
    }
    return items;
}

export async function seguirTrabajo(t: TrabajoReciente) {
    const { data, error } = await supabase.rpc('start_task_timer', {
        _comunidad_id: t.comunidad_id,
        _nota: t.nota,
        _tipo_tarea: t.tipo_tarea,
        _incidencia_id: t.incidencia_id,
        _morosidad_id: t.morosidad_id,
    });
    if (error) throw error;
    await logActivity({
        action: 'start_task', entityType: 'task_timer', entityId: data?.id,
        entityName: t.comunidad ? `${t.comunidad.codigo ?? ''} - ${t.comunidad.nombre_cdad}` : 'Todas las comunidades',
        details: { nota: t.nota, tipo_tarea: t.tipo_tarea, origen: 'Mi día' },
    });
    window.dispatchEvent(new Event('taskTimerChanged'));
}

// ---------- Reuniones (general) ----------

export async function cargarReunionesProximas(dias = 7): Promise<ReunionProxima[]> {
    const hasta = new Date();
    hasta.setDate(hasta.getDate() + dias);
    const { data, error } = await supabase
        .from('reuniones')
        .select('id, tipo, fecha_reunion, comunidades(codigo, nombre_cdad)')
        .gte('fecha_reunion', HOY())
        .lte('fecha_reunion', hasta.toISOString().slice(0, 10))
        .order('fecha_reunion', { ascending: true })
        .limit(10);
    if (error) throw error;
    return (data ?? []).map(r => ({ ...r, comunidad: uno(r.comunidades as ComunidadRef | ComunidadRef[]) }));
}

// ---------- Vacaciones ----------

export async function cargarMisVacaciones(esAdmin: boolean): Promise<MisVacaciones> {
    const id = await uid();
    if (!id) return { proximas: [], diasDisponibles: null, pendientesDeAprobar: null };
    const [prox, saldo, pendientes] = await Promise.all([
        supabase.from('vacation_requests')
            .select('id, date_from, date_to, status, type')
            .eq('user_id', id)
            .in('status', ['PENDIENTE', 'APROBADA'])
            .gte('date_to', HOY())
            .order('date_from', { ascending: true })
            .limit(3),
        supabase.from('vacation_balances')
            .select('vacaciones_total, vacaciones_usados')
            .eq('user_id', id)
            .eq('year', new Date().getFullYear())
            .maybeSingle(),
        esAdmin
            ? supabase.from('vacation_requests').select('id', { count: 'exact', head: true }).eq('status', 'PENDIENTE')
            : Promise.resolve({ count: null }),
    ]);
    if (prox.error) throw prox.error;
    const s = saldo.data;
    return {
        proximas: prox.data ?? [],
        diasDisponibles: s ? Number(s.vacaciones_total ?? 0) - Number(s.vacaciones_usados ?? 0) : null,
        pendientesDeAprobar: pendientes.count ?? null,
    };
}

// ---------- Preferencias de bloques ----------

export interface PrefsMiDia { orden: string[]; ocultos: string[] }

const CLAVE_LOCAL = 'mi-dia-prefs';

function leerLocal(): PrefsMiDia | null {
    try {
        const raw = localStorage.getItem(CLAVE_LOCAL);
        return raw ? JSON.parse(raw) as PrefsMiDia : null;
    } catch { return null; }
}

/** Lee de la BD; si la tabla aún no existe, cae a lo guardado en este navegador */
export async function cargarPrefs(): Promise<PrefsMiDia | null> {
    const id = await uid();
    if (!id) return null;
    const { data, error } = await supabase
        .from('user_home_prefs')
        .select('orden, ocultos')
        .eq('user_id', id)
        .maybeSingle();
    if (error) return leerLocal();
    return data ?? leerLocal();
}

export async function guardarPrefs(p: PrefsMiDia) {
    try { localStorage.setItem(CLAVE_LOCAL, JSON.stringify(p)); } catch { /* sin almacenamiento local */ }
    const id = await uid();
    if (!id) return;
    const { error } = await supabase
        .from('user_home_prefs')
        .upsert({ user_id: id, orden: p.orden, ocultos: p.ocultos, updated_at: new Date().toISOString() });
    if (error) console.warn('[mi-dia] preferencias guardadas solo en este navegador:', error.message);
}
