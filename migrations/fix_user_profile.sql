-- =========================================
-- FIX: Verificar y crear perfil de usuario
-- =========================================
-- Este script verifica si tu usuario tiene un perfil
-- y lo crea si no existe
-- 
-- IMPORTANTE: Ejecutar en Supabase SQL Editor
-- =========================================

-- 1. Ver tu user_id actual
SELECT auth.uid() as mi_user_id;

-- 2. Verificar si tienes un perfil
SELECT * FROM public.profiles WHERE user_id = auth.uid();

-- 3. Si NO tienes perfil, créalo (reemplaza 'Tu Nombre' con tu nombre real)
-- DESCOMENTA Y EJECUTA SOLO SI NO TIENES PERFIL:
/*
INSERT INTO public.profiles (user_id, nombre, rol, activo)
VALUES (
  auth.uid(),
  'Roberto',  -- Cambia esto por tu nombre
  'admin',    -- Rol: 'admin', 'empleado', o 'gestor'
  true
);
*/

-- 4. Verificar políticas RLS de comunidades
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'comunidades';

-- 5. TEMPORAL: Deshabilitar RLS para probar (NO RECOMENDADO EN PRODUCCIÓN)
-- DESCOMENTA SOLO PARA PROBAR:
/*
ALTER TABLE public.comunidades DISABLE ROW LEVEL SECURITY;
*/

-- 6. Para volver a habilitar RLS después de probar:
/*
ALTER TABLE public.comunidades ENABLE ROW LEVEL SECURITY;
*/
