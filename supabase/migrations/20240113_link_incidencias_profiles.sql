-- Link quien_lo_recibe to profiles
ALTER TABLE public.incidencias 
ALTER COLUMN quien_lo_recibe TYPE uuid USING quien_lo_recibe::uuid;

ALTER TABLE public.incidencias
ADD CONSTRAINT fk_incidencias_quien_lo_recibe
FOREIGN KEY (quien_lo_recibe)
REFERENCES public.profiles(user_id);

-- Link gestor_asignado to profiles (if not already linked)
-- Assuming gestor_asignado is also intended to be a UUID link
ALTER TABLE public.incidencias 
ALTER COLUMN gestor_asignado TYPE uuid USING gestor_asignado::uuid;

ALTER TABLE public.incidencias
ADD CONSTRAINT fk_incidencias_gestor_asignado
FOREIGN KEY (gestor_asignado)
REFERENCES public.profiles(user_id);
