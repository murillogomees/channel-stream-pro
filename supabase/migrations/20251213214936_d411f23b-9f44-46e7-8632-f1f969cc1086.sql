-- Update auto_organize to exclude live TV and adult categories from series detection
CREATE OR REPLACE FUNCTION public.auto_organize_series_channels()
RETURNS TABLE(organized_count integer, series_found integer)
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
  -- Process channels in batches, excluding movie/live/adult categories
  FOR v_channel IN 
    SELECT id, name, category 
    FROM public.iptv_channels 
    WHERE (is_series IS NOT TRUE OR series_name IS NULL)
      -- Exclude non-series categories
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
        -- Live TV categories
        category ILIKE '%aberto%' OR
        category ILIKE '%24 h%' OR
        category ILIKE '%24h%' OR
        category ILIKE '%canais%' OR
        category ILIKE '%canal %' OR
        category ILIKE '% canal' OR
        category ILIKE '%tv %' OR
        category ILIKE '% tv' OR
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

  -- Also reset any channels in excluded categories that were incorrectly marked as series
  UPDATE public.iptv_channels
  SET 
    is_series = false,
    series_name = NULL,
    season_number = NULL,
    episode_number = NULL,
    episode_title = NULL,
    updated_at = now()
  WHERE is_series = true
    AND category IS NOT NULL
    AND (
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
      -- Live TV categories
      category ILIKE '%aberto%' OR
      category ILIKE '%24 h%' OR
      category ILIKE '%24h%' OR
      category ILIKE '%canais%' OR
      category ILIKE '%canal %' OR
      category ILIKE '% canal' OR
      category ILIKE '%tv %' OR
      category ILIKE '% tv' OR
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
      -- Adult categories
      category ILIKE '%adulto%' OR
      category ILIKE '%adult%' OR
      category ILIKE '%xxx%' OR
      category ILIKE '%18+%' OR
      category ILIKE '%+18%'
    );

  -- Count unique series after this batch
  SELECT COUNT(DISTINCT series_name) INTO v_series_found 
  FROM public.iptv_channels 
  WHERE is_series = true AND series_name IS NOT NULL;

  RETURN QUERY SELECT v_organized_count, v_series_found;
END;
$$;