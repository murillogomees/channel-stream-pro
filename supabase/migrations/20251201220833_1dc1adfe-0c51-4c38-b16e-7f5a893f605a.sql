-- Fix RLS policies for m3u_sync_sources table
-- The issue is that auth.role() = 'authenticated' may not work reliably
-- We'll use auth.uid() IS NOT NULL which is more reliable for authenticated users

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can view sync sources" ON m3u_sync_sources;
DROP POLICY IF EXISTS "Admins can manage sync sources" ON m3u_sync_sources;

-- Recreate SELECT policy with more reliable check
CREATE POLICY "Authenticated users can view sync sources" 
ON m3u_sync_sources FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Recreate admin policies for write operations
CREATE POLICY "Admins can insert sync sources" 
ON m3u_sync_sources FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update sync sources" 
ON m3u_sync_sources FOR UPDATE
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete sync sources" 
ON m3u_sync_sources FOR DELETE
USING (public.is_admin(auth.uid()));