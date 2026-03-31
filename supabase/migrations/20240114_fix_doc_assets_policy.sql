-- Policy: Allow authenticated users to read (download) assets
-- Run this in your SQL Editor to allow the API to fetch the logo/seal
create policy "doc-assets read authenticated"
on storage.objects for select
to authenticated
using (bucket_id = 'doc-assets');
