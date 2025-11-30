
-- Fix search_path for remaining custom functions (excluding extension functions)

-- 1. calculate_ladder_preset
CREATE OR REPLACE FUNCTION public.calculate_ladder_preset(p_historical_views integer, p_source_width integer, p_source_height integer)
RETURNS quality_ladder_preset
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $function$
DECLARE
  v_max_resolution INTEGER;
  v_popularity_score DECIMAL;
BEGIN
  v_max_resolution := GREATEST(p_source_width, p_source_height);
  
  v_popularity_score := CASE 
    WHEN p_historical_views <= 0 THEN 0
    WHEN p_historical_views < 100 THEN 25
    WHEN p_historical_views < 1000 THEN 50
    WHEN p_historical_views < 10000 THEN 75
    ELSE 100
  END;
  
  IF v_max_resolution >= 2160 AND v_popularity_score >= 75 THEN
    RETURN 'ultra';
  ELSIF v_max_resolution >= 1080 AND v_popularity_score >= 50 THEN
    RETURN 'premium';
  ELSIF v_max_resolution >= 720 AND v_popularity_score >= 25 THEN
    RETURN 'standard';
  ELSE
    RETURN 'basic';
  END IF;
END;
$function$;

-- 2. update_cf_stream_uploads_updated_at
CREATE OR REPLACE FUNCTION public.update_cf_stream_uploads_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- 3. update_r2_jobs_updated_at
CREATE OR REPLACE FUNCTION public.update_r2_jobs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- 4. update_transcode_jobs_updated_at
CREATE OR REPLACE FUNCTION public.update_transcode_jobs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- 5. update_vod_downloads_updated_at
CREATE OR REPLACE FUNCTION public.update_vod_downloads_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- 6. update_vod_host_status_updated_at
CREATE OR REPLACE FUNCTION public.update_vod_host_status_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- 7. update_whatsapp_config_updated_at
CREATE OR REPLACE FUNCTION public.update_whatsapp_config_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;
