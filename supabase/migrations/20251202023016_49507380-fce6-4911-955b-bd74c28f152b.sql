-- ================================================
-- MIGRATION: Consolidate Phone Fields
-- Consolida telefone e telefone_whatsapp em contact_phone
-- Data: 2024-12-02
-- ================================================

-- 1. Adicionar nova coluna contact_phone se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'contact_phone'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN contact_phone TEXT;
    
    RAISE NOTICE 'Coluna contact_phone criada com sucesso';
  ELSE
    RAISE NOTICE 'Coluna contact_phone já existe';
  END IF;
END $$;

-- 2. Migrar dados: prioriza telefone_whatsapp, depois telefone
UPDATE public.profiles
SET contact_phone = COALESCE(telefone_whatsapp, telefone)
WHERE contact_phone IS NULL 
  AND (telefone_whatsapp IS NOT NULL OR telefone IS NOT NULL);

-- 3. Log de conflitos (onde telefone != telefone_whatsapp)
DO $$
DECLARE
  conflict_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO conflict_count
  FROM public.profiles
  WHERE telefone IS NOT NULL 
    AND telefone_whatsapp IS NOT NULL 
    AND telefone != telefone_whatsapp;
  
  IF conflict_count > 0 THEN
    RAISE NOTICE 'ATENÇÃO: % registros com telefone diferente de whatsapp (priorizou whatsapp)', conflict_count;
  END IF;
END $$;

-- 4. Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_profiles_contact_phone 
ON public.profiles(contact_phone);

-- 5. Marcar colunas antigas como deprecated (comentário)
COMMENT ON COLUMN public.profiles.telefone IS 'DEPRECATED: Use contact_phone';
COMMENT ON COLUMN public.profiles.telefone_whatsapp IS 'DEPRECATED: Use contact_phone';

-- ================================================
-- VERIFICATION QUERY
-- ================================================
-- Verificar migração
SELECT 
  COUNT(*) as total_profiles,
  COUNT(contact_phone) as profiles_with_contact,
  COUNT(telefone) as profiles_with_telefone,
  COUNT(telefone_whatsapp) as profiles_with_whatsapp,
  COUNT(contact_phone) * 100.0 / NULLIF(COUNT(*), 0) as percentage_filled
FROM public.profiles;

-- ================================================
-- ROLLBACK SCRIPT (se necessário)
-- ================================================
-- Para reverter:
-- UPDATE public.profiles 
-- SET telefone = contact_phone, telefone_whatsapp = contact_phone 
-- WHERE contact_phone IS NOT NULL;
-- 
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS contact_phone;
-- DROP INDEX IF EXISTS idx_profiles_contact_phone;