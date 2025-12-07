-- =====================================================
-- Migration: profiles_migration_infrastructure
-- Description: Create migration infrastructure for clientes → profiles transition
-- =====================================================

-- 1. Add missing columns to profiles if they don't exist
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS data_cadastro timestamptz,
  ADD COLUMN IF NOT EXISTS data_ultima_edicao timestamptz,
  ADD COLUMN IF NOT EXISTS migrated_from_clientes boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS cliente_legacy_id uuid;

-- 2. Create migration tracking tables
CREATE TABLE IF NOT EXISTS profiles_migration_jobs (
  job_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz DEFAULT now(),
  finished_at timestamptz,
  status text DEFAULT 'pending',
  batch_size integer DEFAULT 1000,
  total_records integer DEFAULT 0,
  processed_records integer DEFAULT 0,
  success_count integer DEFAULT 0,
  error_count integer DEFAULT 0,
  summary jsonb,
  created_by uuid REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS profiles_migration_logs (
  id bigserial PRIMARY KEY,
  job_id uuid REFERENCES profiles_migration_jobs(job_id),
  cliente_id uuid,
  profile_id uuid,
  action text,
  field_mapping jsonb,
  error text,
  created_at timestamptz DEFAULT now()
);

-- 3. Create feature flag table entry
CREATE TABLE IF NOT EXISTS app_feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_name text UNIQUE NOT NULL,
  enabled boolean DEFAULT false,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid
);

-- Insert feature flag
INSERT INTO app_feature_flags (flag_name, enabled, description)
VALUES ('USE_PROFILES_ONLY', false, 'When true, all queries use profiles table exclusively. Clientes table becomes read-only for audit.')
ON CONFLICT (flag_name) DO NOTHING;

-- 4. Create indexes for migration tracking
CREATE INDEX IF NOT EXISTS idx_migration_logs_job_id ON profiles_migration_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_migration_logs_cliente_id ON profiles_migration_logs(cliente_id);
CREATE INDEX IF NOT EXISTS idx_profiles_cliente_legacy_id ON profiles(cliente_legacy_id);
CREATE INDEX IF NOT EXISTS idx_profiles_migrated ON profiles(migrated_from_clientes) WHERE migrated_from_clientes = true;

-- 5. Enable RLS on migration tables
ALTER TABLE profiles_migration_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles_migration_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_feature_flags ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for migration tables (admin/master only)
CREATE POLICY "Admins can manage migration jobs" ON profiles_migration_jobs
  FOR ALL USING (is_admin_or_master(auth.uid()));

CREATE POLICY "Admins can manage migration logs" ON profiles_migration_logs
  FOR ALL USING (is_admin_or_master(auth.uid()));

CREATE POLICY "Admins can manage feature flags" ON app_feature_flags
  FOR ALL USING (is_admin_or_master(auth.uid()));

-- 7. Helper function to get profile with fallback to clientes
CREATE OR REPLACE FUNCTION get_profile_or_cliente(p_id uuid)
RETURNS TABLE (
  id uuid,
  nome text,
  email text,
  telefone text,
  situacao text,
  plano text,
  data_vencimento timestamptz,
  cliente_ativo boolean,
  source_table text
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  use_profiles_only boolean;
BEGIN
  -- Check feature flag
  SELECT enabled INTO use_profiles_only 
  FROM app_feature_flags 
  WHERE flag_name = 'USE_PROFILES_ONLY';
  
  -- Try profiles first
  RETURN QUERY
  SELECT 
    p.id, p.nome, p.email, p.telefone, 
    p.situacao::text, p.plano::text, p.data_vencimento, p.cliente_ativo,
    'profiles'::text as source_table
  FROM profiles p WHERE p.id = p_id;
  
  IF FOUND OR use_profiles_only THEN
    RETURN;
  END IF;
  
  -- Fallback to clientes if not found and flag is false
  RETURN QUERY
  SELECT 
    c.id, c.nome, c.email, c.telefone,
    c.situacao::text, c.plano::text, c.data_vencimento, c.cliente_ativo,
    'clientes'::text as source_table
  FROM clientes c WHERE c.id = p_id;
END;
$$;

-- 8. Function to run migration batch
CREATE OR REPLACE FUNCTION run_profiles_migration_batch(
  p_job_id uuid,
  p_batch_size integer DEFAULT 100
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  rec RECORD;
  v_processed integer := 0;
  v_success integer := 0;
  v_errors integer := 0;
  v_existing_profile uuid;
BEGIN
  FOR rec IN 
    SELECT c.* FROM clientes c
    LEFT JOIN profiles p ON p.cliente_legacy_id = c.id
    WHERE p.id IS NULL
    ORDER BY c.id
    LIMIT p_batch_size
  LOOP
    BEGIN
      -- Check if profile already exists by user_id or email
      SELECT id INTO v_existing_profile 
      FROM profiles 
      WHERE (user_id = rec.user_id AND rec.user_id IS NOT NULL)
         OR (email = rec.email AND rec.email IS NOT NULL AND rec.email != '');
      
      IF v_existing_profile IS NOT NULL THEN
        -- Update existing profile with clientes data (merge)
        UPDATE profiles SET
          nome = COALESCE(profiles.nome, rec.nome),
          telefone = COALESCE(profiles.telefone, rec.telefone),
          situacao = COALESCE(profiles.situacao, rec.situacao),
          plano = COALESCE(profiles.plano, rec.plano),
          data_vencimento = COALESCE(profiles.data_vencimento, rec.data_vencimento),
          data_contratacao = COALESCE(profiles.data_contratacao, rec.data_contratacao),
          valor_pago = COALESCE(profiles.valor_pago, rec.valor_pago),
          data_ultimo_pagamento = COALESCE(profiles.data_ultimo_pagamento, rec.data_ultimo_pagamento),
          forma_ultimo_pagamento = COALESCE(profiles.forma_ultimo_pagamento, rec.forma_ultimo_pagamento),
          cliente_ativo = COALESCE(profiles.cliente_ativo, rec.cliente_ativo),
          origem_cadastro = COALESCE(profiles.origem_cadastro, rec.origem_cadastro::text),
          usuario_m3u = COALESCE(profiles.usuario_m3u, rec.usuario_m3u),
          senha_m3u = COALESCE(profiles.senha_m3u, rec.senha_m3u),
          is_recorrente = COALESCE(profiles.is_recorrente, rec.is_recorrente),
          dispositivo_contratado = COALESCE(profiles.dispositivo_contratado, rec.dispositivo_contratado),
          data_cadastro = COALESCE(profiles.data_cadastro, rec.data_cadastro),
          data_ultima_edicao = rec.data_ultima_edicao,
          migrated_from_clientes = true,
          cliente_legacy_id = rec.id,
          updated_at = now()
        WHERE id = v_existing_profile;
        
        INSERT INTO profiles_migration_logs (job_id, cliente_id, profile_id, action)
        VALUES (p_job_id, rec.id, v_existing_profile, 'merged');
      ELSE
        -- This case shouldn't happen if user has auth account, but log it
        INSERT INTO profiles_migration_logs (job_id, cliente_id, action, error)
        VALUES (p_job_id, rec.id, 'skipped', 'No matching profile found (no user_id or email match)');
      END IF;
      
      v_success := v_success + 1;
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO profiles_migration_logs (job_id, cliente_id, action, error)
      VALUES (p_job_id, rec.id, 'failed', SQLERRM);
      v_errors := v_errors + 1;
    END;
    
    v_processed := v_processed + 1;
  END LOOP;
  
  -- Update job stats
  UPDATE profiles_migration_jobs SET
    processed_records = processed_records + v_processed,
    success_count = success_count + v_success,
    error_count = error_count + v_errors,
    status = CASE 
      WHEN v_processed < p_batch_size THEN 'completed'
      ELSE 'running'
    END,
    finished_at = CASE 
      WHEN v_processed < p_batch_size THEN now()
      ELSE NULL
    END
  WHERE job_id = p_job_id;
  
  RETURN jsonb_build_object(
    'processed', v_processed,
    'success', v_success,
    'errors', v_errors,
    'completed', v_processed < p_batch_size
  );
END;
$$;