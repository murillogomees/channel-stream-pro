-- =====================================================
-- Migration: [migration_name]
-- Description: [Brief description]
-- Author: [author]
-- Date: [YYYY-MM-DD]
-- Reversible: YES
-- =====================================================

-- PRE-FLIGHT CHECKS
DO $$
BEGIN
  -- Add any prerequisite checks here
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'required_table') THEN
    RAISE EXCEPTION 'Prerequisite table not found';
  END IF;
END $$;

-- BACKUP (if modifying existing data)
-- CREATE TABLE IF NOT EXISTS _backup_[table_name]_[date] AS SELECT * FROM [table_name];

BEGIN;

-- =====================================================
-- UP MIGRATION
-- =====================================================

-- 1. Create new table
CREATE TABLE IF NOT EXISTS public.new_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Add indexes
CREATE INDEX IF NOT EXISTS idx_new_table_created ON public.new_table(created_at DESC);

-- 3. Enable RLS
ALTER TABLE public.new_table ENABLE ROW LEVEL SECURITY;

-- 4. Create policies
CREATE POLICY "policy_name" ON public.new_table FOR SELECT USING (true);

-- 5. Create trigger for updated_at
CREATE TRIGGER update_new_table_updated_at
BEFORE UPDATE ON public.new_table
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;

-- =====================================================
-- DOWN MIGRATION (ROLLBACK)
-- =====================================================
/*
BEGIN;

DROP TRIGGER IF EXISTS update_new_table_updated_at ON public.new_table;
DROP POLICY IF EXISTS "policy_name" ON public.new_table;
DROP TABLE IF EXISTS public.new_table;

-- Restore from backup if needed:
-- INSERT INTO [table_name] SELECT * FROM _backup_[table_name]_[date];
-- DROP TABLE _backup_[table_name]_[date];

COMMIT;
*/

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
/*
-- Verify table exists
SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'new_table';

-- Verify RLS enabled
SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'new_table';

-- Verify policies
SELECT policyname FROM pg_policies WHERE tablename = 'new_table';
*/