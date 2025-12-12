import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, newPassword, dbPassword } = await req.json();

    if (!email || !newPassword) {
      return new Response(JSON.stringify({ error: 'email and newPassword required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Generate bcrypt hash with cost factor 10 (same as GoTrue)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    console.log('Generated hash prefix:', hashedPassword.substring(0, 29));

    // Connect to self-hosted database and update
    const { Client } = await import("https://deno.land/x/postgres@v0.17.0/mod.ts");
    
    const client = new Client({
      hostname: 'supabase.iptvlink.com.br',
      port: 5432,
      user: 'postgres',
      password: dbPassword || Deno.env.get('SELFHOSTED_DB_URL')?.split(':')[2]?.split('@')[0] || '',
      database: 'postgres',
      tls: { enabled: false }
    });
    
    await client.connect();

    const result = await client.queryObject`
      UPDATE auth.users 
      SET encrypted_password = ${hashedPassword}
      WHERE email = ${email}
      RETURNING id, email
    `;

    await client.end();

    if (result.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Password updated with correct bcrypt hash',
      user: result.rows[0]
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
