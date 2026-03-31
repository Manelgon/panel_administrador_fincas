-- Add adjuntos column to incidencias to store file URLs
ALTER TABLE public.incidencias 
ADD COLUMN IF NOT EXISTS adjuntos text[];
