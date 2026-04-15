-- Añadir columna confirmada para el flujo de estados:
-- pendiente de confirmar (false) → confirmada (true) → resuelta (resuelto=true)
ALTER TABLE public.reuniones
  ADD COLUMN IF NOT EXISTS confirmada BOOLEAN NOT NULL DEFAULT FALSE;

-- Todas las reuniones existentes ya estaban en flujo activo,
-- por lo que pasan directamente a "confirmada"
UPDATE public.reuniones
  SET confirmada = TRUE;
