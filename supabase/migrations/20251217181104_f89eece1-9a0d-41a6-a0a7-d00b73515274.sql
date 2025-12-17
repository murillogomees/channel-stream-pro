-- Clear all IPTV data for fresh import
TRUNCATE TABLE public.iptv_channel_metrics CASCADE;
TRUNCATE TABLE public.iptv_cdn_cache CASCADE;
TRUNCATE TABLE public.r2_cached_content CASCADE;
TRUNCATE TABLE public.r2_bulk_cache_jobs CASCADE;
TRUNCATE TABLE public.iptv_channels CASCADE;