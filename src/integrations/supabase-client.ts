/**
 * Supabase Client - Cloud Only
 * 
 * Este arquivo aponta para o Supabase Cloud.
 */

import { supabase, supabaseConfig, getFunctionUrl } from './supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './supabase/types';

// Export principal
export { supabase };

// Função getter para uso dinâmico
export const getSupabaseClient = (): SupabaseClient<Database> => {
  return supabase;
};

// Export configuration
export const getSupabaseConfig = () => supabaseConfig;

// Default export
export const supabaseClient = supabase;

// Alias for backwards compatibility
export const selfHostedSupabase = supabase;
