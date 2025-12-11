-- Fix search_path for functions created without it
ALTER FUNCTION public.get_channel_shard(BIGINT) SET search_path = public;

-- Create index for faster slug lookups
CREATE INDEX IF NOT EXISTS idx_iptv_channels_content_type ON public.iptv_channels(content_type);