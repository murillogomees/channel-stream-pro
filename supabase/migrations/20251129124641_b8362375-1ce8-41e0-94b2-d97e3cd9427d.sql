-- Fix duplicated https:// in vod_downloads r2_url
UPDATE vod_downloads 
SET r2_url = REPLACE(r2_url, 'https://https://', 'https://') 
WHERE r2_url LIKE '%https://https://%';

-- Fix duplicated https:// in m3u_channels r2_url
UPDATE m3u_channels 
SET r2_url = REPLACE(r2_url, 'https://https://', 'https://') 
WHERE r2_url LIKE '%https://https://%';