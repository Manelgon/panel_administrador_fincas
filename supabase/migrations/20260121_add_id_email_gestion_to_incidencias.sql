-- Migration: Add id_email_gestion column to incidencias table
ALTER TABLE incidencias ADD COLUMN IF NOT EXISTS id_email_gestion TEXT;

COMMENT ON COLUMN incidencias.id_email_gestion IS 'ID de gestión de email para seguimiento interno. No visible en frontend.';
