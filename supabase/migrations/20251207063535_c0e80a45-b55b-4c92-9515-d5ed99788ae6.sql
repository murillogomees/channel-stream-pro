-- Migrar manualmente os 3 clientes órfãos criando novos profiles
INSERT INTO profiles (
  id, user_id, nome, email, telefone, contact_phone,
  plano, data_vencimento, data_contratacao, data_ultimo_pagamento,
  valor_pago, forma_ultimo_pagamento, cliente_ativo, situacao,
  dispositivo_contratado, origem_cadastro, is_recorrente,
  usuario_m3u, senha_m3u, created_at, updated_at, migrated_from_clientes, cliente_legacy_id
)
SELECT 
  gen_random_uuid() as id,
  gen_random_uuid() as user_id,
  c.nome,
  c.email,
  c.telefone,
  c.telefone as contact_phone,
  c.plano,
  c.data_vencimento,
  c.data_contratacao,
  c.data_ultimo_pagamento,
  c.valor_pago,
  c.forma_ultimo_pagamento,
  c.cliente_ativo,
  c.situacao,
  c.dispositivo_contratado,
  c.origem_cadastro::text,
  c.is_recorrente,
  c.usuario_m3u,
  c.senha_m3u,
  c.data_cadastro as created_at,
  NOW() as updated_at,
  true as migrated_from_clientes,
  c.id as cliente_legacy_id
FROM clientes c
WHERE c.id IN (
  '01472576-e258-4ba6-aefd-a44d110e2a61',
  '7ab3fc96-b2e2-420a-997f-2fdc46b6ebcc', 
  '3ffd2972-4029-47fb-beef-3321b1cc9ef2'
)
AND NOT EXISTS (
  SELECT 1 FROM profiles p 
  WHERE p.telefone = c.telefone 
  OR p.contact_phone = c.telefone
  OR (p.email = c.email AND c.email IS NOT NULL AND c.email != '')
);