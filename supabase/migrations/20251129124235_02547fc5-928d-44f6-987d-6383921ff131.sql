-- Fix duplicated https:// in cdn_url
UPDATE m3u_custom_lists 
SET cdn_url = REPLACE(cdn_url, 'https://https://', 'https://') 
WHERE cdn_url LIKE '%https://https://%';

-- Also check and fix m3u_sync_sources if needed
UPDATE m3u_sync_sources 
SET source_url = REPLACE(source_url, 'https://https://', 'https://') 
WHERE source_url LIKE '%https://https://%';