-- Agregar columna borrador_acta a la tabla reuniones
ALTER TABLE reuniones ADD COLUMN borrador_acta BOOLEAN DEFAULT NULL;
