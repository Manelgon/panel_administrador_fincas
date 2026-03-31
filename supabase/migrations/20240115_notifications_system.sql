-- 1. Create table for notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null, -- 'incidencia_assigned', etc.
  title text not null,
  body text,
  entity_type text,   -- 'incidencias'
  entity_id bigint,   -- incidencias.id
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- 2. Create Indexes
create index if not exists notifications_user_created_idx
on public.notifications(user_id, created_at desc);

create index if not exists notifications_user_unread_idx
on public.notifications(user_id, is_read);

-- 3. RLS
alter table public.notifications enable row level security;

-- User sees only their own notifications
create policy "notifications select own"
on public.notifications for select
to authenticated
using (auth.uid() = user_id);

-- User can update (mark as read) only their own
create policy "notifications update own"
on public.notifications for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- 4. Ensure Incidencias has assigned_user_id (Step A)
-- NOTE: user already confirmed gestor_asignado exists and is uuid linked to profiles.
-- However, we double check if we need to alias it or just use it. 
-- The user request mentioned: "cuando se le asigne una incidencia a ese usuario"
-- And the plan says: "Clave: detectar cambio en gestor_asignado".
-- We will use `gestor_asignado` as the source field.

-- 5. Trigger Function
create or replace function public.notify_incidencia_assigned()
returns trigger as $$
begin
  -- Trigger when gestor_asignado changes and is not null
  -- Also check if it's different from the old value (or if it's a new insert with a value)
  if (new.gestor_asignado is not null) and 
     (tg_op = 'INSERT' or old.gestor_asignado is distinct from new.gestor_asignado) then

    insert into public.notifications (user_id, type, title, body, entity_type, entity_id)
    values (
      new.gestor_asignado,
      'incidencia_assigned',
      'Nueva incidencia asignada',
      coalesce(new.mensaje, 'Se te ha asignado una nueva incidencia.'),
      'incidencias',
      new.id
    );
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- 6. Create Trigger
drop trigger if exists trg_notify_incidencia_assigned on public.incidencias;

create trigger trg_notify_incidencia_assigned
after insert or update of gestor_asignado on public.incidencias
for each row
execute function public.notify_incidencia_assigned();
