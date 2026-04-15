-- Migración: añadir columna imprimir_acta a la tabla reuniones
-- Fecha: 2026-04-15

ALTER TABLE reuniones
    ADD COLUMN IF NOT EXISTS imprimir_acta BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN reuniones.imprimir_acta IS 'Indica si el acta ha sido impresa y entregada';
