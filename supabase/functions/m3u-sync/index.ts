import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Config for chunked sync
const CHUNK_SIZE = 70000; // Entries per chunk
const BATCH_INSERT_SIZE = 1000;

// AWS S3 Signature V4 helper for R2
async function signR2Request(
  method: string,
  url: string,
  accessKeyId: string,
  secretAccessKey: string,
  accountId: string
): Promise<Headers> {
  const parsedUrl = new URL(url);
  const service = 's3';
  const region = 'auto';
  const host = parsedUrl.host;
  const path = parsedUrl.pathname;
  
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substring(0, 8);
  
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const payloadHash = await sha256('');
  
  const canonicalRequest = [
    method,
    path,
    '',
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
    '',
    signedHeaders,
    payloadHash
  ].join('\n');
  
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    await sha256(canonicalRequest)
  ].join('\n');
  
  const signingKey = await getSignatureKey(secretAccessKey, dateStamp, region, service);
  const signature = await hmacHex(signingKey, stringToSign);
  
  const authorizationHeader = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  
  const headers = new Headers();
  headers.set('Host', host);
  headers.set('X-Amz-Date', amzDate);
  headers.set('X-Amz-Content-Sha256', payloadHash);
  headers.set('Authorization', authorizationHeader);
  
  return headers;
}

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmac(key: ArrayBuffer, message: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
}

async function hmacHex(key: ArrayBuffer, message: string): Promise<string> {
  const sig = await hmac(key, message);
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getSignatureKey(key: string, dateStamp: string, region: string, service: string): Promise<ArrayBuffer> {
  const kDate = await hmac(new TextEncoder().encode('AWS4' + key), dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  return await hmac(kService, 'aws4_request');
}

function isR2Url(url: string): boolean {
  return url.includes('.r2.cloudflarestorage.com');
}

function normalizeUrl(urlStr: string): string {
  if (!urlStr) return urlStr;
  
  let normalized = urlStr
    .replace(/^https\/\//i, 'https://')
    .replace(/^http\/\//i, 'http://')
    .replace(/^https:\/\/https:\/\//i, 'https://')
    .replace(/^https:\/\/http:\/\//i, 'http://')
    .replace(/^https:\/\/https\/\//i, 'https://')
    .replace(/^http:\/\/http\/\//i, 'http://');
  
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = 'https://' + normalized;
  }
  
  return normalized;
}

async function fetchWithR2Support(url: string, signal?: AbortSignal): Promise<Response> {
  const normalizedUrl = normalizeUrl(url);
  console.log(`[M3U-Sync] Fetching URL: ${normalizedUrl}`);
  
  const r2AccessKeyId = Deno.env.get('R2_ACCESS_KEY_ID');
  const r2SecretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY');
  const r2AccountId = Deno.env.get('R2_ACCOUNT_ID');
  const r2PublicDomain = Deno.env.get('R2_PUBLIC_DOMAIN');
  
  if (r2PublicDomain && isR2Url(normalizedUrl)) {
    try {
      const parsedUrl = new URL(normalizedUrl);
      const normalizedDomain = normalizeUrl(r2PublicDomain);
      let cleanDomain: string;
      try {
        const domainUrl = new URL(normalizedDomain);
        cleanDomain = domainUrl.host;
      } catch {
        cleanDomain = normalizedDomain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      }
      
      if (cleanDomain && cleanDomain.includes('.') && !cleanDomain.includes('//')) {
        const publicUrl = `https://${cleanDomain}${parsedUrl.pathname}`;
        console.log(`[M3U-Sync] Trying public R2 URL: ${publicUrl}`);
        
        const response = await fetch(publicUrl, {
          signal,
          headers: { 'User-Agent': 'M3U-Sync/1.0', 'Accept': '*/*' },
        });
        
        if (response.ok) return response;
      }
    } catch (e) {
      console.log('[M3U-Sync] Public URL error:', e);
    }
  }
  
  if (isR2Url(normalizedUrl) && r2AccessKeyId && r2SecretAccessKey && r2AccountId) {
    const signedHeaders = await signR2Request('GET', normalizedUrl, r2AccessKeyId, r2SecretAccessKey, r2AccountId);
    signedHeaders.set('User-Agent', 'M3U-Sync/1.0');
    return await fetch(normalizedUrl, { signal, headers: signedHeaders });
  }
  
  console.log('[M3U-Sync] Using standard fetch');
  return await fetch(normalizedUrl, {
    signal,
    headers: { 'User-Agent': 'M3U-Sync/1.0', 'Accept': '*/*' },
  });
}

interface ParsedEntry {
  title: string;
  streamUrl: string;
  groupTitle?: string;
  tvgId?: string;
  tvgName?: string;
  tvgLogo?: string;
  tvgLanguage?: string;
  duration: number;
  rawExtInf: string;
}

// Optimized M3U Parser with offset support for chunked processing
function parseM3UChunked(
  content: string, 
  offset = 0, 
  chunkSize = CHUNK_SIZE
): { entries: ParsedEntry[]; invalidCount: number; totalEntries: number; hasMore: boolean } {
  const lines = content.split(/\r?\n/);
  const entries: ParsedEntry[] = [];
  let invalidCount = 0;
  let totalEntries = 0;
  let currentExtInf: string | null = null;
  let entriesFound = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!line || line === '#EXTM3U') continue;
    
    if (line.startsWith('#EXTINF:')) {
      currentExtInf = line;
      continue;
    }
    
    if (line.startsWith('#')) continue;
    
    if (currentExtInf && isValidUrl(line)) {
      totalEntries++;
      
      // Skip entries before offset
      if (entriesFound < offset) {
        entriesFound++;
        currentExtInf = null;
        continue;
      }
      
      // Stop if we've collected enough for this chunk
      if (entries.length >= chunkSize) {
        currentExtInf = null;
        continue; // Continue counting total
      }
      
      entriesFound++;
      const entry = parseExtInfFast(currentExtInf, line);
      if (entry) {
        entries.push(entry);
      } else {
        invalidCount++;
      }
      currentExtInf = null;
    } else if (isValidUrl(line)) {
      totalEntries++;
      
      if (entriesFound < offset) {
        entriesFound++;
        continue;
      }
      
      if (entries.length >= chunkSize) {
        continue;
      }
      
      entriesFound++;
      entries.push({
        title: extractTitleFromUrl(line),
        streamUrl: line,
        duration: -1,
        rawExtInf: '',
      });
    } else if (currentExtInf) {
      invalidCount++;
      currentExtInf = null;
    }
  }
  
  const hasMore = (offset + entries.length) < totalEntries;
  
  return { entries, invalidCount, totalEntries, hasMore };
}

// Fast EXTINF parser
function parseExtInfFast(extinf: string, url: string): ParsedEntry | null {
  try {
    const match = extinf.match(/#EXTINF:(-?\d+)\s*(.*?)(?:,(.*))?$/);
    if (!match) return { title: extractTitleFromUrl(url), streamUrl: url, duration: -1, rawExtInf: extinf };
    
    const duration = parseInt(match[1]) || -1;
    const attributes = match[2] || '';
    const title = match[3]?.trim() || extractTitleFromUrl(url);
    
    const attrs: Record<string, string> = {};
    const attrRegex = /([\w-]+)=["']([^"']*)["']/g;
    let attrMatch;
    while ((attrMatch = attrRegex.exec(attributes)) !== null) {
      attrs[attrMatch[1].toLowerCase()] = attrMatch[2];
    }
    
    return {
      title: attrs['tvg-name'] || title,
      streamUrl: url,
      groupTitle: attrs['group-title'],
      tvgId: attrs['tvg-id'],
      tvgName: attrs['tvg-name'],
      tvgLogo: attrs['tvg-logo'],
      tvgLanguage: attrs['tvg-language'],
      duration,
      rawExtInf: extinf.substring(0, 500),
    };
  } catch {
    return null;
  }
}

function isValidUrl(str: string): boolean {
  if (!str) return false;
  return /^(https?|rtmp|rtmps|rtsp|mms):\/\/.+/i.test(str.trim());
}

function extractTitleFromUrl(url: string): string {
  try {
    const parts = url.split('/');
    const filename = parts[parts.length - 1];
    return filename.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ').substring(0, 200);
  } catch {
    return 'Unknown';
  }
}

function generateHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

// Background sync processor with chunked support and auto-continuation
async function processSyncInBackground(
  source: any,
  jobId: string,
  triggeredBy: string,
  offset = 0,
  isFirstChunk = true
) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const jobStartTime = Date.now();
  
  try {
    console.log(`[M3U-Sync-BG] Starting chunk sync for ${source.key}, offset: ${offset}`);
    
    // Fetch with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);
    
    const response = await fetchWithR2Support(source.source_url, controller.signal);
    clearTimeout(timeout);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const content = await response.text();
    const fileSize = content.length;
    
    console.log(`[M3U-Sync-BG] Downloaded ${fileSize} bytes for ${source.key}`);
    
    // Parse chunk
    const { entries, invalidCount, totalEntries, hasMore } = parseM3UChunked(content, offset, CHUNK_SIZE);
    console.log(`[M3U-Sync-BG] Parsed chunk: ${entries.length} entries (offset: ${offset}, total: ${totalEntries}, hasMore: ${hasMore})`);
    
    // Deduplicate
    const uniqueMap = new Map<string, ParsedEntry>();
    for (const entry of entries) {
      const hash = generateHash(entry.streamUrl);
      if (!uniqueMap.has(hash)) {
        uniqueMap.set(hash, entry);
      }
    }
    const uniqueEntries = Array.from(uniqueMap.values());
    console.log(`[M3U-Sync-BG] ${uniqueEntries.length} unique entries in chunk`);
    
    // Delete old entries only on first chunk
    if (isFirstChunk) {
      await supabase.from('m3u_sync_entries').delete().eq('source_id', source.id);
    }
    
    // Insert in batches
    let insertedCount = 0;
    for (let i = 0; i < uniqueEntries.length; i += BATCH_INSERT_SIZE) {
      const batch = uniqueEntries.slice(i, i + BATCH_INSERT_SIZE).map(entry => ({
        source_id: source.id,
        entry_hash: generateHash(entry.streamUrl),
        title: entry.title.substring(0, 500),
        stream_url: entry.streamUrl,
        group_title: entry.groupTitle?.substring(0, 200),
        tvg_id: entry.tvgId?.substring(0, 100),
        tvg_name: entry.tvgName?.substring(0, 200),
        tvg_logo: entry.tvgLogo?.substring(0, 500),
        tvg_language: entry.tvgLanguage?.substring(0, 50),
        duration: entry.duration,
        raw_extinf: entry.rawExtInf?.substring(0, 500),
        is_valid: true,
      }));
      
      const { error: insertError } = await supabase.from('m3u_sync_entries').insert(batch);
      if (insertError) {
        console.error(`[M3U-Sync-BG] Batch insert error:`, insertError.message);
      } else {
        insertedCount += batch.length;
      }
      
      if (i % (BATCH_INSERT_SIZE * 5) === 0 && i > 0) {
        await new Promise(r => setTimeout(r, 10));
      }
    }
    
    const duration = Date.now() - jobStartTime;
    const newOffset = offset + entries.length;
    const currentChunk = Math.floor(offset / CHUNK_SIZE) + 1;
    const totalChunks = Math.ceil(totalEntries / CHUNK_SIZE);
    
    // Get current entry count
    const { count: existingCount } = await supabase
      .from('m3u_sync_entries')
      .select('*', { count: 'exact', head: true })
      .eq('source_id', source.id);
    
    // Complete current job
    await supabase.from('m3u_sync_jobs').update({
      status: hasMore ? 'completed' : 'completed',
      completed_at: new Date().toISOString(),
      duration_ms: duration,
      entries_count: existingCount || insertedCount,
      invalid_entries_count: invalidCount,
      file_size_bytes: fileSize,
      metadata: {
        chunk: currentChunk,
        total_chunks: totalChunks,
        next_offset: hasMore ? newOffset : null,
        has_more: hasMore,
      },
    }).eq('id', jobId);
    
    // If there are more entries, auto-trigger next chunk
    if (hasMore) {
      console.log(`[M3U-Sync-BG] ⏳ Chunk ${currentChunk}/${totalChunks} completed. Auto-continuing to offset: ${newOffset}`);
      
      // Update source with partial status
      await supabase.from('m3u_sync_sources').update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: 'partial',
        last_error: null,
        entries_count: existingCount || insertedCount,
        invalid_entries_count: invalidCount,
        file_size_bytes: fileSize,
        metadata: {
          ...(source.metadata || {}),
          sync_offset: newOffset,
          total_entries_available: totalEntries,
          current_chunk: currentChunk,
          total_chunks: totalChunks,
          last_chunk_duration_ms: duration,
        },
      }).eq('id', source.id);
      
      // Auto-invoke next chunk via HTTP call to self
      try {
        const nextChunkResponse = await fetch(`${supabaseUrl}/functions/v1/m3u-sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            key: source.key,
            triggered_by: 'auto_continuation',
            offset: newOffset,
            continue_sync: true,
          }),
        });
        
        if (nextChunkResponse.ok) {
          console.log(`[M3U-Sync-BG] ✅ Auto-triggered chunk ${currentChunk + 1}/${totalChunks}`);
        } else {
          console.error(`[M3U-Sync-BG] ❌ Failed to auto-trigger next chunk:`, await nextChunkResponse.text());
        }
      } catch (e) {
        console.error(`[M3U-Sync-BG] ❌ Error auto-triggering next chunk:`, e);
      }
      
    } else {
      // All chunks processed - final update
      const checksum = generateHash(String(existingCount) + source.id);
      
      await supabase.from('m3u_sync_sources').update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: 'completed',
        last_error: null,
        entries_count: existingCount || insertedCount,
        invalid_entries_count: invalidCount,
        file_size_bytes: fileSize,
        checksum,
        metadata: {
          ...(source.metadata || {}),
          sync_offset: 0,
          total_entries_available: totalEntries,
          current_chunk: 0,
          total_chunks: totalChunks,
          last_full_sync_duration_ms: duration,
          total_entries_synced: existingCount,
        },
      }).eq('id', source.id);
      
      console.log(`[M3U-Sync-BG] ✅ All ${totalChunks} chunks completed for ${source.key}: ${existingCount} entries`);
    }
    
    return { hasMore, nextOffset: newOffset, totalEntries, insertedCount, currentChunk, totalChunks };
    
  } catch (error: any) {
    const duration = Date.now() - jobStartTime;
    const errorMsg = error.message || 'Unknown error';
    
    console.error(`[M3U-Sync-BG] ❌ Failed for ${source.key}:`, errorMsg);
    
    await supabase.from('m3u_sync_sources').update({
      last_sync_at: new Date().toISOString(),
      last_sync_status: 'failed',
      last_error: errorMsg,
    }).eq('id', source.id);
    
    await supabase.from('m3u_sync_jobs').update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      duration_ms: duration,
      error_message: errorMsg,
    }).eq('id', jobId);
    
    await supabase.from('m3u_sync_errors').insert({
      source_id: source.id,
      job_id: jobId,
      error_type: 'sync_failed',
      error_message: errorMsg,
    });
    
    return { hasMore: false, error: errorMsg };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  const url = new URL(req.url);
  const path = url.pathname.replace('/m3u-sync', '');
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // GET /health
    if (req.method === 'GET' && (path === '/health' || path === '')) {
      const { data: stats } = await supabase.rpc('get_m3u_sync_stats');
      return new Response(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        stats: stats?.[0] || {},
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    // GET /sources
    if (req.method === 'GET' && path === '/sources') {
      const { data, error } = await supabase.from('m3u_sync_sources').select('*').order('name');
      if (error) throw error;
      return new Response(JSON.stringify({ sources: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // GET /source/:key
    if (req.method === 'GET' && path.startsWith('/source/')) {
      const key = path.replace('/source/', '');
      const { data: source, error } = await supabase.from('m3u_sync_sources').select('*').eq('key', key).single();
      
      if (error || !source) {
        return new Response(JSON.stringify({ error: 'Source not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      const { data: jobs } = await supabase.from('m3u_sync_jobs').select('*').eq('source_id', source.id).order('started_at', { ascending: false }).limit(20);
      const { data: entries, count } = await supabase.from('m3u_sync_entries').select('*', { count: 'exact' }).eq('source_id', source.id).eq('is_valid', true).limit(20);
      
      return new Response(JSON.stringify({
        source,
        jobs: jobs || [],
        entries_preview: entries || [],
        total_entries: count || 0,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    // POST /sync - Trigger sync with optional offset for chunked processing
    if (req.method === 'POST' && (path === '/sync' || path === '' || path === '/')) {
      const authHeader = req.headers.get('authorization');
      const cronSecret = Deno.env.get('CRON_SECRET');
      
      let isAuthorized = authHeader?.includes(supabaseKey) || authHeader === `Bearer ${cronSecret}`;
      
      if (!isAuthorized && authHeader?.startsWith('Bearer ')) {
        try {
          const token = authHeader.replace('Bearer ', '');
          const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
            global: { headers: { Authorization: `Bearer ${token}` } }
          });
          
          const { data: { user }, error: authError } = await userClient.auth.getUser();
          
          if (!authError && user) {
            const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
            if (roles?.some(r => r.role === 'admin' || r.role === 'super_admin')) {
              isAuthorized = true;
              console.log(`[M3U-Sync] Authorized admin: ${user.email}`);
            }
          }
        } catch (e) {
          console.log('[M3U-Sync] Auth check failed:', e);
        }
      }
      
      if (!isAuthorized) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      const body = await req.json().catch(() => ({}));
      const { key, triggered_by = 'manual', offset = 0, continue_sync = false } = body;
      const isFirstChunk = offset === 0 && !continue_sync;
      
      let sourcesToSync: any[] = [];
      
      if (key) {
        const { data: source, error } = await supabase
          .from('m3u_sync_sources')
          .select('*')
          .eq('key', key)
          .eq('enabled', true)
          .single();
        
        if (error || !source) {
          return new Response(JSON.stringify({ error: 'Source not found or disabled' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        sourcesToSync = [source];
      } else {
        const { data: sources } = await supabase
          .from('m3u_sync_sources')
          .select('*')
          .eq('enabled', true);
        sourcesToSync = sources || [];
      }
      
      if (sourcesToSync.length === 0) {
        return new Response(JSON.stringify({ error: 'No sources to sync' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      const results: any[] = [];
      
      for (const source of sourcesToSync) {
        // Create job record
        const { data: job, error: jobError } = await supabase
          .from('m3u_sync_jobs')
          .insert({
            source_id: source.id,
            status: 'running',
            started_at: new Date().toISOString(),
            triggered_by,
            metadata: { offset, is_continuation: continue_sync },
          })
          .select()
          .single();
        
        if (jobError) {
          console.error('[M3U-Sync] Failed to create job:', jobError);
          continue;
        }
        
        // Update source status
        await supabase.from('m3u_sync_sources').update({
          last_sync_status: 'running',
          last_error: null,
        }).eq('id', source.id);
        
        // Start background processing
        EdgeRuntime.waitUntil(
          processSyncInBackground(source, job.id, triggered_by, offset, isFirstChunk)
        );
        
        results.push({
          source_key: source.key,
          job_id: job.id,
          status: 'started',
          offset,
          message: `Sync started for ${source.name}${offset > 0 ? ` (continuing from entry ${offset})` : ''}`,
        });
      }
      
      return new Response(JSON.stringify({
        success: true,
        syncs_started: results.length,
        results,
        chunked: true,
        chunk_size: CHUNK_SIZE,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    // POST /source - Create new source
    if (req.method === 'POST' && path === '/source') {
      const body = await req.json();
      
      const { data, error } = await supabase
        .from('m3u_sync_sources')
        .insert({
          key: body.key,
          name: body.name,
          source_url: body.source_url,
          sync_interval_minutes: body.sync_interval_minutes || 30,
          enabled: body.enabled ?? true,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      return new Response(JSON.stringify({ source: data }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // DELETE /source/:key
    if (req.method === 'DELETE' && path.startsWith('/source/')) {
      const key = path.replace('/source/', '');
      
      const { error } = await supabase
        .from('m3u_sync_sources')
        .delete()
        .eq('key', key);
      
      if (error) throw error;
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // GET /search
    if (req.method === 'GET' && path === '/search') {
      const query = url.searchParams.get('q') || '';
      const sourceKey = url.searchParams.get('source') || null;
      const limit = parseInt(url.searchParams.get('limit') || '50');
      
      const { data, error } = await supabase.rpc('search_m3u_entries', {
        search_query: query,
        source_key: sourceKey,
        limit_count: Math.min(limit, 200),
      });
      
      if (error) throw error;
      
      return new Response(JSON.stringify({ results: data || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error: any) {
    console.error('[M3U-Sync] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Graceful shutdown handler
addEventListener('beforeunload', (ev: any) => {
  console.log('[M3U-Sync] Function shutting down:', ev.detail?.reason);
});
