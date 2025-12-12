import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Base64url encode function
function base64UrlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// HMAC-SHA256 implementation using Web Crypto API
async function hmacSha256(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const messageData = encoder.encode(message);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  return base64UrlEncode(new Uint8Array(signature));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { jwt_secret } = await req.json();
    
    if (!jwt_secret) {
      return new Response(
        JSON.stringify({ error: 'jwt_secret is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Header for all Supabase JWTs
    const header = { typ: 'JWT', alg: 'HS256' };
    const headerEncoded = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));

    // Anon key payload
    const anonPayload = {
      iss: 'supabase',
      iat: 1765220820,
      exp: 4920894420,
      role: 'anon'
    };
    const anonPayloadEncoded = base64UrlEncode(new TextEncoder().encode(JSON.stringify(anonPayload)));
    
    // Service role payload
    const servicePayload = {
      iss: 'supabase',
      iat: 1765220820,
      exp: 4920894420,
      role: 'service_role'
    };
    const servicePayloadEncoded = base64UrlEncode(new TextEncoder().encode(JSON.stringify(servicePayload)));

    // Generate signatures using HMAC-SHA256
    const anonSignatureInput = `${headerEncoded}.${anonPayloadEncoded}`;
    const serviceSignatureInput = `${headerEncoded}.${servicePayloadEncoded}`;

    const anonSignature = await hmacSha256(jwt_secret, anonSignatureInput);
    const serviceSignature = await hmacSha256(jwt_secret, serviceSignatureInput);

    const anonKey = `${anonSignatureInput}.${anonSignature}`;
    const serviceRoleKey = `${serviceSignatureInput}.${serviceSignature}`;

    return new Response(
      JSON.stringify({
        anon_key: anonKey,
        service_role_key: serviceRoleKey,
        jwt_secret: jwt_secret
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating JWT keys:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
