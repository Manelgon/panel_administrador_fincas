-- Historial de cada tarea de checklist: quién la marcó como realizada y quién
-- la volvió a poner pendiente, y cuándo. Requiere 20260930_create_checklists.sql.
--
-- Lo escribe un trigger al cambiar checklist_items.hecho, con el usuario conectado
-- (auth.uid()). Nadie puede escribir ni borrar el historial a mano desde la app.
-- completado_por / completado_at siguen guardando el estado actual.

CREATE TABLE IF NOT EXISTS public.checklist_item_eventos (
    id BIGSERIAL PRIMARY KEY,
    item_id BIGINT NOT NULL REFERENCES public.checklist_items(id) ON DELETE CASCADE,
    accion TEXT NOT NULL CHECK (accion IN ('realizada', 'reabierta')),
    user_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checklist_item_eventos_item ON public.checklist_item_eventos(item_id, created_at DESC);

-- Solo lectura para el equipo; las filas las crea el trigger
GRANT SELECT ON public.checklist_item_eventos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_item_eventos TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.checklist_item_eventos_id_seq TO service_role;

ALTER TABLE public.checklist_item_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "checklist_item_eventos: select for authenticated" ON public.checklist_item_eventos;
CREATE POLICY "checklist_item_eventos: select for authenticated"
ON public.checklist_item_eventos FOR SELECT TO authenticated USING (true);

-- ============================================
-- TRIGGER: registrar cada cambio de "hecho"
-- ============================================

CREATE OR REPLACE FUNCTION public.checklist_registrar_evento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.hecho IS DISTINCT FROM OLD.hecho THEN
        INSERT INTO checklist_item_eventos (item_id, accion, user_id)
        VALUES (NEW.id, CASE WHEN NEW.hecho THEN 'realizada' ELSE 'reabierta' END, auth.uid());
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_checklist_registrar_evento ON public.checklist_items;
CREATE TRIGGER trg_checklist_registrar_evento
    AFTER UPDATE OF hecho ON public.checklist_items
    FOR EACH ROW EXECUTE FUNCTION public.checklist_registrar_evento();

-- ============================================
-- Tareas que ya estaban hechas: se apunta su "realizada" con los datos que había
-- ============================================

INSERT INTO public.checklist_item_eventos (item_id, accion, user_id, created_at)
SELECT i.id, 'realizada', i.completado_por, coalesce(i.completado_at, now())
FROM public.checklist_items i
WHERE i.hecho
  AND NOT EXISTS (SELECT 1 FROM public.checklist_item_eventos e WHERE e.item_id = i.id);
