-- =========================================
-- FICHAJE SETTINGS & AUTO-CIERRE
-- =========================================

-- 1) Table: fichaje_settings
create table if not exists public.fichaje_settings (
  id int primary key default 1 check (id = 1),
  auto_close_enabled boolean not null default true,
  max_hours_duration int not null default 12,
  max_minutes_duration int not null default 0,
  daily_execution_hour int not null default 17, -- Default 17:00 (5 PM)
  updated_at timestamptz default now()
);

-- Add column if it doesn't exist (safe for re-running)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='fichaje_settings' and column_name='daily_execution_hour') then
    alter table public.fichaje_settings add column daily_execution_hour int default 17;
  end if;
end $$;

-- Insert default row
insert into public.fichaje_settings (id, auto_close_enabled, max_hours_duration, max_minutes_duration, daily_execution_hour)
values (1, true, 12, 0, 17)
on conflict (id) do nothing;

-- RLS
alter table public.fichaje_settings enable row level security;

drop policy if exists "fichaje_settings: admin only" on public.fichaje_settings;
create policy "fichaje_settings: admin only"
on public.fichaje_settings for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- 2) Function: admin_clock_out
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
  set
    end_at = now(),
    note = coalesce(note, '') || ' [Cerrado por Admin]'
  where user_id = _user_id
    and end_at is null
  returning id into updated_id;

  return updated_id;
end;
$$;

-- 3) Function: auto_close_stale_sessions
drop function if exists public.auto_close_stale_sessions();

create or replace function public.auto_close_stale_sessions()
returns table(id bigint, user_id uuid, start_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  _enabled boolean;
  _hours int;
  _minutes int;
  _daily_hour int;
  _current_hour int;
  _max_interval interval;
begin
  -- 1. Get settings
  select auto_close_enabled, max_hours_duration, max_minutes_duration, daily_execution_hour
  into _enabled, _hours, _minutes, _daily_hour
  from public.fichaje_settings
  where id = 1;

  if not _enabled then
    return;
  end if;

  -- 2. Check if it's the configured hour (Europe/Madrid timezone)
  select extract(hour from timezone('Europe/Madrid', now())) into _current_hour;
  
  if _current_hour != _daily_hour then
    return; -- Not the right hour, skip execution
  end if;

  -- 3. Calculate interval
  _max_interval := make_interval(hours := _hours, mins := _minutes);

  -- 4. Update and return
  return query
  with closed_rows as (
    update public.time_entries
    set
      end_at = start_at + _max_interval,
      note = coalesce(note, '') || ' [AUTO-CIERRE]'
    where end_at is null
      and (now() - start_at) > _max_interval
    returning time_entries.id, time_entries.user_id, time_entries.start_at
  )
  select * from closed_rows;
end;
$$;
