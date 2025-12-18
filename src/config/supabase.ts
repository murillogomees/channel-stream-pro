/**
 * Backend configuration (URL + public key)
 *
 * Keep this file free of hardcoded credentials so it always matches the currently connected backend.
 */

/**
 * LOVABLE CLOUD PROJECT
 * Usa variáveis de ambiente fornecidas automaticamente pelo Lovable
 */
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://waxgowafohlrfoefwhsf.supabase.co";
export const SUPABASE_FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndheGdvd2Fmb2hscmZvZWZ3aHNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNzAzMDMsImV4cCI6MjA4MDg0NjMwM30.dgqou7A6mcKc5hmn7aV15FDhkEf0uA3hiYp8v_T2MBw";
