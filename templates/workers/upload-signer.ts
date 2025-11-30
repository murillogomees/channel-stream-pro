/**
 * Upload Signer Worker Template
 * 
 * Generates signed URLs for secure uploads to R2/S3
 * 
 * Environment Variables Required:
 * - R2_ACCOUNT_ID
 * - R2_ACCESS_KEY_ID
 * - R2_SECRET_ACCESS_KEY
 * - R2_BUCKET_NAME
 * - JWT_SECRET
 */

import { createClient } from '@supabase/supabase-js';

// Types
interface SignedUrlRequest {
  filename: string;
  contentType: string;
  contentLength: number;
  userId: string;
  metadata?: Record<string, string>;
}

interface SignedUrlResponse {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  expiresAt: string;
}

// HMAC-SHA256 signing
async function hmacSha256(key: ArrayBuffer, message: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
}

// AWS Signature V4
async function signV4(
  method: string,
  url: URL,
  headers: Record<string, string>,
  payload: string,
  credentials: { accessKeyId: string; secretAccessKey: string },
  region: string,
  service: string
): Promise<Record<string, string>> {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  // Create canonical request
  const signedHeaders = Object.keys(headers)
    .map(k => k.toLowerCase())
    .sort()
    .join(';');

  const canonicalHeaders = Object.entries(headers)
    .map(([k, v]) => `${k.toLowerCase()}:${v.trim()}`)
    .sort()
    .join('\n');

  const payloadHash = await sha256(payload);
  const canonicalRequest = [
    method,
    url.pathname,
    url.search.slice(1),
    canonicalHeaders + '\n',
    signedHeaders,
    payloadHash,
  ].join('\n');

  // Create string to sign
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    await sha256(canonicalRequest),
  ].join('\n');

  // Calculate signature
  const kDate = await hmacSha256(
    new TextEncoder().encode('AWS4' + credentials.secretAccessKey),
    dateStamp
  );
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, 'aws4_request');
  const signature = toHex(await hmacSha256(kSigning, stringToSign));

  return {
    ...headers,
    'x-amz-date': amzDate,
    Authorization: `${algorithm} Credential=${credentials.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return toHex(hashBuffer);
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Generate presigned URL
async function generatePresignedUrl(
  request: SignedUrlRequest,
  env: Record<string, string>
): Promise<SignedUrlResponse> {
  const key = `uploads/${request.userId}/${Date.now()}-${request.filename}`;
  const expiresIn = 3600; // 1 hour
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  const url = new URL(
    `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET_NAME}/${key}`
  );

  // Add query parameters for presigned URL
  url.searchParams.set('X-Amz-Algorithm', 'AWS4-HMAC-SHA256');
  url.searchParams.set('X-Amz-Expires', expiresIn.toString());
  url.searchParams.set('X-Amz-SignedHeaders', 'host;content-type');

  const headers = {
    host: url.host,
    'content-type': request.contentType,
  };

  const signedHeaders = await signV4(
    'PUT',
    url,
    headers,
    'UNSIGNED-PAYLOAD',
    {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
    'auto',
    's3'
  );

  return {
    uploadUrl: url.toString(),
    publicUrl: `https://${env.R2_PUBLIC_DOMAIN || env.R2_BUCKET_NAME + '.r2.dev'}/${key}`,
    key,
    expiresAt: expiresAt.toISOString(),
  };
}

// Verify JWT token
async function verifyJwt(token: string, secret: string): Promise<{ userId: string } | null> {
  try {
    const [headerB64, payloadB64, signatureB64] = token.split('.');
    const payload = JSON.parse(atob(payloadB64));

    // Verify expiration
    if (payload.exp && payload.exp < Date.now() / 1000) {
      return null;
    }

    // Verify signature
    const data = `${headerB64}.${payloadB64}`;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signature = Uint8Array.from(atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, signature, new TextEncoder().encode(data));

    return valid ? { userId: payload.sub || payload.user_id } : null;
  } catch {
    return null;
  }
}

// Main handler
export default {
  async fetch(request: Request, env: Record<string, string>): Promise<Response> {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    try {
      // Verify authorization
      const authHeader = request.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response('Unauthorized', { status: 401, headers: corsHeaders });
      }

      const token = authHeader.slice(7);
      const user = await verifyJwt(token, env.JWT_SECRET);
      if (!user) {
        return new Response('Invalid token', { status: 401, headers: corsHeaders });
      }

      // Parse request
      const body = await request.json() as SignedUrlRequest;
      body.userId = user.userId;

      // Validate request
      if (!body.filename || !body.contentType) {
        return new Response('Missing required fields', { status: 400, headers: corsHeaders });
      }

      // Check file size limit (100MB)
      if (body.contentLength > 100 * 1024 * 1024) {
        return new Response('File too large', { status: 413, headers: corsHeaders });
      }

      // Generate signed URL
      const result = await generatePresignedUrl(body, env);

      // Log to database (optional)
      if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
        await supabase.from('upload_logs').insert({
          user_id: user.userId,
          filename: body.filename,
          content_type: body.contentType,
          r2_key: result.key,
          expires_at: result.expiresAt,
        });
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Upload signer error:', error);
      return new Response('Internal server error', { status: 500, headers: corsHeaders });
    }
  },
};
