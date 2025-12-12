/**
 * Self-Hosted Supabase Client
 * 
 * This is the PRIMARY client for the application.
 * All operations should use this client instead of the Lovable Cloud client.
 * 
 * Self-hosted URL: https://supabase.iptvlink.com.br
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/types";

// Self-hosted Supabase configuration
const SELFHOSTED_URL = "https://supabase.iptvlink.com.br";

// Anon key for self-hosted instance (Coolify deployment)
const SELFHOSTED_ANON_KEY = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2NTIyMDgyMCwiZXhwIjo0OTIwODk0NDIwLCJyb2xlIjoiYW5vbiJ9.55tQdiEEa0mlCvveFpQZwMHqDZt0DzAgUQOPpLCNDLU";

// Storage key for custom auth session
const CUSTOM_AUTH_STORAGE_KEY = 'custom_auth_session';

// Helper to get custom auth token from localStorage
const getCustomAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(CUSTOM_AUTH_STORAGE_KEY);
    if (stored) {
      const session = JSON.parse(stored);
      if (session.expires_at > Date.now() && session.access_token) {
        return session.access_token;
      }
    }
  } catch (e) {
    console.error('[Self-Hosted] Error reading custom auth token:', e);
  }
  return null;
};

// Debug logging
console.log('[Self-Hosted Supabase] Using URL:', SELFHOSTED_URL);

// Create the self-hosted client with dynamic auth header
export const selfHostedSupabase: SupabaseClient<Database> = createClient<Database>(
  SELFHOSTED_URL,
  SELFHOSTED_ANON_KEY,
  {
    auth: {
      storage: typeof window !== 'undefined' ? localStorage : undefined,
      storageKey: 'sb-selfhosted-auth',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
    realtime: {
      params: {
        eventsPerSecond: 2,
      },
      log_level: "error",
    },
    global: {
      headers: {
        "X-Client-Info": "iptv-link-selfhosted",
      },
      fetch: (url, options: RequestInit = {}) => {
        // Inject custom auth token into requests
        const customToken = getCustomAuthToken();
        if (customToken) {
          const headers = new Headers(options.headers as HeadersInit);
          headers.set('Authorization', `Bearer ${customToken}`);
          options = { ...options, headers };
        }
        return fetch(url, options);
      },
    },
  }
);

// Export configuration for edge functions and other services
export const selfHostedConfig = {
  url: SELFHOSTED_URL,
  anonKey: SELFHOSTED_ANON_KEY,
  projectRef: "iptvlink-selfhosted",
};

// Helper to get edge function URL for self-hosted
export const getSelfHostedFunctionUrl = (functionName: string): string => {
  return `${SELFHOSTED_URL}/functions/v1/${functionName}`;
};

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
