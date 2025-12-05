/**
 * Check Secrets Configuration
 * 
 * SECURITY HARDENED: Requires admin/master JWT authentication
 * Only reveals if secrets are configured, not their values
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ========================================
    // SECURITY: Require JWT Authentication
    // ========================================
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const jwt = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create client with user's JWT to verify identity
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } }
    });
    
    // Get user from JWT
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ========================================
    // SECURITY: Verify Admin/Master Role
    // ========================================
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: isAdmin } = await supabase.rpc('is_admin_or_master', { 
      user_id: user.id 
    });
    
    if (!isAdmin) {
      console.log(`[check-secrets] Access denied for user ${user.id}`);
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ========================================
    // Process Request (Admin only)
    // ========================================
    const { secrets } = await req.json();
    
    if (!Array.isArray(secrets)) {
      return new Response(
        JSON.stringify({ error: "secrets must be an array" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Limit the number of secrets that can be checked
    if (secrets.length > 20) {
      return new Response(
        JSON.stringify({ error: "Maximum 20 secrets can be checked at once" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const result: Record<string, { name: string; isConfigured: boolean; loading: boolean }> = {};

    // Check if each secret is configured (without exposing values)
    for (const secretName of secrets) {
      // Only allow checking specific known secret names
      const allowedSecrets = [
        'MERCADO_PAGO_ACCESS_TOKEN',
        'MERCADO_PAGO_WEBHOOK_SECRET',
        'WHATSAPP_APPKEY',
        'WHATSAPP_AUTHKEY',
        'SUPABASE_SERVICE_ROLE_KEY',
        'CLOUDFLARE_ACCOUNT_ID',
        'CLOUDFLARE_API_TOKEN',
        'R2_ACCESS_KEY_ID',
        'R2_SECRET_ACCESS_KEY',
        'STREAM_PROXY_SECRET',
        'SMARTONE_API_KEY',
        'CRON_SECRET',
      ];
      
      if (!allowedSecrets.includes(secretName)) {
        result[secretName] = {
          name: secretName,
          isConfigured: false,
          loading: false,
        };
        continue;
      }
      
      const value = Deno.env.get(secretName);
      result[secretName] = {
        name: secretName,
        isConfigured: !!value && value.length > 0,
        loading: false,
      };
    }

    console.log(`[check-secrets] Admin ${user.email} checked ${secrets.length} secrets`);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[check-secrets] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});