-- =====================================================
-- Sistema de Lista M3U Padrão
-- =====================================================
-- Execute este SQL no Supabase SQL Editor:
-- https://supabase.com/dashboard/project/fcmwpbgdehtuqxcjqmxi/sql/new
-- =====================================================

-- Adicionar coluna is_default na tabela m3u_lists
ALTER TABLE public.m3u_lists 
ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;

-- Criar índice para busca rápida da lista padrão
CREATE INDEX IF NOT EXISTS idx_m3u_lists_default 
ON public.m3u_lists(is_default) 
WHERE is_default = true;

-- Criar função para garantir apenas uma lista padrão por vez
CREATE OR REPLACE FUNCTION public.ensure_single_default_m3u()
RETURNS TRIGGER AS $$
BEGIN
  -- Se a nova linha está sendo marcada como padrão
  IF NEW.is_default = true THEN
    -- Desmarcar todas as outras listas
    UPDATE public.m3u_lists 
    SET is_default = false 
    WHERE id != NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger para garantir apenas uma lista padrão
DROP TRIGGER IF EXISTS trigger_ensure_single_default_m3u ON public.m3u_lists;
CREATE TRIGGER trigger_ensure_single_default_m3u
  BEFORE INSERT OR UPDATE ON public.m3u_lists
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_single_default_m3u();

-- Comentários para documentação
COMMENT ON COLUMN public.m3u_lists.is_default IS 'Indica se esta é a lista M3U padrão usada para novos cadastros e testes grátis';
COMMENT ON FUNCTION public.ensure_single_default_m3u() IS 'Garante que apenas uma lista M3U seja marcada como padrão por vez';
