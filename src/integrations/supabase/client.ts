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

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  // Fail fast with a clear error so we don't get silent "Failed to fetch" later.
  // eslint-disable-next-line no-console
  console.error(
    "[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Check backend connection/env vars."
  );
}

const projectRef = (import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined) ??
  (SUPABASE_URL ? getProjectRefFromUrl(SUPABASE_URL) : null) ??
  "unknown";

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
