-- Fix existing R2 URLs to use public CDN domain instead of storage endpoint

-- Get R2_PUBLIC_DOMAIN value (we'll assume it's configured in secrets)
-- Update all existing cdn_urls that point to r2.cloudflarestorage.com

UPDATE r2_storage_objects
SET cdn_url = CONCAT(
  'https://',
  -- Extract just the path from the storage URL
  SUBSTRING(cdn_url FROM 'r2\.cloudflarestorage\.com/(.+)$')
)
WHERE cdn_url LIKE '%.r2.cloudflarestorage.com/%'
  AND status = 'ready';

-- For safety, if the SUBSTRING fails, we can construct it from r2_key
UPDATE r2_storage_objects
SET cdn_url = CONCAT('https://cdn.iptvlink.com.br/', r2_key)
WHERE (cdn_url IS NULL OR cdn_url LIKE '%.r2.cloudflarestorage.com/%')
  AND status = 'ready';