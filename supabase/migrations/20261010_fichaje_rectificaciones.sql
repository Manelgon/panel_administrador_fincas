-- =========================================================================
-- PRP-007: Autocierre de fichajes fiable + rectificaciones
-- Pegar ENTERO en Supabase > SQL Editor y pulsar "Run".
-- Es idempotente: si se pega dos veces no rompe nada.
-- =========================================================================

begin;

-- -------------------------------------------------------------------------
-- 1) time_entries: quién cerró el fichaje y estado de revisión
-- -------------------------------------------------------------------------
alter table public.time_entries
  add column if not exists closed_by text,
  add column if not exists review_status text not null default 'ok',
  add column if not exists original_end_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'time_entries_closed_by_check') then
    alter table public.time_entries
      add constraint time_entries_closed_by_check
      check (closed_by in ('user', 'admin', 'auto'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'time_entries_review_status_check') then
    alter table public.time_entries
      add constraint time_entries_review_status_check
      check (review_status in ('ok', 'pendiente', 'solicitado', 'corregido'));
  end if;
end $$;

-- Un solo fichaje abierto por persona
create unique index if not exists time_entries_one_open_per_user
  on public.time_entries (user_id) where end_at is null;

create index if not exists time_entries_review_status_idx
  on public.time_entries (review_status) where review_status <> 'ok';

-- Traducir las marcas antiguas de la nota (los históricos NO pasan a pendiente)
update public.time_entries set closed_by = 'auto'
  where closed_by is null and end_at is not null and note like '%[AUTO-CIERRE]%';
update public.time_entries set closed_by = 'admin'
  where closed_by is null and end_at is not null and note like '%[Cerrado por Admin]%';
update public.time_entries set closed_by = 'user'
  where closed_by is null and end_at is not null;

-- -------------------------------------------------------------------------
-- 2) Solicitudes de corrección (tabla nueva)
-- -------------------------------------------------------------------------
create table if not exists public.time_entry_corrections (
  id               bigserial primary key,
  time_entry_id    bigint not null references public.time_entries(id) on delete cascade,
  user_id          uuid   not null references public.profiles(user_id) on delete cascade,
  requested_by     uuid   not null references public.profiles(user_id),
  previous_end_at  timestamptz not null,
  proposed_end_at  timestamptz not null,
  reason           text not null check (char_length(reason) between 5 and 500),
  status           text not null default 'pendiente'
                     check (status in ('pendiente', 'aprobada', 'rechazada')),
  reviewed_by      uuid references public.profiles(user_id),
  reviewed_at      timestamptz,
  review_comment   text,
  created_at       timestamptz not null default now()
);

create unique index if not exists time_entry_corrections_one_pending
  on public.time_entry_corrections (time_entry_id) where status = 'pendiente';
create index if not exists time_entry_corrections_status_idx
  on public.time_entry_corrections (status, created_at desc);
create index if not exists time_entry_corrections_user_idx
  on public.time_entry_corrections (user_id, created_at desc);

-- Grants explícitos (cambio Supabase 2026). Escrituras solo vía funciones.
grant select on public.time_entry_corrections to authenticated;
grant select, insert, update, delete on public.time_entry_corrections to service_role;
grant usage, select on sequence public.time_entry_corrections_id_seq to service_role;

alter table public.time_entry_corrections enable row level security;

drop policy if exists "corrections: read own or admin" on public.time_entry_corrections;
create policy "corrections: read own or admin"
on public.time_entry_corrections for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

-- -------------------------------------------------------------------------
-- 3) RLS time_entries: el empleado ya no puede escribir directamente
--    (todo pasa por clock_in / clock_out / funciones con rastro)
-- -------------------------------------------------------------------------
drop policy if exists "time_entries: insert own" on public.time_entries;
drop policy if exists "time_entries: insert admin" on public.time_entries;
create policy "time_entries: insert admin"
on public.time_entries for insert
to authenticated
with check (public.is_admin());

drop policy if exists "time_entries: update own or admin" on public.time_entries;
drop policy if exists "time_entries: update admin" on public.time_entries;
create policy "time_entries: update admin"
on public.time_entries for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- -------------------------------------------------------------------------
-- 4) Funciones internas
-- -------------------------------------------------------------------------

-- Duración máxima configurada (null si el autocierre está desactivado)
create or replace function public.fichaje_max_interval()
returns interval
language sql
stable
security definer
set search_path = public
as $$
  select case when s.auto_close_enabled
              then make_interval(hours := s.max_hours_duration, mins := s.max_minutes_duration)
         end
  from public.fichaje_settings s
  where s.id = 1;
$$;

-- Cierra un fichaje abierto como autocierre y avisa al empleado
create or replace function public.close_entry_as_auto(_entry_id bigint, _max interval)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  _row public.time_entries%rowtype;
begin
  update public.time_entries
  set end_at = start_at + _max,
      closed_by = 'auto',
      review_status = 'pendiente'
  where id = _entry_id
    and end_at is null
  returning * into _row;

  if _row.id is null then
    return null;
  end if;

  insert into public.notifications (user_id, type, title, body, entity_type, entity_id, is_read)
  values (
    _row.user_id,
    'fichaje_autocierre',
    'Fichaje cerrado automáticamente',
    'Tu fichaje del ' || to_char(timezone('Europe/Madrid', _row.start_at), 'DD/MM/YYYY')
      || ' se cerró solo a las ' || to_char(timezone('Europe/Madrid', _row.end_at), 'HH24:MI')
      || '. Entra en Fichaje e indica tu hora real de salida.',
    'fichaje',
    _row.id,
    false
  );

  return _row.id;
end;
$$;

-- Avisa a todos los administradores activos
create or replace function public.notify_fichaje_admins(_title text, _body text, _entry_id bigint)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notifications (user_id, type, title, body, entity_type, entity_id, is_read)
  select p.user_id, 'fichaje_rectificacion', _title, _body, 'fichaje', _entry_id, false
  from public.profiles p
  where p.rol = 'admin' and p.activo = true;
$$;

-- -------------------------------------------------------------------------
-- 5) Autocierre (cron): ya NO depende de la hora de ejecución
-- -------------------------------------------------------------------------
drop function if exists public.auto_close_stale_sessions();
create function public.auto_close_stale_sessions()
returns table(id bigint, user_id uuid, start_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  _max interval := public.fichaje_max_interval();
  _entry record;
begin
  if _max is null then
    return;
  end if;

  for _entry in
    select te.id, te.user_id, te.start_at
    from public.time_entries te
    where te.end_at is null
      and now() - te.start_at > _max
  loop
    if public.close_entry_as_auto(_entry.id, _max) is not null then
      id := _entry.id;
      user_id := _entry.user_id;
      start_at := _entry.start_at;
      return next;
    end if;
  end loop;
end;
$$;

-- -------------------------------------------------------------------------
-- 6) Fichar entrada / salida
-- -------------------------------------------------------------------------
create or replace function public.clock_in(_note text default null)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  _max interval := public.fichaje_max_interval();
  _open public.time_entries%rowtype;
  new_id bigint;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into _open
  from public.time_entries
  where user_id = auth.uid() and end_at is null
  limit 1;

  if _open.id is not null then
    -- Fichaje olvidado de otra jornada: se autocierra y se sigue
    if _max is not null and now() - _open.start_at > _max then
      perform public.close_entry_as_auto(_open.id, _max);
    else
      raise exception 'Ya tienes un fichaje abierto';
    end if;
  end if;

  insert into public.time_entries (user_id, start_at, note)
  values (auth.uid(), now(), _note)
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.clock_out()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  _max interval := public.fichaje_max_interval();
  _open public.time_entries%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into _open
  from public.time_entries
  where user_id = auth.uid() and end_at is null
  limit 1;

  if _open.id is null then
    raise exception 'No hay fichaje abierto';
  end if;

  -- Si se pasó del máximo, no se crea una jornada de 24h: autocierre
  if _max is not null and now() - _open.start_at > _max then
    return public.close_entry_as_auto(_open.id, _max);
  end if;

  update public.time_entries
  set end_at = now(), closed_by = 'user'
  where id = _open.id;

  return _open.id;
end;
$$;

create or replace function public.admin_clock_out(_user_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_id bigint;
begin
  if not public.is_admin() then
    raise exception 'Access denied: admins only';
  end if;

  update public.time_entries
  set end_at = now(), closed_by = 'admin'
  where user_id = _user_id
    and end_at is null
  returning id into updated_id;

  return updated_id;
end;
$$;

-- -------------------------------------------------------------------------
-- 7) Rectificaciones
-- -------------------------------------------------------------------------

-- Comprueba que una hora de salida es coherente para un fichaje
create or replace function public.validate_time_entry_end(_entry public.time_entries, _end_at timestamptz)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _next_start timestamptz;
begin
  if _end_at <= _entry.start_at then
    raise exception 'La hora de salida debe ser posterior a la entrada';
  end if;
  if _end_at > now() then
    raise exception 'La hora de salida no puede ser futura';
  end if;
  if _end_at - _entry.start_at > interval '16 hours' then
    raise exception 'La jornada no puede superar 16 horas';
  end if;

  select min(te.start_at) into _next_start
  from public.time_entries te
  where te.user_id = _entry.user_id
    and te.id <> _entry.id
    and te.start_at > _entry.start_at;

  if _next_start is not null and _end_at > _next_start then
    raise exception 'La hora de salida se solapa con el siguiente fichaje (%)',
      to_char(timezone('Europe/Madrid', _next_start), 'DD/MM HH24:MI');
  end if;
end;
$$;

-- El empleado propone su hora real de salida
create or replace function public.request_time_entry_correction(
  _entry_id bigint,
  _proposed_end_at timestamptz,
  _reason text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  _entry public.time_entries%rowtype;
  _name text;
  new_id bigint;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into _entry from public.time_entries where id = _entry_id for update;

  if _entry.id is null or _entry.user_id <> auth.uid() then
    raise exception 'Fichaje no encontrado';
  end if;
  if _entry.end_at is null then
    raise exception 'El fichaje sigue abierto';
  end if;
  if _entry.review_status <> 'pendiente' then
    raise exception 'Este fichaje no está pendiente de revisar';
  end if;
  if char_length(coalesce(trim(_reason), '')) < 5 then
    raise exception 'Indica un motivo (mínimo 5 caracteres)';
  end if;

  perform public.validate_time_entry_end(_entry, _proposed_end_at);

  insert into public.time_entry_corrections
    (time_entry_id, user_id, requested_by, previous_end_at, proposed_end_at, reason)
  values
    (_entry.id, _entry.user_id, auth.uid(), _entry.end_at, _proposed_end_at, trim(_reason))
  returning id into new_id;

  update public.time_entries set review_status = 'solicitado' where id = _entry.id;

  select trim(p.nombre || ' ' || coalesce(p.apellido, '')) into _name
  from public.profiles p where p.user_id = auth.uid();

  perform public.notify_fichaje_admins(
    'Corrección de fichaje pendiente',
    coalesce(_name, 'Un empleado') || ' propone salida a las '
      || to_char(timezone('Europe/Madrid', _proposed_end_at), 'HH24:MI')
      || ' en su fichaje del ' || to_char(timezone('Europe/Madrid', _entry.start_at), 'DD/MM/YYYY') || '.',
    _entry.id
  );

  return new_id;
end;
$$;

-- El admin aprueba o rechaza una solicitud
create or replace function public.review_time_entry_correction(
  _correction_id bigint,
  _approve boolean,
  _comment text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  _corr public.time_entry_corrections%rowtype;
  _entry public.time_entries%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Access denied: admins only';
  end if;

  select * into _corr from public.time_entry_corrections where id = _correction_id for update;
  if _corr.id is null or _corr.status <> 'pendiente' then
    raise exception 'La solicitud no existe o ya está resuelta';
  end if;

  if not _approve and char_length(coalesce(trim(_comment), '')) < 3 then
    raise exception 'Indica el motivo del rechazo';
  end if;

  select * into _entry from public.time_entries where id = _corr.time_entry_id for update;

  if _approve then
    perform public.validate_time_entry_end(_entry, _corr.proposed_end_at);

    update public.time_entries
    set original_end_at = coalesce(original_end_at, end_at),
        end_at = _corr.proposed_end_at,
        review_status = 'corregido'
    where id = _entry.id;
  else
    update public.time_entries set review_status = 'pendiente' where id = _entry.id;
  end if;

  update public.time_entry_corrections
  set status = case when _approve then 'aprobada' else 'rechazada' end,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_comment = nullif(trim(coalesce(_comment, '')), '')
  where id = _corr.id;

  insert into public.notifications (user_id, type, title, body, entity_type, entity_id, is_read)
  values (
    _corr.user_id,
    'fichaje_rectificacion',
    case when _approve then 'Corrección de fichaje aprobada' else 'Corrección de fichaje rechazada' end,
    'Fichaje del ' || to_char(timezone('Europe/Madrid', _entry.start_at), 'DD/MM/YYYY')
      || case when _approve
              then ': salida corregida a las ' || to_char(timezone('Europe/Madrid', _corr.proposed_end_at), 'HH24:MI') || '.'
              else ': ' || trim(_comment) || '. Vuelve a indicar tu hora de salida.'
         end,
    'fichaje',
    _entry.id,
    false
  );

  return _corr.id;
end;
$$;

-- El admin corrige directamente (queda el mismo rastro: solicitud creada y aprobada)
create or replace function public.admin_correct_time_entry(
  _entry_id bigint,
  _end_at timestamptz,
  _reason text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  _entry public.time_entries%rowtype;
  new_id bigint;
begin
  if not public.is_admin() then
    raise exception 'Access denied: admins only';
  end if;
  if char_length(coalesce(trim(_reason), '')) < 5 then
    raise exception 'Indica un motivo (mínimo 5 caracteres)';
  end if;

  select * into _entry from public.time_entries where id = _entry_id for update;
  if _entry.id is null then
    raise exception 'Fichaje no encontrado';
  end if;
  if _entry.end_at is null then
    raise exception 'El fichaje sigue abierto: ciérralo primero';
  end if;

  perform public.validate_time_entry_end(_entry, _end_at);

  -- Si el empleado tenía una solicitud pendiente, queda sustituida
  update public.time_entry_corrections
  set status = 'rechazada', reviewed_by = auth.uid(), reviewed_at = now(),
      review_comment = 'Sustituida por corrección directa del administrador'
  where time_entry_id = _entry.id and status = 'pendiente';

  insert into public.time_entry_corrections
    (time_entry_id, user_id, requested_by, previous_end_at, proposed_end_at, reason,
     status, reviewed_by, reviewed_at)
  values
    (_entry.id, _entry.user_id, auth.uid(), _entry.end_at, _end_at, trim(_reason),
     'aprobada', auth.uid(), now())
  returning id into new_id;

  update public.time_entries
  set original_end_at = coalesce(original_end_at, end_at),
      end_at = _end_at,
      review_status = 'corregido'
  where id = _entry.id;

  if _entry.user_id <> auth.uid() then
    insert into public.notifications (user_id, type, title, body, entity_type, entity_id, is_read)
    values (
      _entry.user_id,
      'fichaje_rectificacion',
      'Fichaje corregido por administración',
      'Fichaje del ' || to_char(timezone('Europe/Madrid', _entry.start_at), 'DD/MM/YYYY')
        || ': salida corregida a las ' || to_char(timezone('Europe/Madrid', _end_at), 'HH24:MI')
        || '. Motivo: ' || trim(_reason),
      'fichaje',
      _entry.id,
      false
    );
  end if;

  return new_id;
end;
$$;

-- -------------------------------------------------------------------------
-- 8) Permisos de ejecución
-- -------------------------------------------------------------------------
-- Internas: nadie desde la API (solo las usan otras funciones)
revoke execute on function public.fichaje_max_interval() from public, anon, authenticated;
revoke execute on function public.close_entry_as_auto(bigint, interval) from public, anon, authenticated;
revoke execute on function public.notify_fichaje_admins(text, text, bigint) from public, anon, authenticated;
revoke execute on function public.validate_time_entry_end(public.time_entries, timestamptz) from public, anon, authenticated;

-- Cron: solo el servidor
revoke execute on function public.auto_close_stale_sessions() from public, anon, authenticated;
grant execute on function public.auto_close_stale_sessions() to service_role;

-- Públicas para usuarios con sesión
revoke execute on function public.clock_in(text) from public, anon;
revoke execute on function public.clock_out() from public, anon;
revoke execute on function public.admin_clock_out(uuid) from public, anon;
revoke execute on function public.request_time_entry_correction(bigint, timestamptz, text) from public, anon;
revoke execute on function public.review_time_entry_correction(bigint, boolean, text) from public, anon;
revoke execute on function public.admin_correct_time_entry(bigint, timestamptz, text) from public, anon;

grant execute on function public.clock_in(text) to authenticated;
grant execute on function public.clock_out() to authenticated;
grant execute on function public.admin_clock_out(uuid) to authenticated;
grant execute on function public.request_time_entry_correction(bigint, timestamptz, text) to authenticated;
grant execute on function public.review_time_entry_correction(bigint, boolean, text) to authenticated;
grant execute on function public.admin_correct_time_entry(bigint, timestamptz, text) to authenticated;

commit;

-- Recargar el esquema de la API para que vea las columnas y funciones nuevas
notify pgrst, 'reload schema';
