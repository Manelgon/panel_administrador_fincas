-- =========================================
-- ACTIVITY LOGS TABLE - Migration Script
-- =========================================
-- Este script crea la tabla de logs de actividad
-- y sus políticas de seguridad RLS
-- 
-- Ejecutar en: Supabase SQL Editor
-- =========================================

-- Crear tabla de logs de actividad
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name TEXT,
  action TEXT NOT NULL, -- 'create', 'update', 'delete', 'mark_paid', 'toggle_active'
  entity_type TEXT NOT NULL, -- 'comunidad', 'incidencia', 'morosidad'
  entity_id BIGINT,
  entity_name TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Crear índices para mejorar el rendimiento de las consultas
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON public.activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON public.activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON public.activity_logs(action);

-- Habilitar Row Level Security
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Política: Solo administradores pueden ver los logs
CREATE POLICY "Admin can view all activity logs"
  ON public.activity_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.rol = 'admin'
        AND profiles.activo = true
    )
  );

-- Política: Todos los usuarios autenticados pueden insertar logs
CREATE POLICY "Authenticated users can insert activity logs"
  ON public.activity_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Comentarios para documentación
COMMENT ON TABLE public.activity_logs IS 'Registro de todas las actividades de usuarios en el sistema';
COMMENT ON COLUMN public.activity_logs.action IS 'Tipo de acción: create, update, delete, mark_paid, toggle_active';
COMMENT ON COLUMN public.activity_logs.entity_type IS 'Tipo de entidad afectada: comunidad, incidencia, morosidad';
COMMENT ON COLUMN public.activity_logs.details IS 'Información adicional en formato JSON';
