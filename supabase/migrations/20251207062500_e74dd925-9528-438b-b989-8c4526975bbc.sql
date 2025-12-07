-- Adicionar coluna user_id em profiles (será deprecada no futuro, id será a coluna definitiva)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS user_id uuid;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);

-- Preencher user_id com o próprio id para registros existentes
UPDATE public.profiles SET user_id = id WHERE user_id IS NULL;

-- Adicionar comentário explicando que é deprecated
COMMENT ON COLUMN public.profiles.user_id IS 'DEPRECATED: Usar coluna id diretamente. Mantida temporariamente para compatibilidade com migração de clientes.';