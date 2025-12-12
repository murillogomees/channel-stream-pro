/**
 * Supabase Client Wrapper - 100% Self-Hosted
 * 
 * Este arquivo redireciona TODAS as operações para o Supabase Self-Hosted.
 * URL: https://supabase.iptvlink.com.br
 * 
 * Para migrar um arquivo, altere o import de:
 *   import { supabase } from '@/integrations/supabase/client';
 * Para:
 *   import { supabase } from '@/integrations/supabase-client';
 */

import { selfHostedSupabase, selfHostedConfig } from './selfhosted/client';
import { supabase as cloudSupabase } from './supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './supabase/types';

// ============================================
// CONFIGURAÇÃO: 100% SELF-HOSTED
// ============================================
const USE_SELFHOSTED = true;

// Export principal - aponta para self-hosted
export const supabase: SupabaseClient<Database> = USE_SELFHOSTED 
  ? selfHostedSupabase 
  : cloudSupabase;

// Função getter para uso dinâmico
export const getSupabaseClient = (): SupabaseClient<Database> => {
  return USE_SELFHOSTED ? selfHostedSupabase : cloudSupabase;
};

// Export configuration
export const getSupabaseConfig = () => {
  if (USE_SELFHOSTED) {
    return selfHostedConfig;
  }
  return {
    url: import.meta.env.VITE_SUPABASE_URL,
    anonKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
};

// Constantes para uso em Edge Functions e configs
export const SELFHOSTED_URL = "https://supabase.iptvlink.com.br";
export const SELFHOSTED_FUNCTIONS_URL = `${SELFHOSTED_URL}/functions/v1`;

// Default export
export const supabaseClient = supabase;

// Re-exports para compatibilidade
export { selfHostedSupabase } from './selfhosted/client';
export { supabase as cloudSupabase } from './supabase/client';
