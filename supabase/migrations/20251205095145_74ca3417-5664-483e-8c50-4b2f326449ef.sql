-- Add explicit SELECT policies for r2_storage_objects and vod_downloads
DROP POLICY IF EXISTS "Admins and masters can manage R2 objects" ON r2_storage_objects;
DROP POLICY IF EXISTS "Admins and masters full access vod_downloads" ON vod_downloads;

-- R2 storage objects - separate policies for each operation
CREATE POLICY "r2_storage_objects_select" ON r2_storage_objects
FOR SELECT USING (is_admin_or_master(auth.uid()));

CREATE POLICY "r2_storage_objects_insert" ON r2_storage_objects
FOR INSERT WITH CHECK (is_admin_or_master(auth.uid()));

CREATE POLICY "r2_storage_objects_update" ON r2_storage_objects
FOR UPDATE USING (is_admin_or_master(auth.uid()));

CREATE POLICY "r2_storage_objects_delete" ON r2_storage_objects
FOR DELETE USING (is_admin_or_master(auth.uid()));

-- VOD downloads - separate policies for each operation
CREATE POLICY "vod_downloads_select" ON vod_downloads
FOR SELECT USING (is_admin_or_master(auth.uid()));

CREATE POLICY "vod_downloads_insert" ON vod_downloads
FOR INSERT WITH CHECK (is_admin_or_master(auth.uid()));

CREATE POLICY "vod_downloads_update" ON vod_downloads
FOR UPDATE USING (is_admin_or_master(auth.uid()));

CREATE POLICY "vod_downloads_delete" ON vod_downloads
FOR DELETE USING (is_admin_or_master(auth.uid()));