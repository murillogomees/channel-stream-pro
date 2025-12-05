/**
 * R2 Signed Upload URL Generator
 * 
 * Generates presigned URLs for direct R2 uploads.
 * Uses native AWS4 signing (no npm dependencies).
 * 
 * @version 2.0.0
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configuration
const DEFAULT_TTL_SECONDS = 900;
const MIN_TTL_SECONDS = 300;
const MAX_TTL_SECONDS = 3600;

// =============================================
// AWS4 SIGNING (Native implementation)
// =============================================

async function hmacSha256(key: ArrayBuffer | Uint8Array, message: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
}

async function sha256(message: string): Promise<string> {
  const data = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function getSignatureKey(
  secretKey: string,
  dateStamp: string,
  region: string,
  service: string
): Promise<ArrayBuffer> {
  const kDate = await hmacSha256(new TextEncoder().encode('AWS4' + secretKey), dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  return hmacSha256(kService, 'aws4_request');
}

async function generatePresignedUrl(
  accountId: string,
  accessKeyId: string,
  secretAccessKey: string,
  bucketName: string,
  objectKey: string,
  contentType: string,
  expiresIn: number
): Promise<string> {
  const region = 'auto';
  const service = 's3';
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const endpoint = `https://${host}/${bucketName}/${encodeURIComponent(objectKey).replace(/%2F/g, '/')}`;
  
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substring(0, 8);
  
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const credential = `${accessKeyId}/${credentialScope}`;
  
  // Query parameters for presigned URL
  const queryParams = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': credential,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': expiresIn.toString(),
    'X-Amz-SignedHeaders': 'content-type;host',
  });
  
  // Sort query params
  const sortedParams = new URLSearchParams([...queryParams.entries()].sort());
  
  // Canonical request
  const canonicalUri = `/${bucketName}/${encodeURIComponent(objectKey).replace(/%2F/g, '/')}`;
  const canonicalQuerystring = sortedParams.toString();
  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\n`;
  const signedHeaders = 'content-type;host';
  const payloadHash = 'UNSIGNED-PAYLOAD';
  
  const canonicalRequest = [
    'PUT',
    canonicalUri,
    canonicalQuerystring,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');
  
  // String to sign
  const algorithm = 'AWS4-HMAC-SHA256';
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    await sha256(canonicalRequest),
  ].join('\n');
  
  // Signature
  const signingKey = await getSignatureKey(secretAccessKey, dateStamp, region, service);
  const signatureBuffer = await hmacSha256(signingKey, stringToSign);
  const signature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  // Final URL
  sortedParams.set('X-Amz-Signature', signature);
  return `https://${host}${canonicalUri}?${sortedParams.toString()}`;
}

// =============================================
// MAIN HANDLER
// =============================================

serve(async (req) => {
  const traceId = crypto.randomUUID().slice(0, 8);
  const startTime = Date.now();
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const log = (level: string, message: string, data?: Record<string, unknown>) => {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      traceId,
      level,
      message,
      ...data,
    }));
  };

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('Authorization');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let userId: string | null = null;
    const serviceToken = Deno.env.get('INTERNAL_SERVICE_TOKEN');
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      
      if (serviceToken && token === serviceToken) {
        log('info', 'Service token authentication');
        userId = 'service';
      } else {
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        
        if (authError || !user) {
          log('warn', 'Authentication failed', { error: authError?.message });
          return new Response(
            JSON.stringify({ error: 'Unauthorized' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: roles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .in('role', ['admin', 'master']);

        if (!roles || roles.length === 0) {
          log('warn', 'Access denied - not admin', { userId: user.id });
          return new Response(
            JSON.stringify({ error: 'Admin access required' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        userId = user.id;
      }
    } else {
      log('warn', 'No authorization provided');
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { key, contentType, expectedSize, ttlSeconds } = body;

    if (!key || typeof key !== 'string') {
      return new Response(
        JSON.stringify({ error: 'key is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const effectiveTtl = Math.min(
      Math.max(ttlSeconds || DEFAULT_TTL_SECONDS, MIN_TTL_SECONDS),
      MAX_TTL_SECONDS
    );

    log('info', 'Generating signed upload URL', {
      key,
      contentType,
      expectedSize,
      ttlSeconds: effectiveTtl,
      userId,
    });

    const accountId = Deno.env.get('R2_ACCOUNT_ID') || Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
    const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID');
    const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY');
    const bucketName = Deno.env.get('R2_BUCKET_NAME') || 'iptvlink-cdn';
    const cdnBaseUrl = Deno.env.get('R2_CDN_BASE_URL') || 'https://cdn.iptvlink.app';

    if (!accountId || !accessKeyId || !secretAccessKey) {
      log('error', 'R2 configuration missing');
      return new Response(
        JSON.stringify({ error: 'R2 not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const uploadUrl = await generatePresignedUrl(
      accountId,
      accessKeyId,
      secretAccessKey,
      bucketName,
      key,
      contentType || 'application/vnd.apple.mpegurl',
      effectiveTtl
    );

    const expiresAt = new Date(Date.now() + effectiveTtl * 1000).toISOString();

    log('info', 'Signed URL generated successfully', {
      key,
      expiresAt,
      ttlSeconds: effectiveTtl,
      durationMs: Date.now() - startTime,
    });

    // Track in database (non-blocking)
    supabase.from('r2_signed_url_logs').insert({
      object_key: key,
      content_type: contentType || 'application/vnd.apple.mpegurl',
      expected_size: expectedSize,
      ttl_seconds: effectiveTtl,
      expires_at: expiresAt,
      requested_by: userId,
      trace_id: traceId,
    }).catch(err => {
      log('warn', 'Failed to log signed URL request', { error: String(err) });
    });

    return new Response(
      JSON.stringify({
        uploadUrl,
        objectKey: key,
        expiresAt,
        bucket: bucketName,
        cdnUrl: `${cdnBaseUrl}/${key}`,
      }),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'X-Trace-Id': traceId,
        } 
      }
    );

  } catch (error) {
    log('error', 'Failed to generate signed URL', {
      error: String(error),
      durationMs: Date.now() - startTime,
    });

    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate signed URL',
        details: String(error),
        traceId,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
