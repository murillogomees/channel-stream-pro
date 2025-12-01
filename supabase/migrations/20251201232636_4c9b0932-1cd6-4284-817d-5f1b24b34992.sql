-- Consolidar registros duplicados mantendo apenas o registro vinculado a auth.users
-- Para cada email duplicado, manter o registro que existe em auth.users e deletar o outro

-- Primeiro: Atualizar profiles vinculados a auth.users com dados completos dos clientes
UPDATE profiles p
SET 
  telefone = COALESCE(NULLIF(p.telefone, ''), c.telefone, p.telefone),
  telefone_whatsapp = COALESCE(p.telefone_whatsapp, c.telefone),
  origem_cadastro = COALESCE(p.origem_cadastro, c.origem_cadastro::text),
  situacao = COALESCE(p.situacao, c.situacao),
  plano = COALESCE(p.plano, c.plano),
  data_vencimento = COALESCE(p.data_vencimento, c.data_vencimento),
  data_contratacao = COALESCE(p.data_contratacao, c.data_contratacao),
  valor_pago = COALESCE(p.valor_pago, c.valor_pago),
  data_ultimo_pagamento = COALESCE(p.data_ultimo_pagamento, c.data_ultimo_pagamento),
  forma_ultimo_pagamento = COALESCE(p.forma_ultimo_pagamento, c.forma_ultimo_pagamento),
  mac_smart_one = COALESCE(p.mac_smart_one, c.mac_smart_one),
  cliente_ativo = COALESCE(p.cliente_ativo, c.cliente_ativo),
  is_recorrente = COALESCE(p.is_recorrente, c.is_recorrente),
  dispositivo_contratado = COALESCE(p.dispositivo_contratado, c.dispositivo_contratado),
  smartone_status = COALESCE(p.smartone_status, c.smartone_status),
  smartone_playlist_id = COALESCE(p.smartone_playlist_id, c.smartone_playlist_id),
  smartone_last_sync_at = COALESCE(p.smartone_last_sync_at, c.smartone_last_sync_at),
  updated_at = NOW()
FROM clientes c
WHERE c.user_id = p.id
  AND p.id IN (SELECT id FROM auth.users);

-- Deletar profiles duplicados que NÃO são auth.users (manter apenas os vinculados a auth)
DELETE FROM profiles p
WHERE p.id NOT IN (SELECT id FROM auth.users)
  AND EXISTS (
    SELECT 1 
    FROM profiles p2 
    WHERE p2.email = p.email 
      AND p2.id IN (SELECT id FROM auth.users)
      AND p2.id != p.id
  );

-- Atualizar referência de clientes.user_id para os profiles corretos (auth.users)
UPDATE clientes c
SET user_id = (
  SELECT p.id 
  FROM profiles p 
  WHERE p.email = c.email 
    AND p.id IN (SELECT id FROM auth.users)
  LIMIT 1
)
WHERE c.email IS NOT NULL 
  AND c.email != ''
  AND EXISTS (
    SELECT 1 
    FROM profiles p 
    WHERE p.email = c.email 
      AND p.id IN (SELECT id FROM auth.users)
  );