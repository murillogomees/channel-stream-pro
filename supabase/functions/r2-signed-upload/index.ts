/**
 * R2 Signed Upload URL Generator
 * 
 * Generates presigned URLs for direct R2 uploads when Edge Function 
 * streaming would exceed timeouts.
 * 
 * Features:
 * - Short TTL (5-15 min) for security
 * - Role-based authorization
 * - Structured logging for observability
 * 
 * @version 1.0.0
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { S3Client, PutObjectCommand } from "https://esm.sh/@aws-sdk/client-s3@3.478.0";
import { getSignedUrl } from "https://esm.sh/@aws-sdk/s3-request-presigner@3.478.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configuration
const DEFAULT_TTL_SECONDS = 900; // 15 minutes
const MIN_TTL_SECONDS = 300;     // 5 minutes
const MAX_TTL_SECONDS = 3600;    // 1 hour

interface SignedUploadRequest {
  key: string;
  contentType?: string;
  expectedSize?: number;
  ttlSeconds?: number;
  metadata?: Record<string, string>;
}

interface SignedUploadResponse {
  uploadUrl: string;
  objectKey: string;
  expiresAt: string;
  bucket: string;
  cdnUrl: string;
}

serve(async (req) => {
  const traceId = crypto.randomUUID().slice(0, 8);
  const startTime = Date.now();
  
  // CORS preflight
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
    // Only POST allowed
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    
    // Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is admin (if JWT provided) or service token
    let userId: string | null = null;
    const serviceToken = Deno.env.get('INTERNAL_SERVICE_TOKEN');
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      
      // Check if it's our internal service token
      if (serviceToken && token === serviceToken) {
        log('info', 'Service token authentication');
        userId = 'service';
      } else {
        // Verify JWT and check admin role
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        
        if (authError || !user) {
          log('warn', 'Authentication failed', { error: authError?.message });
          return new Response(
            JSON.stringify({ error: 'Unauthorized' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check if user is admin
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

    // Parse request
    const body: SignedUploadRequest = await req.json();
    const { key, contentType, expectedSize, ttlSeconds, metadata } = body;

    if (!key || typeof key !== 'string') {
      return new Response(
        JSON.stringify({ error: 'key is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate TTL
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

    // Get R2 config
    const accountId = Deno.env.get('R2_ACCOUNT_ID') || Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
    const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID');
    const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY');
    const bucketName = Deno.env.get('R2_BUCKET_NAME') || 'iptvlink-cdn';
    const cdnBaseUrl = Deno.env.get('R2_CDN_BASE_URL') || 'https://cdn.iptvlink.app';

    if (!accountId || !accessKeyId || !secretAccessKey) {
      log('error', 'R2 configuration missing', {
        hasAccountId: !!accountId,
        hasAccessKey: !!accessKeyId,
        hasSecret: !!secretAccessKey,
      });
      return new Response(
        JSON.stringify({ error: 'R2 not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create S3 client for R2
    const s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    // Generate presigned URL
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: contentType || 'application/vnd.apple.mpegurl',
      ...(expectedSize && { ContentLength: expectedSize }),
      Metadata: {
        ...metadata,
        'upload-source': 'signed-url',
        'upload-time': new Date().toISOString(),
        'uploaded-by': userId || 'unknown',
      },
    });

    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: effectiveTtl,
    });

    const expiresAt = new Date(Date.now() + effectiveTtl * 1000).toISOString();

    const response: SignedUploadResponse = {
      uploadUrl,
      objectKey: key,
      expiresAt,
      bucket: bucketName,
      cdnUrl: `${cdnBaseUrl}/${key}`,
    };

    // Log the signed URL generation (without the URL for security)
    log('info', 'Signed URL generated successfully', {
      key,
      expiresAt,
      ttlSeconds: effectiveTtl,
      durationMs: Date.now() - startTime,
    });

    // Track in database for audit
    await supabase.from('r2_signed_url_logs').insert({
      object_key: key,
      content_type: contentType || 'application/vnd.apple.mpegurl',
      expected_size: expectedSize,
      ttl_seconds: effectiveTtl,
      expires_at: expiresAt,
      requested_by: userId,
      trace_id: traceId,
    }).catch(err => {
      // Non-blocking - just log if audit fails
      log('warn', 'Failed to log signed URL request', { error: String(err) });
    });

    return new Response(
      JSON.stringify(response),
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
