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
    const { email, password } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'email and password required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[test-selfhosted-auth] Testing direct GoTrue call for: ${email}`);

    // Call GoTrue directly with fetch
    const response = await fetch(`${SELFHOSTED_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SELFHOSTED_ANON_KEY,
        'Authorization': `Bearer ${SELFHOSTED_ANON_KEY}`,
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    
    console.log(`[test-selfhosted-auth] GoTrue response status: ${response.status}`);
    console.log(`[test-selfhosted-auth] GoTrue response:`, JSON.stringify(data));

    return new Response(
      JSON.stringify({ 
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        data,
        url_called: `${SELFHOSTED_URL}/auth/v1/token?grant_type=password`,
        anon_key_used: SELFHOSTED_ANON_KEY.substring(0, 50) + '...',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[test-selfhosted-auth] Exception:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
