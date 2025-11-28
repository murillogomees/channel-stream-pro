-- Drop existing policy and recreate with anon access
DROP POLICY IF EXISTS "Anyone can read content metadata" ON public.content_metadata;

-- Allow anyone (including anon) to read content metadata - it's public TMDB data
CREATE POLICY "Anyone can read content metadata"
ON public.content_metadata
FOR SELECT
TO anon, authenticated
USING (true);