import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Autenticação necessária' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create authenticated Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Token inválido ou expirado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin role
    const { data: isAdmin, error: roleError } = await supabase.rpc('is_admin', { uid: user.id });
    if (roleError || !isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Acesso negado - privilégios de administrador necessários' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { sourceId, sourceKey, sourceName, m3uContent, entriesCount } = await req.json();

    if (!sourceId || !sourceKey || !m3uContent) {
      return new Response(
        JSON.stringify({ error: 'sourceId, sourceKey e m3uContent são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const startTime = Date.now();
    const fileSize = new TextEncoder().encode(m3uContent).length;

    // Upload to Cloudflare R2
    let cdnUrl: string | null = null;
    let uploadTime = 0;
    let cdnUploadStatus = 'skipped';

    try {
      cdnUrl = await uploadToR2(sourceKey, m3uContent);
      uploadTime = Date.now() - startTime;
      cdnUploadStatus = 'success';
      console.log(`✅ M3U uploaded to R2: ${cdnUrl}`);
    } catch (uploadError) {
      console.error('⚠️ R2 upload failed:', uploadError.message);
      cdnUploadStatus = 'failed';
    }

    // Use service role for database update
    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Update source with CDN URL
    if (cdnUrl) {
      await supabaseService
        .from('m3u_sync_sources')
        .update({
          metadata: {
            cdn_url: cdnUrl,
            cdn_generated_at: new Date().toISOString(),
            cdn_file_size: fileSize,
            cdn_entries_count: entriesCount,
          }
        })
        .eq('id', sourceId);
    }

    console.log(`✅ M3U CDN gerada: ${sourceName} (${entriesCount} entradas, ${fileSize} bytes, CDN: ${cdnUploadStatus})`);

    return new Response(
      JSON.stringify({
        success: true,
        cdnUrl,
        fileSize,
        entriesCount,
        generationTime: Date.now() - startTime,
        uploadTime,
        cdnStatus: cdnUploadStatus
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro ao gerar M3U CDN:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Upload para Cloudflare R2 usando API S3 nativa com assinatura AWS v4
 */
async function uploadToR2(sourceKey: string, content: string): Promise<string> {
  const R2_ACCOUNT_ID = Deno.env.get('R2_ACCOUNT_ID');
  const R2_ACCESS_KEY = Deno.env.get('R2_ACCESS_KEY_ID');
  const R2_SECRET_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY');
  const R2_BUCKET = Deno.env.get('R2_BUCKET_NAME');
  const R2_PUBLIC_DOMAIN = Deno.env.get('R2_PUBLIC_DOMAIN');

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY || !R2_SECRET_KEY || !R2_BUCKET) {
    throw new Error('R2 credentials not configured. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME secrets.');
  }

  const fileName = `sync-playlists/${sourceKey}.m3u`;
  const endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const url = `${endpoint}/${R2_BUCKET}/${fileName}`;
  const body = new TextEncoder().encode(content);

  // AWS Signature V4
  const region = 'auto';
  const service = 's3';
  const host = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const contentType = 'audio/x-mpegurl';

  // Create canonical request
  const method = 'PUT';
  const canonicalUri = `/${R2_BUCKET}/${fileName}`;
  const canonicalQueryString = '';
  
  // Hash the payload
  const payloadHash = await sha256Hex(body);
  
  const canonicalHeaders = [
    `content-type:${contentType}`,
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
  ].join('\n') + '\n';
  
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');

  // Create string to sign
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const canonicalRequestHash = await sha256Hex(new TextEncoder().encode(canonicalRequest));
  
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    canonicalRequestHash
  ].join('\n');

  // Calculate signature
  const signingKey = await getSignatureKey(R2_SECRET_KEY, dateStamp, region, service);
  const signature = await hmacSha256Hex(signingKey, stringToSign);

  // Create authorization header
  const authorization = `${algorithm} Credential=${R2_ACCESS_KEY}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  // Make request
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'Host': host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      'Authorization': authorization,
      'Cache-Control': 'public, max-age=3600',
    },
    body: body
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`R2 upload failed: ${response.status} - ${errorText}`);
  }

  // Remove https:// prefix if present to avoid duplication
  const publicDomain = (R2_PUBLIC_DOMAIN || `${R2_BUCKET}.r2.dev`).replace(/^https?:\/\//, '');
  return `https://${publicDomain}/${fileName}`;
}

// AWS Signature V4 helper functions
async function sha256Hex(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hmacSha256(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
}

async function hmacSha256Hex(key: ArrayBuffer, data: string): Promise<string> {
  const result = await hmacSha256(key, data);
  return Array.from(new Uint8Array(result))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function getSignatureKey(
  key: string,
  dateStamp: string,
  region: string,
  service: string
): Promise<ArrayBuffer> {
  const kDate = await hmacSha256(new TextEncoder().encode('AWS4' + key), dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  return hmacSha256(kService, 'aws4_request');
}
