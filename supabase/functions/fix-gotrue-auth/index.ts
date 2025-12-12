import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SELFHOSTED_URL = "https://supabase.iptvlink.com.br";
const SELFHOSTED_ANON_KEY = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2NTIyMDgyMCwiZXhwIjo0OTIwODk0NDIwLCJyb2xlIjoiYW5vbiJ9.55tQdiEEa0mlCvveFpQZwMHqDZt0DzAgUQOPpLCNDLU";
const SELFHOSTED_SERVICE_KEY = Deno.env.get('SELFHOSTED_SERVICE_ROLE_KEY') || '';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, email, password } = await req.json();
    const results: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      action,
    };

    // 1. Test using Supabase JS client
    if (action === 'signup-with-client') {
      const supabase = createClient(SELFHOSTED_URL, SELFHOSTED_ANON_KEY);
      const { data, error } = await supabase.auth.signUp({
        email: email || `test-client-${Date.now()}@test.com`,
        password: password || 'TestPassword123!',
      });
      results.client_signup = {
        success: !error,
        user_id: data?.user?.id || null,
        error: error?.message || null,
        error_code: error?.code || null,
      };
    }
    
    // 2. Test login with existing user using client
    else if (action === 'login-with-client') {
      const supabase = createClient(SELFHOSTED_URL, SELFHOSTED_ANON_KEY);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      results.client_login = {
        success: !error,
        user_id: data?.user?.id || null,
        session_present: !!data?.session,
        error: error?.message || null,
        error_code: error?.code || null,
      };
    }
    
    // 3. Test admin API access
    else if (action === 'admin-list-users') {
      const supabase = createClient(SELFHOSTED_URL, SELFHOSTED_SERVICE_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        }
      });
      const { data, error } = await supabase.auth.admin.listUsers();
      results.admin_list = {
        success: !error,
        users_count: data?.users?.length || 0,
        users: data?.users?.map((u: { id: string; email?: string }) => ({ id: u.id, email: u.email })) || [],
        error: error?.message || null,
      };
    }
    
    // 4. Test admin update password
    else if (action === 'admin-update-password') {
      const supabase = createClient(SELFHOSTED_URL, SELFHOSTED_SERVICE_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        }
      });
      
      // First list users to find the one
      const { data: listData } = await supabase.auth.admin.listUsers();
      const targetUser = listData?.users?.find((u: { email?: string }) => u.email === email);
      
      if (targetUser) {
        const { data, error } = await supabase.auth.admin.updateUserById(
          targetUser.id,
          { password }
        );
        results.admin_update = {
          success: !error,
          user_id: data?.user?.id || null,
          email: data?.user?.email || null,
          error: error?.message || null,
        };
      } else {
        results.admin_update = {
          success: false,
          error: `User not found: ${email}`,
          available_users: listData?.users?.map((u: { email?: string }) => u.email) || [],
        };
      }
    }
    
    // 5. Create user via admin API
    else if (action === 'admin-create-user') {
      const supabase = createClient(SELFHOSTED_URL, SELFHOSTED_SERVICE_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        }
      });
      
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      
      results.admin_create = {
        success: !error,
        user_id: data?.user?.id || null,
        email: data?.user?.email || null,
        error: error?.message || null,
      };
    }
    
    // 6. Full diagnostic
    else if (action === 'full-diagnostic') {
      // Test REST API
      const restResponse = await fetch(`${SELFHOSTED_URL}/rest/v1/profiles?select=id,email&limit=5`, {
        headers: {
          'apikey': SELFHOSTED_SERVICE_KEY,
          'Authorization': `Bearer ${SELFHOSTED_SERVICE_KEY}`,
        }
      });
      const restData = await restResponse.json().catch(() => null);
      results.rest_api = {
        status: restResponse.status,
        profiles_count: restData?.length || 0,
        profiles: restData || [],
      };

      // Test auth health
      const authHealth = await fetch(`${SELFHOSTED_URL}/auth/v1/health`);
      results.auth_health = {
        status: authHealth.status,
        data: await authHealth.json().catch(() => null),
      };

      // Test admin users via client
      const supabase = createClient(SELFHOSTED_URL, SELFHOSTED_SERVICE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false }
      });
      const { data: adminData, error: adminError } = await supabase.auth.admin.listUsers();
      results.admin_users = {
        success: !adminError,
        count: adminData?.users?.length || 0,
        emails: adminData?.users?.map((u: { email?: string }) => u.email) || [],
        error: adminError?.message || null,
      };

      // Test direct GoTrue admin endpoint
      const gotrueAdminResponse = await fetch(`${SELFHOSTED_URL}/auth/v1/admin/users`, {
        headers: {
          'apikey': SELFHOSTED_SERVICE_KEY,
          'Authorization': `Bearer ${SELFHOSTED_SERVICE_KEY}`,
        }
      });
      const gotrueAdminData = await gotrueAdminResponse.json().catch(() => null);
      results.gotrue_admin = {
        status: gotrueAdminResponse.status,
        count: gotrueAdminData?.users?.length || 0,
        error: gotrueAdminData?.msg || gotrueAdminData?.error || null,
      };

      // Compare results
      results.diagnosis = {
        rest_works: restResponse.status === 200,
        gotrue_healthy: (results.auth_health as { status: number }).status === 200,
        admin_api_has_users: (results.admin_users as { count: number }).count > 0,
        gotrue_direct_has_users: (results.gotrue_admin as { count: number }).count > 0,
        mismatch: (results.rest_api as { profiles_count: number }).profiles_count !== (results.admin_users as { count: number }).count,
      };
    }
    
    else {
      results.error = 'Unknown action';
      results.available_actions = [
        'signup-with-client',
        'login-with-client', 
        'admin-list-users',
        'admin-update-password',
        'admin-create-user',
        'full-diagnostic',
      ];
    }

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[fix-gotrue-auth] Exception:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
