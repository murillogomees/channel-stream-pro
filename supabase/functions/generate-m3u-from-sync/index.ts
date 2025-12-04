import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Smaller page size to avoid timeouts
const PAGE_SIZE = 500;

function matchesContentClass(groupTitle: string, targetClass: string): boolean {
  const lower = (groupTitle || '').toLowerCase();
  
  if (targetClass === 'series') {
    return lower.includes('séries') || lower.includes('series') || 
           lower.includes('temporada') || lower.includes('season') ||
           lower.includes('novelas') || lower.includes('doramas') ||
           lower.includes('animes') || lower.includes('reality');
  }
  
  if (targetClass === 'movies') {
    return lower.includes('filme') || lower.includes('filmes') ||
           lower.includes('movie') || lower.includes('cinema');
  }
  
  if (targetClass === 'tv') {
    return lower.includes('canais') || lower.includes('tv') ||
           lower.includes('ao vivo') || lower.includes('live') ||
           lower.includes('24h');
  }
  
  if (targetClass === 'other') {
    return !matchesContentClass(groupTitle, 'series') &&
           !matchesContentClass(groupTitle, 'movies') &&
           !matchesContentClass(groupTitle, 'tv');
  }
  
  return true;
}

// Format entry as M3U line - returns Uint8Array to avoid string concatenation
function formatEntry(e: any): Uint8Array {
  let line = `#EXTINF:-1`;
  if (e.tvg_id) line += ` tvg-id="${e.tvg_id}"`;
  if (e.tvg_name) line += ` tvg-name="${e.tvg_name}"`;
  if (e.tvg_logo) line += ` tvg-logo="${e.tvg_logo}"`;
  if (e.group_title) line += ` group-title="${e.group_title}"`;
  line += `,${e.title}\n${e.stream_url}\n`;
  return new TextEncoder().encode(line);
}

// Background processing function with streaming approach
async function processInBackground(
  sourceId: string, 
  sourceKey: string, 
  sourceName: string,
  entryIds: string[] | null,
  filters: any
) {
  const startTime = Date.now();
  
  try {
    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const useEntryIds = Array.isArray(entryIds) && entryIds.length > 0;
    const hasFilters = filters && (filters.searchQuery || filters.selectedClass || filters.selectedCategory);

    // Update status to processing
    await supabaseService
      .from('m3u_sync_sources')
      .update({ 
        metadata: { 
          generation_status: 'processing',
          generation_started_at: new Date().toISOString()
        }
      })
      .eq('id', sourceId);

    // Use array of Uint8Array chunks instead of string concatenation
    const chunks: Uint8Array[] = [];
    const header = new TextEncoder().encode('#EXTM3U\n');
    chunks.push(header);
    let totalSize = header.length;
    let actualCount = 0;

    if (useEntryIds) {
      // Process by IDs in small batches
      for (let i = 0; i < entryIds!.length; i += PAGE_SIZE) {
        const batchIds = entryIds!.slice(i, i + PAGE_SIZE);
        
        const { data: entries } = await supabaseService
          .from('m3u_sync_entries')
          .select('title, stream_url, tvg_id, tvg_name, tvg_logo, group_title')
          .in('id', batchIds)
          .eq('is_valid', true);

        if (entries) {
          for (const e of entries) {
            const chunk = formatEntry(e);
            chunks.push(chunk);
            totalSize += chunk.length;
            actualCount++;
          }
        }
        
        // Small delay to prevent CPU overload
        if (i > 0 && i % 5000 === 0) {
          await new Promise(r => setTimeout(r, 10));
        }
      }
    } else {
      // Get total count first
      const { count: totalCount } = await supabaseService
        .from('m3u_sync_entries')
        .select('*', { count: 'exact', head: true })
        .eq('source_id', sourceId)
        .eq('is_valid', true);

      console.log(`[GenerateM3U-BG] Total: ${totalCount}`);

      // Paginated fetch with cursor-based pagination using ID
      let lastId: string | null = null;
      let processedCount = 0;
      let consecutiveEmptyBatches = 0;

      while (processedCount < (totalCount || 0) && consecutiveEmptyBatches < 3) {
        let query = supabaseService
          .from('m3u_sync_entries')
          .select('id, title, stream_url, tvg_id, tvg_name, tvg_logo, group_title')
          .eq('source_id', sourceId)
          .eq('is_valid', true)
          .order('id', { ascending: true })
          .limit(PAGE_SIZE);

        // Use cursor-based pagination instead of offset
        if (lastId) {
          query = query.gt('id', lastId);
        }

        if (hasFilters?.selectedCategory) {
          query = query.eq('group_title', filters.selectedCategory);
        }
        if (hasFilters?.searchQuery) {
          query = query.or(`title.ilike.%${filters.searchQuery}%,group_title.ilike.%${filters.searchQuery}%`);
        }

        const { data: entries, error } = await query;

        if (error) {
          console.error(`[GenerateM3U-BG] Query error:`, error.message);
          consecutiveEmptyBatches++;
          await new Promise(r => setTimeout(r, 500)); // Wait before retry
          continue;
        }

        if (!entries || entries.length === 0) {
          consecutiveEmptyBatches++;
          continue;
        }

        consecutiveEmptyBatches = 0;
        lastId = entries[entries.length - 1].id;

        for (const e of entries) {
          if (hasFilters?.selectedClass && !matchesContentClass(e.group_title || '', filters.selectedClass)) {
            continue;
          }

          const chunk = formatEntry(e);
          chunks.push(chunk);
          totalSize += chunk.length;
          actualCount++;
        }

        processedCount += entries.length;

        // Log progress every 10k entries
        if (processedCount % 10000 < PAGE_SIZE) {
          console.log(`[GenerateM3U-BG] Progress: ${processedCount}/${totalCount} (${actualCount} matching)`);
        }

        // Small delay between batches to prevent CPU overload
        await new Promise(r => setTimeout(r, 5));
      }
    }

    console.log(`[GenerateM3U-BG] Generated: ${actualCount} entries, ${(totalSize/1024/1024).toFixed(2)}MB`);

    // Combine chunks efficiently
    const combined = new Uint8Array(totalSize);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    
    // Clear chunks array to free memory
    chunks.length = 0;

    // Upload to R2
    let cdnUrl: string | null = null;
    try {
      cdnUrl = await uploadToR2(sourceKey, combined);
      console.log(`[GenerateM3U-BG] ✅ Uploaded: ${cdnUrl}`);
    } catch (e) {
      console.error(`[GenerateM3U-BG] R2 upload failed:`, e);
    }

    // Update metadata
    await supabaseService
      .from('m3u_sync_sources')
      .update({
        metadata: {
          cdn_url: cdnUrl,
          cdn_generated_at: new Date().toISOString(),
          cdn_file_size: totalSize,
          cdn_entries_count: actualCount,
          generation_status: cdnUrl ? 'completed' : 'failed',
          generation_time_ms: Date.now() - startTime
        }
      })
      .eq('id', sourceId);

    console.log(`[GenerateM3U-BG] ✅ Complete in ${Date.now() - startTime}ms`);

  } catch (error) {
    console.error('[GenerateM3U-BG] ❌ Error:', error);
    
    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    await supabaseService
      .from('m3u_sync_sources')
      .update({
        metadata: {
          generation_status: 'failed',
          generation_error: error.message,
          generation_failed_at: new Date().toISOString()
        }
      })
      .eq('id', sourceId);
  }
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
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: isAdmin } = await supabase.rpc('is_admin', { uid: user.id });
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Acesso negado' }),
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

    console.log(`[GenerateM3U] Starting background task for: ${sourceName || sourceId}`);

    // Start background processing - don't await, let it run
    EdgeRuntime.waitUntil(processInBackground(sourceId, sourceKey, sourceName, entryIds, filters));

    // Return immediately
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Geração iniciada em background',
        status: 'processing',
        sourceId,
        sourceKey
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
    throw new Error(`R2 upload failed: ${response.status}`);
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
