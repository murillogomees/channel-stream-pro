/**
 * Supabase Client Proxy
 * Reexporta o cliente principal para compatibilidade.
 */
import { supabase } from "@/integrations/supabase/client";

export { supabase };
export default supabase;
