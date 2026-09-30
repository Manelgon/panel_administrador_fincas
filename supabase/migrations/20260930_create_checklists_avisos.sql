-- Avisos (tabla notifications) de los checklists. Requiere 20260930_create_checklists.sql.
--
-- 1. Al asignar una tarea o subtarea a alguien → aviso a esa persona
--    (no si se la asigna a sí misma).
-- 2. Tareas sin hacer con fecha límite → aviso a sus responsables:
--      · cuando faltan 2 días o menos ("vence pronto")
--      · cuando ya ha vencido ("vencida")
--    Cada aviso sale una sola vez por fecha; si se cambia la fecha, vuelve a avisar.
--    Lo lanza cada mañana el cron /api/cron/checklist-vencimientos.
--
-- Los avisos apuntan al checklist (entity_type 'checklist', entity_id = id del checklist).

-- ============================================
-- Control de avisos ya enviados (guarda la fecha avisada)
-- ============================================

ALTER TABLE public.checklist_items
    ADD COLUMN IF NOT EXISTS aviso_proximo_para DATE,
    ADD COLUMN IF NOT EXISTS aviso_vencida_para DATE;

-- ============================================
-- Texto común: "Tarea · Checklist (Comunidad)"
-- ============================================

CREATE OR REPLACE FUNCTION public.checklist_describir_item(p_item BIGINT)
RETURNS TABLE (checklist_id BIGINT, texto TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        c.id,
        i.titulo
            || CASE WHEN m.titulo IS NOT NULL THEN ' (subtarea de «' || m.titulo || '»)' ELSE '' END
            || ' · ' || c.nombre
            || ' — ' || coalesce(nullif(concat_ws(' - ', co.codigo, co.nombre_cdad), ''), 'sin comunidad')
    FROM checklist_items i
    JOIN checklists c ON c.id = i.checklist_id
    LEFT JOIN checklist_items m ON m.id = i.parent_id
    LEFT JOIN comunidades co ON co.id = c.comunidad_id
    WHERE i.id = p_item;
$$;

REVOKE ALL ON FUNCTION public.checklist_describir_item(BIGINT) FROM public, anon, authenticated;

-- ============================================
-- 1. AVISO AL ASIGNAR
-- ============================================

CREATE OR REPLACE FUNCTION public.checklist_avisar_asignacion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_desc RECORD;
    v_fecha DATE;
BEGIN
    -- Asignarse a uno mismo no genera aviso
    IF NEW.user_id = auth.uid() THEN
        RETURN NEW;
    END IF;

    SELECT * INTO v_desc FROM checklist_describir_item(NEW.item_id);
    SELECT fecha_limite INTO v_fecha FROM checklist_items WHERE id = NEW.item_id;

    INSERT INTO notifications (user_id, type, title, body, entity_type, entity_id)
    VALUES (
        NEW.user_id,
        'checklist_asignada',
        'Se te ha asignado una tarea de checklist',
        v_desc.texto
            || CASE WHEN v_fecha IS NOT NULL THEN '. Fecha límite: ' || to_char(v_fecha, 'DD/MM/YYYY') ELSE '' END,
        'checklist',
        v_desc.checklist_id
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_checklist_avisar_asignacion ON public.checklist_item_responsables;
CREATE TRIGGER trg_checklist_avisar_asignacion
    AFTER INSERT ON public.checklist_item_responsables
    FOR EACH ROW EXECUTE FUNCTION public.checklist_avisar_asignacion();

-- ============================================
-- 2. AVISOS DE VENCIMIENTO (los llama el cron diario)
-- ============================================
-- Devuelve cuántos avisos ha creado. Fechas en hora de Madrid.

CREATE OR REPLACE FUNCTION public.checklist_avisar_vencimientos(p_dias_antes INTEGER DEFAULT 2)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_hoy DATE := (now() AT TIME ZONE 'Europe/Madrid')::date;
    v_creados INTEGER := 0;
    v_n INTEGER;
BEGIN
    -- Vence pronto: entre hoy y dentro de p_dias_antes días
    WITH pendientes AS (
        SELECT i.id, i.fecha_limite
        FROM checklist_items i
        JOIN checklists c ON c.id = i.checklist_id AND c.activo
        WHERE NOT i.hecho
          AND i.fecha_limite BETWEEN v_hoy AND v_hoy + p_dias_antes
          AND i.aviso_proximo_para IS DISTINCT FROM i.fecha_limite
          -- Sin responsables no se marca: si se asigna más tarde, aún avisará
          AND EXISTS (SELECT 1 FROM checklist_item_responsables r WHERE r.item_id = i.id)
    ),
    marcados AS (
        UPDATE checklist_items i SET aviso_proximo_para = p.fecha_limite
        FROM pendientes p WHERE i.id = p.id
        RETURNING i.id, i.fecha_limite
    ),
    avisos AS (
        INSERT INTO notifications (user_id, type, title, body, entity_type, entity_id)
        SELECT r.user_id,
               'checklist_vence',
               CASE m.fecha_limite - v_hoy
                   WHEN 0 THEN 'Una tarea de checklist vence hoy'
                   WHEN 1 THEN 'Una tarea de checklist vence mañana'
                   ELSE 'Una tarea de checklist vence en ' || (m.fecha_limite - v_hoy) || ' días'
               END,
               d.texto || '. Fecha límite: ' || to_char(m.fecha_limite, 'DD/MM/YYYY'),
               'checklist',
               d.checklist_id
        FROM marcados m
        JOIN checklist_item_responsables r ON r.item_id = m.id
        CROSS JOIN LATERAL checklist_describir_item(m.id) d
        RETURNING 1
    )
    SELECT count(*) INTO v_n FROM avisos;
    v_creados := v_creados + v_n;

    -- Vencida: la fecha ya pasó
    WITH pendientes AS (
        SELECT i.id, i.fecha_limite
        FROM checklist_items i
        JOIN checklists c ON c.id = i.checklist_id AND c.activo
        WHERE NOT i.hecho
          AND i.fecha_limite < v_hoy
          AND i.aviso_vencida_para IS DISTINCT FROM i.fecha_limite
          -- Sin responsables no se marca: si se asigna más tarde, aún avisará
          AND EXISTS (SELECT 1 FROM checklist_item_responsables r WHERE r.item_id = i.id)
    ),
    marcados AS (
        UPDATE checklist_items i SET aviso_vencida_para = p.fecha_limite
        FROM pendientes p WHERE i.id = p.id
        RETURNING i.id, i.fecha_limite
    ),
    avisos AS (
        INSERT INTO notifications (user_id, type, title, body, entity_type, entity_id)
        SELECT r.user_id,
               'checklist_vencida',
               'Tarea de checklist vencida',
               d.texto || '. Venció el ' || to_char(m.fecha_limite, 'DD/MM/YYYY'),
               'checklist',
               d.checklist_id
        FROM marcados m
        JOIN checklist_item_responsables r ON r.item_id = m.id
        CROSS JOIN LATERAL checklist_describir_item(m.id) d
        RETURNING 1
    )
    SELECT count(*) INTO v_n FROM avisos;
    v_creados := v_creados + v_n;

    RETURN v_creados;
END;
$$;

-- Solo el servidor (cron con service_role) puede lanzarlo
REVOKE ALL ON FUNCTION public.checklist_avisar_vencimientos(INTEGER) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.checklist_avisar_vencimientos(INTEGER) TO service_role;
