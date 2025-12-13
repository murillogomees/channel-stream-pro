-- Add unique constraint on cache_key for upsert to work
ALTER TABLE public.iptv_cdn_cache 
ADD CONSTRAINT iptv_cdn_cache_cache_key_unique UNIQUE (cache_key);