-- Atualizar pagamento como aprovado
UPDATE payments 
SET status = 'approved', 
    paid_at = NOW(),
    payment_method = 'pix',
    updated_at = NOW()
WHERE id = 'ebbd4063-024c-4949-bdf6-e76541f409de' 
  AND user_id = '8b96c2f3-e50d-43bb-a39b-81e6d0b177f2';

-- Ativar plano da usuária (30 dias a partir de hoje)
UPDATE profiles 
SET situacao = 'Ativo',
    data_vencimento = NOW() + INTERVAL '30 days',
    data_ultimo_pagamento = NOW(),
    forma_ultimo_pagamento = 'Pix',
    valor_pago = 30,
    plano = 'Mensal',
    updated_at = NOW()
WHERE id = '8b96c2f3-e50d-43bb-a39b-81e6d0b177f2';

-- Criar/atualizar subscription
INSERT INTO user_subscriptions (user_id, plan_id, status, current_period_start, current_period_end)
SELECT 
  '8b96c2f3-e50d-43bb-a39b-81e6d0b177f2',
  id,
  'active',
  NOW(),
  NOW() + INTERVAL '30 days'
FROM subscription_plans 
WHERE name = 'Mensal' 
LIMIT 1
ON CONFLICT (user_id) 
DO UPDATE SET 
  status = 'active',
  current_period_start = NOW(),
  current_period_end = NOW() + INTERVAL '30 days',
  updated_at = NOW();