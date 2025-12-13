
-- Drop and recreate the function with improved logic
-- Channels with S##/E## patterns should ALWAYS be detected as series
CREATE OR REPLACE FUNCTION public.auto_organize_series_channels()
RETURNS TABLE(organized_count INTEGER, series_found INTEGER) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_organized_count INTEGER := 0;
  v_series_found INTEGER := 0;
  v_channel RECORD;
  v_parsed RECORD;
  v_new_name TEXT;
  v_has_series_pattern BOOLEAN;
BEGIN
  -- Process channels in batches
  -- Only exclude categories that are DEFINITELY not series (movies, live TV, adult)
  FOR v_channel IN 
    SELECT id, name, category 
    FROM public.iptv_channels 
    WHERE (is_series IS NOT TRUE OR series_name IS NULL)
      -- Exclude only definitively non-series categories
      AND (category IS NULL OR NOT (
        -- Movie categories
        category ILIKE '%filme%' OR 
        category ILIKE '%filmes%' OR 
        category ILIKE '%movie%' OR 
        category ILIKE '%movies%' OR
        category ILIKE '%film %' OR
        category ILIKE '% film' OR
        category ILIKE '%cinema%' OR
        category ILIKE '%lançamento%' OR
        category ILIKE '%lancamento%' OR
        -- Live TV categories (channels that are definitely live broadcasts)
        category ILIKE '%aberto%' OR
        category ILIKE '%24 h%' OR
        category ILIKE '%24h%' OR
        category ILIKE '%canais%' OR
        category ILIKE '%canal %' OR
        category ILIKE '% canal' OR
        category ILIKE '%ao vivo%' OR
        category ILIKE '%aovivo%' OR
        category ILIKE '%live%' OR
        category ILIKE '%esporte%' OR
        category ILIKE '%sport%' OR
        category ILIKE '%futebol%' OR
        category ILIKE '%football%' OR
        category ILIKE '%news%' OR
        category ILIKE '%noticia%' OR
        category ILIKE '%jornalismo%' OR
        category ILIKE '%fhd%' OR
        category ILIKE '%premiere%' OR
        category ILIKE '%pay per view%' OR
        category ILIKE '%ppv%' OR
        category ILIKE '%pay-per-view%' OR
        category ILIKE '%combate%' OR
        category ILIKE '%ufc%' OR
        category ILIKE '%luta%' OR
        category ILIKE '%boxe%' OR
        -- Adult categories
        category ILIKE '%adulto%' OR
        category ILIKE '%adult%' OR
        category ILIKE '%xxx%' OR
        category ILIKE '%18+%' OR
        category ILIKE '%+18%'
      ))
    ORDER BY id
    LIMIT 5000
  LOOP
    -- Check if name has explicit series patterns (S01, E01, etc.)
    v_has_series_pattern := v_channel.name ~* 'S\d{1,2}\s*E?\d{0,2}|E\d{1,2}|T\d{1,2}\s*E\d{1,2}|EP\s*\d+|EP\.\s*\d+|EPISODIO\s*\d+|TEMPORADA\s*\d+|SEASON\s*\d+|EPISODE\s*\d+';
    
    IF v_has_series_pattern THEN
      SELECT * INTO v_parsed FROM public.parse_series_info_from_name(v_channel.name);
      
      IF v_parsed.is_series AND v_parsed.series_name IS NOT NULL AND length(v_parsed.series_name) > 1 THEN
        -- Generate standardized name: "Series Name | T1 - E4"
        v_new_name := v_parsed.series_name || ' | T' || COALESCE(v_parsed.season_number, 1) || ' - E' || COALESCE(v_parsed.episode_number, 1);
        
        UPDATE public.iptv_channels
        SET 
          name = v_new_name,
          series_name = v_parsed.series_name,
          season_number = v_parsed.season_number,
          episode_number = v_parsed.episode_number,
          episode_title = v_parsed.episode_title,
          is_series = true,
          updated_at = now()
        WHERE id = v_channel.id;
        
        v_organized_count := v_organized_count + 1;
      END IF;
    END IF;
  END LOOP;

  -- Count distinct series found
  SELECT COUNT(DISTINCT series_name) INTO v_series_found 
  FROM public.iptv_channels 
  WHERE is_series = true AND series_name IS NOT NULL;

  RETURN QUERY SELECT v_organized_count, v_series_found;
END;
$$;

-- Also add a function to forcefully detect series by pattern, ignoring category
CREATE OR REPLACE FUNCTION public.force_detect_series_by_pattern()
RETURNS TABLE(organized_count INTEGER) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_organized_count INTEGER := 0;
  v_channel RECORD;
  v_parsed RECORD;
  v_new_name TEXT;
BEGIN
  -- Find ALL channels with series patterns, regardless of category
  FOR v_channel IN 
    SELECT id, name, category 
    FROM public.iptv_channels 
    WHERE (is_series IS NOT TRUE OR series_name IS NULL)
      -- Must have series pattern in name
      AND name ~* 'S\d{1,2}\s*E?\d{0,2}|E\d{1,2}|T\d{1,2}\s*E\d{1,2}|EP\s*\d+|EP\.\s*\d+|EPISODIO\s*\d+|TEMPORADA\s*\d+|SEASON\s*\d+|EPISODE\s*\d+'
      -- But still exclude adult content
      AND (category IS NULL OR NOT (
        category ILIKE '%adulto%' OR
        category ILIKE '%adult%' OR
        category ILIKE '%xxx%' OR
        category ILIKE '%18+%' OR
        category ILIKE '%+18%'
      ))
    ORDER BY id
    LIMIT 5000
  LOOP
    SELECT * INTO v_parsed FROM public.parse_series_info_from_name(v_channel.name);
    
    IF v_parsed.series_name IS NOT NULL AND length(v_parsed.series_name) > 1 THEN
      v_new_name := v_parsed.series_name || ' | T' || COALESCE(v_parsed.season_number, 1) || ' - E' || COALESCE(v_parsed.episode_number, 1);
      
      UPDATE public.iptv_channels
      SET 
        name = v_new_name,
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

  RETURN QUERY SELECT v_organized_count;
END;
$$;
