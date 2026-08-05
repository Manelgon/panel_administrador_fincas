-- PDF del contrato (PRP-004): un archivo por contrato.
-- archivo_url guarda la ruta interna del objeto en Storage; archivo_nombre
-- conserva el nombre original para que la descarga salga con su nombre real.
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS archivo_url TEXT;
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS archivo_nombre TEXT;
