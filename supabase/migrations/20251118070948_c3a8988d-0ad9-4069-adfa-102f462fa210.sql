-- Remover coluna plan_type da tabela m3u_lists (não mais utilizada)
ALTER TABLE m3u_lists DROP COLUMN IF EXISTS plan_type;

-- Adicionar coluna description se não existir (para documentação detalhada das listas)
ALTER TABLE m3u_lists ADD COLUMN IF NOT EXISTS description TEXT;

-- Adicionar comentário explicativo na coluna
COMMENT ON COLUMN m3u_lists.description IS 'Descrição detalhada da lista M3U incluindo qualidade, canais, região, características específicas, etc.';