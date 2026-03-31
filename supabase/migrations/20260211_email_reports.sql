-- =========================================
-- EMAIL REPORTS MODULE
-- =========================================

-- 1) TABLE: email_reports (history of AI generated reports)
create table if not exists public.email_reports (
  id uuid default gen_random_uuid() primary key,
  community_id text not null,        -- OneDrive/Outlook Folder ID
  community_name text not null,      -- OneDrive/Outlook Folder Name
  title text not null,               -- Report Title
  period_start date not null,
  period_end date not null,
  pdf_path text not null,            -- Storage path in 'documents' bucket
  emails_count integer not null,
  created_at timestamptz not null default now()
);

-- Indexes for performance
create index if not exists email_reports_community_idx on public.email_reports (community_id, created_at desc);
create index if not exists email_reports_created_idx on public.email_reports (created_at desc);

-- =========================================
-- 2) RLS POLICIES
-- =========================================

alter table public.email_reports enable row level security;

-- ✅ Authenticated users can read all reports
drop policy if exists "email_reports: read all authenticated" on public.email_reports;
create policy "email_reports: read all authenticated"
on public.email_reports for select
to authenticated
using (true);

-- ✅ Authenticated users can insert reports
drop policy if exists "email_reports: insert authenticated" on public.email_reports;
create policy "email_reports: insert authenticated"
on public.email_reports for insert
to authenticated
with check (true);

-- ✅ Only admins can delete reports
drop policy if exists "email_reports: delete admin" on public.email_reports;
create policy "email_reports: delete admin"
on public.email_reports for delete
to authenticated
using (public.is_admin());
