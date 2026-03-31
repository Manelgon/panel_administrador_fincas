-- =========================================
-- TIME TRACKING / FICHAJE
-- =========================================

-- 1) TABLE: time_entries
create table if not exists public.time_entries (
  id bigserial primary key,
  user_id uuid not null references public.profiles(user_id) on delete cascade,

  start_at timestamptz not null default now(),
  end_at timestamptz, -- null mientras está "en curso"

  note text,
  created_at timestamptz not null default now(),

  -- constraints básicas
  constraint end_after_start check (end_at is null or end_at > start_at)
);

-- Indexes
create index if not exists time_entries_user_start_idx
  on public.time_entries (user_id, start_at desc);

create index if not exists time_entries_open_idx
  on public.time_entries (user_id)
  where end_at is null;

-- =========================================
-- 2) HELPER FUNCTIONS
-- =========================================

-- 2.1 Check if user has open entry
create or replace function public.has_open_entry(_user uuid)
returns boolean
language sql stable as $$
  select exists (
    select 1
    from public.time_entries te
    where te.user_id = _user
      and te.end_at is null
  );
$$;

-- 2.2 Clock in (fichar entrada)
create or replace function public.clock_in(_note text default null)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id bigint;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if public.has_open_entry(auth.uid()) then
    raise exception 'Ya tienes un fichaje abierto';
  end if;

  insert into public.time_entries (user_id, start_at, note)
  values (auth.uid(), now(), _note)
  returning id into new_id;

  return new_id;
end;
$$;

-- 2.3 Clock out (fichar salida)
create or replace function public.clock_out()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_id bigint;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.time_entries
  set end_at = now()
  where user_id = auth.uid()
    and end_at is null
  returning id into updated_id;

  if updated_id is null then
    raise exception 'No hay fichaje abierto';
  end if;

  return updated_id;
end;
$$;

-- =========================================
-- 3) RLS POLICIES
-- =========================================

-- Enable RLS
alter table public.time_entries enable row level security;

-- Ver: propio o admin
drop policy if exists "time_entries: read own or admin" on public.time_entries;
create policy "time_entries: read own or admin"
on public.time_entries for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

-- Insertar: solo propio (pero realmente usarás clock_in)
drop policy if exists "time_entries: insert own" on public.time_entries;
create policy "time_entries: insert own"
on public.time_entries for insert
to authenticated
with check (user_id = auth.uid() or public.is_admin());

-- Actualizar: propio o admin (pero realmente usarás clock_out)
drop policy if exists "time_entries: update own or admin" on public.time_entries;
create policy "time_entries: update own or admin"
on public.time_entries for update
to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

-- Borrar: solo admin (opcional)
drop policy if exists "time_entries: delete admin" on public.time_entries;
create policy "time_entries: delete admin"
on public.time_entries for delete
to authenticated
using (public.is_admin());

-- =========================================
-- 4) VIEW: monthly_hours
-- =========================================

create or replace view public.monthly_hours 
with (security_invoker = true)
as
select
  te.user_id,
  date_trunc('month', te.start_at) as month,
  sum(
    extract(epoch from (coalesce(te.end_at, now()) - te.start_at))
  ) / 3600.0 as hours
from public.time_entries te
group by te.user_id, date_trunc('month', te.start_at);
