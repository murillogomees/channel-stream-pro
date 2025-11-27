-- Drop and recreate view with SECURITY INVOKER
DROP VIEW IF EXISTS public.vw_expiration_summary;

CREATE VIEW public.vw_expiration_summary 
WITH (security_invoker = true)
AS
SELECT 
  id,
  nome,
  telefone,
  email,
  plano,
  valor_pago,
  situacao,
  data_vencimento,
  is_recorrente,
  forma_ultimo_pagamento,
  data_ultimo_pagamento,
  origem_cadastro,
  CASE
    WHEN (data_ultimo_pagamento > (CURRENT_DATE - '30 days'::interval)) THEN true
    ELSE false
  END AS pagamento_recente,
  (EXTRACT(day FROM (data_vencimento - (CURRENT_DATE)::timestamp with time zone)))::integer AS dias_ate_vencimento
FROM clientes c
WHERE situacao = ANY (ARRAY['Ativo'::situacao_cliente, 'Testando'::situacao_cliente, 'Devendo'::situacao_cliente]);

-- Grant access to authenticated users (will be filtered by RLS on clientes table)
GRANT SELECT ON public.vw_expiration_summary TO authenticated;