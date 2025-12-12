/**
 * Self-Hosted Supabase Client
 * 
 * Reexporta o cliente principal - agora há apenas um cliente self-hosted.
 */

import { supabase, supabaseConfig, getFunctionUrl } from '../supabase/client';

// Reexport with legacy names for backward compatibility
export const selfHostedSupabase = supabase;
export const selfHostedConfig = supabaseConfig;
export const getSelfHostedFunctionUrl = getFunctionUrl;

// Helper to invoke self-hosted edge functions
export const invokeSelfHostedFunction = async <T = unknown>(
  functionName: string,
  options?: {
    body?: Record<string, unknown>;
    headers?: Record<string, string>;
  }
): Promise<{ data: T | null; error: Error | null }> => {
  try {
    const { data, error } = await selfHostedSupabase.functions.invoke<T>(functionName, {
      body: options?.body,
      headers: options?.headers,
    });
    
    if (error) {
      console.error(`[Self-Hosted Function ${functionName}] Error:`, error);
      return { data: null, error };
    }
    
    return { data, error: null };
  } catch (err) {
    console.error(`[Self-Hosted Function ${functionName}] Exception:`, err);
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
};

export default selfHostedSupabase;
