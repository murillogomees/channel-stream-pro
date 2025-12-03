import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const PAGE_SIZE = 500; // Smaller batches for memory efficiency

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

    // Parse request - now only needs sourceId
    const body = await req.text();
    const { sourceId, sourceKey, sourceName } = body ? JSON.parse(body) : {};

    if (!sourceId || !sourceKey) {
      return new Response(
        JSON.stringify({ error: 'sourceId e sourceKey são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const startTime = Date.now();
    console.log(`[GenerateM3U] Starting server-side generation for source: ${sourceId}`);

    // Use service role for database queries
    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get total count first
    const { count: totalCount, error: countError } = await supabaseService
      .from('m3u_sync_entries')
      .select('*', { count: 'exact', head: true })
      .eq('source_id', sourceId)
      .eq('is_valid', true);

    if (countError) {
      throw new Error(`Failed to count entries: ${countError.message}`);
    }

    console.log(`[GenerateM3U] Total entries to process: ${totalCount}`);

    // Generate M3U header
    const m3uParts: string[] = ['#EXTM3U\n'];
    let processedCount = 0;
    let page = 0;

    // Fetch and process entries in batches
    while (processedCount < (totalCount || 0)) {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data: entries, error: fetchError } = await supabaseService
        .from('m3u_sync_entries')
        .select('title, stream_url, tvg_id, tvg_name, tvg_logo, group_title, extra_tags')
        .eq('source_id', sourceId)
        .eq('is_valid', true)
        .order('group_title')
        .order('title')
        .range(from, to);

      if (fetchError) {
        console.error(`[GenerateM3U] Batch ${page} error:`, fetchError);
        break;
      }

      if (!entries || entries.length === 0) break;

      // Convert entries to M3U format
      for (const entry of entries) {
        let extinf = '#EXTINF:-1';
        
        if (entry.tvg_id) extinf += ` tvg-id="${entry.tvg_id}"`;
        if (entry.tvg_name) extinf += ` tvg-name="${entry.tvg_name}"`;
        if (entry.tvg_logo) extinf += ` tvg-logo="${entry.tvg_logo}"`;
        if (entry.group_title) extinf += ` group-title="${entry.group_title}"`;
        if (entry.extra_tags) extinf += ` ${entry.extra_tags}`;
        
        extinf += `,${entry.title}\n${entry.stream_url}\n`;
        m3uParts.push(extinf);
      }

      processedCount += entries.length;
      page++;

      // Log progress every 10 pages
      if (page % 10 === 0) {
        console.log(`[GenerateM3U] Progress: ${processedCount}/${totalCount} entries`);
      }

      // Clear reference to allow GC
      entries.length = 0;
    }

    console.log(`[GenerateM3U] Finished fetching ${processedCount} entries in ${Date.now() - startTime}ms`);

    // Join all parts into final M3U content
    const m3uContent = m3uParts.join('');
    const fileSize = new TextEncoder().encode(m3uContent).length;

    console.log(`[GenerateM3U] M3U content size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

    // Upload to Cloudflare R2
    let cdnUrl: string | null = null;
    let uploadTime = 0;
    let cdnUploadStatus = 'skipped';

    try {
      const uploadStart = Date.now();
      cdnUrl = await uploadToR2(sourceKey, m3uContent);
      uploadTime = Date.now() - uploadStart;
      cdnUploadStatus = 'success';
      console.log(`[GenerateM3U] ✅ Uploaded to R2 in ${uploadTime}ms: ${cdnUrl}`);
    } catch (uploadError) {
      console.error('[GenerateM3U] ⚠️ R2 upload failed:', uploadError.message);
      cdnUploadStatus = 'failed';
    }

    // Update source with CDN URL
    if (cdnUrl) {
      await supabaseService
        .from('m3u_sync_sources')
        .update({
          metadata: {
            cdn_url: cdnUrl,
            cdn_generated_at: new Date().toISOString(),
            cdn_file_size: fileSize,
            cdn_entries_count: processedCount,
          }
        })
        .eq('id', sourceId);
    }

    const totalTime = Date.now() - startTime;
    console.log(`[GenerateM3U] ✅ Complete: ${sourceName} (${processedCount} entries, ${(fileSize / 1024 / 1024).toFixed(2)} MB) in ${totalTime}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        cdnUrl,
        fileSize,
        entriesCount: processedCount,
        generationTime: totalTime,
        uploadTime,
        cdnStatus: cdnUploadStatus
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[GenerateM3U] ❌ Error:', error);
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
