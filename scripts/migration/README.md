-- =====================================================
-- COMPLETE MIGRATION ORDER
-- Source: Lovable Cloud (waxgowafohlrfoefwhsf)
-- Target: Supabase Cloud (sdvyxdghxqmntyoweqbd)
-- =====================================================

-- STEP 1: CLEANUP (execute in order)
-- 00-complete-cleanup.sql (or individual scripts 01-08)

-- STEP 2: CREATE SCHEMA (execute in order)
-- 10-create-types.sql
-- 11-create-functions.sql
-- 12-create-tables.sql
-- 13-create-indexes.sql
-- 14-create-rls-policies.sql
-- 15-create-triggers.sql

-- STEP 3: MIGRATE DATA
-- Use the data-migration Edge Function with action: 'migrate-all'
