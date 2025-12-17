-- Add R2 cache columns to iptv_channels
ALTER TABLE public.iptv_channels 
ADD COLUMN IF NOT EXISTS r2_uploaded BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS r2_url TEXT;

-- Index for faster R2 lookups
CREATE INDEX IF NOT EXISTS idx_iptv_channels_r2 ON public.iptv_channels(r2_uploaded) WHERE r2_uploaded = true;