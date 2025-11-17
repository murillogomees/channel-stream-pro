-- Adicionar campo de categoria/plano às listas M3U
ALTER TABLE public.m3u_lists
ADD COLUMN IF NOT EXISTS plan_type text DEFAULT 'teste' CHECK (plan_type IN ('teste', 'basico', 'premium')),
ADD COLUMN IF NOT EXISTS priority integer DEFAULT 0;

-- Criar índice para busca rápida por plano
CREATE INDEX IF NOT EXISTS idx_m3u_lists_plan_type ON public.m3u_lists(plan_type, status);

-- Criar índice para is_default otimizado
CREATE INDEX IF NOT EXISTS idx_m3u_lists_default ON public.m3u_lists(is_default) WHERE is_default = true;

-- Comentários para documentação
COMMENT ON COLUMN public.m3u_lists.plan_type IS 'Tipo de plano: teste (gratuito/trial), basico (mensal/trimestral), premium (semestral/anual)';
COMMENT ON COLUMN public.m3u_lists.priority IS 'Prioridade da lista (maior = maior prioridade). Usado para fallback quando não há lista específica para o plano';

-- Função para obter lista M3U apropriada baseada no plano do cliente
CREATE OR REPLACE FUNCTION public.get_m3u_for_client_plan(
  cliente_plano text,
  cliente_situacao text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  target_plan_type text;
  selected_list_id uuid;
BEGIN
  -- Determinar tipo de plano baseado na situação e plano
  IF cliente_situacao = 'Testando' OR cliente_situacao = 'Lead' THEN
    target_plan_type := 'teste';
  ELSIF cliente_plano IN ('Semestral', 'Anual') THEN
    target_plan_type := 'premium';
  ELSE
    target_plan_type := 'basico';
  END IF;

  -- Buscar lista ativa para o plano específico (por prioridade)
  SELECT id INTO selected_list_id
  FROM public.m3u_lists
  WHERE plan_type = target_plan_type
    AND status = 'active'
  ORDER BY priority DESC, created_at DESC
  LIMIT 1;

  -- Se não encontrar lista específica, usar a padrão
  IF selected_list_id IS NULL THEN
    SELECT id INTO selected_list_id
    FROM public.m3u_lists
    WHERE is_default = true
      AND status = 'active'
    LIMIT 1;
  END IF;

  -- Se ainda não encontrar, usar qualquer lista ativa
  IF selected_list_id IS NULL THEN
    SELECT id INTO selected_list_id
    FROM public.m3u_lists
    WHERE status = 'active'
    ORDER BY priority DESC, created_at DESC
    LIMIT 1;
  END IF;

  RETURN selected_list_id;
END;
$$;

-- Trigger para atualizar automaticamente a lista M3U quando o plano/situação do cliente mudar
CREATE OR REPLACE FUNCTION public.handle_client_plan_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_m3u_id uuid;
  old_plan_type text;
  new_plan_type text;
BEGIN
  -- Determinar tipo de plano antigo
  IF OLD.situacao IN ('Testando', 'Lead') THEN
    old_plan_type := 'teste';
  ELSIF OLD.plano IN ('Semestral', 'Anual') THEN
    old_plan_type := 'premium';
  ELSE
    old_plan_type := 'basico';
  END IF;

  -- Determinar tipo de plano novo
  IF NEW.situacao IN ('Testando', 'Lead') THEN
    new_plan_type := 'teste';
  ELSIF NEW.plano IN ('Semestral', 'Anual') THEN
    new_plan_type := 'premium';
  ELSE
    new_plan_type := 'basico';
  END IF;

  -- Se mudou de plano, resetar status de sincronização para forçar nova sync
  IF old_plan_type != new_plan_type THEN
    NEW.smartone_status := 'pendente';
    NEW.smartone_last_sync_at := NULL;
    
    -- Log da mudança
    RAISE NOTICE 'Cliente % mudou de plano % para %. Status resetado para re-sincronização.', 
      NEW.id, old_plan_type, new_plan_type;
  END IF;

  RETURN NEW;
END;
$$;

-- Criar trigger na tabela clientes
DROP TRIGGER IF EXISTS trigger_client_plan_change ON public.clientes;
CREATE TRIGGER trigger_client_plan_change
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW
  WHEN (
    OLD.situacao IS DISTINCT FROM NEW.situacao OR 
    OLD.plano IS DISTINCT FROM NEW.plano
  )
  EXECUTE FUNCTION public.handle_client_plan_change();

-- Atualizar listas existentes para ter um plano padrão
UPDATE public.m3u_lists
SET plan_type = 'teste', priority = 10
WHERE is_default = true;

-- Comentário na função
COMMENT ON FUNCTION public.get_m3u_for_client_plan IS 'Retorna o ID da lista M3U apropriada baseada no plano e situação do cliente. Usa hierarquia: plano específico > padrão > qualquer ativa.';