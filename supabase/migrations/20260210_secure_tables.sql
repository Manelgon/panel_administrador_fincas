-- 1. Enable RLS on public tables
ALTER TABLE public.incidencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.morosidad ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comunidades ENABLE ROW LEVEL SECURITY;

-- 2. Policies for 'incidencias'

-- Admin: Full Access
DROP POLICY IF EXISTS "incidencias: admin all" ON public.incidencias;
CREATE POLICY "incidencias: admin all"
ON public.incidencias
FOR ALL
TO authenticated
USING ( public.is_admin() )
WITH CHECK ( public.is_admin() );

-- Gestor & Empleado: Select, Insert, Update
DROP POLICY IF EXISTS "incidencias: gestor_empleado write" ON public.incidencias;
CREATE POLICY "incidencias: gestor_empleado write"
ON public.incidencias
FOR ALL
TO authenticated
USING ( 
  (SELECT rol FROM public.profiles WHERE user_id = auth.uid()) IN ('gestor', 'empleado') 
)
WITH CHECK ( 
  (SELECT rol FROM public.profiles WHERE user_id = auth.uid()) IN ('gestor', 'empleado') 
);


-- 3. Policies for 'morosidad'

-- Admin: Full Access
DROP POLICY IF EXISTS "morosidad: admin all" ON public.morosidad;
CREATE POLICY "morosidad: admin all"
ON public.morosidad
FOR ALL
TO authenticated
USING ( public.is_admin() )
WITH CHECK ( public.is_admin() );

-- Gestor & Empleado: Select, Insert, Update
DROP POLICY IF EXISTS "morosidad: gestor_empleado write" ON public.morosidad;
CREATE POLICY "morosidad: gestor_empleado write"
ON public.morosidad
FOR ALL
TO authenticated
USING ( 
  (SELECT rol FROM public.profiles WHERE user_id = auth.uid()) IN ('gestor', 'empleado') 
)
WITH CHECK ( 
  (SELECT rol FROM public.profiles WHERE user_id = auth.uid()) IN ('gestor', 'empleado') 
);


-- 4. Policies for 'proveedores'

-- Admin: Full Access
DROP POLICY IF EXISTS "proveedores: admin all" ON public.proveedores;
CREATE POLICY "proveedores: admin all"
ON public.proveedores
FOR ALL
TO authenticated
USING ( public.is_admin() )
WITH CHECK ( public.is_admin() );

-- Others: Read Only
DROP POLICY IF EXISTS "proveedores: select for authenticated" ON public.proveedores;
CREATE POLICY "proveedores: select for authenticated"
ON public.proveedores
FOR SELECT
TO authenticated
USING ( true );

-- Remove permissive policies from original migration if they exist
DROP POLICY IF EXISTS "proveedores: insert for authenticated" ON public.proveedores;
DROP POLICY IF EXISTS "proveedores: update for authenticated" ON public.proveedores;
DROP POLICY IF EXISTS "proveedores: delete for authenticated" ON public.proveedores;


-- 5. Policies for 'comunidades'

-- Admin: Full Access
DROP POLICY IF EXISTS "comunidades: admin all" ON public.comunidades;
CREATE POLICY "comunidades: admin all"
ON public.comunidades
FOR ALL
TO authenticated
USING ( public.is_admin() )
WITH CHECK ( public.is_admin() );

-- Others: Read Only
DROP POLICY IF EXISTS "comunidades: read all authenticated" ON public.comunidades;
CREATE POLICY "comunidades: read all authenticated"
ON public.comunidades
FOR SELECT
TO authenticated
USING ( true );

DROP POLICY IF EXISTS "comunidades: admin insert" ON public.comunidades;
DROP POLICY IF EXISTS "comunidades: admin update" ON public.comunidades;
DROP POLICY IF EXISTS "comunidades: admin delete" ON public.comunidades;
