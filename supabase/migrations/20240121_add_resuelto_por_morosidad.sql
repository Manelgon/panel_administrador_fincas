-- Add resuelto_por and fecha_resuelto columns to morosidad
ALTER TABLE public.morosidad 
ADD COLUMN IF NOT EXISTS resuelto_por uuid REFERENCES public.profiles(user_id),
ADD COLUMN IF NOT EXISTS fecha_resuelto timestamptz;

-- Add comments
COMMENT ON COLUMN public.morosidad.resuelto_por IS 'User who marked the debt as paid';
COMMENT ON COLUMN public.morosidad.fecha_resuelto IS 'Date when the debt was marked as paid';
