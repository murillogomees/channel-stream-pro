-- =====================================================
-- SCRIPT 10: CREATE ALL TYPES
-- Source: Lovable Cloud (waxgowafohlrfoefwhsf)
-- Target: Supabase Cloud (sdvyxdghxqmntyoweqbd)
-- Execute BEFORE creating tables
-- =====================================================

-- Create app_role enum type
CREATE TYPE public.app_role AS ENUM ('client', 'admin', 'master');
