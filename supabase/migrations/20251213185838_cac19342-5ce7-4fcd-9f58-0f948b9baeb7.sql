-- Adicionar campos obrigatórios para gestão de planos e pagamentos
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_recorrente boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS data_ultimo_pagamento timestamp with time zone,
ADD COLUMN IF NOT EXISTS forma_ultimo_pagamento text,
ADD COLUMN IF NOT EXISTS dispositivo_contratado text;

-- Criar índice para consultas de vencimento
CREATE INDEX IF NOT EXISTS idx_profiles_data_vencimento ON public.profiles(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_profiles_cliente_ativo ON public.profiles(cliente_ativo);