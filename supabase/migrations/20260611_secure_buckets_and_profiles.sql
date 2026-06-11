-- Migration: Cierre de buckets públicos y restricción de lectura de profiles
-- Contexto (auditoría 2026-06-11):
--  - FACTURAS y documentos_administrativos estaban public=true → sus archivos
--    se servían por /object/public/ SIN autenticación.
--  - Policies SELECT "TO public" permitían lectura vía API con la anon key.
--  - profiles tenía SELECT USING (true) para cualquier autenticado, incluso inactivos.
-- La app sirve estos buckets por signed URLs (service_role) y por /api/storage/view,
-- por lo que cerrar el acceso público no afecta a ningún flujo propio.

-- 1. Buckets: dejar de servir archivos por URL pública
update storage.buckets set public = false where id in ('FACTURAS', 'documentos_administrativos');

-- 2. Storage: eliminar lectura para rol public (anon)
drop policy if exists "Permiso Ver Documentos" on storage.objects;
drop policy if exists "Permiso Ver AdminDocs" on storage.objects;
drop policy if exists "Public read facturas" on storage.objects;

-- documentos ya tiene "Authenticated users can read documents"; AdminDocs y FACTURAS
-- se recrean solo para authenticated
drop policy if exists "AdminDocs read authenticated" on storage.objects;
create policy "AdminDocs read authenticated"
on storage.objects for select
to authenticated
using (bucket_id = 'documentos_administrativos');

drop policy if exists "Authenticated users can read facturas" on storage.objects;
create policy "FACTURAS read authenticated"
on storage.objects for select
to authenticated
using (bucket_id = 'FACTURAS');

-- 3. profiles: solo el propio perfil o empleados activos (el chat necesita
--    nombres/avatares de otros perfiles, por eso no se limita a "solo el propio")
drop policy if exists "profiles: read all authenticated" on public.profiles;
drop policy if exists "profiles: select basic for all" on public.profiles;
create policy "profiles: select own or active employee"
on public.profiles for select
to authenticated
using ((user_id = auth.uid()) or public.is_active_employee());
