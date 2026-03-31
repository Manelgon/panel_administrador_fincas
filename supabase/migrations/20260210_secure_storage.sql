-- 1. Secure 'documentos' bucket
UPDATE storage.buckets
SET public = false
WHERE id = 'documentos';

-- 2. Policies for 'documentos' bucket

-- Allow all authenticated users to read folders/files
DROP POLICY IF EXISTS "Authenticated users can read documents" ON storage.objects;
CREATE POLICY "Authenticated users can read documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'documentos');

-- Allow authenticated users to upload
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
CREATE POLICY "Authenticated users can upload documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documentos');

-- Allow update/delete ONLY for owners (profiles.user_id matching owner) or admins
-- Note: storage.objects has an 'owner' column which is usually auth.uid()
DROP POLICY IF EXISTS "Owners or admins can update/delete documents" ON storage.objects;
CREATE POLICY "Owners or admins can update/delete documents"
ON storage.objects FOR ALL
TO authenticated
USING (
    bucket_id = 'documentos' AND 
    (auth.uid() = owner OR public.is_admin())
)
WITH CHECK (
    bucket_id = 'documentos' AND 
    (auth.uid() = owner OR public.is_admin())
);

-- Remove public read access if it existed
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
