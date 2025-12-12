/**
 * Supabase client - Self-Hosted Only
 * 
 * Este arquivo aponta exclusivamente para o Supabase Self-Hosted no Coolify.
 * URL: https://supabase.iptvlink.com.br
 * 
 * NÃO HÁ MAIS SUPABASE CLOUD - apenas self-hosted.
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Self-Hosted Supabase configuration (Coolify)
const SUPABASE_URL = "https://supabase.iptvlink.com.br";
const SUPABASE_PUBLISHABLE_KEY = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2NTIyMDgyMCwiZXhwIjo0OTIwODk0NDIwLCJyb2xlIjoiYW5vbiJ9.55tQdiEEa0mlCvveFpQZwMHqDZt0DzAgUQOPpLCNDLU";

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
    console.error('[Supabase] Error reading custom auth token:', e);
  }
  return null;
};

// Debug log to verify correct URL is being used
console.log('[Supabase Client] Using Self-Hosted URL:', SUPABASE_URL);

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase: SupabaseClient<Database> = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
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
});

// Export configuration for services
export const supabaseConfig = {
  url: SUPABASE_URL,
  anonKey: SUPABASE_PUBLISHABLE_KEY,
};

// Helper to get edge function URL
export const getFunctionUrl = (functionName: string): string => {
  return `${SUPABASE_URL}/functions/v1/${functionName}`;
};
