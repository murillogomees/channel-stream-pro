-- =====================================================
-- SCRIPT 11: CREATE ALL FUNCTIONS
-- Source: Lovable Cloud (waxgowafohlrfoefwhsf)
-- Target: Supabase Cloud (sdvyxdghxqmntyoweqbd)
-- Execute BEFORE creating tables (some functions are needed for defaults)
-- =====================================================

-- Function: normalize_text
CREATE OR REPLACE FUNCTION public.normalize_text(input_text text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
BEGIN
  IF input_text IS NULL THEN RETURN NULL; END IF;
  RETURN lower(trim(regexp_replace(
    translate(input_text,
      'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
      'aaaaaeeeeiiiioooooúuuuçnAAAAAEEEEIIIIOOOOOUUUUCN'),
    '[^a-z0-9 ]', '', 'gi')));
END;
$function$;

-- Function: generate_source_hash
CREATE OR REPLACE FUNCTION public.generate_source_hash(url text, name text, category text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN md5(COALESCE(url, '') || '|' || COALESCE(normalize_text(name), '') || '|' || COALESCE(normalize_text(category), ''));
END;
$function$;

-- Function: update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Function: is_admin_or_master
CREATE OR REPLACE FUNCTION public.is_admin_or_master(check_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = check_user_id
    AND role IN ('admin', 'master')
  );
$function$;

-- Function: has_role
CREATE OR REPLACE FUNCTION public.has_role(check_user_id uuid, check_role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = check_user_id
    AND role = check_role
  );
$function$;

-- Function: handle_new_user (trigger function for auth.users)
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, nome, contact_phone, origem_cadastro)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'telefone',
    COALESCE(NEW.raw_user_meta_data->>'origem_cadastro', 'Website')
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'client');

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$function$;

-- Function: get_channel_shard
CREATE OR REPLACE FUNCTION public.get_channel_shard(channel_id bigint)
 RETURNS integer
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT shard_id FROM public.iptv_channels WHERE id = channel_id;
$function$;

-- Function: update_channel_health
CREATE OR REPLACE FUNCTION public.update_channel_health(p_channel_id bigint, p_is_healthy boolean, p_health_score integer DEFAULT NULL::integer, p_probe_error text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.iptv_channels
  SET 
    is_healthy = p_is_healthy,
    health_score = COALESCE(p_health_score, health_score),
    probe_error = p_probe_error,
    last_probe_at = now(),
    updated_at = now()
  WHERE id = p_channel_id;
END;
$function$;

-- Function: generate_stream_token
CREATE OR REPLACE FUNCTION public.generate_stream_token(p_user_id uuid, p_channel_id bigint, p_ttl_seconds integer DEFAULT 3600)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_token TEXT;
BEGIN
  v_token := encode(gen_random_bytes(32), 'hex');
  
  INSERT INTO public.iptv_stream_tokens (user_id, channel_id, token, expires_at)
  VALUES (p_user_id, p_channel_id, v_token, now() + (p_ttl_seconds || ' seconds')::INTERVAL);
  
  RETURN v_token;
END;
$function$;

-- Function: validate_stream_token
CREATE OR REPLACE FUNCTION public.validate_stream_token(p_token text)
 RETURNS TABLE(channel_id bigint, user_id uuid, is_valid boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    t.channel_id,
    t.user_id,
    (t.expires_at > now() AND t.used_at IS NULL) as is_valid
  FROM public.iptv_stream_tokens t
  WHERE t.token = p_token;
  
  UPDATE public.iptv_stream_tokens
  SET used_at = now()
  WHERE token = p_token AND used_at IS NULL;
END;
$function$;

-- Function: check_rate_limit
CREATE OR REPLACE FUNCTION public.check_rate_limit(p_identifier text, p_identifier_type text DEFAULT 'ip'::text, p_limit integer DEFAULT 5, p_window_seconds integer DEFAULT 60)
 RETURNS TABLE(allowed boolean, current_count integer, reset_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_count INTEGER;
BEGIN
  v_window_start := NOW() - (p_window_seconds || ' seconds')::INTERVAL;
  
  SELECT COALESCE(SUM(request_count), 0) INTO v_count
  FROM public.rate_limit_tracking
  WHERE identifier = p_identifier
    AND identifier_type = p_identifier_type
    AND window_start > v_window_start;
  
  INSERT INTO public.rate_limit_tracking (identifier, identifier_type, request_count, window_start, window_duration_seconds)
  VALUES (p_identifier, p_identifier_type, 1, NOW(), p_window_seconds)
  ON CONFLICT (identifier, identifier_type, window_start) 
  DO UPDATE SET request_count = rate_limit_tracking.request_count + 1, last_request_at = NOW();
  
  RETURN QUERY SELECT 
    (v_count + 1) <= p_limit,
    v_count + 1,
    NOW() + (p_window_seconds || ' seconds')::INTERVAL;
END;
$function$;

-- Function: is_blocked
CREATE OR REPLACE FUNCTION public.is_blocked(p_identifier text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.ip_blacklist
    WHERE ip_address = p_identifier
      AND unblocked_at IS NULL
      AND (expires_at IS NULL OR expires_at > NOW())
  );
$function$;

-- Function: auto_block_identifier
CREATE OR REPLACE FUNCTION public.auto_block_identifier(p_identifier text, p_failed_attempts integer, p_reason text DEFAULT 'brute_force'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_block_duration INTERVAL;
  v_severity TEXT;
BEGIN
  IF p_failed_attempts >= 50 THEN
    v_block_duration := INTERVAL '7 days';
    v_severity := 'critical';
  ELSIF p_failed_attempts >= 20 THEN
    v_block_duration := INTERVAL '24 hours';
    v_severity := 'high';
  ELSIF p_failed_attempts >= 10 THEN
    v_block_duration := INTERVAL '1 hour';
    v_severity := 'medium';
  ELSE
    v_block_duration := INTERVAL '15 minutes';
    v_severity := 'low';
  END IF;

  INSERT INTO public.ip_blacklist (ip_address, reason, auto_blocked, failed_attempts, last_attempt_at, expires_at, severity)
  VALUES (p_identifier, p_reason, true, p_failed_attempts, NOW(), NOW() + v_block_duration, v_severity)
  ON CONFLICT (ip_address) DO UPDATE SET
    failed_attempts = EXCLUDED.failed_attempts,
    last_attempt_at = NOW(),
    expires_at = NOW() + v_block_duration,
    severity = EXCLUDED.severity;
  
  INSERT INTO public.security_events (event_type, event_details, ip_address, severity)
  VALUES ('auto_block', jsonb_build_object('reason', p_reason, 'attempts', p_failed_attempts), p_identifier, v_severity);
END;
$function$;

-- Function: cleanup_rate_limits
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.rate_limit_tracking
  WHERE window_start < NOW() - INTERVAL '1 hour';
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$function$;

-- Function: revoke_token_family
CREATE OR REPLACE FUNCTION public.revoke_token_family(p_family_id uuid, p_reason text DEFAULT 'security'::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_revoked INTEGER;
BEGIN
  UPDATE public.refresh_tokens
  SET is_revoked = true, revoked_at = NOW(), revoked_reason = p_reason
  WHERE family_id = p_family_id AND is_revoked = false;
  
  GET DIAGNOSTICS v_revoked = ROW_COUNT;
  
  IF v_revoked > 0 THEN
    INSERT INTO public.security_events (event_type, event_details, severity)
    VALUES ('token_family_revoked', jsonb_build_object('family_id', p_family_id, 'reason', p_reason, 'tokens_revoked', v_revoked), 'high');
  END IF;
  
  RETURN v_revoked;
END;
$function$;

-- Function: parse_series_info_from_name
CREATE OR REPLACE FUNCTION public.parse_series_info_from_name(channel_name text)
 RETURNS TABLE(series_name text, season_number integer, episode_number integer, episode_title text, is_series boolean)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_series_name TEXT;
  v_season INTEGER := 0;
  v_episode INTEGER := 0;
  v_episode_title TEXT := '';
  v_is_series BOOLEAN := false;
  v_match TEXT[];
BEGIN
  v_match := regexp_match(channel_name, '(.+?)\s*[Ss](\d{1,2})\s*[Ee](\d{1,3})\s*[-:.]?\s*(.*)', 'i');
  IF v_match IS NOT NULL THEN
    v_series_name := trim(v_match[1]);
    v_season := v_match[2]::INTEGER;
    v_episode := v_match[3]::INTEGER;
    v_episode_title := trim(v_match[4]);
    v_is_series := true;
  ELSE
    v_match := regexp_match(channel_name, '(.+?)\s*(\d{1,2})[xX](\d{1,3})\s*[-:.]?\s*(.*)', 'i');
    IF v_match IS NOT NULL THEN
      v_series_name := trim(v_match[1]);
      v_season := v_match[2]::INTEGER;
      v_episode := v_match[3]::INTEGER;
      v_episode_title := trim(v_match[4]);
      v_is_series := true;
    ELSE
      v_match := regexp_match(channel_name, '(.+?)\s*[Tt]emporada\s*(\d{1,2}).*[Ee]pis[oó]dio\s*(\d{1,3})\s*[-:.]?\s*(.*)', 'i');
      IF v_match IS NOT NULL THEN
        v_series_name := trim(v_match[1]);
        v_season := v_match[2]::INTEGER;
        v_episode := v_match[3]::INTEGER;
        v_episode_title := trim(v_match[4]);
        v_is_series := true;
      ELSE
        v_match := regexp_match(channel_name, '(.+?)\s*[Ee][Pp]?\s*(\d{1,3})(?:\s|$|-|\.)', 'i');
        IF v_match IS NOT NULL AND length(v_match[1]) > 2 THEN
          v_series_name := trim(v_match[1]);
          v_season := 1;
          v_episode := v_match[2]::INTEGER;
          v_episode_title := '';
          v_is_series := true;
        ELSE
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

  IF v_series_name IS NOT NULL THEN
    v_series_name := regexp_replace(v_series_name, '[-_.:]+$', '', 'g');
    v_series_name := trim(v_series_name);
  END IF;

  RETURN QUERY SELECT v_series_name, v_season, v_episode, v_episode_title, v_is_series;
END;
$function$;

-- Function: auto_organize_series_channels
CREATE OR REPLACE FUNCTION public.auto_organize_series_channels()
 RETURNS TABLE(organized_count integer, series_found integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_organized_count INTEGER := 0;
  v_series_found INTEGER := 0;
  v_channel RECORD;
  v_parsed RECORD;
  v_new_name TEXT;
  v_has_series_pattern BOOLEAN;
BEGIN
  FOR v_channel IN 
    SELECT id, name, category 
    FROM public.iptv_channels 
    WHERE (is_series IS NOT TRUE OR series_name IS NULL)
      AND (category IS NULL OR NOT (
        category ILIKE '%filme%' OR category ILIKE '%filmes%' OR category ILIKE '%movie%' OR 
        category ILIKE '%movies%' OR category ILIKE '%film %' OR category ILIKE '% film' OR
        category ILIKE '%cinema%' OR category ILIKE '%lançamento%' OR category ILIKE '%lancamento%' OR
        category ILIKE '%aberto%' OR category ILIKE '%24 h%' OR category ILIKE '%24h%' OR
        category ILIKE '%canais%' OR category ILIKE '%canal %' OR category ILIKE '% canal' OR
        category ILIKE '%ao vivo%' OR category ILIKE '%aovivo%' OR category ILIKE '%live%' OR
        category ILIKE '%esporte%' OR category ILIKE '%sport%' OR category ILIKE '%futebol%' OR
        category ILIKE '%football%' OR category ILIKE '%news%' OR category ILIKE '%noticia%' OR
        category ILIKE '%jornalismo%' OR category ILIKE '%fhd%' OR category ILIKE '%premiere%' OR
        category ILIKE '%pay per view%' OR category ILIKE '%ppv%' OR category ILIKE '%pay-per-view%' OR
        category ILIKE '%combate%' OR category ILIKE '%ufc%' OR category ILIKE '%luta%' OR
        category ILIKE '%boxe%' OR category ILIKE '%adulto%' OR category ILIKE '%adult%' OR
        category ILIKE '%xxx%' OR category ILIKE '%18+%' OR category ILIKE '%+18%'
      ))
    ORDER BY id
    LIMIT 5000
  LOOP
    v_has_series_pattern := v_channel.name ~* 'S\d{1,2}\s*E?\d{0,2}|E\d{1,2}|T\d{1,2}\s*E\d{1,2}|EP\s*\d+|EP\.\s*\d+|EPISODIO\s*\d+|TEMPORADA\s*\d+|SEASON\s*\d+|EPISODE\s*\d+';
    
    IF v_has_series_pattern THEN
      SELECT * INTO v_parsed FROM public.parse_series_info_from_name(v_channel.name);
      
      IF v_parsed.is_series AND v_parsed.series_name IS NOT NULL AND length(v_parsed.series_name) > 1 THEN
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

  SELECT COUNT(DISTINCT series_name) INTO v_series_found 
  FROM public.iptv_channels 
  WHERE is_series = true AND series_name IS NOT NULL;

  RETURN QUERY SELECT v_organized_count, v_series_found;
END;
$function$;

-- Function: force_detect_series_by_pattern
CREATE OR REPLACE FUNCTION public.force_detect_series_by_pattern()
 RETURNS TABLE(organized_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_organized_count INTEGER := 0;
  v_channel RECORD;
  v_parsed RECORD;
  v_new_name TEXT;
BEGIN
  FOR v_channel IN 
    SELECT id, name, category 
    FROM public.iptv_channels 
    WHERE (is_series IS NOT TRUE OR series_name IS NULL)
      AND name ~* 'S\d{1,2}\s*E?\d{0,2}|E\d{1,2}|T\d{1,2}\s*E\d{1,2}|EP\s*\d+|EP\.\s*\d+|EPISODIO\s*\d+|TEMPORADA\s*\d+|SEASON\s*\d+|EPISODE\s*\d+'
      AND (category IS NULL OR NOT (
        category ILIKE '%adulto%' OR category ILIKE '%adult%' OR
        category ILIKE '%xxx%' OR category ILIKE '%18+%' OR category ILIKE '%+18%'
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
$function$;

-- Function: get_sync_statistics
CREATE OR REPLACE FUNCTION public.get_sync_statistics()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'channels', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM iptv_channels),
      'healthy', (SELECT COUNT(*) FROM iptv_channels WHERE is_healthy = true),
      'unhealthy', (SELECT COUNT(*) FROM iptv_channels WHERE is_healthy = false)
    ),
    'categories', (SELECT COUNT(DISTINCT category) FROM iptv_channels WHERE category IS NOT NULL)
  );
$function$;

-- Function: get_m3u_distinct_categories
CREATE OR REPLACE FUNCTION public.get_m3u_distinct_categories()
 RETURNS TABLE(group_title text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT DISTINCT category as group_title
  FROM iptv_channels
  WHERE category IS NOT NULL
  ORDER BY category;
$function$;

-- Function: cleanup_iptv_duplicates
CREATE OR REPLACE FUNCTION public.cleanup_iptv_duplicates()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH duplicates AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY original_url ORDER BY id) as rn
    FROM iptv_channels
  )
  DELETE FROM iptv_channels 
  WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$function$;

-- Function: toggle_feature_flag
CREATE OR REPLACE FUNCTION public.toggle_feature_flag(flag_name_param text, enabled_param boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.feature_flag_config 
  SET enabled = enabled_param, updated_at = NOW()
  WHERE flag_name = flag_name_param;
END;
$function$;

-- Function: cleanup_fase8_old_data
CREATE OR REPLACE FUNCTION public.cleanup_fase8_old_data()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN jsonb_build_object('status', 'success', 'message', 'No cleanup needed');
END;
$function$;

-- Function: check_suspicious_login
CREATE OR REPLACE FUNCTION public.check_suspicious_login(_ip_address text, _email text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  attempt_count INTEGER;
  is_whitelisted BOOLEAN := false;
BEGIN
  SELECT COUNT(*) INTO attempt_count
  FROM public.security_events
  WHERE event_type = 'failed_login'
  AND event_details->>'email' = _email
  AND created_at > NOW() - INTERVAL '15 minutes';
  
  RETURN jsonb_build_object(
    'suspicious', attempt_count >= 5,
    'whitelisted', is_whitelisted,
    'alert_admins', attempt_count >= 10,
    'should_block', attempt_count >= 15,
    'attempt_count', attempt_count
  );
END;
$function$;

-- Function: get_auth_statistics
CREATE OR REPLACE FUNCTION public.get_auth_statistics(days integer DEFAULT 7)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_logins', (SELECT COUNT(*) FROM public.auth_sessions_log WHERE event_type = 'login' AND created_at > NOW() - (days || ' days')::INTERVAL),
    'failed_logins', (SELECT COUNT(*) FROM public.security_events WHERE event_type = 'failed_login' AND created_at > NOW() - (days || ' days')::INTERVAL),
    'unique_users', (SELECT COUNT(DISTINCT user_id) FROM public.auth_sessions_log WHERE created_at > NOW() - (days || ' days')::INTERVAL)
  ) INTO result;
  RETURN result;
END;
$function$;

-- Function: get_active_sessions
CREATE OR REPLACE FUNCTION public.get_active_sessions()
 RETURNS TABLE(user_id uuid, user_email text, last_activity timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT DISTINCT ON (user_id) user_id, user_email, created_at as last_activity
  FROM public.auth_sessions_log
  WHERE event_type = 'login'
  AND created_at > NOW() - INTERVAL '24 hours'
  ORDER BY user_id, created_at DESC;
$function$;

-- Function: track_affiliate_click
CREATE OR REPLACE FUNCTION public.track_affiliate_click(p_affiliate_code text, p_ip_address text DEFAULT NULL::text, p_user_agent text DEFAULT NULL::text, p_referrer text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_affiliate_id UUID;
BEGIN
  SELECT id INTO v_affiliate_id FROM public.affiliates WHERE code = p_affiliate_code AND is_active = true;
  
  IF v_affiliate_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Affiliate not found');
  END IF;
  
  INSERT INTO public.affiliate_link_clicks (affiliate_id, ip_address, user_agent, referrer)
  VALUES (v_affiliate_id, p_ip_address, p_user_agent, p_referrer);
  
  UPDATE public.affiliates SET total_clicks = total_clicks + 1 WHERE id = v_affiliate_id;
  
  RETURN jsonb_build_object('success', true, 'affiliate_id', v_affiliate_id);
END;
$function$;
