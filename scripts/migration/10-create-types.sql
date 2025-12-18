-- =====================================================
-- SCRIPT 10: CREATE ALL TYPES
-- Supabase Cloud Project: sdvyxdghxqmntyoweqbd
-- Execute BEFORE creating tables
-- =====================================================
-- =====================================================

-- Create app_role enum type
CREATE TYPE public.app_role AS ENUM ('client', 'admin', 'master');
