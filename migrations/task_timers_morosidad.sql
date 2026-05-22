-- =========================================
-- TASK TIMERS: enlace con morosidad + ampliación de start_task_timer
-- =========================================

-- 1) Nueva columna para vincular un timer con una deuda (morosidad)
alter table public.task_timers
  add column if not exists morosidad_id bigint
    references public.morosidad(id) on delete set null;

create index if not exists task_timers_morosidad_idx
  on public.task_timers(morosidad_id);

-- 2) Ampliar start_task_timer para aceptar morosidad_id.
--    Mantiene compatibilidad: los parámetros nuevos tienen default null.
create or replace function public.start_task_timer(
  _comunidad_id bigint,
  _nota text default null,
  _tipo_tarea text default null,
  _incidencia_id bigint default null,
  _morosidad_id bigint default null
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
  select * into _open_task
  from public.task_timers
  where user_id = auth.uid()
    and end_at is null
  limit 1;

  if found then
    raise exception 'Ya tienes una tarea en curso. Párala antes de iniciar una nueva.';
  end if;

  insert into public.task_timers (
    user_id, comunidad_id, nota, start_at, is_manual, tipo_tarea, incidencia_id, morosidad_id
  )
  values (
    auth.uid(), _comunidad_id, _nota, now(), false, _tipo_tarea, _incidencia_id, _morosidad_id
  )
  returning * into _new_task;

  return _new_task;
end;
$$;
