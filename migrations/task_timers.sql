-- =========================================
-- TASK TIMERS
-- =========================================

-- Table
create table if not exists public.task_timers (
  id bigserial primary key,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  comunidad_id bigint not null references public.comunidades(id) on delete cascade,
  nota text,
  start_at timestamptz not null default now(),
  end_at timestamptz,
  duration_seconds int,
  is_manual boolean not null default false,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists task_timers_user_idx on public.task_timers(user_id);
create index if not exists task_timers_comunidad_idx on public.task_timers(comunidad_id);
create index if not exists task_timers_start_idx on public.task_timers(start_at desc);

-- RLS
alter table public.task_timers enable row level security;

drop policy if exists "task_timers: read own or admin" on public.task_timers;
drop policy if exists "task_timers: read all authenticated" on public.task_timers;
create policy "task_timers: read all authenticated"
on public.task_timers for select
to authenticated
using (true);

drop policy if exists "task_timers: insert own" on public.task_timers;
create policy "task_timers: insert own"
on public.task_timers for insert
to authenticated
with check (public.is_active_employee() and user_id = auth.uid());

drop policy if exists "task_timers: update own or admin" on public.task_timers;
create policy "task_timers: update own or admin"
on public.task_timers for update
to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "task_timers: delete admin" on public.task_timers;
create policy "task_timers: delete admin"
on public.task_timers for delete
to authenticated
using (public.is_admin());

-- =========================================
-- RPCs
-- =========================================

-- start_task_timer: opens a new timer for the current user (enforces 1 open per user)
create or replace function public.start_task_timer(
  _comunidad_id bigint,
  _nota text default null
)
returns public.task_timers
language plpgsql
security definer
set search_path = public
as $$
declare
  _open_task public.task_timers;
  _new_task public.task_timers;
begin
  -- Check for an already open task
  select * into _open_task
  from public.task_timers
  where user_id = auth.uid()
    and end_at is null
  limit 1;

  if found then
    raise exception 'Ya tienes una tarea en curso. Párala antes de iniciar una nueva.';
  end if;

  insert into public.task_timers (user_id, comunidad_id, nota, start_at, is_manual)
  values (auth.uid(), _comunidad_id, _nota, now(), false)
  returning * into _new_task;

  return _new_task;
end;
$$;

-- stop_task_timer: closes the current open timer and calculates duration
create or replace function public.stop_task_timer()
returns public.task_timers
language plpgsql
security definer
set search_path = public
as $$
declare
  _task public.task_timers;
begin
  update public.task_timers
  set
    end_at = now(),
    duration_seconds = extract(epoch from (now() - start_at))::int
  where user_id = auth.uid()
    and end_at is null
  returning * into _task;

  if not found then
    raise exception 'No hay ninguna tarea activa que parar.';
  end if;

  return _task;
end;
$$;
