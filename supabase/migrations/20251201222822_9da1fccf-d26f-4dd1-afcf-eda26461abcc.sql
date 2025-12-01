-- Final URL fix: correct malformed URLs from previous update
UPDATE r2_storage_objects
SET cdn_url = CONCAT('https://cdn.iptvlink.com.br/', r2_key)
WHERE cdn_url LIKE 'https://vod/%' 
   OR cdn_url NOT LIKE 'https://cdn.iptvlink.com.br/%'
   AND status = 'ready';