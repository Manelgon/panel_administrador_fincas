-- Create contratos table (PRP-004: Gestión de Contratos con Proveedores)
CREATE TABLE IF NOT EXISTS public.contratos (
    id SERIAL PRIMARY KEY,
    comunidad_id INTEGER REFERENCES public.comunidades(id) ON DELETE RESTRICT,
    proveedor_id INTEGER REFERENCES public.proveedores(id) ON DELETE RESTRICT,
    tipo_servicio TEXT,
    descripcion TEXT,
    fecha_alta DATE,
    fecha_vencimiento DATE,
    fecha_preaviso DATE,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT contratos_fechas_coherentes
        CHECK (fecha_vencimiento IS NULL OR fecha_alta IS NULL OR fecha_vencimiento >= fecha_alta)
);

-- Índices para los filtros de la UI (por comunidad y por proveedor)
CREATE INDEX IF NOT EXISTS idx_contratos_comunidad_id ON public.contratos(comunidad_id);
CREATE INDEX IF NOT EXISTS idx_contratos_proveedor_id ON public.contratos(proveedor_id);

-- GRANTS explícitos (obligatorio desde el breaking change de Supabase 2026-04-28).
-- Sin grant a `anon`: los contratos son información interna, nunca pública.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contratos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contratos TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.contratos_id_seq TO authenticated, service_role;

-- Enable RLS
ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;

-- Policies alineadas con el modelo vigente del proyecto
-- (20260210_secure_tables.sql + 20260410_proveedores_gestor_write.sql):
-- lectura para todo authenticated, escritura solo admin / gestor / empleado.
DROP POLICY IF EXISTS "contratos: select for authenticated" ON public.contratos;
CREATE POLICY "contratos: select for authenticated"
ON public.contratos FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "contratos: admin all" ON public.contratos;
CREATE POLICY "contratos: admin all"
ON public.contratos FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "contratos: gestor_empleado write" ON public.contratos;
CREATE POLICY "contratos: gestor_empleado write"
ON public.contratos FOR ALL
TO authenticated
USING ((SELECT rol FROM public.profiles WHERE user_id = auth.uid()) IN ('gestor', 'empleado'))
WITH CHECK ((SELECT rol FROM public.profiles WHERE user_id = auth.uid()) IN ('gestor', 'empleado'));
