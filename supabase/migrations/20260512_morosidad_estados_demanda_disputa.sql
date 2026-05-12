-- Ampliar estados de morosidad: añadir 'Demanda' y columna subtipo_disputa
-- Estados resultantes: Pendiente | Pagado | En disputa | Demanda
-- subtipo_disputa solo aplica cuando estado = 'En disputa'

ALTER TABLE public.morosidad
  DROP CONSTRAINT IF EXISTS morosidad_estado_check;

ALTER TABLE public.morosidad
  ADD CONSTRAINT morosidad_estado_check
  CHECK (estado IN ('Pendiente', 'Pagado', 'En disputa', 'Demanda'));

ALTER TABLE public.morosidad
  ADD COLUMN IF NOT EXISTS subtipo_disputa text
  CHECK (subtipo_disputa IS NULL OR subtipo_disputa IN ('No localizable'));

COMMENT ON COLUMN public.morosidad.subtipo_disputa IS 'Subtipo cuando estado = En disputa. Por ahora: No localizable.';
