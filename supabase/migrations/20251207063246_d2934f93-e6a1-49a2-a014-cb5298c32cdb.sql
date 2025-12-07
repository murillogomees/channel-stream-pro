-- Limpar logs de erros antigos (antes da correção)
DELETE FROM profiles_migration_logs WHERE action = 'failed' AND error LIKE '%column%user_id%does not exist%';

-- Atualizar função para criar novos profiles para clientes órfãos
CREATE OR REPLACE FUNCTION run_profiles_migration_batch(
  p_job_id UUID,
  p_batch_size INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente RECORD;
  v_profile_id UUID;
  v_migrated INTEGER := 0;
  v_skipped INTEGER := 0;
  v_errors INTEGER := 0;
  v_total INTEGER := 0;
  v_new_profiles INTEGER := 0;
BEGIN
  -- Process batch of clientes
  FOR v_cliente IN 
    SELECT * FROM clientes 
    ORDER BY data_cadastro ASC
    LIMIT p_batch_size OFFSET p_offset
  LOOP
    v_total := v_total + 1;
    v_profile_id := NULL;
    
    BEGIN
      -- Try to find existing profile by user_id or email
      IF v_cliente.user_id IS NOT NULL THEN
        SELECT id INTO v_profile_id FROM profiles WHERE id = v_cliente.user_id;
      END IF;
      
      IF v_profile_id IS NULL AND v_cliente.email IS NOT NULL AND v_cliente.email != '' THEN
        SELECT id INTO v_profile_id FROM profiles WHERE email = v_cliente.email;
      END IF;
      
      IF v_profile_id IS NULL AND v_cliente.telefone IS NOT NULL AND v_cliente.telefone != '' THEN
        SELECT id INTO v_profile_id FROM profiles WHERE contact_phone = v_cliente.telefone;
      END IF;
      
      -- If no profile found, CREATE a new one for orphan cliente
      IF v_profile_id IS NULL THEN
        v_profile_id := gen_random_uuid();
        
        INSERT INTO profiles (
          id, user_id, full_name, email, contact_phone,
          plano, data_vencimento, data_contratacao, data_ultimo_pagamento,
          valor_pago, forma_ultimo_pagamento, cliente_ativo, situacao,
          dispositivo_contratado, origem_cadastro, is_recorrente,
          usuario_m3u, senha_m3u, created_at, updated_at
        ) VALUES (
          v_profile_id, v_profile_id, v_cliente.nome, v_cliente.email, v_cliente.telefone,
          v_cliente.plano, v_cliente.data_vencimento, v_cliente.data_contratacao, v_cliente.data_ultimo_pagamento,
          v_cliente.valor_pago, v_cliente.forma_ultimo_pagamento, v_cliente.cliente_ativo, v_cliente.situacao,
          v_cliente.dispositivo_contratado, v_cliente.origem_cadastro, v_cliente.is_recorrente,
          v_cliente.usuario_m3u, v_cliente.senha_m3u, v_cliente.data_cadastro, NOW()
        );
        
        -- Log the creation
        INSERT INTO profiles_migration_logs (job_id, cliente_id, profile_id, action, field_mapping)
        VALUES (p_job_id, v_cliente.id, v_profile_id, 'created', 
          jsonb_build_object('source', 'orphan_cliente', 'created_new_profile', true));
        
        v_new_profiles := v_new_profiles + 1;
        v_migrated := v_migrated + 1;
      ELSE
        -- Profile exists, merge data
        UPDATE profiles SET
          full_name = COALESCE(NULLIF(full_name, ''), v_cliente.nome),
          contact_phone = COALESCE(contact_phone, v_cliente.telefone),
          plano = COALESCE(plano, v_cliente.plano),
          data_vencimento = COALESCE(data_vencimento, v_cliente.data_vencimento),
          data_contratacao = COALESCE(data_contratacao, v_cliente.data_contratacao),
          data_ultimo_pagamento = COALESCE(data_ultimo_pagamento, v_cliente.data_ultimo_pagamento),
          valor_pago = COALESCE(valor_pago, v_cliente.valor_pago),
          forma_ultimo_pagamento = COALESCE(forma_ultimo_pagamento, v_cliente.forma_ultimo_pagamento),
          cliente_ativo = COALESCE(cliente_ativo, v_cliente.cliente_ativo),
          situacao = COALESCE(situacao, v_cliente.situacao),
          dispositivo_contratado = COALESCE(dispositivo_contratado, v_cliente.dispositivo_contratado),
          origem_cadastro = COALESCE(origem_cadastro, v_cliente.origem_cadastro),
          is_recorrente = COALESCE(is_recorrente, v_cliente.is_recorrente),
          usuario_m3u = COALESCE(usuario_m3u, v_cliente.usuario_m3u),
          senha_m3u = COALESCE(senha_m3u, v_cliente.senha_m3u),
          updated_at = NOW()
        WHERE id = v_profile_id;
        
        -- Log the merge
        INSERT INTO profiles_migration_logs (job_id, cliente_id, profile_id, action, field_mapping)
        VALUES (p_job_id, v_cliente.id, v_profile_id, 'merged', 
          jsonb_build_object('matched_by', CASE 
            WHEN v_cliente.user_id IS NOT NULL THEN 'user_id'
            WHEN v_cliente.email IS NOT NULL THEN 'email'
            ELSE 'phone'
          END));
        
        v_migrated := v_migrated + 1;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      -- Log error
      INSERT INTO profiles_migration_logs (job_id, cliente_id, action, error)
      VALUES (p_job_id, v_cliente.id, 'failed', SQLERRM);
      v_errors := v_errors + 1;
    END;
  END LOOP;
  
  RETURN jsonb_build_object(
    'processed', v_total,
    'migrated', v_migrated,
    'new_profiles', v_new_profiles,
    'skipped', v_skipped,
    'errors', v_errors
  );
END;
$$;