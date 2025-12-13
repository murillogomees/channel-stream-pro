-- Add series-related columns to iptv_channels for hierarchical organization
-- Structure: Category > Series Name > Season > Episode

ALTER TABLE public.iptv_channels 
ADD COLUMN IF NOT EXISTS series_name TEXT,
ADD COLUMN IF NOT EXISTS season_number INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS episode_number INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS episode_title TEXT,
ADD COLUMN IF NOT EXISTS is_series BOOLEAN DEFAULT false;

-- Create index for series grouping and ordering
CREATE INDEX IF NOT EXISTS idx_iptv_channels_series ON public.iptv_channels(category, series_name, season_number, episode_number) WHERE is_series = true;

-- Create index for quick series lookup
CREATE INDEX IF NOT EXISTS idx_iptv_channels_series_name ON public.iptv_channels(series_name) WHERE series_name IS NOT NULL;

-- Function to auto-detect and parse series info from channel name
CREATE OR REPLACE FUNCTION public.parse_series_info_from_name(channel_name TEXT)
RETURNS TABLE(
  series_name TEXT,
  season_number INTEGER,
  episode_number INTEGER,
  episode_title TEXT,
  is_series BOOLEAN
)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_series_name TEXT;
  v_season INTEGER := 0;
  v_episode INTEGER := 0;
  v_episode_title TEXT := '';
  v_is_series BOOLEAN := false;
  v_match TEXT[];
BEGIN
  -- Try to match S01E01 pattern
  v_match := regexp_match(channel_name, '(.+?)\s*[Ss](\d{1,2})[Ee](\d{1,3})\s*[-:.]?\s*(.*)', 'i');
  IF v_match IS NOT NULL THEN
    v_series_name := trim(v_match[1]);
    v_season := v_match[2]::INTEGER;
    v_episode := v_match[3]::INTEGER;
    v_episode_title := trim(v_match[4]);
    v_is_series := true;
  ELSE
    -- Try to match 1x01 pattern
    v_match := regexp_match(channel_name, '(.+?)\s*(\d{1,2})[xX](\d{1,3})\s*[-:.]?\s*(.*)', 'i');
    IF v_match IS NOT NULL THEN
      v_series_name := trim(v_match[1]);
      v_season := v_match[2]::INTEGER;
      v_episode := v_match[3]::INTEGER;
      v_episode_title := trim(v_match[4]);
      v_is_series := true;
    ELSE
      -- Try to match Temporada X Episodio Y pattern
      v_match := regexp_match(channel_name, '(.+?)\s*[Tt]emporada\s*(\d{1,2}).*[Ee]pis[oó]dio\s*(\d{1,3})\s*[-:.]?\s*(.*)', 'i');
      IF v_match IS NOT NULL THEN
        v_series_name := trim(v_match[1]);
        v_season := v_match[2]::INTEGER;
        v_episode := v_match[3]::INTEGER;
        v_episode_title := trim(v_match[4]);
        v_is_series := true;
      ELSE
        -- Try to match EP01 pattern (assume season 1)
        v_match := regexp_match(channel_name, '(.+?)\s*[Ee][Pp]\s*(\d{1,3})\s*[-:.]?\s*(.*)', 'i');
        IF v_match IS NOT NULL THEN
          v_series_name := trim(v_match[1]);
          v_season := 1;
          v_episode := v_match[2]::INTEGER;
          v_episode_title := trim(v_match[3]);
          v_is_series := true;
        END IF;
      END IF;
    END IF;
  END IF;

  -- Clean series name
  IF v_series_name IS NOT NULL THEN
    v_series_name := regexp_replace(v_series_name, '[-_.:]+$', '', 'g');
    v_series_name := trim(v_series_name);
  END IF;

  RETURN QUERY SELECT v_series_name, v_season, v_episode, v_episode_title, v_is_series;
END;
$$;

-- Function to auto-organize all channels by detecting series patterns
CREATE OR REPLACE FUNCTION public.auto_organize_series_channels()
RETURNS TABLE(
  organized_count INTEGER,
  series_found INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_organized_count INTEGER := 0;
  v_series_found INTEGER := 0;
  v_channel RECORD;
  v_parsed RECORD;
BEGIN
  FOR v_channel IN 
    SELECT id, name FROM public.iptv_channels 
    WHERE (is_series IS NULL OR is_series = false)
    AND (series_name IS NULL)
  LOOP
    SELECT * INTO v_parsed FROM public.parse_series_info_from_name(v_channel.name);
    
    IF v_parsed.is_series THEN
      UPDATE public.iptv_channels
      SET 
        series_name = v_parsed.series_name,
        season_number = v_parsed.season_number,
        episode_number = v_parsed.episode_number,
        episode_title = v_parsed.episode_title,
        is_series = true,
        updated_at = now()
      WHERE id = v_channel.id;
      
      v_organized_count := v_organized_count + 1;
    END IF;
  END LOOP;

  -- Count unique series
  SELECT COUNT(DISTINCT series_name) INTO v_series_found 
  FROM public.iptv_channels 
  WHERE is_series = true AND series_name IS NOT NULL;

  RETURN QUERY SELECT v_organized_count, v_series_found;
END;
$$;

COMMENT ON COLUMN public.iptv_channels.series_name IS 'Name of the series (for grouping episodes)';
COMMENT ON COLUMN public.iptv_channels.season_number IS 'Season number (0 = not a series or unknown)';
COMMENT ON COLUMN public.iptv_channels.episode_number IS 'Episode number within the season';
COMMENT ON COLUMN public.iptv_channels.episode_title IS 'Title of the specific episode';
COMMENT ON COLUMN public.iptv_channels.is_series IS 'Whether this channel is part of a series';