/**
 * Self-Hosted Supabase Client
 * Connects to VPS self-hosted Supabase for heavy operations
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Self-hosted Supabase configuration (VPS)
const SELF_HOSTED_URL = import.meta.env.VITE_SUPABASE_SELFHOSTED_URL || "https://srv1182856.hstgr.cloud";
const SELF_HOSTED_KEY = import.meta.env.VITE_SUPABASE_SELFHOSTED_KEY || "";

// Check if self-hosted is configured
export const isSelfHostedConfigured = (): boolean => {
  return Boolean(SELF_HOSTED_URL && SELF_HOSTED_KEY);
};

// Create self-hosted client (lazy initialization)
let selfHostedInstance: SupabaseClient<Database> | null = null;

export const getSelfHostedClient = (): SupabaseClient<Database> | null => {
  if (!isSelfHostedConfigured()) {
    console.warn('[SelfHosted] Not configured - missing URL or key');
    return null;
  }
  
  if (!selfHostedInstance) {
    console.log('[SelfHosted] Initializing client:', SELF_HOSTED_URL);
    
    selfHostedInstance = createClient<Database>(SELF_HOSTED_URL, SELF_HOSTED_KEY, {
      auth: {
        storage: localStorage,
        persistSession: false, // Don't persist self-hosted session
        autoRefreshToken: false,
      },
      global: {
        headers: {
          "X-Client-Info": "iptv-link-selfhosted",
        },
      },
    });
  }
  
  return selfHostedInstance;
};

// Direct API call to self-hosted Edge Functions
export const callSelfHostedFunction = async <T = unknown>(
  functionName: string,
  body?: Record<string, unknown>,
  options?: { 
    method?: 'GET' | 'POST';
    headers?: Record<string, string>;
  }
): Promise<{ data: T | null; error: Error | null }> => {
  if (!isSelfHostedConfigured()) {
    return { data: null, error: new Error('Self-hosted not configured') };
  }
  
  const url = `${SELF_HOSTED_URL}/functions/v1/${functionName}`;
  
  try {
    const response = await fetch(url, {
      method: options?.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SELF_HOSTED_KEY}`,
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

// Export URL for reference
export const SELF_HOSTED_BASE_URL = SELF_HOSTED_URL;
