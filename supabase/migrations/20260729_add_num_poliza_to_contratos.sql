-- Añadir nº de póliza como dato propio del contrato (antes iba en descripcion)
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS num_poliza TEXT;
