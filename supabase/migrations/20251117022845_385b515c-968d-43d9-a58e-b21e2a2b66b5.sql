-- Corrigir search_path das funções existentes que estão faltando

-- Função ensure_single_default_m3u
CREATE OR REPLACE FUNCTION public.ensure_single_default_m3u()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.m3u_lists 
    SET is_default = false 
    WHERE id != NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;

-- Função log_role_change
CREATE OR REPLACE FUNCTION public.log_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only log if role actually changed (for updates) or for new inserts
  IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND OLD.role != NEW.role) THEN
    INSERT INTO public.security_events (
      event_type,
      severity,
      user_id,
      target_user_id,
      event_details
    ) VALUES (
      'permission_change',
      'warning',
      auth.uid(),
      NEW.user_id,
      jsonb_build_object(
        'action', TG_OP,
        'new_role', NEW.role,
        'old_role', CASE WHEN TG_OP = 'UPDATE' THEN OLD.role ELSE null END,
        'timestamp', now()
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Função save_monthly_leaderboard
CREATE OR REPLACE FUNCTION public.save_monthly_leaderboard()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_month TEXT;
BEGIN
  current_month := to_char(now(), 'YYYY-MM');
  
  -- Inserir ou atualizar rankings do mês atual
  INSERT INTO public.admin_leaderboard_history (
    month_year,
    admin_id,
    admin_name,
    admin_phone,
    rank,
    score,
    level,
    total_alerts,
    confirmation_rate,
    avg_response_time_minutes
  )
  SELECT 
    current_month,
    admin_id,
    admin_name,
    admin_phone,
    ROW_NUMBER() OVER (ORDER BY 
      confirmed_alerts * 10 + 
      alerts_with_action * 15 +
      CASE 
        WHEN avg_response_time_minutes < 2 THEN 500
        WHEN avg_response_time_minutes < 5 THEN 300
        WHEN avg_response_time_minutes < 10 THEN 100
        ELSE 0
      END +
      CASE 
        WHEN confirmation_rate = 100 THEN 1000
        WHEN confirmation_rate >= 95 THEN 500
        WHEN confirmation_rate >= 85 THEN 250
        ELSE 0
      END DESC
    ) as rank,
    confirmed_alerts * 10 + alerts_with_action * 15 as score,
    FLOOR((confirmed_alerts * 10 + alerts_with_action * 15) / 500) + 1 as level,
    total_alerts,
    confirmation_rate,
    avg_response_time_minutes
  FROM get_admin_performance_stats(30)
  ON CONFLICT (month_year, admin_id) 
  DO UPDATE SET
    rank = EXCLUDED.rank,
    score = EXCLUDED.score,
    level = EXCLUDED.level,
    total_alerts = EXCLUDED.total_alerts,
    confirmation_rate = EXCLUDED.confirmation_rate,
    avg_response_time_minutes = EXCLUDED.avg_response_time_minutes,
    created_at = now();
END;
$$;