
-- Adicionar 'master' ao enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum WHERE enumlabel = 'master' AND enumtypid = 'app_role'::regtype
  ) THEN
    EXECUTE 'ALTER TYPE app_role ADD VALUE ''master''';
  END IF;
END$$;
