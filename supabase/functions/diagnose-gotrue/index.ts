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
    const serviceKey = Deno.env.get('SELFHOSTED_SERVICE_ROLE_KEY') || '';
    const dbUrl = Deno.env.get('SELFHOSTED_DB_URL') || '';
    
    const results: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      service_key_length: serviceKey.length,
      service_key_prefix: serviceKey.substring(0, 50) + '...',
      db_url_configured: !!dbUrl,
      db_url_host: dbUrl ? new URL(dbUrl).hostname : 'not configured',
    };

    // Test GoTrue health
    const healthResponse = await fetch(`${SELFHOSTED_URL}/auth/v1/health`, {
      headers: { 'apikey': SELFHOSTED_ANON_KEY },
    });
    results.gotrue_health = {
      status: healthResponse.status,
      data: await healthResponse.json().catch(() => null),
    };

    // Test GoTrue admin users endpoint with service role key
    const adminUsersResponse = await fetch(`${SELFHOSTED_URL}/auth/v1/admin/users`, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
      },
    });
    const adminUsersData = await adminUsersResponse.json().catch(() => null);
    results.admin_users = {
      status: adminUsersResponse.status,
      count: adminUsersData?.users?.length || 0,
      error: adminUsersData?.error || adminUsersData?.msg || null,
      first_user_email: adminUsersData?.users?.[0]?.email || null,
    };

    // Test signup endpoint to see if we can create a test user
    const testEmail = `test-${Date.now()}@test.com`;
    const signupResponse = await fetch(`${SELFHOSTED_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SELFHOSTED_ANON_KEY,
        'Authorization': `Bearer ${SELFHOSTED_ANON_KEY}`,
      },
      body: JSON.stringify({ 
        email: testEmail, 
        password: 'TestPassword123!' 
      }),
    });
    const signupData = await signupResponse.json().catch(() => null);
    results.test_signup = {
      status: signupResponse.status,
      email: testEmail,
      user_id: signupData?.user?.id || null,
      access_token_present: !!signupData?.access_token,
      error: signupData?.error || signupData?.msg || null,
    };

    // If signup succeeded, immediately try to login with that user
    if (signupData?.user?.id) {
      // Wait a brief moment
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const loginResponse = await fetch(`${SELFHOSTED_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SELFHOSTED_ANON_KEY,
          'Authorization': `Bearer ${SELFHOSTED_ANON_KEY}`,
        },
        body: JSON.stringify({ email: testEmail, password: 'TestPassword123!' }),
      });
      const loginData = await loginResponse.json().catch(() => null);
      results.test_login_new_user = {
        status: loginResponse.status,
        success: !!loginData?.access_token,
        error: loginData?.error || loginData?.msg || null,
      };
      
      // Check admin users again after signup
      const adminUsersAfterResponse = await fetch(`${SELFHOSTED_URL}/auth/v1/admin/users`, {
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
        },
      });
      const adminUsersAfterData = await adminUsersAfterResponse.json().catch(() => null);
      results.admin_users_after_signup = {
        status: adminUsersAfterResponse.status,
        count: adminUsersAfterData?.users?.length || 0,
        new_user_found: adminUsersAfterData?.users?.some((u: {email: string}) => u.email === testEmail) || false,
      };
      
      // Delete test user via admin API
      if (signupData?.user?.id) {
        const deleteResponse = await fetch(`${SELFHOSTED_URL}/auth/v1/admin/users/${signupData.user.id}`, {
          method: 'DELETE',
          headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
          },
        });
        results.test_user_deleted = {
          status: deleteResponse.status,
          success: deleteResponse.status >= 200 && deleteResponse.status < 300,
        };
      }
    }

    // Final diagnosis
    results.diagnosis = {
      gotrue_healthy: results.gotrue_health && (results.gotrue_health as {status: number}).status === 200,
      admin_api_working: (results.admin_users as {status: number}).status === 200,
      signup_working: (results.test_signup as {status: number}).status >= 200 && (results.test_signup as {status: number}).status < 300,
      different_database: (results.admin_users as {count: number}).count === 0 && (results.test_signup as {user_id: string|null}).user_id !== null,
    };

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[diagnose-gotrue] Exception:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
