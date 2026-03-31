-- Drop the restrictive policy
DROP POLICY IF EXISTS "profiles: read own or admin" ON public.profiles;

-- Create a new policy allowing all authenticated users to read names/IDs
-- Needed for referencing user names in Incidents/Morosidad tables
CREATE POLICY "profiles: read all authenticated"
ON public.profiles FOR SELECT
TO authenticated
USING (true);
