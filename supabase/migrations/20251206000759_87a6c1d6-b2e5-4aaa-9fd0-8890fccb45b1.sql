-- Remove SmartOne IPTV - use CASCADE to handle dependent objects

-- Drop the view first
DROP VIEW IF EXISTS public.profiles_safe CASCADE;

-- Remove SmartOne columns from profiles table
ALTER TABLE public.profiles 
  DROP COLUMN IF EXISTS mac_smart_one CASCADE,
  DROP COLUMN IF EXISTS smartone_status CASCADE,
  DROP COLUMN IF EXISTS smartone_playlist_id CASCADE,
  DROP COLUMN IF EXISTS smartone_raw_response CASCADE,
  DROP COLUMN IF EXISTS smartone_last_sync_at CASCADE;

-- Remove SmartOne columns from clientes table
ALTER TABLE public.clientes 
  DROP COLUMN IF EXISTS mac_smart_one CASCADE,
  DROP COLUMN IF EXISTS smartone_status CASCADE,
  DROP COLUMN IF EXISTS smartone_playlist_id CASCADE,
  DROP COLUMN IF EXISTS smartone_raw_response CASCADE,
  DROP COLUMN IF EXISTS smartone_last_sync_at CASCADE,
  DROP COLUMN IF EXISTS smartone_error CASCADE;

-- Drop the smartone_status enum type
DROP TYPE IF EXISTS public.smartone_status CASCADE;

-- Remove indexes
DROP INDEX IF EXISTS idx_clientes_mac;