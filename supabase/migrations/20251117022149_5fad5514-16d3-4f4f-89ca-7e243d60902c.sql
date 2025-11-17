-- Criar tabela para histórico de leaderboards mensais
CREATE TABLE IF NOT EXISTS public.admin_leaderboard_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month_year TEXT NOT NULL, -- formato: YYYY-MM
  admin_id UUID NOT NULL,
  admin_name TEXT NOT NULL,
  admin_phone TEXT NOT NULL,
  rank INTEGER NOT NULL,
  score INTEGER NOT NULL,
  badges_earned JSONB NOT NULL DEFAULT '[]'::jsonb,
  level INTEGER NOT NULL,
  total_alerts INTEGER NOT NULL,
  confirmation_rate NUMERIC NOT NULL,
  avg_response_time_minutes NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(month_year, admin_id)
);

-- Criar índices para performance
CREATE INDEX idx_leaderboard_month_year ON public.admin_leaderboard_history(month_year);
CREATE INDEX idx_leaderboard_rank ON public.admin_leaderboard_history(month_year, rank);
CREATE INDEX idx_leaderboard_admin ON public.admin_leaderboard_history(admin_id);

-- Habilitar RLS
ALTER TABLE public.admin_leaderboard_history ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins podem visualizar leaderboard"
  ON public.admin_leaderboard_history
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Sistema pode inserir no leaderboard"
  ON public.admin_leaderboard_history
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Criar tabela para tracking de badges conquistados
CREATE TABLE IF NOT EXISTS public.admin_badge_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL,
  badge_id TEXT NOT NULL,
  badge_name TEXT NOT NULL,
  badge_rarity TEXT NOT NULL,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices
CREATE INDEX idx_badge_notifications_admin ON public.admin_badge_notifications(admin_id);
CREATE INDEX idx_badge_notifications_unread ON public.admin_badge_notifications(admin_id, read_at) WHERE read_at IS NULL;

-- RLS
ALTER TABLE public.admin_badge_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver suas notificações"
  ON public.admin_badge_notifications
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Sistema pode inserir notificações"
  ON public.admin_badge_notifications
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins podem marcar como lido"
  ON public.admin_badge_notifications
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Função para salvar snapshot do leaderboard mensal
CREATE OR REPLACE FUNCTION save_monthly_leaderboard()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Comentários
COMMENT ON TABLE public.admin_leaderboard_history IS 'Histórico mensal de rankings e performance dos admins';
COMMENT ON TABLE public.admin_badge_notifications IS 'Notificações de badges conquistados pelos admins';
COMMENT ON FUNCTION save_monthly_leaderboard IS 'Salva snapshot do leaderboard do mês atual';