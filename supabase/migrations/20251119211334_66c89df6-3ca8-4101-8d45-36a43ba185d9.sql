-- Adicionar campo is_recorrente na tabela clientes
ALTER TABLE clientes 
ADD COLUMN IF NOT EXISTS is_recorrente BOOLEAN DEFAULT false;

COMMENT ON COLUMN clientes.is_recorrente IS 
'Indica se o cliente possui pagamento recorrente ativo';

-- Criar view agregada para resumos de vencimento
CREATE OR REPLACE VIEW vw_expiration_summary AS
SELECT 
  c.id,
  c.nome,
  c.telefone,
  c.email,
  c.plano,
  c.valor_pago,
  c.situacao,
  c.data_vencimento,
  c.is_recorrente,
  c.forma_ultimo_pagamento,
  c.data_ultimo_pagamento,
  c.origem_cadastro,
  CASE 
    WHEN c.data_ultimo_pagamento > (CURRENT_DATE - INTERVAL '30 days') 
    THEN true 
    ELSE false 
  END as pagamento_recente,
  EXTRACT(DAY FROM (c.data_vencimento - CURRENT_DATE))::INTEGER as dias_ate_vencimento
FROM clientes c
WHERE c.situacao IN ('Ativo', 'Testando', 'Devendo');

COMMENT ON VIEW vw_expiration_summary IS 
'View agregada para facilitar resumos de vencimento e alertas administrativos';

-- Garantir RLS na view (herda das políticas da tabela clientes)
ALTER VIEW vw_expiration_summary SET (security_barrier = true);
