-- =========================================
-- DOCUMENTOS MODULE
-- =========================================

-- 1) STORAGE BUCKET: documents (private)
-- Create this via Supabase Dashboard -> Storage -> New Bucket
-- Name: documents
-- Public: false (private)
-- Or run via SQL if you have the storage schema access

-- 2) TABLE: doc_submissions (history)
create table if not exists public.doc_submissions (
  id bigserial primary key,
  user_id uuid not null references public.profiles(user_id) on delete cascade,

  doc_key text not null,          -- "suplidos", "honorarios", etc.
  title text not null,            -- "Documento Suplidos"
  payload jsonb not null,

  pdf_path text not null,         -- storage path in documents bucket
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists doc_submissions_created_idx
  on public.doc_submissions (created_at desc);

create index if not exists doc_submissions_doc_idx
  on public.doc_submissions (doc_key, created_at desc);

create index if not exists doc_submissions_user_idx
  on public.doc_submissions (user_id, created_at desc);

-- =========================================
-- 3) RLS POLICIES
-- =========================================

alter table public.doc_submissions enable row level security;

-- ✅ TODOS ven TODO (todos los documentos son visibles para todos los usuarios autenticados)
drop policy if exists "doc_submissions: read all authenticated" on public.doc_submissions;
create policy "doc_submissions: read all authenticated"
on public.doc_submissions for select
to authenticated
using (true);

-- ✅ Cada uno inserta lo suyo (o admin puede insertar para cualquiera)
drop policy if exists "doc_submissions: insert own" on public.doc_submissions;
create policy "doc_submissions: insert own"
on public.doc_submissions for insert
to authenticated
with check (user_id = auth.uid() or public.is_admin());

-- ✅ Borrar: solo admin (opcional, para poder limpiar historial)
drop policy if exists "doc_submissions: delete admin" on public.doc_submissions;
create policy "doc_submissions: delete admin"
on public.doc_submissions for delete
to authenticated
using (public.is_admin());
