-- Checklists sin comunidad: la comunidad pasa a ser opcional.
-- Sirve para checklists internos (oficina, formación...) que no pertenecen a ninguna comunidad.
-- crear_checklist ya acepta p_comunidad_id NULL y los avisos ya muestran "sin comunidad".
-- No borra ni modifica datos: los checklists existentes siguen con su comunidad.

ALTER TABLE public.checklists ALTER COLUMN comunidad_id DROP NOT NULL;
