/**
 * CDN Token Service
 * 
 * Generates signed JWT tokens for manifest access with:
 * - Configurable expiration
 * - IP and referrer restrictions
 * - Usage tracking
 * 
 * Token pattern: Manifests require JWT, segments use normalized cache-key
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// JWT signing using HMAC-SHA256
async function signJWT(payload: Record<string, unknown>, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  
  const encode = (obj: Record<string, unknown>) => {
    const json = JSON.stringify(obj);
    const bytes = new TextEncoder().encode(json);
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  };
  
  const headerB64 = encode(header);
  const payloadB64 = encode(payload);
  const data = `${headerB64}.${payloadB64}`;
  
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(data)
  );
  
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  return `${data}.${signatureB64}`;
}

// Verify JWT
async function verifyJWT(token: string, secret: string): Promise<Record<string, unknown> | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const [headerB64, payloadB64, signatureB64] = parts;
    const data = `${headerB64}.${payloadB64}`;
    
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    // Decode signature
    const signatureStr = signatureB64.replace(/-/g, '+').replace(/_/g, '/');
    const signatureBytes = Uint8Array.from(atob(signatureStr), c => c.charCodeAt(0));
    
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      new TextEncoder().encode(data)
    );
    
    if (!valid) return null;
    
    // Decode payload
    const payloadStr = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
    const payloadJson = atob(payloadStr);
    return JSON.parse(payloadJson);
  } catch {
    return null;
  }
}

// Hash token for storage
async function hashToken(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const cdnSecret = Deno.env.get('STREAM_PROXY_SECRET') || 'cdn-signing-secret';
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'generate';

    if (action === 'generate') {
      // Generate new signed token
      let body: any;
      try {
        body = await req.json();
      } catch (parseError) {
        console.error('[CDN-Token] Invalid JSON body for generate:', parseError);
        return new Response(
          JSON.stringify({ error: 'Invalid JSON in request body' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const {
        r2_key,
        channel_id,
        user_profile_id,
        expires_in_seconds = 7200, // 2 hours default
        ip_restriction,
        referrer_restriction,
        max_uses = 1,
        token_type = 'manifest'
      } = body;

      if (!r2_key) {
        return new Response(
          JSON.stringify({ error: 'r2_key is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const now = Math.floor(Date.now() / 1000);
      const exp = now + expires_in_seconds;

      const payload = {
        sub: r2_key,
        iat: now,
        exp,
        cid: channel_id,
        pid: user_profile_id,
        typ: token_type,
        ip: ip_restriction,
        ref: referrer_restriction,
        jti: crypto.randomUUID()
      };

      const token = await signJWT(payload, cdnSecret);
      const tokenHash = await hashToken(token);

      // Store token record
      const { error: insertError } = await supabase
        .from('cdn_signed_tokens')
        .insert({
          token_hash: tokenHash,
          token_type,
          r2_key,
          channel_id,
          user_profile_id,
          ip_restriction,
          referrer_restriction,
          max_uses,
          expires_at: new Date(exp * 1000).toISOString()
        });

      if (insertError) {
        console.error('[CDN-Token] Insert error:', insertError);
      }

      // Build CDN URL with token
      const r2Domain = Deno.env.get('R2_PUBLIC_DOMAIN') || 'cdn.example.com';
      const cdnUrl = `https://${r2Domain}/${r2_key}?jwt=${token}`;

      console.log('[CDN-Token] Generated token', { r2_key, token_type, expires_in_seconds });

      return new Response(
        JSON.stringify({
          success: true,
          token,
          cdn_url: cdnUrl,
          expires_at: exp,
          expires_in: expires_in_seconds
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'verify') {
      // Verify existing token
      const token = url.searchParams.get('token');
      const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
      const referrer = req.headers.get('referer');

      if (!token) {
        return new Response(
          JSON.stringify({ valid: false, error: 'Token required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const payload = await verifyJWT(token, cdnSecret);
      
      if (!payload) {
        return new Response(
          JSON.stringify({ valid: false, error: 'Invalid signature' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      if ((payload.exp as number) < now) {
        return new Response(
          JSON.stringify({ valid: false, error: 'Token expired' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check IP restriction
      if (payload.ip && payload.ip !== clientIp) {
        return new Response(
          JSON.stringify({ valid: false, error: 'IP mismatch' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check referrer restriction
      if (payload.ref && referrer && !referrer.includes(payload.ref as string)) {
        return new Response(
          JSON.stringify({ valid: false, error: 'Referrer mismatch' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check usage limits
      const tokenHash = await hashToken(token);
      const { data: tokenRecord } = await supabase
        .from('cdn_signed_tokens')
        .select('current_uses, max_uses, revoked_at')
        .eq('token_hash', tokenHash)
        .single();

      if (tokenRecord) {
        if (tokenRecord.revoked_at) {
          return new Response(
            JSON.stringify({ valid: false, error: 'Token revoked' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (tokenRecord.current_uses >= tokenRecord.max_uses) {
          return new Response(
            JSON.stringify({ valid: false, error: 'Usage limit exceeded' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Increment usage
        await supabase
          .from('cdn_signed_tokens')
          .update({ current_uses: tokenRecord.current_uses + 1 })
          .eq('token_hash', tokenHash);
      }

      return new Response(
        JSON.stringify({
          valid: true,
          r2_key: payload.sub,
          channel_id: payload.cid,
          token_type: payload.typ,
          expires_at: payload.exp
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'revoke') {
      // Revoke token
      let body: any;
      try {
        body = await req.json();
      } catch (parseError) {
        console.error('[CDN-Token] Invalid JSON body for revoke:', parseError);
        return new Response(
          JSON.stringify({ error: 'Invalid JSON in request body' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { token, channel_id } = body;

      if (token) {
        const tokenHash = await hashToken(token);
        await supabase
          .from('cdn_signed_tokens')
          .update({ revoked_at: new Date().toISOString() })
          .eq('token_hash', tokenHash);
      } else if (channel_id) {
        // Revoke all tokens for channel
        await supabase
          .from('cdn_signed_tokens')
          .update({ revoked_at: new Date().toISOString() })
          .eq('channel_id', channel_id)
          .is('revoked_at', null);
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[CDN-Token] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
