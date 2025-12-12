/**
 * Supabase Client Wrapper
 * 
 * This file provides a unified interface that can switch between
 * Lovable Cloud and Self-Hosted Supabase based on configuration.
 * 
 * For 100% self-hosted migration, this will be the primary client.
 */

import { selfHostedSupabase, selfHostedConfig } from './selfhosted/client';
import { supabase as cloudSupabase } from './supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './supabase/types';

// Configuration flag - set to true for 100% self-hosted
const USE_SELFHOSTED = true;

// Export the appropriate client based on configuration
export const getSupabaseClient = (): SupabaseClient<Database> => {
  if (USE_SELFHOSTED) {
    console.log('[Supabase] Using Self-Hosted client');
    return selfHostedSupabase;
  }
  console.log('[Supabase] Using Cloud client');
  return cloudSupabase;
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

// Default export - the active client
export const supabaseClient = getSupabaseClient();

// Re-export for convenience
export { selfHostedSupabase } from './selfhosted/client';
export { supabase as cloudSupabase } from './supabase/client';
