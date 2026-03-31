-- Ensure FACTURAS bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('FACTURAS', 'FACTURAS', false)
ON CONFLICT (id) DO NOTHING;

-- Policy for listing and reading
DROP POLICY IF EXISTS "Authenticated users can read facturas" ON storage.objects;
CREATE POLICY "Authenticated users can read facturas"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'FACTURAS');

-- Policy for direct unsigned read if public was true (fallback)
DROP POLICY IF EXISTS "Public read facturas" ON storage.objects;
CREATE POLICY "Public read facturas"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'FACTURAS');
