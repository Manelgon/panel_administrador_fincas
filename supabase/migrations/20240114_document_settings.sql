-- Tabla flexibles para ajustes de documentos por clave
create table if not exists public.document_settings (
  id bigserial primary key,
  doc_key text not null,                 -- "suplidos"
  setting_key text not null,             -- "precio_1", "precio_2", etc
  setting_value numeric not null,        -- 0.25, 1.40, ...
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),

  unique (doc_key, setting_key)
);

alter table public.document_settings enable row level security;

-- ✅ Todos pueden leer (para rellenar formularios)
drop policy if exists "document_settings read all" on public.document_settings;
create policy "document_settings read all"
on public.document_settings for select
to authenticated
using (true);

-- ✅ Solo admin puede insertar/actualizar/borrar
drop policy if exists "document_settings admin write" on public.document_settings;
create policy "document_settings admin write"
on public.document_settings for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Valores iniciales para Suplidos (precios a 0.00 por defecto)
insert into public.document_settings (doc_key, setting_key, setting_value)
values
  ('suplidos', 'precio_1', 0.00), -- Precio Sobre Normal
  ('suplidos', 'precio_2', 0.00), -- Precio Sobre A5
  ('suplidos', 'precio_3', 0.00), -- Precio Papel Corp
  ('suplidos', 'precio_4', 0.00), -- Precio Etiqueta
  ('suplidos', 'precio_5', 0.00), -- Precio Impresión B/N
  ('suplidos', 'precio_6', 0.00)  -- Precio Franqueo
on conflict (doc_key, setting_key) do nothing;
