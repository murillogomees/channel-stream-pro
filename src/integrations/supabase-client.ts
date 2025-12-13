/**
 * Supabase Client - Self-Hosted Only
 * 
 * Este arquivo aponta exclusivamente para o Supabase Self-Hosted.
 * URL: https://supabase.iptvlink.com.br
 */

import { supabase, supabaseConfig, getFunctionUrl } from './supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './supabase/types';

// Export principal - sempre self-hosted
export { supabase };

// Função getter para uso dinâmico
export const getSupabaseClient = (): SupabaseClient<Database> => {
  return supabase;
};

// Export configuration
export const getSupabaseConfig = () => supabaseConfig;

// Constantes para uso em Edge Functions e configs
export const SELFHOSTED_URL = "https://supabase.iptvlink.com.br";
export const SELFHOSTED_FUNCTIONS_URL = `${SELFHOSTED_URL}/functions/v1`;

// Default export
export const supabaseClient = supabase;

// Re-exports para compatibilidade
export { selfHostedSupabase } from './selfhosted/client';
