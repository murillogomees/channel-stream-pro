import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

// Larger batches = fewer DB queries = faster processing
const PAGE_SIZE = 2000;
const ID_BATCH_SIZE = 2000;
const PROGRESS_LOG_INTERVAL = 5000;

// Content class matching function
function matchesContentClass(groupTitle: string, targetClass: string): boolean {
  const lower = (groupTitle || '').toLowerCase();
  
  if (targetClass === 'series') {
    return lower.includes('séries') || lower.includes('series') || 
           lower.includes('temporada') || lower.includes('season') ||
           lower.includes('novelas') || lower.includes('doramas') ||
           lower.includes('animes') || lower.includes('reality') ||
           lower.includes('tokusatsu');
  }
  
  if (targetClass === 'movies') {
    return lower.includes('filme') || lower.includes('filmes') ||
           lower.includes('movie') || lower.includes('cinema') ||
           lower.includes('lançamento');
  }
  
  if (targetClass === 'tv') {
    return lower.includes('canais') || lower.includes('tv') ||
           lower.includes('ao vivo') || lower.includes('live') ||
           lower.includes('24h') || lower.includes('globo') ||
           lower.includes('pluto') || lower.includes('karaoke') ||
           lower.includes('docs');
  }
  
  if (targetClass === 'other') {
    return !matchesContentClass(groupTitle, 'series') &&
           !matchesContentClass(groupTitle, 'movies') &&
           !matchesContentClass(groupTitle, 'tv');
  }
  
  return true;
}

// Build EXTINF line efficiently (no string concatenation in loop)
function buildExtinf(entry: any): string {
  const parts = ['#EXTINF:-1'];
  if (entry.tvg_id) parts.push(` tvg-id="${entry.tvg_id}"`);
  if (entry.tvg_name) parts.push(` tvg-name="${entry.tvg_name}"`);
  if (entry.tvg_logo) parts.push(` tvg-logo="${entry.tvg_logo}"`);
  if (entry.group_title) parts.push(` group-title="${entry.group_title}"`);
  parts.push(`,${entry.title}\n${entry.stream_url}\n`);
  return parts.join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Autenticação necessária' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Token inválido ou expirado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: isAdmin, error: roleError } = await supabase.rpc('is_admin', { uid: user.id });
    if (roleError || !isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Acesso negado - privilégios de administrador necessários' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.text();
    const { sourceId, sourceKey, sourceName, entryIds, filters } = body ? JSON.parse(body) : {};

    if (!sourceId || !sourceKey) {
      return new Response(
        JSON.stringify({ error: 'sourceId e sourceKey são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const useEntryIds = Array.isArray(entryIds) && entryIds.length > 0;
    const hasFilters = filters && (filters.searchQuery || filters.selectedClass || filters.selectedCategory);
    
    console.log(`[GenerateM3U] Starting for source: ${sourceId}`);
    console.log(`[GenerateM3U] Mode: ${useEntryIds ? 'entryIds' : hasFilters ? 'filters' : 'all'}`);

    const startTime = Date.now();

    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Use TextEncoder for streaming - more memory efficient
    const encoder = new TextEncoder();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    let processedCount = 0;
    let actualCount = 0;

    // Add header
    const header = encoder.encode('#EXTM3U\n');
    chunks.push(header);
    totalBytes += header.length;

    // Mode 1: Fetch by specific entry IDs
    if (useEntryIds) {
      console.log(`[GenerateM3U] Processing ${entryIds.length} entries by ID`);
      
      for (let i = 0; i < entryIds.length; i += ID_BATCH_SIZE) {
        const batchIds = entryIds.slice(i, i + ID_BATCH_SIZE);
        
        const { data: entries, error: fetchError } = await supabaseService
          .from('m3u_sync_entries')
          .select('title, stream_url, tvg_id, tvg_name, tvg_logo, group_title')
          .in('id', batchIds)
          .eq('is_valid', true)
          .order('group_title')
          .order('title');

        if (fetchError) {
          console.error(`[GenerateM3U] ID batch error:`, fetchError);
          continue;
        }

        if (entries) {
          for (const entry of entries) {
            const line = encoder.encode(buildExtinf(entry));
            chunks.push(line);
            totalBytes += line.length;
            actualCount++;
          }
          processedCount += entries.length;
        }

        if (processedCount % PROGRESS_LOG_INTERVAL < ID_BATCH_SIZE) {
          console.log(`[GenerateM3U] Progress: ${processedCount}/${entryIds.length}`);
        }
      }
    } 
    // Mode 2: Fetch with pagination
    else {
      // Get total count first
      let countQuery = supabaseService
        .from('m3u_sync_entries')
        .select('*', { count: 'exact', head: true })
        .eq('source_id', sourceId)
        .eq('is_valid', true);

      if (hasFilters?.selectedCategory) {
        countQuery = countQuery.eq('group_title', filters.selectedCategory);
      }
      if (hasFilters?.searchQuery) {
        countQuery = countQuery.or(`title.ilike.%${filters.searchQuery}%,group_title.ilike.%${filters.searchQuery}%`);
      }

      const { count: totalCount, error: countError } = await countQuery;
      if (countError) throw new Error(`Count failed: ${countError.message}`);

      console.log(`[GenerateM3U] Total entries: ${totalCount}`);

      let page = 0;
      let hasMore = true;
      
      while (hasMore && processedCount < (totalCount || 0)) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        let fetchQuery = supabaseService
          .from('m3u_sync_entries')
          .select('title, stream_url, tvg_id, tvg_name, tvg_logo, group_title')
          .eq('source_id', sourceId)
          .eq('is_valid', true)
          .order('group_title')
          .order('title')
          .range(from, to);

        if (hasFilters?.selectedCategory) {
          fetchQuery = fetchQuery.eq('group_title', filters.selectedCategory);
        }
        if (hasFilters?.searchQuery) {
          fetchQuery = fetchQuery.or(`title.ilike.%${filters.searchQuery}%,group_title.ilike.%${filters.searchQuery}%`);
        }

        const { data: entries, error: fetchError } = await fetchQuery;

        if (fetchError) {
          console.error(`[GenerateM3U] Batch ${page} error:`, fetchError);
          break;
        }

        if (!entries || entries.length === 0) {
          hasMore = false;
          break;
        }

        for (const entry of entries) {
          // Apply class filter server-side if needed
          if (hasFilters?.selectedClass) {
            if (!matchesContentClass(entry.group_title || '', filters.selectedClass)) {
              continue;
            }
          }

          const line = encoder.encode(buildExtinf(entry));
          chunks.push(line);
          totalBytes += line.length;
          actualCount++;
        }

        processedCount += entries.length;
        page++;

        // Less entries than page size = no more data
        if (entries.length < PAGE_SIZE) {
          hasMore = false;
        }

        if (processedCount % PROGRESS_LOG_INTERVAL < PAGE_SIZE) {
          console.log(`[GenerateM3U] Progress: ${processedCount}/${totalCount}`);
        }
      }
    }

    console.log(`[GenerateM3U] Finished: ${actualCount} entries in ${Date.now() - startTime}ms`);
    console.log(`[GenerateM3U] M3U size: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);

    // Combine chunks efficiently
    const m3uContent = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      m3uContent.set(chunk, offset);
      offset += chunk.length;
    }
    
    // Free memory from chunks array
    chunks.length = 0;

    // Upload to R2
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

    // Update source metadata
    if (cdnUrl) {
      await supabaseService
        .from('m3u_sync_sources')
        .update({
          metadata: {
            cdn_url: cdnUrl,
            cdn_generated_at: new Date().toISOString(),
            cdn_file_size: totalBytes,
            cdn_entries_count: actualCount,
          }
        })
        .eq('id', sourceId);
    }

    const totalTime = Date.now() - startTime;
    console.log(`[GenerateM3U] ✅ Complete: ${sourceName} (${actualCount} entries, ${(totalBytes / 1024 / 1024).toFixed(2)} MB) in ${totalTime}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        cdnUrl,
        fileSize: totalBytes,
        entriesCount: actualCount,
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

async function uploadToR2(sourceKey: string, content: Uint8Array): Promise<string> {
  const R2_ACCOUNT_ID = Deno.env.get('R2_ACCOUNT_ID');
  const R2_ACCESS_KEY = Deno.env.get('R2_ACCESS_KEY_ID');
  const R2_SECRET_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY');
  const R2_BUCKET = Deno.env.get('R2_BUCKET_NAME');
  const R2_PUBLIC_DOMAIN = Deno.env.get('R2_PUBLIC_DOMAIN');

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY || !R2_SECRET_KEY || !R2_BUCKET) {
    throw new Error('R2 credentials not configured');
  }

  const fileName = `sync-playlists/${sourceKey}.m3u`;
  const endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const url = `${endpoint}/${R2_BUCKET}/${fileName}`;

  const region = 'auto';
  const service = 's3';
  const host = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const contentType = 'audio/x-mpegurl';

  const method = 'PUT';
  const canonicalUri = `/${R2_BUCKET}/${fileName}`;
  const payloadHash = await sha256Hex(content);
  
  const canonicalHeaders = [
    `content-type:${contentType}`,
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
  ].join('\n') + '\n';
  
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  
  const canonicalRequest = [method, canonicalUri, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const canonicalRequestHash = await sha256Hex(new TextEncoder().encode(canonicalRequest));
  const stringToSign = [algorithm, amzDate, credentialScope, canonicalRequestHash].join('\n');
  const signingKey = await getSignatureKey(R2_SECRET_KEY, dateStamp, region, service);
  const signature = await hmacSha256Hex(signingKey, stringToSign);
  const authorization = `${algorithm} Credential=${R2_ACCESS_KEY}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

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
    body: content
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`R2 upload failed: ${response.status} - ${errorText}`);
  }

  const publicDomain = (R2_PUBLIC_DOMAIN || `${R2_BUCKET}.r2.dev`).replace(/^https?:\/\//, '');
  return `https://${publicDomain}/${fileName}`;
}

async function sha256Hex(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
}

async function hmacSha256Hex(key: ArrayBuffer, data: string): Promise<string> {
  const result = await hmacSha256(key, data);
  return Array.from(new Uint8Array(result)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getSignatureKey(key: string, dateStamp: string, region: string, service: string): Promise<ArrayBuffer> {
  const kDate = await hmacSha256(new TextEncoder().encode('AWS4' + key), dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  return hmacSha256(kService, 'aws4_request');
}
