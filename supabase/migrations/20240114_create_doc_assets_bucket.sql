-- Create the private bucket for document assets
insert into storage.buckets (id, name, public)
values ('doc-assets', 'doc-assets', false)
on conflict (id) do nothing;

-- Enable RLS
alter table storage.objects enable row level security;

-- Policy: Allow authenticated users to read (download) assets
create policy "doc-assets read authenticated"
on storage.objects for select
to authenticated
using (bucket_id = 'doc-assets');

-- Policy: Optional - Allow admins to upload (insert/update/delete)
-- Assuming you have an 'admin' role or check in profiles.
-- For now, we'll leave upload to the Supabase Dashboard (service role) or manual.
