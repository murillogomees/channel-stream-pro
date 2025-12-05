-- Fix cf_stream_uploads RLS
DROP POLICY IF EXISTS "Admins can manage stream uploads" ON cf_stream_uploads;
CREATE POLICY "Admins and masters can manage stream uploads" 
ON cf_stream_uploads FOR ALL 
USING (is_admin_or_master(auth.uid()))
WITH CHECK (is_admin_or_master(auth.uid()));

-- Fix r2_storage_objects RLS
DROP POLICY IF EXISTS "Admins can manage R2 objects" ON r2_storage_objects;
CREATE POLICY "Admins and masters can manage R2 objects" 
ON r2_storage_objects FOR ALL 
USING (is_admin_or_master(auth.uid()))
WITH CHECK (is_admin_or_master(auth.uid()));

-- Fix vod_downloads RLS
DROP POLICY IF EXISTS "Admins full access vod_downloads" ON vod_downloads;
CREATE POLICY "Admins and masters full access vod_downloads" 
ON vod_downloads FOR ALL 
USING (is_admin_or_master(auth.uid()))
WITH CHECK (is_admin_or_master(auth.uid()));