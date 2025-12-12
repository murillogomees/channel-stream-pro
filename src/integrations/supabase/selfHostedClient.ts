/**
 * Self-Hosted Supabase Client
 * 
 * Reexporta do cliente principal - apenas self-hosted.
 */
import { supabase, supabaseConfig, getFunctionUrl } from "./client";
import type { Database } from "./types";

// Self-hosted URL (único)
export const SELF_HOSTED_BASE_URL = supabaseConfig.url;

// Sempre configurado (apenas self-hosted)
export const isSelfHostedConfigured = (): boolean => true;

// Retorna o cliente principal
export const getSelfHostedClient = () => supabase;

// Chama edge functions no self-hosted
export const callSelfHostedFunction = async <T = unknown>(
  functionName: string,
  body?: Record<string, unknown>,
  options?: { 
    method?: 'GET' | 'POST';
    headers?: Record<string, string>;
  }
): Promise<{ data: T | null; error: Error | null }> => {
  const url = getFunctionUrl(functionName);
  
  try {
    const response = await fetch(url, {
      method: options?.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseConfig.anonKey}`,
        ...options?.headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    const data = await response.json();
    return { data, error: null };
  } catch (err) {
    console.error(`[SelfHosted] Function ${functionName} error:`, err);
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
};
