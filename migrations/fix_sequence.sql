-- =========================================
-- FIX: Resetear secuencia de auto-incremento
-- =========================================
-- Este script arregla el problema de IDs duplicados
-- reajustando la secuencia al valor máximo actual
-- 
-- Ejecutar en: Supabase SQL Editor
-- =========================================

-- Resetear la secuencia de comunidades al máximo ID actual
SELECT setval('comunidades_id_seq', (SELECT MAX(id) FROM comunidades));

-- Verificar el siguiente valor que se usará
SELECT nextval('comunidades_id_seq');

-- Si también tienes problemas con otras tablas, ejecuta lo mismo:
SELECT setval('incidencias_id_seq', (SELECT MAX(id) FROM incidencias));
SELECT setval('morosidad_id_seq', (SELECT MAX(id) FROM morosidad));
