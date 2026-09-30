import { supabase } from '@/lib/supabaseClient';

// ============================================
// TIPOS
// ============================================

export interface Persona {
    user_id: string;
    nombre: string;
    rol: string;
}

export interface Categoria {
    id: number;
    nombre: string;
    orden: number;
    activo: boolean;
}

/** Un cambio de estado de una tarea: quién la marcó como realizada o la reabrió, y cuándo. */
export interface EventoTarea {
    accion: 'realizada' | 'reabierta';
    fecha: string;
    nombre: string | null;
}

/** Tarea de plantilla o de checklist. Las de checklist traen estado y responsables. */
export interface ChecklistTarea {
    id: number;
    parent_id: number | null;
    /** Solo en tareas principales; las subtareas van con su madre */
    categoria_id: number | null;
    titulo: string;
    descripcion: string;
    orden: number;
    hecho?: boolean;
    completado_at?: string | null;
    completado_por_nombre?: string | null;
    fecha_limite?: string | null;
    responsables?: string[];
    /** Último cambio de estado (solo checklists) */
    ultimo_evento?: EventoTarea | null;
}

/** Tarea madre con sus subtareas ya colgadas, en orden. */
export interface TareaConSubtareas extends ChecklistTarea {
    subtareas: ChecklistTarea[];
}

export type ModoLista = 'plantilla' | 'checklist';

export const TABLA_ITEMS: Record<ModoLista, string> = {
    plantilla: 'checklist_plantilla_items',
    checklist: 'checklist_items',
};

export const COLUMNA_PADRE: Record<ModoLista, string> = {
    plantilla: 'plantilla_id',
    checklist: 'checklist_id',
};

// ============================================
// ÁRBOL Y PROGRESO
// ============================================

export function agruparTareas(tareas: ChecklistTarea[]): TareaConSubtareas[] {
    const porOrden = (a: ChecklistTarea, b: ChecklistTarea) => a.orden - b.orden || a.id - b.id;
    const madres = tareas.filter(t => t.parent_id === null).sort(porOrden);
    return madres.map(m => ({
        ...m,
        subtareas: tareas.filter(t => t.parent_id === m.id).sort(porOrden),
    }));
}

export interface GrupoCategoria {
    /** null = "Otros" (tareas sin categoría) */
    categoria: Categoria | null;
    tareas: TareaConSubtareas[];
}

/** Agrupa las tareas por categoría en el orden del catálogo; "Otros" al final. */
export function agruparPorCategoria(arbol: TareaConSubtareas[], categorias: Categoria[]): GrupoCategoria[] {
    const grupos: GrupoCategoria[] = [...categorias]
        .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre))
        .map(categoria => ({ categoria, tareas: arbol.filter(t => t.categoria_id === categoria.id) }))
        .filter(g => g.tareas.length > 0);

    const conocidas = new Set(categorias.map(c => c.id));
    const otros = arbol.filter(t => t.categoria_id === null || !conocidas.has(t.categoria_id));
    if (otros.length) grupos.push({ categoria: null, tareas: otros });
    return grupos;
}

/** Progreso sobre las tareas principales (las subtareas se cuentan dentro de cada una). */
export function progreso(tareas: { parent_id: number | null; hecho?: boolean }[]) {
    const principales = tareas.filter(t => t.parent_id === null);
    const hechas = principales.filter(t => t.hecho).length;
    const total = principales.length;
    return { hechas, total, pct: total ? Math.round((hechas / total) * 100) : 0 };
}

/** Estado de una fecha límite para pintarla: vencida, hoy/mañana, próxima o normal. */
export function estadoFecha(fecha: string | null | undefined, hecho?: boolean) {
    if (!fecha) return null;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const [y, m, d] = fecha.split('-').map(Number);
    const dias = Math.round((new Date(y, m - 1, d).getTime() - hoy.getTime()) / 86400000);
    const texto = new Date(y, m - 1, d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });

    if (hecho) return { texto, clase: 'bg-neutral-100 text-neutral-500' };
    if (dias < 0) return { texto: dias === -1 ? 'Ayer' : `Hace ${-dias} días`, clase: 'bg-red-100 text-red-700' };
    if (dias === 0) return { texto: 'Hoy', clase: 'bg-orange-100 text-orange-700' };
    if (dias === 1) return { texto: 'Mañana', clase: 'bg-orange-100 text-orange-700' };
    if (dias <= 7) return { texto: `En ${dias} días`, clase: 'bg-yellow-100 text-yellow-800' };
    return { texto, clase: 'bg-neutral-100 text-neutral-600' };
}

export function iniciales(nombre: string) {
    return nombre.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

// ============================================
// LECTURAS
// ============================================

export async function listarCategorias(): Promise<Categoria[]> {
    const { data } = await supabase
        .from('checklist_categorias')
        .select('id, nombre, orden, activo')
        .order('orden')
        .order('nombre');
    return (data as Categoria[]) || [];
}

/** Crea una categoría al final del catálogo. Si ya existe con ese nombre, devuelve la existente. */
export async function crearCategoria(nombre: string, categorias: Categoria[]): Promise<Categoria> {
    const limpio = nombre.trim();
    const existente = categorias.find(c => c.nombre.trim().toLowerCase() === limpio.toLowerCase());
    if (existente) return existente;

    const orden = Math.max(0, ...categorias.map(c => c.orden)) + 1;
    const { data, error } = await supabase
        .from('checklist_categorias')
        .insert({ nombre: limpio, orden })
        .select('id, nombre, orden, activo')
        .single();
    if (error) throw error;
    return data as Categoria;
}

export async function listarPersonas(): Promise<Persona[]> {
    const { data } = await supabase
        .from('profiles')
        .select('user_id, nombre, rol')
        .eq('activo', true)
        .order('nombre');
    return (data as Persona[]) || [];
}

interface FilaItemChecklist {
    id: number;
    parent_id: number | null;
    categoria_id: number | null;
    titulo: string;
    descripcion: string;
    orden: number;
    hecho: boolean;
    completado_at: string | null;
    fecha_limite: string | null;
    completado: { nombre: string } | null;
    checklist_item_responsables: { user_id: string }[];
}

export async function cargarTareas(modo: ModoLista, padreId: number): Promise<ChecklistTarea[]> {
    if (modo === 'plantilla') {
        const { data, error } = await supabase
            .from(TABLA_ITEMS.plantilla)
            .select('id, parent_id, categoria_id, titulo, descripcion, orden')
            .eq('plantilla_id', padreId);
        if (error) throw error;
        return (data as ChecklistTarea[]) || [];
    }

    const { data, error } = await supabase
        .from('checklist_items')
        .select('id, parent_id, categoria_id, titulo, descripcion, orden, hecho, completado_at, fecha_limite, completado:profiles!checklist_items_completado_por_fkey(nombre), checklist_item_responsables(user_id)')
        .eq('checklist_id', padreId);
    if (error) throw error;

    const filas = (data as unknown as FilaItemChecklist[]) || [];
    const ultimos = await ultimosEventos(filas.map(f => f.id));

    return filas.map(f => ({
        id: f.id,
        parent_id: f.parent_id,
        categoria_id: f.categoria_id,
        titulo: f.titulo,
        descripcion: f.descripcion,
        orden: f.orden,
        hecho: f.hecho,
        completado_at: f.completado_at,
        completado_por_nombre: f.completado?.nombre ?? null,
        fecha_limite: f.fecha_limite,
        responsables: f.checklist_item_responsables.map(r => r.user_id),
        ultimo_evento: ultimos.get(f.id) ?? null,
    }));
}

interface FilaEvento {
    item_id: number;
    accion: 'realizada' | 'reabierta';
    created_at: string;
    persona: { nombre: string } | null;
}

const SELECT_EVENTOS = 'item_id, accion, created_at, persona:profiles!checklist_item_eventos_user_id_fkey(nombre)';

const aEvento = (f: FilaEvento): EventoTarea => ({ accion: f.accion, fecha: f.created_at, nombre: f.persona?.nombre ?? null });

/** Último cambio de estado de cada tarea. Si el historial aún no existe en la BD, devuelve vacío. */
async function ultimosEventos(ids: number[]): Promise<Map<number, EventoTarea>> {
    const ultimos = new Map<number, EventoTarea>();
    if (!ids.length) return ultimos;
    const { data, error } = await supabase
        .from('checklist_item_eventos')
        .select(SELECT_EVENTOS)
        .in('item_id', ids)
        .order('created_at', { ascending: false });
    if (error) return ultimos;
    for (const f of (data as unknown as FilaEvento[]) || []) {
        if (!ultimos.has(f.item_id)) ultimos.set(f.item_id, aEvento(f));
    }
    return ultimos;
}

/** Historial completo de una tarea, del más reciente al más antiguo. */
export async function historialTarea(itemId: number): Promise<EventoTarea[]> {
    const { data, error } = await supabase
        .from('checklist_item_eventos')
        .select(SELECT_EVENTOS)
        .eq('item_id', itemId)
        .order('created_at', { ascending: false });
    if (error) return [];
    return ((data as unknown as FilaEvento[]) || []).map(aEvento);
}

export function formatoFechaHora(iso: string) {
    return new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ============================================
// ESCRITURAS DE TAREAS (comunes a plantilla y checklist)
// ============================================

export interface DatosTarea {
    titulo: string;
    descripcion: string;
    /** Se ignora en subtareas */
    categoria_id?: number | null;
    fecha_limite?: string | null;
    responsables?: string[];
}

export async function crearTarea(
    modo: ModoLista,
    padreId: number,
    parentId: number | null,
    orden: number,
    datos: DatosTarea,
) {
    const fila: Record<string, unknown> = {
        [COLUMNA_PADRE[modo]]: padreId,
        parent_id: parentId,
        categoria_id: parentId ? null : datos.categoria_id ?? null,
        titulo: datos.titulo.trim(),
        descripcion: datos.descripcion.trim(),
        orden,
    };
    if (modo === 'checklist') fila.fecha_limite = datos.fecha_limite || null;

    const { data, error } = await supabase.from(TABLA_ITEMS[modo]).insert(fila).select('id').single();
    if (error) throw error;

    if (modo === 'checklist' && datos.responsables?.length) {
        await fijarResponsables(data.id, [], datos.responsables);
    }
    return data.id as number;
}

export async function actualizarTarea(modo: ModoLista, tarea: ChecklistTarea, datos: DatosTarea) {
    const cambios: Record<string, unknown> = {
        titulo: datos.titulo.trim(),
        descripcion: datos.descripcion.trim(),
    };
    if (tarea.parent_id === null && datos.categoria_id !== undefined) cambios.categoria_id = datos.categoria_id;
    if (modo === 'checklist') cambios.fecha_limite = datos.fecha_limite || null;

    const { error } = await supabase.from(TABLA_ITEMS[modo]).update(cambios).eq('id', tarea.id);
    if (error) throw error;

    if (modo === 'checklist' && datos.responsables) {
        await fijarResponsables(tarea.id, tarea.responsables || [], datos.responsables);
    }
}

/** Mueve una tarea principal a otra categoría (null = "Otros"), al final de ese grupo. */
export async function moverACategoria(modo: ModoLista, id: number, categoriaId: number | null, orden: number) {
    const { error } = await supabase.from(TABLA_ITEMS[modo]).update({ categoria_id: categoriaId, orden }).eq('id', id);
    if (error) throw error;
}

export async function borrarTarea(modo: ModoLista, id: number) {
    // Las subtareas caen solas por la FK en cascada
    const { error } = await supabase.from(TABLA_ITEMS[modo]).delete().eq('id', id);
    if (error) throw error;
}

export async function marcarTarea(id: number, hecho: boolean) {
    const { error } = await supabase.from('checklist_items').update({ hecho }).eq('id', id);
    if (error) throw error;
}

/** Guarda un nuevo orden (1, 2, 3...) para una lista de tareas hermanas; solo toca las que cambian. */
export async function reordenar(modo: ModoLista, enOrden: ChecklistTarea[]) {
    const resultados = await Promise.all(enOrden
        .map((t, i) => ({ t, orden: i + 1 }))
        .filter(({ t, orden }) => t.orden !== orden)
        .map(({ t, orden }) => supabase.from(TABLA_ITEMS[modo]).update({ orden }).eq('id', t.id)));
    const fallo = resultados.find(r => r.error);
    if (fallo) throw fallo.error;
}

export async function fijarResponsables(itemId: number, actuales: string[], deseados: string[]) {
    const quitar = actuales.filter(u => !deseados.includes(u));
    const poner = deseados.filter(u => !actuales.includes(u));

    if (quitar.length) {
        const { error } = await supabase
            .from('checklist_item_responsables')
            .delete()
            .eq('item_id', itemId)
            .in('user_id', quitar);
        if (error) throw error;
    }
    if (poner.length) {
        const { error } = await supabase
            .from('checklist_item_responsables')
            .insert(poner.map(user_id => ({ item_id: itemId, user_id })));
        if (error) throw error;
    }
}

// ============================================
// BORRADO COMPLETO (solo admin, con credenciales si hace falta)
// ============================================

export async function borrarEntidad(
    type: 'checklist' | 'checklist_plantilla',
    id: number,
    credenciales: { email: string; password: string },
) {
    const res = await fetch('/api/admin/universal-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, type, ...credenciales }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'No se pudo eliminar');
}
