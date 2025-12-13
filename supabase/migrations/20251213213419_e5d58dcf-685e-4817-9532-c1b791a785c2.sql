-- Update the parse function to handle more patterns including spaces between S01 E01
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
  -- Pattern 1: S01E01, S1E1 (no space)
  v_match := regexp_match(channel_name, '(.+?)\s*[Ss](\d{1,2})\s*[Ee](\d{1,3})\s*[-:.]?\s*(.*)', 'i');
  IF v_match IS NOT NULL THEN
    v_series_name := trim(v_match[1]);
    v_season := v_match[2]::INTEGER;
    v_episode := v_match[3]::INTEGER;
    v_episode_title := trim(v_match[4]);
    v_is_series := true;
  ELSE
    -- Pattern 2: 1x01, 1X01
    v_match := regexp_match(channel_name, '(.+?)\s*(\d{1,2})[xX](\d{1,3})\s*[-:.]?\s*(.*)', 'i');
    IF v_match IS NOT NULL THEN
      v_series_name := trim(v_match[1]);
      v_season := v_match[2]::INTEGER;
      v_episode := v_match[3]::INTEGER;
      v_episode_title := trim(v_match[4]);
      v_is_series := true;
    ELSE
      -- Pattern 3: Temporada X Episodio Y
      v_match := regexp_match(channel_name, '(.+?)\s*[Tt]emporada\s*(\d{1,2}).*[Ee]pis[oó]dio\s*(\d{1,3})\s*[-:.]?\s*(.*)', 'i');
      IF v_match IS NOT NULL THEN
        v_series_name := trim(v_match[1]);
        v_season := v_match[2]::INTEGER;
        v_episode := v_match[3]::INTEGER;
        v_episode_title := trim(v_match[4]);
        v_is_series := true;
      ELSE
        -- Pattern 4: EP01, Ep 01, E01 standalone
        v_match := regexp_match(channel_name, '(.+?)\s*[Ee][Pp]?\s*(\d{1,3})(?:\s|$|-|\.)', 'i');
        IF v_match IS NOT NULL AND length(v_match[1]) > 2 THEN
          v_series_name := trim(v_match[1]);
          v_season := 1;
          v_episode := v_match[2]::INTEGER;
          v_episode_title := '';
          v_is_series := true;
        ELSE
          -- Pattern 5: Detect repeated base names with numbers (e.g., "Anime Name 01", "Anime Name 02")
          v_match := regexp_match(channel_name, '^(.+?)\s+(\d{1,3})$', 'i');
          IF v_match IS NOT NULL AND length(v_match[1]) > 3 THEN
            v_series_name := trim(v_match[1]);
            v_season := 1;
            v_episode := v_match[2]::INTEGER;
            v_episode_title := '';
            v_is_series := true;
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;

  -- Clean series name - remove trailing punctuation
  IF v_series_name IS NOT NULL THEN
    v_series_name := regexp_replace(v_series_name, '[-_.:]+$', '', 'g');
    v_series_name := trim(v_series_name);
  END IF;

  RETURN QUERY SELECT v_series_name, v_season, v_episode, v_episode_title, v_is_series;
END;
$$;

-- Update auto_organize to reset and re-detect with improved patterns
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
  -- Process all channels that haven't been organized yet
  FOR v_channel IN 
    SELECT id, name FROM public.iptv_channels 
    WHERE is_series IS NOT TRUE OR series_name IS NULL
  LOOP
    SELECT * INTO v_parsed FROM public.parse_series_info_from_name(v_channel.name);
    
    IF v_parsed.is_series AND v_parsed.series_name IS NOT NULL AND length(v_parsed.series_name) > 1 THEN
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