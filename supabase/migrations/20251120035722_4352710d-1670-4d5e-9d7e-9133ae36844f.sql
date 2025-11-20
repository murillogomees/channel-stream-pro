-- Remove tags system
DROP TABLE IF EXISTS m3u_list_tags CASCADE;
DROP TABLE IF EXISTS m3u_tags CASCADE;

-- Remove priority column from m3u_lists
ALTER TABLE m3u_lists DROP COLUMN IF EXISTS priority;

-- Add plan_type column (array of text for multiple plan types)
ALTER TABLE m3u_lists ADD COLUMN IF NOT EXISTS plan_type text[] DEFAULT ARRAY['mensal']::text[];

-- Update existing records to have default plan_type
UPDATE m3u_lists SET plan_type = ARRAY['mensal']::text[] WHERE plan_type IS NULL OR array_length(plan_type, 1) IS NULL;

-- Create or replace function to get M3U for client based on plan and situation
CREATE OR REPLACE FUNCTION get_m3u_for_client_plan(cliente_plano text, cliente_situacao text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_plan_type text;
  selected_list_id uuid;
BEGIN
  -- Determine target plan type based on situation and plan
  IF cliente_situacao IN ('Testando', 'Lead') THEN
    target_plan_type := 'testando';
  ELSIF cliente_situacao = 'Ativo' THEN
    -- Use specific plan type for active clients
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

  -- Select M3U list with least usage that matches the plan type
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
$$;

COMMENT ON COLUMN m3u_lists.plan_type IS 'Array of plan types that can use this M3U list: testando, ativo, mensal, trimestral, semestral, anual, vip';