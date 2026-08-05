-- Catálogo editable de tipos de servicio de contratos (PRP-004).
-- Sustituye a la lista fija de src/lib/tiposServicioContrato.ts para que el
-- equipo pueda dar de alta tipos nuevos desde la interfaz.
CREATE TABLE IF NOT EXISTS public.tipos_servicio_contrato (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- GRANTS explícitos (breaking change de Supabase 2026-04-28). Sin `anon`: dato interno.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tipos_servicio_contrato TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tipos_servicio_contrato TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.tipos_servicio_contrato_id_seq TO authenticated, service_role;

ALTER TABLE public.tipos_servicio_contrato ENABLE ROW LEVEL SECURITY;

-- Lectura para todo authenticated; escritura para admin / gestor / empleado
-- (los gestores crean tipos al vuelo desde el formulario de contrato).
DROP POLICY IF EXISTS "tipos_servicio: select for authenticated" ON public.tipos_servicio_contrato;
CREATE POLICY "tipos_servicio: select for authenticated"
ON public.tipos_servicio_contrato FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "tipos_servicio: admin all" ON public.tipos_servicio_contrato;
CREATE POLICY "tipos_servicio: admin all"
ON public.tipos_servicio_contrato FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "tipos_servicio: gestor_empleado write" ON public.tipos_servicio_contrato;
CREATE POLICY "tipos_servicio: gestor_empleado write"
ON public.tipos_servicio_contrato FOR ALL
TO authenticated
USING ((SELECT rol FROM public.profiles WHERE user_id = auth.uid()) IN ('gestor', 'empleado'))
WITH CHECK ((SELECT rol FROM public.profiles WHERE user_id = auth.uid()) IN ('gestor', 'empleado'));

-- Semilla: los tipos que ya usan los 438 contratos importados
INSERT INTO public.tipos_servicio_contrato (nombre) VALUES
    ('Seguro multirriesgo'),
    ('Electricidad'),
    ('Ascensores'),
    ('Limpieza'),
    ('Suministro de agua'),
    ('Extintores / Contraincendios'),
    ('Grupo de presión'),
    ('Protección de datos RGPD'),
    ('Antenas / Telecomunicaciones'),
    ('Cámaras / Seguridad'),
    ('Puertas de garaje'),
    ('Control de plagas'),
    ('Piscina'),
    ('Obras y reformas'),
    ('Jardinería'),
    ('Mantenimiento general'),
    ('Prevención de riesgos laborales'),
    ('Energía solar'),
    ('Banca / Cuenta corriente'),
    ('Servicios jurídicos'),
    ('ITE'),
    ('Otro')
ON CONFLICT (nombre) DO NOTHING;
