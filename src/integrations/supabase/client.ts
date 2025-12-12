// Supabase client - Using Lovable Cloud
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Lovable Cloud Supabase configuration
const SUPABASE_URL = "https://waxgowafohlrfoefwhsf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndheGdvd2Fmb2hscmZvZWZ3aHNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNzAzMDMsImV4cCI6MjA4MDg0NjMwM30.dgqou7A6mcKc5hmn7aV15FDhkEf0uA3hiYp8v_T2MBw";

// Debug log to verify correct URL is being used
console.log('[Supabase Client] Using URL:', SUPABASE_URL);

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    storageKey: 'sb-cloud-auth',
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
      "X-Client-Info": "iptv-link-web",
    },
  },
});
