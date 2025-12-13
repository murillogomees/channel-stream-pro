-- Limit auto_organize_series_channels to process a batch per call to avoid timeouts
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
  -- Process channels in batches to avoid long-running transactions and timeouts
  FOR v_channel IN 
    SELECT id, name 
    FROM public.iptv_channels 
    WHERE is_series IS NOT TRUE OR series_name IS NULL
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

  -- Count unique series after this batch
  SELECT COUNT(DISTINCT series_name) INTO v_series_found 
  FROM public.iptv_channels 
  WHERE is_series = true AND series_name IS NOT NULL;

  RETURN QUERY SELECT v_organized_count, v_series_found;
END;
$$;