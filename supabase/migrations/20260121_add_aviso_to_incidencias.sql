-- Add aviso column to incidencias table
ALTER TABLE incidencias
ADD COLUMN aviso TEXT DEFAULT NULL;

COMMENT ON COLUMN incidencias.aviso IS 'Indicates if owner notification was sent for this incident';
