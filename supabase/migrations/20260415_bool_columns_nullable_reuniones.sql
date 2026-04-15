-- Migración: hacer las columnas booleanas de reuniones nullable
-- 3 estados: null = pendiente, true = hecho, false = no aplica
-- Los valores false existentes se convierten a null (eran pendientes)
-- Fecha: 2026-04-15

-- 1. Quitar NOT NULL
ALTER TABLE reuniones
  ALTER COLUMN estado_cuentas DROP NOT NULL,
  ALTER COLUMN pto_ordinario   DROP NOT NULL,
  ALTER COLUMN pto_extra       DROP NOT NULL,
  ALTER COLUMN morosos         DROP NOT NULL,
  ALTER COLUMN citacion_email  DROP NOT NULL,
  ALTER COLUMN citacion_carta  DROP NOT NULL,
  ALTER COLUMN redactar_acta   DROP NOT NULL,
  ALTER COLUMN vb_pendiente    DROP NOT NULL,
  ALTER COLUMN imprimir_acta   DROP NOT NULL,
  ALTER COLUMN acta_email      DROP NOT NULL,
  ALTER COLUMN acta_carta      DROP NOT NULL,
  ALTER COLUMN pasar_acuerdos  DROP NOT NULL;

-- 2. Convertir false existentes a null (eran "pendiente")
UPDATE reuniones SET estado_cuentas  = NULL WHERE estado_cuentas = false;
UPDATE reuniones SET pto_ordinario   = NULL WHERE pto_ordinario  = false;
UPDATE reuniones SET pto_extra       = NULL WHERE pto_extra      = false;
UPDATE reuniones SET morosos         = NULL WHERE morosos        = false;
UPDATE reuniones SET citacion_email  = NULL WHERE citacion_email = false;
UPDATE reuniones SET citacion_carta  = NULL WHERE citacion_carta = false;
UPDATE reuniones SET redactar_acta   = NULL WHERE redactar_acta  = false;
UPDATE reuniones SET vb_pendiente    = NULL WHERE vb_pendiente   = false;
UPDATE reuniones SET imprimir_acta   = NULL WHERE imprimir_acta  = false;
UPDATE reuniones SET acta_email      = NULL WHERE acta_email     = false;
UPDATE reuniones SET acta_carta      = NULL WHERE acta_carta     = false;
UPDATE reuniones SET pasar_acuerdos  = NULL WHERE pasar_acuerdos = false;

-- 3. Establecer DEFAULT NULL (pendiente por defecto)
ALTER TABLE reuniones
  ALTER COLUMN estado_cuentas SET DEFAULT NULL,
  ALTER COLUMN pto_ordinario   SET DEFAULT NULL,
  ALTER COLUMN pto_extra       SET DEFAULT NULL,
  ALTER COLUMN morosos         SET DEFAULT NULL,
  ALTER COLUMN citacion_email  SET DEFAULT NULL,
  ALTER COLUMN citacion_carta  SET DEFAULT NULL,
  ALTER COLUMN redactar_acta   SET DEFAULT NULL,
  ALTER COLUMN vb_pendiente    SET DEFAULT NULL,
  ALTER COLUMN imprimir_acta   SET DEFAULT NULL,
  ALTER COLUMN acta_email      SET DEFAULT NULL,
  ALTER COLUMN acta_carta      SET DEFAULT NULL,
  ALTER COLUMN pasar_acuerdos  SET DEFAULT NULL;
