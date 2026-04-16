-- Renombrar columna pto_extra a informe_incidencias en la tabla reuniones
ALTER TABLE public.reuniones
  RENAME COLUMN pto_extra TO informe_incidencias;
