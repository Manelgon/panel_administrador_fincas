-- Migration: Audit Improvements (Indexes and Search)
-- Created: 2026-02-12

-- 1. Composite Indexes for Incidencias
-- Optimized for filtering by status and date (common dashboard view)
CREATE INDEX IF NOT EXISTS idx_incidencias_estado_fecha
ON public.incidencias (resuelto, created_at DESC);

-- Optimized for filtering by assigned manager and date
CREATE INDEX IF NOT EXISTS idx_incidencias_gestor_fecha
ON public.incidencias (gestor_asignado, created_at DESC);

-- 2. Full Text Search Index for Incidencias
-- Optimized for searching description field
CREATE INDEX IF NOT EXISTS idx_incidencias_search
ON public.incidencias
USING GIN (to_tsvector('spanish', descripcion));

-- 3. Composite Indexes for Reports/Email Logs (Optional but recommended based on usage)
CREATE INDEX IF NOT EXISTS idx_email_reports_community_date
ON public.email_reports (community_id, created_at DESC);
