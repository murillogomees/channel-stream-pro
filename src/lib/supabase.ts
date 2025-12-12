/**
 * Supabase Client Proxy
 * 
 * This file redirects all Supabase operations to the self-hosted instance.
 * Import this instead of @/integrations/supabase/client for self-hosted operations.
 */

import { selfHostedSupabase } from "@/integrations/selfhosted/client";

// Re-export the self-hosted client as the main supabase client
export const supabase = selfHostedSupabase;

// Export default for convenience
export default supabase;
