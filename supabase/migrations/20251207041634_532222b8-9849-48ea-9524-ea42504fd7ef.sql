-- Remove unused tables related to transcode, playlists, CF Stream, VOD, storage, and M3U lists

-- Drop transcode tables
DROP TABLE IF EXISTS public.transcode_history CASCADE;
DROP TABLE IF EXISTS public.transcode_jobs CASCADE;

-- Drop CF Stream tables
DROP TABLE IF EXISTS public.cf_stream_uploads CASCADE;

-- Drop M3U ingest tables
DROP TABLE IF EXISTS public.m3u_ingest_jobs CASCADE;
DROP TABLE IF EXISTS public.m3u_ingest_metrics CASCADE;

-- Drop playlist tables
DROP TABLE IF EXISTS public.playlist_entries CASCADE;
DROP TABLE IF EXISTS public.playlists CASCADE;
DROP TABLE IF EXISTS public.archives CASCADE;

-- Drop VOD tables
DROP TABLE IF EXISTS public.vod_downloads CASCADE;

-- Drop M3U lists tables (no longer needed - using m3u_sync_entries for all)
DROP TABLE IF EXISTS public.client_m3u_lists CASCADE;
DROP TABLE IF EXISTS public.m3u_lists CASCADE;

-- Drop storage tables
DROP TABLE IF EXISTS public.storage_monthly_stats CASCADE;
DROP TABLE IF EXISTS public.r2_storage_objects CASCADE;

-- Drop conversion metrics table
DROP TABLE IF EXISTS public.conversion_metrics CASCADE;