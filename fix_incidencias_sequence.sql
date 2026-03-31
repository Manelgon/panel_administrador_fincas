-- SQL for fixing the "duplicate key" error in incidencias table
-- This happens when the ID sequence gets out of sync with the actual data

-- 1. Get the current maximum ID
-- SELECT max(id) FROM public.incidencias;

-- 2. Reset the sequence to the maximum ID + 1
SELECT setval(
    pg_get_serial_sequence('public.incidencias', 'id'), 
    COALESCE((SELECT max(id) FROM public.incidencias), 0) + 1, 
    false
);

-- Note: If you have the same issue with "morosidad" or "deudas", 
-- you can run a similar command for those tables.
