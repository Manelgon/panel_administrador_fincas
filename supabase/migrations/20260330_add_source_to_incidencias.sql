-- Add source column to incidencias table
-- Tracks how the ticket was received (entrada)
ALTER TABLE public.incidencias
ADD COLUMN IF NOT EXISTS source text
CHECK (source IN ('visita comunidad','whatsapp','llamada','email','tratar proxima junta'));
