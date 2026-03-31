-- =============================================
-- MIGRACIÓN COMPLETA - Panel Maria Jose Martos de Dios
-- Ejecutar en Supabase SQL Editor (en orden)
-- =============================================

-- =========================================
-- 0) EXTENSIONS
-- =========================================
create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- =========================================
-- 1) CUSTOM TYPES (ENUMS)
-- =========================================
do $$ begin
  create type public.user_role as enum ('admin', 'empleado', 'gestor');
exception
  when duplicate_object then null;
end $$;

-- =========================================
-- 2) TABLES (ordenadas por dependencias)
-- =========================================

-- 2.1 Profiles
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  apellido text,
  telefono text,
  email text,
  rol public.user_role not null default 'empleado',
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  avatar_url text
);

-- 2.2 Comunidades
create table if not exists public.comunidades (
  id bigserial primary key,
  codigo text unique not null,
  tipo text not null default 'comunidad de propietarios',
  nombre_cdad text not null,
  direccion text,
  cp text,
  ciudad text,
  provincia text,
  cif text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2.3 Empleado <-> Comunidad
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
  quien_lo_recibe uuid references public.profiles(user_id),
  telefono text,
  nombre_cliente text,
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
  todas_notas_propietario text,
  adjuntos text[],
  resuelto_por uuid references public.profiles(user_id),
  aviso text,
  id_email_gestion text,
  estado text default 'Pendiente' check (estado in ('Pendiente','Resuelto','Aplazado','Cancelado')),
  fecha_recordatorio timestamptz,
  source text check (source in ('Llamada','Presencial','Email','Whatsapp','App 360','Acuerdo Junta')),
  motivo_ticket text
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
  importe numeric not null,
  observaciones text,
  estado text default 'Pendiente' check (estado in ('Pendiente','Pagado','En disputa')),
  fecha_pago timestamptz,
  gestor uuid references public.profiles(user_id),
  aviso text,
  created_at timestamptz not null default now(),
  documento text,
  resuelto_por uuid references public.profiles(user_id),
  fecha_resuelto timestamptz,
  id_email_deuda text,
  ref text
);

create index if not exists morosidad_comunidad_idx on public.morosidad(comunidad_id);
create index if not exists morosidad_estado_idx on public.morosidad(estado);
create index if not exists morosidad_created_at_idx on public.morosidad(created_at);

-- 2.6 Activity Logs
create table if not exists public.activity_logs (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null,
  user_name text,
  action text not null,
  entity_type text not null,
  entity_id bigint,
  entity_name text,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_logs_user on public.activity_logs(user_id);
create index if not exists idx_activity_logs_entity on public.activity_logs(entity_type, entity_id);
create index if not exists idx_activity_logs_created on public.activity_logs(created_at desc);
create index if not exists idx_activity_logs_action on public.activity_logs(action);

-- 2.7 Task Timers (cronometraje)
create table if not exists public.task_timers (
  id bigserial primary key,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  comunidad_id bigint references public.comunidades(id) on delete cascade,
  nota text,
  start_at timestamptz not null default now(),
  end_at timestamptz,
  duration_seconds int,
  is_manual boolean not null default false,
  created_at timestamptz not null default now(),
  tipo_tarea text
);

create index if not exists task_timers_user_idx on public.task_timers(user_id);
create index if not exists task_timers_comunidad_idx on public.task_timers(comunidad_id);
create index if not exists task_timers_start_idx on public.task_timers(start_at desc);

-- 2.8 Time Entries (fichaje)
create table if not exists public.time_entries (
  id bigserial primary key,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  start_at timestamptz not null default now(),
  end_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists time_entries_user_idx on public.time_entries(user_id);

-- 2.9 Fichaje Settings
create table if not exists public.fichaje_settings (
  id integer not null default 1 check (id = 1) primary key,
  auto_close_enabled boolean not null default true,
  max_hours_duration integer not null default 12,
  max_minutes_duration integer not null default 0,
  updated_at timestamptz default now(),
  daily_execution_hour integer default 17
);

-- Insertar configuración por defecto
insert into public.fichaje_settings (id) values (1) on conflict (id) do nothing;

-- 2.10 Proveedores
create table if not exists public.proveedores (
  id serial primary key,
  nombre text not null,
  telefono text,
  email text,
  cif text,
  direccion text,
  cp text,
  ciudad text,
  provincia text,
  activo boolean default true,
  created_at timestamptz not null default timezone('utc', now()),
  servicio text
);

-- 2.11 Notifications
create table if not exists public.notifications (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  entity_type text,
  entity_id bigint,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications(user_id);
create index if not exists notifications_read_idx on public.notifications(is_read);

-- 2.12 Record Messages (timeline/chat por entidad)
create table if not exists public.record_messages (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default timezone('utc', now()),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  entity_type text not null,
  entity_id bigint not null,
  content text not null
);

create index if not exists record_messages_entity_idx on public.record_messages(entity_type, entity_id);

-- 2.13 Document Submissions
create table if not exists public.doc_submissions (
  id bigserial primary key,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  doc_key text not null,
  title text not null,
  payload jsonb not null,
  pdf_path text not null,
  created_at timestamptz not null default now(),
  invoice_number text
);

-- 2.14 Document Settings
create table if not exists public.document_settings (
  id bigserial primary key,
  doc_key text not null,
  setting_key text not null,
  setting_value text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

-- 2.15 Invoice Sequences
create table if not exists public.invoice_sequences (
  id text not null primary key,
  current_value bigint not null default 0,
  updated_at timestamptz not null default now()
);

-- 2.16 Email Reports
create table if not exists public.email_reports (
  id uuid not null default gen_random_uuid() primary key,
  community_id text not null,
  community_name text not null,
  title text not null,
  period_start date not null,
  period_end date not null,
  pdf_path text not null,
  emails_count integer not null,
  created_at timestamptz not null default now()
);

-- 2.17 Vacation Policies
create table if not exists public.vacation_policies (
  id uuid not null default gen_random_uuid() primary key,
  name text not null,
  max_approved_per_day integer not null default 1,
  count_holidays boolean not null default false,
  count_weekends boolean not null default false,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

-- 2.18 Vacation Balances
create table if not exists public.vacation_balances (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  year integer not null,
  vacaciones_total integer not null default 22,
  vacaciones_usados integer not null default 0,
  retribuidos_total integer not null default 4,
  retribuidos_usados integer not null default 0,
  no_retribuidos_total integer not null default 0,
  no_retribuidos_usados integer not null default 0,
  created_at timestamptz not null default now()
);

-- 2.19 Vacation Requests
create table if not exists public.vacation_requests (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('VACACIONES','RETRIBUIDO','NO_RETRIBUIDO')),
  date_from date not null,
  date_to date not null,
  days_count numeric not null,
  status text not null default 'PENDIENTE' check (status in ('PENDIENTE','APROBADA','RECHAZADA','CANCELADA','MODIFICADA')),
  admin_id uuid references auth.users(id),
  comment_user text,
  comment_admin text,
  replaces_id uuid references public.vacation_requests(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2.20 Blocked Dates
create table if not exists public.blocked_dates (
  id uuid not null default gen_random_uuid() primary key,
  date_from date not null,
  date_to date not null,
  reason text,
  scope text not null default 'global',
  type_restriction text not null default 'all',
  created_at timestamptz not null default now()
);

-- 2.21 Incidencias Serincobot (Sofia Bot)
create table if not exists public.incidencias_serincobot (
  id bigserial primary key,
  comunidad_id bigint references public.comunidades(id) on delete set null,
  quien_lo_recibe uuid references public.profiles(user_id),
  telefono text,
  nombre_cliente text,
  email text,
  mensaje text,
  gestor_asignado uuid references public.profiles(user_id),
  sentimiento text,
  urgencia text check (urgencia in ('Baja','Media','Alta')),
  categoria text,
  timestamp timestamptz,
  created_at timestamptz not null default now(),
  resuelto boolean not null default false,
  nota_gestor text,
  nota_propietario text,
  todas_notas_propietario text,
  dia_resuelto timestamptz,
  resuelto_por uuid references public.profiles(user_id),
  adjuntos text[],
  aviso text,
  id_email_gestion text,
  estado text default 'Pendiente' check (estado in ('Pendiente','Resuelto','Aplazado','Cancelado')),
  fecha_recordatorio timestamptz,
  comunidad text,
  codigo text
);

create index if not exists incidencias_serincobot_resuelto_idx on public.incidencias_serincobot(resuelto);
create index if not exists incidencias_serincobot_created_at_idx on public.incidencias_serincobot(created_at);

-- 2.22 Propietarios (Sofia Bot)
create table if not exists public.propietarios (
  id bigserial primary key,
  id_comunidad bigint references public.comunidades(id) on delete set null,
  codigo_comunidad text,
  comunidad text,
  nombre_cliente text,
  apellid_cliente text,
  direccion_postal text,
  mail text,
  telefono text,
  contestacion boolean,
  created_at timestamptz not null default now()
);

create index if not exists propietarios_comunidad_idx on public.propietarios(id_comunidad);

-- 2.23 Chat Temporal (mensajes WhatsApp vía n8n)
create table if not exists public.chat_temporal (
  id bigserial primary key,
  session_id text not null,
  message jsonb not null,
  sender text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chat_temporal_session_idx on public.chat_temporal(session_id);
create index if not exists chat_temporal_created_at_idx on public.chat_temporal(created_at desc);

-- 2.24 Chat Temporal AI (contexto IA vía n8n)
create table if not exists public.n8n_chat_temporal_ai (
  id bigserial primary key,
  session_id text not null,
  message jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists n8n_chat_temporal_ai_session_idx on public.n8n_chat_temporal_ai(session_id);

-- 2.25 RAG Comunidades (embeddings pgvector)
create table if not exists public.rag_cdades (
  id bigserial primary key,
  content text not null,
  metadata jsonb,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

create index if not exists rag_cdades_embedding_idx
on public.rag_cdades
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

-- =========================================
-- 3) HELPER FUNCTIONS (para RLS)
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
-- 4) TRIGGER: Auto-crear perfil al registrarse
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =========================================
-- 5) RPC FUNCTIONS (cronometraje)
-- =========================================

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

-- =========================================
-- 5b) RPC FUNCTIONS (fichaje)
-- =========================================

-- Helper: Check if user has open entry
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

-- Clock in (fichar entrada)
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

-- Clock out (fichar salida)
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

-- Admin: cerrar fichaje de otro usuario
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

-- Auto-cierre de fichajes abiertos demasiado tiempo
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
  select auto_close_enabled, max_hours_duration, max_minutes_duration, daily_execution_hour
  into _enabled, _hours, _minutes, _daily_hour
  from public.fichaje_settings
  where id = 1;

  if not _enabled then
    return;
  end if;

  select extract(hour from timezone('Europe/Madrid', now())) into _current_hour;

  if _current_hour != _daily_hour then
    return;
  end if;

  _max_interval := make_interval(hours := _hours, mins := _minutes);

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

-- =========================================
-- 6) ENABLE RLS EN TODAS LAS TABLAS
-- =========================================

alter table public.profiles enable row level security;
alter table public.comunidades enable row level security;
alter table public.empleado_comunidad enable row level security;
alter table public.incidencias enable row level security;
alter table public.morosidad enable row level security;
alter table public.activity_logs enable row level security;
alter table public.task_timers enable row level security;
alter table public.time_entries enable row level security;
alter table public.fichaje_settings enable row level security;
alter table public.proveedores enable row level security;
alter table public.notifications enable row level security;
alter table public.record_messages enable row level security;
alter table public.doc_submissions enable row level security;
alter table public.document_settings enable row level security;
alter table public.invoice_sequences enable row level security;
alter table public.email_reports enable row level security;
alter table public.vacation_policies enable row level security;
alter table public.vacation_balances enable row level security;
alter table public.vacation_requests enable row level security;
alter table public.blocked_dates enable row level security;
alter table public.incidencias_serincobot enable row level security;
alter table public.propietarios enable row level security;
alter table public.chat_temporal enable row level security;
alter table public.n8n_chat_temporal_ai enable row level security;
alter table public.rag_cdades enable row level security;

-- =========================================
-- 7) RLS POLICIES
-- =========================================

-- ---------- INCIDENCIAS_SERINCOBOT (Sofia) ----------
drop policy if exists "incidencias_serincobot: read authenticated" on public.incidencias_serincobot;
create policy "incidencias_serincobot: read authenticated"
on public.incidencias_serincobot for select
to authenticated
using (true);

drop policy if exists "incidencias_serincobot: insert authenticated" on public.incidencias_serincobot;
create policy "incidencias_serincobot: insert authenticated"
on public.incidencias_serincobot for insert
to authenticated
with check (auth.uid() is not null);

drop policy if exists "incidencias_serincobot: update authenticated" on public.incidencias_serincobot;
create policy "incidencias_serincobot: update authenticated"
on public.incidencias_serincobot for update
to authenticated
using (true)
with check (true);

drop policy if exists "incidencias_serincobot: delete admin" on public.incidencias_serincobot;
create policy "incidencias_serincobot: delete admin"
on public.incidencias_serincobot for delete
to authenticated
using (public.is_admin());

-- ---------- PROPIETARIOS (Sofia) ----------
drop policy if exists "propietarios: read authenticated" on public.propietarios;
create policy "propietarios: read authenticated"
on public.propietarios for select
to authenticated
using (true);

drop policy if exists "propietarios: insert authenticated" on public.propietarios;
create policy "propietarios: insert authenticated"
on public.propietarios for insert
to authenticated
with check (auth.uid() is not null);

drop policy if exists "propietarios: update authenticated" on public.propietarios;
create policy "propietarios: update authenticated"
on public.propietarios for update
to authenticated
using (true)
with check (true);

drop policy if exists "propietarios: delete admin" on public.propietarios;
create policy "propietarios: delete admin"
on public.propietarios for delete
to authenticated
using (public.is_admin());

-- ---------- PROFILES ----------
drop policy if exists "profiles: read own or admin" on public.profiles;
create policy "profiles: read own or admin"
on public.profiles for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "profiles: update own or admin" on public.profiles;
create policy "profiles: update own or admin"
on public.profiles for update
to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "profiles: insert admin" on public.profiles;
create policy "profiles: insert admin"
on public.profiles for insert
to authenticated
with check (public.is_admin());

drop policy if exists "profiles: delete admin" on public.profiles;
create policy "profiles: delete admin"
on public.profiles for delete
to authenticated
using (public.is_admin());

-- ---------- COMUNIDADES ----------
drop policy if exists "comunidades: read all authenticated" on public.comunidades;
create policy "comunidades: read all authenticated"
on public.comunidades for select
to authenticated
using (true);

drop policy if exists "comunidades: admin insert" on public.comunidades;
create policy "comunidades: admin insert"
on public.comunidades for insert
to authenticated
with check (public.is_admin());

drop policy if exists "comunidades: admin update" on public.comunidades;
drop policy if exists "comunidades: gestor update" on public.comunidades;
create policy "comunidades: gestor update"
on public.comunidades for update
to authenticated
using (
  (select rol from public.profiles where user_id = auth.uid()) in ('gestor', 'admin')
)
with check (
  (select rol from public.profiles where user_id = auth.uid()) in ('gestor', 'admin')
);

drop policy if exists "comunidades: admin delete" on public.comunidades;
create policy "comunidades: admin delete"
on public.comunidades for delete
to authenticated
using (public.is_admin());

-- ---------- EMPLEADO_COMUNIDAD ----------
drop policy if exists "empleado_comunidad: admin all" on public.empleado_comunidad;
create policy "empleado_comunidad: admin all"
on public.empleado_comunidad for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "empleado_comunidad: read own" on public.empleado_comunidad;
create policy "empleado_comunidad: read own"
on public.empleado_comunidad for select
to authenticated
using (public.is_admin() or user_id = auth.uid());

-- ---------- INCIDENCIAS ----------
drop policy if exists "incidencias: read by comunidad" on public.incidencias;
create policy "incidencias: read by comunidad"
on public.incidencias for select
to authenticated
using (public.has_comunidad(comunidad_id));

drop policy if exists "incidencias: insert by comunidad" on public.incidencias;
create policy "incidencias: insert by comunidad"
on public.incidencias for insert
to authenticated
with check (public.is_active_employee() and public.has_comunidad(comunidad_id));

drop policy if exists "incidencias: update by comunidad" on public.incidencias;
create policy "incidencias: update by comunidad"
on public.incidencias for update
to authenticated
using (public.is_active_employee() and public.has_comunidad(comunidad_id))
with check (public.is_active_employee() and public.has_comunidad(comunidad_id));

drop policy if exists "incidencias: delete admin" on public.incidencias;
create policy "incidencias: delete admin"
on public.incidencias for delete
to authenticated
using (public.is_admin());

-- ---------- MOROSIDAD ----------
drop policy if exists "morosidad: read by comunidad" on public.morosidad;
create policy "morosidad: read by comunidad"
on public.morosidad for select
to authenticated
using (public.has_comunidad(comunidad_id));

drop policy if exists "morosidad: insert by comunidad" on public.morosidad;
create policy "morosidad: insert by comunidad"
on public.morosidad for insert
to authenticated
with check (public.is_active_employee() and public.has_comunidad(comunidad_id));

drop policy if exists "morosidad: update by comunidad" on public.morosidad;
create policy "morosidad: update by comunidad"
on public.morosidad for update
to authenticated
using (public.is_active_employee() and public.has_comunidad(comunidad_id))
with check (public.is_active_employee() and public.has_comunidad(comunidad_id));

drop policy if exists "morosidad: delete admin" on public.morosidad;
create policy "morosidad: delete admin"
on public.morosidad for delete
to authenticated
using (public.is_admin());

-- ---------- ACTIVITY_LOGS ----------
drop policy if exists "activity_logs: read admin" on public.activity_logs;
create policy "activity_logs: read admin"
on public.activity_logs for select
to authenticated
using (public.is_admin());

drop policy if exists "activity_logs: insert authenticated" on public.activity_logs;
create policy "activity_logs: insert authenticated"
on public.activity_logs for insert
to authenticated
with check (auth.uid() is not null);

-- ---------- TASK_TIMERS ----------
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

-- ---------- TIME_ENTRIES ----------
drop policy if exists "time_entries: read own or admin" on public.time_entries;
create policy "time_entries: read own or admin"
on public.time_entries for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "time_entries: insert own" on public.time_entries;
create policy "time_entries: insert own"
on public.time_entries for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "time_entries: update own or admin" on public.time_entries;
create policy "time_entries: update own or admin"
on public.time_entries for update
to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "time_entries: delete admin" on public.time_entries;
create policy "time_entries: delete admin"
on public.time_entries for delete
to authenticated
using (public.is_admin());

-- ---------- FICHAJE_SETTINGS ----------
drop policy if exists "fichaje_settings: read authenticated" on public.fichaje_settings;
create policy "fichaje_settings: read authenticated"
on public.fichaje_settings for select
to authenticated
using (true);

drop policy if exists "fichaje_settings: update admin" on public.fichaje_settings;
create policy "fichaje_settings: update admin"
on public.fichaje_settings for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ---------- PROVEEDORES ----------
drop policy if exists "proveedores: read authenticated" on public.proveedores;
create policy "proveedores: read authenticated"
on public.proveedores for select
to authenticated
using (true);

drop policy if exists "proveedores: admin insert" on public.proveedores;
create policy "proveedores: admin insert"
on public.proveedores for insert
to authenticated
with check (public.is_admin());

drop policy if exists "proveedores: admin update" on public.proveedores;
create policy "proveedores: admin update"
on public.proveedores for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "proveedores: admin delete" on public.proveedores;
create policy "proveedores: admin delete"
on public.proveedores for delete
to authenticated
using (public.is_admin());

-- ---------- NOTIFICATIONS ----------
drop policy if exists "notifications: read own" on public.notifications;
create policy "notifications: read own"
on public.notifications for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "notifications: insert authenticated" on public.notifications;
create policy "notifications: insert authenticated"
on public.notifications for insert
to authenticated
with check (auth.uid() is not null);

drop policy if exists "notifications: update own" on public.notifications;
create policy "notifications: update own"
on public.notifications for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "notifications: delete own" on public.notifications;
create policy "notifications: delete own"
on public.notifications for delete
to authenticated
using (user_id = auth.uid());

-- ---------- RECORD_MESSAGES ----------
drop policy if exists "record_messages: read authenticated" on public.record_messages;
create policy "record_messages: read authenticated"
on public.record_messages for select
to authenticated
using (true);

drop policy if exists "record_messages: insert authenticated" on public.record_messages;
create policy "record_messages: insert authenticated"
on public.record_messages for insert
to authenticated
with check (user_id = auth.uid());

-- ---------- DOC_SUBMISSIONS ----------
drop policy if exists "doc_submissions: read own or admin" on public.doc_submissions;
create policy "doc_submissions: read own or admin"
on public.doc_submissions for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "doc_submissions: insert own" on public.doc_submissions;
create policy "doc_submissions: insert own"
on public.doc_submissions for insert
to authenticated
with check (user_id = auth.uid());

-- ---------- DOCUMENT_SETTINGS ----------
drop policy if exists "document_settings: read authenticated" on public.document_settings;
create policy "document_settings: read authenticated"
on public.document_settings for select
to authenticated
using (true);

drop policy if exists "document_settings: admin update" on public.document_settings;
create policy "document_settings: admin update"
on public.document_settings for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "document_settings: admin insert" on public.document_settings;
create policy "document_settings: admin insert"
on public.document_settings for insert
to authenticated
with check (public.is_admin());

-- ---------- INVOICE_SEQUENCES ----------
drop policy if exists "invoice_sequences: read authenticated" on public.invoice_sequences;
create policy "invoice_sequences: read authenticated"
on public.invoice_sequences for select
to authenticated
using (true);

drop policy if exists "invoice_sequences: insert authenticated" on public.invoice_sequences;
create policy "invoice_sequences: insert authenticated"
on public.invoice_sequences for insert
to authenticated
with check (auth.uid() is not null);

drop policy if exists "invoice_sequences: update authenticated" on public.invoice_sequences;
create policy "invoice_sequences: update authenticated"
on public.invoice_sequences for update
to authenticated
using (true)
with check (true);

-- ---------- EMAIL_REPORTS ----------
drop policy if exists "email_reports: read authenticated" on public.email_reports;
create policy "email_reports: read authenticated"
on public.email_reports for select
to authenticated
using (true);

drop policy if exists "email_reports: insert authenticated" on public.email_reports;
create policy "email_reports: insert authenticated"
on public.email_reports for insert
to authenticated
with check (auth.uid() is not null);

-- ---------- VACATION_POLICIES ----------
drop policy if exists "vacation_policies: read authenticated" on public.vacation_policies;
create policy "vacation_policies: read authenticated"
on public.vacation_policies for select
to authenticated
using (true);

drop policy if exists "vacation_policies: admin manage" on public.vacation_policies;
create policy "vacation_policies: admin manage"
on public.vacation_policies for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ---------- VACATION_BALANCES ----------
drop policy if exists "vacation_balances: read own or admin" on public.vacation_balances;
create policy "vacation_balances: read own or admin"
on public.vacation_balances for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "vacation_balances: admin manage" on public.vacation_balances;
create policy "vacation_balances: admin manage"
on public.vacation_balances for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ---------- VACATION_REQUESTS ----------
drop policy if exists "vacation_requests: read own or admin" on public.vacation_requests;
create policy "vacation_requests: read own or admin"
on public.vacation_requests for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "vacation_requests: insert own" on public.vacation_requests;
create policy "vacation_requests: insert own"
on public.vacation_requests for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "vacation_requests: update own or admin" on public.vacation_requests;
create policy "vacation_requests: update own or admin"
on public.vacation_requests for update
to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

-- ---------- BLOCKED_DATES ----------
drop policy if exists "blocked_dates: read authenticated" on public.blocked_dates;
create policy "blocked_dates: read authenticated"
on public.blocked_dates for select
to authenticated
using (true);

drop policy if exists "blocked_dates: admin manage" on public.blocked_dates;
create policy "blocked_dates: admin manage"
on public.blocked_dates for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ---------- CHAT_TEMPORAL (n8n inserta con service_role) ----------
drop policy if exists "chat_temporal: read authenticated" on public.chat_temporal;
create policy "chat_temporal: read authenticated"
on public.chat_temporal for select
to authenticated
using (true);

drop policy if exists "chat_temporal: delete admin" on public.chat_temporal;
create policy "chat_temporal: delete admin"
on public.chat_temporal for delete
to authenticated
using (public.is_admin());

-- ---------- N8N_CHAT_TEMPORAL_AI (n8n inserta con service_role) ----------
drop policy if exists "n8n_chat_temporal_ai: read authenticated" on public.n8n_chat_temporal_ai;
create policy "n8n_chat_temporal_ai: read authenticated"
on public.n8n_chat_temporal_ai for select
to authenticated
using (true);

drop policy if exists "n8n_chat_temporal_ai: delete admin" on public.n8n_chat_temporal_ai;
create policy "n8n_chat_temporal_ai: delete admin"
on public.n8n_chat_temporal_ai for delete
to authenticated
using (public.is_admin());

-- ---------- RAG_CDADES (n8n inserta con service_role) ----------
drop policy if exists "rag_cdades: read authenticated" on public.rag_cdades;
create policy "rag_cdades: read authenticated"
on public.rag_cdades for select
to authenticated
using (true);

drop policy if exists "rag_cdades: delete admin" on public.rag_cdades;
create policy "rag_cdades: delete admin"
on public.rag_cdades for delete
to authenticated
using (public.is_admin());

-- =========================================
-- 8) STORAGE BUCKETS (ejecutar por separado si es necesario)
-- =========================================
-- Necesitas crear estos buckets en Supabase Storage:
--   - doc-assets      (para logos/assets de documentos)
--   - incidencias     (para adjuntos de incidencias)
--   - morosidad       (para documentos de deudas)
--   - facturas        (para facturas de comunidades)
--   - email-reports   (para informes de email en PDF)

-- =========================================
-- 9) COMPANY SETTINGS (emisor, logo, firma)
-- =========================================

create table if not exists public.company_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null unique,
  setting_value text not null default '',
  updated_at timestamptz default now()
);

alter table public.company_settings enable row level security;

-- Cualquier usuario autenticado puede leer (los PDFs lo necesitan desde el servidor)
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'company_settings'
    and policyname = 'Authenticated can read company_settings'
  ) then
    create policy "Authenticated can read company_settings"
      on public.company_settings for select
      to authenticated
      using (true);
  end if;
end $$;

-- Seed inicial con los valores de producción
insert into public.company_settings (setting_key, setting_value) values
  ('emisor_name',    'SERINCOSOL S.L.'),
  ('emisor_address', 'Pasaje Pezuela 1, 1º A Dcha'),
  ('emisor_city',    '29010 Málaga'),
  ('emisor_cif',     'B09915075'),
  ('logo_path',      ''),
  ('firma_path',     '')
on conflict (setting_key) do nothing;

-- =========================================
-- FIN DE LA MIGRACIÓN
-- =========================================
