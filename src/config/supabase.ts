/**
 * Backend configuration (URL + public key)
 *
 * Keep this file free of hardcoded credentials so it always matches the currently connected backend.
 */

export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "";
export const SUPABASE_FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

// Public publishable key (safe for frontend). Provided automatically by the backend integration.
export const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? "";
