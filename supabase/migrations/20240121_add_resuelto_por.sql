-- Add resuelto_por column to incidencias
ALTER TABLE public.incidencias 
ADD COLUMN IF NOT EXISTS resuelto_por uuid REFERENCES public.profiles(user_id);

-- Add comment
COMMENT ON COLUMN public.incidencias.resuelto_por IS 'User who resolved the incident';
