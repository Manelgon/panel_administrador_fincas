-- Tabla para configuración del emisor (datos de empresa)
CREATE TABLE IF NOT EXISTS public.company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- Cualquier usuario autenticado puede leer (los PDFs lo necesitan)
CREATE POLICY "Authenticated can read company_settings"
  ON public.company_settings FOR SELECT
  TO authenticated
  USING (true);

-- Solo service role puede escribir (la API usa service role key)
-- No se necesita política adicional de escritura porque usamos service role key en la API

-- Seed inicial con los valores de producción actuales
INSERT INTO public.company_settings (setting_key, setting_value) VALUES
  ('emisor_name',    'SERINCOSOL S.L.'),
  ('emisor_address', 'Pasaje Pezuela 1, 1º A Dcha'),
  ('emisor_city',    '29010 Málaga'),
  ('emisor_cif',     'B09915075'),
  ('logo_path',      ''),
  ('firma_path',     ''),
  ('header_path',    '')
ON CONFLICT (setting_key) DO NOTHING;
