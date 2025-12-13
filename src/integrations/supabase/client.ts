/**
 * Supabase client - Self-Hosted Only
 * 
 * Este arquivo aponta exclusivamente para o Supabase Self-Hosted no Coolify.
 * URL: https://supabase.iptvlink.com.br
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Self-Hosted Supabase configuration (Coolify)
const SUPABASE_URL = "https://supabase.iptvlink.com.br";
const SUPABASE_PUBLISHABLE_KEY = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2NTIyMDgyMCwiZXhwIjo0OTIwODk0NDIwLCJyb2xlIjoiYW5vbiJ9.55tQdiEEa0mlCvveFpQZwMHqDZt0DzAgUQOPpLCNDLU";

// Debug log to verify correct URL is being used
console.log('[Supabase Client] Using Self-Hosted URL:', SUPABASE_URL);

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase: SupabaseClient<Database> = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: typeof window !== 'undefined' ? localStorage : undefined,
    storageKey: 'sb-auth',
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
