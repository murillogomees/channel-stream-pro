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
    const { email, password, action } = await req.json();

    const results: Record<string, any> = {};

    if (action === 'signup') {
      // Try to create a test user via GoTrue signup
      const signupResponse = await fetch(`${SELFHOSTED_URL}/auth/v1/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SELFHOSTED_ANON_KEY,
          'Authorization': `Bearer ${SELFHOSTED_ANON_KEY}`,
        },
        body: JSON.stringify({ 
          email: email || 'test-gotrue@test.com', 
          password: password || 'TestPassword123!' 
        }),
      });
      results.signup = {
        status: signupResponse.status,
        data: await signupResponse.json().catch(() => null),
      };
    } else if (action === 'login') {
      // Try password grant
      const loginResponse = await fetch(`${SELFHOSTED_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SELFHOSTED_ANON_KEY,
          'Authorization': `Bearer ${SELFHOSTED_ANON_KEY}`,
        },
        body: JSON.stringify({ email, password }),
      });
      results.login = {
        status: loginResponse.status,
        data: await loginResponse.json().catch(() => null),
      };
    } else if (action === 'check-password-format') {
      // We'll query the DB to see how passwords are stored for different users
      const response = await fetch(`${SELFHOSTED_URL}/rest/v1/rpc/`, {
        method: 'GET',
        headers: {
          'apikey': SELFHOSTED_ANON_KEY,
        },
      });
      results.rpc = {
        status: response.status,
      };
    } else if (action === 'admin-update-password') {
      // Try using GoTrue admin API to update password
      // This requires service role key
      const serviceKey = Deno.env.get('SELFHOSTED_SERVICE_ROLE_KEY') || '';
      
      // First get user by email
      const usersResponse = await fetch(`${SELFHOSTED_URL}/auth/v1/admin/users`, {
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
        },
      });
      
      const usersData = await usersResponse.json().catch(() => null);
      results.users_list = {
        status: usersResponse.status,
        count: usersData?.users?.length || 0,
      };
      
      if (usersData?.users) {
        const targetUser = usersData.users.find((u: any) => u.email === email);
        if (targetUser) {
          // Update password via admin API
          const updateResponse = await fetch(`${SELFHOSTED_URL}/auth/v1/admin/users/${targetUser.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'apikey': serviceKey,
              'Authorization': `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({ password }),
          });
          results.update = {
            status: updateResponse.status,
            data: await updateResponse.json().catch(() => null),
          };
        } else {
          results.error = 'User not found';
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        action,
        results,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[gotrue-admin] Exception:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
