-- Add proveedor_id column (FK to proveedores) and aviso_proveedor to incidencias
ALTER TABLE public.incidencias
ADD COLUMN proveedor_id INTEGER REFERENCES public.proveedores(id) DEFAULT NULL,
ADD COLUMN aviso_proveedor TEXT DEFAULT NULL;

COMMENT ON COLUMN public.incidencias.proveedor_id IS 'FK to proveedores table - the assigned provider for this ticket';
COMMENT ON COLUMN public.incidencias.aviso_proveedor IS 'Same as aviso: 0=none, 1=WhatsApp, 2=Email, 3=both';
