/**
 * Supabase Client
 *
 * IMPORTANT: this must be configured via Vite env vars provided by the backend integration.
 * Never hardcode project URLs/keys here, otherwise Edge Functions will break when the backend changes.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

function getProjectRefFromUrl(url: string): string | null {
  try {
    const { hostname } = new URL(url);
    // <ref>.supabase.co
    const parts = hostname.split(".");
    return parts.length > 0 ? parts[0] : null;
  } catch {
    return null;
  }
}

/**
 * SUPABASE CLOUD PROJECT: sdvyxdghxqmntyoweqbd
 * Este é o projeto padrão de produção - NÃO usar Lovable Cloud
 */
const SUPABASE_URL = "https://sdvyxdghxqmntyoweqbd.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkdnl4ZGdoeHFtbnR5b3dlcWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMzMxNTAsImV4cCI6MjA3ODYwOTE1MH0.60t5M81zC_UI5qr3Pfjy0Pa2AKqglMQu7RLmE0K2iak";

// Forçar projectRef para sdvyxdghxqmntyoweqbd
const projectRef = 'sdvyxdghxqmntyoweqbd';

export const supabase: SupabaseClient<Database> = createClient<Database>(
  SUPABASE_URL ?? "",
  SUPABASE_PUBLISHABLE_KEY ?? "",
  {
    auth: {
      storage: typeof window !== "undefined" ? localStorage : undefined,
      storageKey: `sb-${projectRef}-auth-token`,
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
        "X-Client-Info": "iptv-link-cloud",
      },
    },
  }
);

export const supabaseConfig = {
  url: SUPABASE_URL ?? "",
  anonKey: SUPABASE_PUBLISHABLE_KEY ?? "",
  projectRef,
};

export const getFunctionUrl = (functionName: string): string => {
  return `${supabaseConfig.url}/functions/v1/${functionName}`;
};
