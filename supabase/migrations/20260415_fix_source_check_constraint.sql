-- Actualizar el CHECK constraint de source en incidencias
-- El constraint anterior usaba valores en minúscula y desactualizados
-- Ahora se ajusta a los valores reales usados en el frontend

ALTER TABLE public.incidencias
  DROP CONSTRAINT IF EXISTS incidencias_source_check;

ALTER TABLE public.incidencias
  ADD CONSTRAINT incidencias_source_check
  CHECK (source IN (
    'Llamada',
    'Presencial',
    'Email',
    'Whatsapp',
    'App 360',
    'Acuerdo Junta',
    'Gestión Interna'
  ));
