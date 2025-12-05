-- Fix R2 bucket name in existing records
UPDATE r2_storage_objects 
SET r2_bucket = 'iptvlink-cdn' 
WHERE r2_bucket = 'iptv-vod';

-- Also update any pending records
UPDATE r2_storage_objects 
SET r2_bucket = 'iptvlink-cdn' 
WHERE r2_bucket IS NULL OR r2_bucket != 'iptvlink-cdn';