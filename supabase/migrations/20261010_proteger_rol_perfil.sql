-- APLICAR A MANO en Supabase → SQL Editor del proyecto de Serincosol (producción). Seguro de repetir.
-- 008 · Seguridad: nadie puede cambiarse a sí mismo el rol ni reactivarse la cuenta.
-- La política «profiles: update own or admin» deja a cada usuario editar SU fila
-- entera, incluido `rol` y `activo`: un empleado podía hacerse admin desde el
-- navegador. Este trigger solo deja cambiar rol, activo y user_id a un admin
-- (o al servidor con service_role, que es como lo hace Ajustes → Personas, o desde
-- el editor SQL de Supabase).
-- Idempotente.

create or replace function public.proteger_campos_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if (new.rol is distinct from old.rol
        or new.activo is distinct from old.activo
        or new.user_id is distinct from old.user_id)
       -- Solo peticiones de usuarios con sesión (API de Supabase como 'authenticated');
       -- el servidor (service_role) y el SQL del panel de Supabase no se bloquean
       and coalesce(auth.role(), '') = 'authenticated'
       and not public.is_admin() then
        raise exception 'Solo un administrador puede cambiar el rol o el estado de una cuenta'
            using errcode = '42501';
    end if;
    return new;
end;
$$;

revoke all on function public.proteger_campos_perfil() from public, anon, authenticated;

drop trigger if exists trg_proteger_campos_perfil on public.profiles;
create trigger trg_proteger_campos_perfil
    before update on public.profiles
    for each row execute function public.proteger_campos_perfil();
