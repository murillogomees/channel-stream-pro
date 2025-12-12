import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SELFHOSTED_URL = "https://supabase.iptvlink.com.br";
const SELFHOSTED_ANON_KEY = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2NTIyMDgyMCwiZXhwIjo0OTIwODk0NDIwLCJyb2xlIjoiYW5vbiJ9.55tQdiEEa0mlCvveFpQZwMHqDZt0DzAgUQOPpLCNDLU";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const results: Record<string, any> = {};

    // 1. Check GoTrue Health
    try {
      const healthResponse = await fetch(`${SELFHOSTED_URL}/auth/v1/health`, {
        headers: {
          'apikey': SELFHOSTED_ANON_KEY,
          'Authorization': `Bearer ${SELFHOSTED_ANON_KEY}`,
        }
      });
      results.health = {
        status: healthResponse.status,
        ok: healthResponse.ok,
        data: await healthResponse.json().catch(() => null),
      };
    } catch (error) {
      results.health = { error: error.message };
    }

    // 2. Check GoTrue Settings (public endpoint)
    try {
      const settingsResponse = await fetch(`${SELFHOSTED_URL}/auth/v1/settings`, {
        headers: {
          'apikey': SELFHOSTED_ANON_KEY,
          'Authorization': `Bearer ${SELFHOSTED_ANON_KEY}`,
        }
      });
      results.settings = {
        status: settingsResponse.status,
        ok: settingsResponse.ok,
        data: await settingsResponse.json().catch(() => null),
      };
    } catch (error) {
      results.settings = { error: error.message };
    }

    // 3. Check if we can reach the token endpoint
    try {
      const tokenResponse = await fetch(`${SELFHOSTED_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SELFHOSTED_ANON_KEY,
          'Authorization': `Bearer ${SELFHOSTED_ANON_KEY}`,
        },
        body: JSON.stringify({ email: 'test@test.com', password: 'invalid' }),
      });
      const tokenData = await tokenResponse.json().catch(() => null);
      results.token_endpoint = {
        status: tokenResponse.status,
        accessible: true,
        response: tokenData,
      };
    } catch (error) {
      results.token_endpoint = { error: error.message, accessible: false };
    }

    // 4. Check database directly - list auth.users
    try {
      const dbResponse = await fetch(`${SELFHOSTED_URL}/rest/v1/rpc/is_admin_or_master`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SELFHOSTED_ANON_KEY,
          'Authorization': `Bearer ${SELFHOSTED_ANON_KEY}`,
        },
        body: JSON.stringify({}),
      });
      results.db_rpc = {
        status: dbResponse.status,
        ok: dbResponse.ok,
      };
    } catch (error) {
      results.db_rpc = { error: error.message };
    }

    // 5. Check profiles table
    try {
      const profilesResponse = await fetch(`${SELFHOSTED_URL}/rest/v1/profiles?select=id,email&limit=5`, {
        headers: {
          'apikey': SELFHOSTED_ANON_KEY,
          'Authorization': `Bearer ${SELFHOSTED_ANON_KEY}`,
        }
      });
      results.profiles = {
        status: profilesResponse.status,
        ok: profilesResponse.ok,
        data: await profilesResponse.json().catch(() => null),
      };
    } catch (error) {
      results.profiles = { error: error.message };
    }

    // 6. Check user_roles table
    try {
      const rolesResponse = await fetch(`${SELFHOSTED_URL}/rest/v1/user_roles?select=*&limit=5`, {
        headers: {
          'apikey': SELFHOSTED_ANON_KEY,
          'Authorization': `Bearer ${SELFHOSTED_ANON_KEY}`,
        }
      });
      results.user_roles = {
        status: rolesResponse.status,
        ok: rolesResponse.ok,
        data: await rolesResponse.json().catch(() => null),
      };
    } catch (error) {
      results.user_roles = { error: error.message };
    }

    return new Response(
      JSON.stringify({
        success: true,
        selfhosted_url: SELFHOSTED_URL,
        anon_key_prefix: SELFHOSTED_ANON_KEY.substring(0, 50) + '...',
        results,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[check-gotrue-config] Exception:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
