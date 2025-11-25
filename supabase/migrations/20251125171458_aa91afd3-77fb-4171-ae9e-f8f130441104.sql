-- Fix FK violation for audit log when deleting m3u_lists
-- We want to allow audit records to exist even after the main list is deleted
ALTER TABLE public.m3u_lists_audit
DROP CONSTRAINT IF EXISTS m3u_lists_audit_m3u_list_id_fkey;