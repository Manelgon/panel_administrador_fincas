-- =========================================
-- 0) EXTENSIONS (si no están)
-- =========================================
create extension if not exists "pgcrypto";

-- =========================================
-- 1) TYPES
-- =========================================
do $$ begin
  create type public.user_role as enum ('admin', 'empleado', 'gestor');
exception
  when duplicate_object then null;
end $$;

-- =========================================
-- 2) TABLES
-- =========================================

-- 2.1 Profiles (empleados / usuarios internos)
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  apellido text,
  telefono text,
  email text,
  rol public.user_role not null default 'empleado',
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2.2 Comunidades (TODOS pueden verlas)
create table if not exists public.comunidades (
  id bigserial primary key,
  codigo text unique not null,
  nombre_cdad text not null,
  direccion text,
  cp text,
  ciudad text,
  provincia text,
  cif text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2.3 Asignación empleado <-> comunidad (para permisos)
create table if not exists public.empleado_comunidad (
  id bigserial primary key,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  comunidad_id bigint not null references public.comunidades(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, comunidad_id)
);

create index if not exists empleado_comunidad_user_idx on public.empleado_comunidad(user_id);
create index if not exists empleado_comunidad_comunidad_idx on public.empleado_comunidad(comunidad_id);

-- 2.4 Incidencias
create table if not exists public.incidencias (
  id bigserial primary key,
  comunidad_id bigint not null references public.comunidades(id) on delete cascade,

  quien_lo_recibe text,
  telefono text,
  nombre_cliente text not null,
  email text,
  mensaje text not null,

  gestor_asignado uuid references public.profiles(user_id),
  sentimiento text,
  urgencia text check (urgencia in ('Baja','Media','Alta')),

  categoria text default 'Incidencias',
  created_at timestamptz not null default now(),

  resuelto boolean not null default false,
  nota_gestor text,
  nota_propietario text,
  dia_resuelto timestamptz,
  todas_notas_propietario text
);

create index if not exists incidencias_comunidad_idx on public.incidencias(comunidad_id);
create index if not exists incidencias_resuelto_idx on public.incidencias(resuelto);
create index if not exists incidencias_created_at_idx on public.incidencias(created_at);

-- 2.5 Morosidad
create table if not exists public.morosidad (
  id bigserial primary key,
  comunidad_id bigint not null references public.comunidades(id) on delete cascade,

  nombre_deudor text not null,
  apellidos text,
  telefono_deudor text,
  email_deudor text,

  titulo_documento text not null,
  fecha_notificacion timestamptz,
  importe numeric(10,2) not null,

  observaciones text,
  estado text check (estado in ('Pendiente','Pagado','En disputa')) default 'Pendiente',
  fecha_pago timestamptz,

  gestor uuid references public.profiles(user_id),
  aviso boolean not null default false,

  created_at timestamptz not null default now()
);

create index if not exists morosidad_comunidad_idx on public.morosidad(comunidad_id);
create index if not exists morosidad_estado_idx on public.morosidad(estado);
create index if not exists morosidad_created_at_idx on public.morosidad(created_at);

-- =========================================
-- 3) HELPERS (funciones para RLS)
-- =========================================

create or replace function public.is_admin()
returns boolean
language sql stable as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.rol = 'admin'
      and p.activo = true
  );
$$;

create or replace function public.is_active_employee()
returns boolean
language sql stable as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.activo = true
  );
$$;

create or replace function public.has_comunidad(_comunidad_id bigint)
returns boolean
language sql stable as $$
  select public.is_admin()
  or exists (
    select 1
    from public.empleado_comunidad ec
    join public.profiles p on p.user_id = ec.user_id
    where ec.user_id = auth.uid()
      and ec.comunidad_id = _comunidad_id
      and p.activo = true
  );
$$;

-- =========================================
-- 3.1) TRIGGER: Auto-crear perfil al registrarse
-- =========================================

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

-- Crear trigger si no existe
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =========================================
-- 4) RLS ENABLE
-- =========================================
alter table public.profiles enable row level security;
alter table public.comunidades enable row level security;
alter table public.empleado_comunidad enable row level security;
alter table public.incidencias enable row level security;
alter table public.morosidad enable row level security;

-- =========================================
-- 5) POLICIES
-- =========================================

-- ---------- PROFILES ----------
-- Ver: tu perfil o admin
drop policy if exists "profiles: read own or admin" on public.profiles;
create policy "profiles: read own or admin"
on public.profiles for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

-- Actualizar: tu perfil o admin
drop policy if exists "profiles: update own or admin" on public.profiles;
create policy "profiles: update own or admin"
on public.profiles for update
to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

-- Insertar perfiles: solo admin (normalmente lo harás desde panel)
drop policy if exists "profiles: insert admin" on public.profiles;
create policy "profiles: insert admin"
on public.profiles for insert
to authenticated
with check (public.is_admin());

-- Borrar perfiles: solo admin
drop policy if exists "profiles: delete admin" on public.profiles;
create policy "profiles: delete admin"
on public.profiles for delete
to authenticated
using (public.is_admin());

-- ---------- COMUNIDADES ----------
-- ✅ TODOS pueden ver TODAS las comunidades (si están autenticados)
drop policy if exists "comunidades: read all authenticated" on public.comunidades;
create policy "comunidades: read all authenticated"
on public.comunidades for select
to authenticated
using (true);

-- CRUD comunidades: solo admin
drop policy if exists "comunidades: admin insert" on public.comunidades;
create policy "comunidades: admin insert"
on public.comunidades for insert
to authenticated
with check (public.is_admin());

drop policy if exists "comunidades: admin update" on public.comunidades;
create policy "comunidades: admin update"
on public.comunidades for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "comunidades: admin delete" on public.comunidades;
create policy "comunidades: admin delete"
on public.comunidades for delete
to authenticated
using (public.is_admin());

-- ---------- EMPLEADO_COMUNIDAD ----------
-- Gestionar asignaciones: solo admin
drop policy if exists "empleado_comunidad: admin all" on public.empleado_comunidad;
create policy "empleado_comunidad: admin all"
on public.empleado_comunidad for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- (Opcional) que el empleado pueda ver a qué comunidades está asignado
drop policy if exists "empleado_comunidad: read own" on public.empleado_comunidad;
create policy "empleado_comunidad: read own"
on public.empleado_comunidad for select
to authenticated
using (public.is_admin() or user_id = auth.uid());

-- ---------- INCIDENCIAS ----------
-- Ver incidencias: solo si tienes esa comunidad (o admin)
drop policy if exists "incidencias: read by comunidad" on public.incidencias;
create policy "incidencias: read by comunidad"
on public.incidencias for select
to authenticated
using (public.has_comunidad(comunidad_id));

-- Crear incidencias: solo si tienes esa comunidad (o admin) y usuario activo
drop policy if exists "incidencias: insert by comunidad" on public.incidencias;
create policy "incidencias: insert by comunidad"
on public.incidencias for insert
to authenticated
with check (public.is_active_employee() and public.has_comunidad(comunidad_id));

-- Editar incidencias: solo si tienes esa comunidad (o admin) y usuario activo
drop policy if exists "incidencias: update by comunidad" on public.incidencias;
create policy "incidencias: update by comunidad"
on public.incidencias for update
to authenticated
using (public.is_active_employee() and public.has_comunidad(comunidad_id))
with check (public.is_active_employee() and public.has_comunidad(comunidad_id));

-- Borrar incidencias: solo admin
drop policy if exists "incidencias: delete admin" on public.incidencias;
create policy "incidencias: delete admin"
on public.incidencias for delete
to authenticated
using (public.is_admin());

-- ---------- MOROSIDAD ----------
-- Ver morosidad: solo si tienes esa comunidad (o admin)
drop policy if exists "morosidad: read by comunidad" on public.morosidad;
create policy "morosidad: read by comunidad"
on public.morosidad for select
to authenticated
using (public.has_comunidad(comunidad_id));

-- Crear morosidad: solo si tienes esa comunidad (o admin) y usuario activo
drop policy if exists "morosidad: insert by comunidad" on public.morosidad;
create policy "morosidad: insert by comunidad"
on public.morosidad for insert
to authenticated
with check (public.is_active_employee() and public.has_comunidad(comunidad_id));

-- Editar morosidad: solo si tienes esa comunidad (o admin) y usuario activo
drop policy if exists "morosidad: update by comunidad" on public.morosidad;
create policy "morosidad: update by comunidad"
on public.morosidad for update
to authenticated
using (public.is_active_employee() and public.has_comunidad(comunidad_id))
with check (public.is_active_employee() and public.has_comunidad(comunidad_id));

-- Borrar morosidad: solo admin
drop policy if exists "morosidad: delete admin" on public.morosidad;
create policy "morosidad: delete admin"
on public.morosidad for delete
to authenticated
using (public.is_admin());

-- =========================================
-- 9) ACTIVITY LOGS TABLE
-- =========================================

create table if not exists public.activity_logs (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null,
  user_name text,
  action text not null, -- 'create', 'update', 'delete', 'mark_paid', 'toggle_active'
  entity_type text not null, -- 'comunidad', 'incidencia', 'morosidad'
  entity_id bigint,
  entity_name text,
  details jsonb,
  created_at timestamptz not null default now()
);

-- Indexes for better query performance
create index if not exists idx_activity_logs_user on public.activity_logs(user_id);
create index if not exists idx_activity_logs_entity on public.activity_logs(entity_type, entity_id);
create index if not exists idx_activity_logs_created on public.activity_logs(created_at desc);
create index if not exists idx_activity_logs_action on public.activity_logs(action);

-- RLS for activity logs
alter table public.activity_logs enable row level security;

-- Only admin can view activity logs
create policy "Admin can view all activity logs"
  on public.activity_logs for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.user_id = auth.uid()
        and profiles.rol = 'admin'
        and profiles.activo = true
    )
  );

-- All authenticated users can insert activity logs
create policy "Authenticated users can insert activity logs"
  on public.activity_logs for insert
  with check (auth.uid() is not null);

-- =========================================
-- 10) TASK TIMERS TABLE
-- =========================================

create table if not exists public.task_timers (
  id bigserial primary key,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  comunidad_id bigint not null references public.comunidades(id) on delete cascade,
  nota text,
  start_at timestamptz not null default now(),
  end_at timestamptz,
  duration_seconds int,
  is_manual boolean not null default false,
  created_at timestamptz not null default now(),
  tipo_tarea text,
  incidencia_id bigint references public.incidencias(id) on delete set null
);

create index if not exists task_timers_user_idx on public.task_timers(user_id);
create index if not exists task_timers_comunidad_idx on public.task_timers(comunidad_id);
create index if not exists task_timers_start_idx on public.task_timers(start_at desc);
create index if not exists task_timers_incidencia_idx on public.task_timers(incidencia_id);

alter table public.task_timers enable row level security;

drop policy if exists "task_timers: read own or admin" on public.task_timers;
create policy "task_timers: read own or admin"
on public.task_timers for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

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

-- RPC: start_task_timer
create or replace function public.start_task_timer(
  _comunidad_id bigint,
  _nota text default null,
  _tipo_tarea text default null,
  _incidencia_id bigint default null
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
    user_id, comunidad_id, nota, start_at, is_manual, tipo_tarea, incidencia_id
  )
  values (
    auth.uid(), _comunidad_id, _nota, now(), false, _tipo_tarea, _incidencia_id
  )
  returning * into _new_task;

  return _new_task;
end;
$$;

-- RPC: stop_task_timer
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
