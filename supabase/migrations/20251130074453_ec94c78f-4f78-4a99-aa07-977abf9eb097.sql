-- =====================================================
-- FIX: Add search_path to trigger functions missing it
-- Security best practice to prevent search_path attacks
-- =====================================================

-- 1. update_playlist_sources_updated_at
CREATE OR REPLACE FUNCTION public.update_playlist_sources_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- 2. update_m3u_import_session_updated_at
CREATE OR REPLACE FUNCTION public.update_m3u_import_session_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- 3. update_m3u_updated_at
CREATE OR REPLACE FUNCTION public.update_m3u_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- 4. update_notification_schedule_updated_at
CREATE OR REPLACE FUNCTION public.update_notification_schedule_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- 5. update_playlist_entry_search_vector
CREATE OR REPLACE FUNCTION public.update_playlist_entry_search_vector()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  NEW.search_vector := to_tsvector('portuguese', 
    COALESCE(NEW.title, '') || ' ' || 
    COALESCE(NEW.group_title, '') || ' ' ||
    COALESCE(NEW.tvg_name, '')
  );
  RETURN NEW;
END;
$function$;

-- 6. update_subscription_plans_updated_at
CREATE OR REPLACE FUNCTION public.update_subscription_plans_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- 7. update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- 8. increment_coupon_usage
CREATE OR REPLACE FUNCTION public.increment_coupon_usage()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  UPDATE public.discount_coupons
  SET current_uses = current_uses + 1
  WHERE id = NEW.coupon_id;
  RETURN NEW;
END;
$function$;

-- 9. get_m3u_for_client_plan
CREATE OR REPLACE FUNCTION public.get_m3u_for_client_plan(cliente_plano text, cliente_situacao text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  target_plan_type text;
  selected_list_id uuid;
BEGIN
  IF cliente_situacao IN ('Testando', 'Lead') THEN
    target_plan_type := 'testando';
  ELSIF cliente_situacao = 'Ativo' THEN
    CASE cliente_plano
      WHEN 'Mensal' THEN target_plan_type := 'mensal';
      WHEN 'Trimestral' THEN target_plan_type := 'trimestral';
      WHEN 'Semestral' THEN target_plan_type := 'semestral';
      WHEN 'Anual' THEN target_plan_type := 'anual';
      ELSE target_plan_type := 'mensal';
    END CASE;
  ELSE
    target_plan_type := 'mensal';
  END IF;

  SELECT m.id INTO selected_list_id
  FROM m3u_lists m
  LEFT JOIN (
    SELECT m3u_list_id, COUNT(*) as usage_count
    FROM client_m3u_lists
    WHERE is_active = true
    GROUP BY m3u_list_id
  ) usage ON m.id = usage.m3u_list_id
  WHERE m.status = 'active'
    AND target_plan_type = ANY(m.plan_type)
  ORDER BY COALESCE(usage.usage_count, 0) ASC, m.created_at DESC
  LIMIT 1;

  RETURN selected_list_id;
END;
$function$;

-- 10. release_playlist_sync_lock
CREATE OR REPLACE FUNCTION public.release_playlist_sync_lock(p_key text, p_locked_by text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  DELETE FROM playlist_sync_locks 
  WHERE playlist_key = p_key AND locked_by = p_locked_by;
  RETURN FOUND;
END;
$function$;

-- 11. acquire_playlist_sync_lock
CREATE OR REPLACE FUNCTION public.acquire_playlist_sync_lock(p_key text, p_locked_by text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_acquired BOOLEAN := false;
BEGIN
  DELETE FROM playlist_sync_locks WHERE expires_at < now();
  
  INSERT INTO playlist_sync_locks (playlist_key, locked_by, locked_at, expires_at)
  VALUES (p_key, p_locked_by, now(), now() + interval '5 minutes')
  ON CONFLICT (playlist_key) DO NOTHING;
  
  SELECT EXISTS (
    SELECT 1 FROM playlist_sync_locks 
    WHERE playlist_key = p_key AND locked_by = p_locked_by
  ) INTO v_acquired;
  
  RETURN v_acquired;
END;
$function$;

-- 12. get_conversion_rate
CREATE OR REPLACE FUNCTION public.get_conversion_rate(days_period integer DEFAULT 30)
 RETURNS TABLE(total_trials bigint, total_conversions bigint, conversion_rate numeric, avg_days_to_convert numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_trials,
    COUNT(*) FILTER (WHERE converted = true)::BIGINT as total_conversions,
    ROUND(
      (COUNT(*) FILTER (WHERE converted = true)::NUMERIC / NULLIF(COUNT(*), 0)::NUMERIC) * 100,
      2
    ) as conversion_rate,
    ROUND(AVG(days_to_convert) FILTER (WHERE converted = true), 1) as avg_days_to_convert
  FROM public.conversion_metrics
  WHERE created_at > now() - (days_period || ' days')::interval;
END;
$function$;

-- 13. search_playlist_entries
CREATE OR REPLACE FUNCTION public.search_playlist_entries(p_query text, p_playlist_key text DEFAULT NULL::text, p_group_title text DEFAULT NULL::text, p_limit integer DEFAULT 100)
 RETURNS TABLE(id uuid, playlist_key text, title text, stream_url text, group_title text, tvg_logo text, rank real)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.playlist_key,
    e.title,
    e.stream_url,
    e.group_title,
    e.tvg_logo,
    ts_rank(e.search_vector, plainto_tsquery('portuguese', p_query)) as rank
  FROM playlist_entries e
  WHERE e.is_valid = true
    AND (p_playlist_key IS NULL OR e.playlist_key = p_playlist_key)
    AND (p_group_title IS NULL OR e.group_title = p_group_title)
    AND (
      e.search_vector @@ plainto_tsquery('portuguese', p_query)
      OR e.title ILIKE '%' || p_query || '%'
    )
  ORDER BY rank DESC, e.title
  LIMIT p_limit;
END;
$function$;