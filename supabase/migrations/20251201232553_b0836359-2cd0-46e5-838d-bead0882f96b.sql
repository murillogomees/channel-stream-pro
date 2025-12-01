-- Remover constraint de foreign key que impede clientes sem auth.users
-- Isso permite que profiles existam para clientes/leads que não têm conta de login ainda
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Agora migrar TODOS os clientes para profiles, incluindo os sem user_id
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
  c.id,
  c.nome,
  COALESCE(c.email, ''),
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
WHERE NOT EXISTS (
  SELECT 1 FROM profiles p WHERE p.id = c.id
)
ON CONFLICT (id) DO NOTHING;