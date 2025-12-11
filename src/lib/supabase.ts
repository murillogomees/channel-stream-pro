/**
 * Supabase Self-Hosted Client
 * Configuração exclusiva para instância self-hosted
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/config/supabase";

console.log('[Supabase Self-Hosted] Using URL:', SUPABASE_URL);

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
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
      "X-Client-Info": "iptv-link-web-selfhosted",
    },
  },
});

// Re-export types for convenience
export type { Database } from "@/integrations/supabase/types";
