-- Migration: Add 'estado' and 'fecha_recordatorio' to 'incidencias' table

-- Add 'estado' column
ALTER TABLE public.incidencias 
ADD COLUMN estado text DEFAULT 'Pendiente' 
CHECK (estado IN ('Pendiente', 'Resuelto', 'Aplazado', 'Cancelado'));

-- Add 'fecha_recordatorio' column
ALTER TABLE public.incidencias 
ADD COLUMN fecha_recordatorio timestamptz;

-- Update existing data based on 'resuelto' column
UPDATE public.incidencias 
SET estado = 'Resuelto' 
WHERE resuelto = true;

UPDATE public.incidencias 
SET estado = 'Pendiente' 
WHERE resuelto = false OR resuelto IS NULL;
