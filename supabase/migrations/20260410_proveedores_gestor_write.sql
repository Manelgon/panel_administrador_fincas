-- Allow gestores and empleados to create/edit/delete proveedores
DROP POLICY IF EXISTS "proveedores: gestor_empleado write" ON public.proveedores;
CREATE POLICY "proveedores: gestor_empleado write"
ON public.proveedores
FOR ALL
TO authenticated
USING (
  (SELECT rol FROM public.profiles WHERE user_id = auth.uid()) IN ('gestor', 'empleado')
)
WITH CHECK (
  (SELECT rol FROM public.profiles WHERE user_id = auth.uid()) IN ('gestor', 'empleado')
);
