-- Ampliar subtipo_disputa de morosidad: añadir 'No conforme'
ALTER TABLE public.morosidad
  DROP CONSTRAINT IF EXISTS morosidad_subtipo_disputa_check;

ALTER TABLE public.morosidad
  ADD CONSTRAINT morosidad_subtipo_disputa_check
  CHECK (subtipo_disputa IS NULL OR subtipo_disputa IN ('No localizable', 'No conforme'));
