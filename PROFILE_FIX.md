# Solución: Usuario sin perfil

## Problema
Cuando creas un usuario en Supabase Auth, no se crea automáticamente un registro en la tabla `profiles`.

## Soluciones

### Opción 1: Manual (rápido)
1. Ve a la tabla `profiles` en Supabase
2. Click en "Insert" → "Insert row"
3. Completa:
   - `user_id`: UUID del usuario (cópialo desde Authentication > Users)
   - `nombre`: Nombre del usuario
   - `email`: Email del usuario
   - `rol`: `admin` (o `empleado`, `gestor`)
   - `activo`: `true`

### Opción 2: Trigger automático (recomendado)
He actualizado `supa_schema.sql` con un trigger que crea automáticamente el perfil cuando se registra un usuario.

**Ejecuta este SQL en Supabase:**

```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, nombre, email, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    new.email,
    'empleado'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

Después de ejecutar esto, cada nuevo usuario tendrá automáticamente un perfil con rol `empleado`.

### Para el usuario actual
Crea manualmente el perfil con la Opción 1, o borra el usuario y créalo de nuevo (después de ejecutar el trigger).
