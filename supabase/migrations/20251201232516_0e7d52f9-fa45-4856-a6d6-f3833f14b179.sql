-- Adicionar colunas faltantes na tabela profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS telefone_whatsapp TEXT,
ADD COLUMN IF NOT EXISTS origem_cadastro TEXT;

-- Primeiro: Migrar apenas clientes que JÁ têm user_id válido em auth.users
INSERT INTO profiles (
  id,
  nome,
  email,
  telefone,
  telefone_whatsapp,
  origem_cadastro,
  created_at,
  updated_at,
  situacao,
  plano,
  data_vencimento,
  data_contratacao,
  valor_pago,
  data_ultimo_pagamento,
  forma_ultimo_pagamento,
  mac_smart_one,
  cliente_ativo,
  is_recorrente,
  dispositivo_contratado,
  smartone_status,
  smartone_playlist_id,
  smartone_last_sync_at
)
SELECT 
  c.user_id,
  c.nome,
  c.email,
  c.telefone,
  c.telefone,
  COALESCE(c.origem_cadastro::text, 'Website'),
  COALESCE(c.data_cadastro, NOW()),
  COALESCE(c.data_ultima_edicao, NOW()),
  c.situacao,
  c.plano,
  c.data_vencimento,
  COALESCE(c.data_contratacao, c.data_cadastro, NOW()),
  COALESCE(c.valor_pago, 0),
  c.data_ultimo_pagamento,
  c.forma_ultimo_pagamento,
  c.mac_smart_one,
  COALESCE(c.cliente_ativo, true),
  COALESCE(c.is_recorrente, false),
  c.dispositivo_contratado,
  c.smartone_status,
  c.smartone_playlist_id,
  c.smartone_last_sync_at
FROM clientes c
WHERE c.user_id IS NOT NULL
  AND c.user_id IN (SELECT id FROM auth.users)
  AND NOT EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = c.user_id
  )
ON CONFLICT (id) DO NOTHING;

-- Atualizar profiles existentes com dados de clientes
UPDATE profiles p
SET 
  telefone = COALESCE(NULLIF(p.telefone, ''), c.telefone, p.telefone),
  telefone_whatsapp = COALESCE(p.telefone_whatsapp, c.telefone),
  origem_cadastro = COALESCE(p.origem_cadastro, c.origem_cadastro::text),
  situacao = COALESCE(p.situacao, c.situacao),
  plano = COALESCE(p.plano, c.plano),
  data_vencimento = COALESCE(p.data_vencimento, c.data_vencimento),
  data_contratacao = COALESCE(p.data_contratacao, c.data_contratacao, c.data_cadastro),
  valor_pago = COALESCE(p.valor_pago, c.valor_pago, 0),
  data_ultimo_pagamento = COALESCE(p.data_ultimo_pagamento, c.data_ultimo_pagamento),
  forma_ultimo_pagamento = COALESCE(p.forma_ultimo_pagamento, c.forma_ultimo_pagamento),
  mac_smart_one = COALESCE(p.mac_smart_one, c.mac_smart_one),
  cliente_ativo = COALESCE(p.cliente_ativo, c.cliente_ativo, true),
  is_recorrente = COALESCE(p.is_recorrente, c.is_recorrente, false),
  dispositivo_contratado = COALESCE(p.dispositivo_contratado, c.dispositivo_contratado),
  smartone_status = COALESCE(p.smartone_status, c.smartone_status),
  smartone_playlist_id = COALESCE(p.smartone_playlist_id, c.smartone_playlist_id),
  smartone_last_sync_at = COALESCE(p.smartone_last_sync_at, c.smartone_last_sync_at),
  updated_at = NOW()
FROM clientes c
WHERE p.id = c.user_id
  AND c.user_id IS NOT NULL;