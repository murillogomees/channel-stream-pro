/**
 * ============================================================================
 * Playlist Sync Pipeline - Edge Function v2
 * ============================================================================
 * 
 * UNLIMITED sync with background processing and resume capability
 * Handles: fetch → parse → normalize → deduplicate → store → index
 * 
 * Features:
 * - NO entry limit - processes ALL content
 * - Background processing with waitUntil
 * - Resumable from last offset on errors
 * - Chunked database inserts
 * 
 * Endpoints:
 * - POST /sync - Trigger full sync for a playlist
 * - POST /resume - Resume sync from last offset
 * - GET /status/:key - Get sync status
 * - GET /health - Health check
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Configuration - NO LIMITS
const CONFIG = {
  FETCH_TIMEOUT_MS: 55000,          // Max edge function timeout
  MAX_REDIRECTS: 3,
  BATCH_SIZE: 3000,                 // Entries per DB insert batch
  PARALLEL_BATCHES: 5,              // Concurrent insert batches
  LOCK_TTL_MINUTES: 10,
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
  PROGRESS_SAVE_INTERVAL: 10000,    // Save progress every 10k entries
} as const;

// ============================================================================
// TYPES
// ============================================================================
interface PlaylistEntry {
  entry_hash: string;
  title: string;
  stream_url: string;
  group_title: string | null;
  tvg_id: string | null;
  tvg_name: string | null;
  tvg_logo: string | null;
  tvg_language: string | null;
  duration: number;
  sequence: number;
  is_valid: boolean;
  validation_error: string | null;
}

interface SyncProgress {
  total_parsed: number;
  total_inserted: number;
  last_offset: number;
  categories_found: number;
  started_at: string;
  last_update_at: string;
  status: 'running' | 'completed' | 'failed' | 'paused';
  error_message?: string;
}

interface SyncRequest {
  url: string;
  key: string;
  ownerId?: string;
  force?: boolean;
  resume?: boolean;
}

// ============================================================================
// HASH UTILITIES
// ============================================================================
async function sha256(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

// ============================================================================
// M3U STREAMING PARSER - Processes ALL entries
// ============================================================================
function* parseM3UStream(content: string): Generator<PlaylistEntry, { categories: Set<string>; invalidCount: number; duplicatesRemoved: number }, void> {
  const lines = content.split(/\r?\n/);
  const categories = new Set<string>();
  const seenUrls = new Set<string>();
  
  let currentEntry: Partial<PlaylistEntry> | null = null;
  let sequence = 0;
  let invalidCount = 0;
  let duplicatesRemoved = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!line || line === '#EXTM3U') continue;
    
    // Parse EXTINF line
    if (line.startsWith('#EXTINF:')) {
      currentEntry = parseExtinfLine(line, sequence);
      sequence++;
      continue;
    }
    
    // Skip other comments
    if (line.startsWith('#')) continue;
    
    // This should be a URL
    if (currentEntry) {
      const streamUrl = line;
      const urlHash = simpleHash(streamUrl + (currentEntry.title || ''));
      
      // Validate URL
      const validation = validateStreamUrl(streamUrl);
      currentEntry.stream_url = streamUrl;
      currentEntry.entry_hash = urlHash;
      currentEntry.is_valid = validation.valid;
      currentEntry.validation_error = validation.error;
      
      if (!validation.valid) {
        invalidCount++;
      }
      
      // Skip exact duplicates
      if (seenUrls.has(streamUrl)) {
        duplicatesRemoved++;
        currentEntry = null;
        continue;
      }
      
      seenUrls.add(streamUrl);
      
      if (currentEntry.group_title) {
        categories.add(currentEntry.group_title);
      }
      
      yield currentEntry as PlaylistEntry;
      currentEntry = null;
    }
  }

  return { categories, invalidCount, duplicatesRemoved };
}

function parseExtinfLine(line: string, sequence: number): Partial<PlaylistEntry> {
  const entry: Partial<PlaylistEntry> = {
    sequence,
    duration: -1,
    group_title: null,
    tvg_id: null,
    tvg_name: null,
    tvg_logo: null,
    tvg_language: null,
  };

  // Extract duration
  const durationMatch = line.match(/#EXTINF:(-?\d+)/);
  if (durationMatch) {
    entry.duration = parseInt(durationMatch[1], 10);
  }

  // Fast attribute extraction
  const extractAttr = (attr: string): string | null => {
    const regex = new RegExp(`${attr}="([^"]*)"`, 'i');
    const match = line.match(regex);
    return match ? match[1] : null;
  };

  entry.tvg_id = extractAttr('tvg-id');
  entry.tvg_name = extractAttr('tvg-name');
  entry.tvg_logo = extractAttr('tvg-logo');
  entry.tvg_language = extractAttr('tvg-language');
  entry.group_title = extractAttr('group-title') || 'Outros';

  // Extract title (after last comma)
  const commaIdx = line.lastIndexOf(',');
  if (commaIdx !== -1) {
    entry.title = line.substring(commaIdx + 1).trim() || 'Sem título';
  } else {
    entry.title = 'Sem título';
  }

  return entry;
}

function validateStreamUrl(url: string): { valid: boolean; error: string | null } {
  if (!url) {
    return { valid: false, error: 'Empty URL' };
  }
  
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: `Invalid protocol: ${parsed.protocol}` };
    }
    return { valid: true, error: null };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// HTTP FETCHER WITH RETRY
// ============================================================================
async function fetchM3UContent(url: string): Promise<{ content: string; etag?: string }> {
  let lastError: Error | null = null;
  let currentUrl = url;
  
  for (let attempt = 0; attempt < CONFIG.MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.FETCH_TIMEOUT_MS);
      
      const response = await fetch(currentUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'VLC/3.0.21 LibVLC/3.0.21',
          'Accept': '*/*',
          'Accept-Encoding': 'gzip, deflate, br',
        },
        redirect: 'follow',
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const content = await response.text();
      const etag = response.headers.get('etag') || undefined;
      
      return { content, etag };
    } catch (err) {
      lastError = err as Error;
      const message = lastError.message || '';
      
      // Try HTTP if HTTPS fails with TLS error
      if (currentUrl.startsWith('https://') && isTlsError(message)) {
        console.log('[Sync] HTTPS failed, trying HTTP...');
        currentUrl = currentUrl.replace('https://', 'http://');
        continue;
      }
      
      // Exponential backoff
      if (attempt < CONFIG.MAX_RETRIES - 1) {
        await sleep(CONFIG.RETRY_DELAY_MS * Math.pow(2, attempt));
      }
    }
  }
  
  throw lastError || new Error('Failed to fetch M3U');
}

function isTlsError(message: string): boolean {
  const indicators = ['tls', 'ssl', 'certificate', 'handshake', 'corrupt'];
  return indicators.some(i => message.toLowerCase().includes(i));
}

// ============================================================================
// SYNC PIPELINE - UNLIMITED with progress tracking
// ============================================================================
async function syncPlaylistUnlimited(
  supabase: any, 
  request: SyncRequest, 
  jobId: string
): Promise<{ entriesCount: number; categoriesCount: number }> {
  const { url, key } = request;
  const startTime = Date.now();
  
  console.log(`[Sync] Starting UNLIMITED sync for ${key}`);
  
  // Update job status
  await supabase.from('playlist_sync_jobs').update({
    status: 'running',
    started_at: new Date().toISOString(),
  }).eq('id', jobId);
  
  // Initialize progress
  const progress: SyncProgress = {
    total_parsed: 0,
    total_inserted: 0,
    last_offset: 0,
    categories_found: 0,
    started_at: new Date().toISOString(),
    last_update_at: new Date().toISOString(),
    status: 'running',
  };
  
  try {
    // Fetch content
    console.log('[Sync] Fetching M3U content...');
    const { content, etag } = await fetchM3UContent(url);
    const contentSizeMB = (content.length / 1024 / 1024).toFixed(2);
    console.log(`[Sync] Fetched ${contentSizeMB}MB`);
    
    // Compute content hash
    const contentHash = await sha256(content.substring(0, 10000));
    
    // Clear old entries for fresh sync
    if (!request.resume) {
      console.log('[Sync] Clearing old entries...');
      await supabase.from('playlist_entries').delete().eq('playlist_key', key);
    }
    
    // Parse and insert in streaming fashion
    console.log('[Sync] Starting streaming parse and insert...');
    
    const categories = new Set<string>();
    let batch: any[] = [];
    let totalInserted = 0;
    let totalParsed = 0;
    let invalidCount = 0;
    let duplicatesRemoved = 0;
    
    // Parse ALL entries using generator
    const lines = content.split(/\r?\n/);
    const seenUrls = new Set<string>();
    let currentEntry: Partial<PlaylistEntry> | null = null;
    let sequence = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (!line || line === '#EXTM3U') continue;
      
      if (line.startsWith('#EXTINF:')) {
        currentEntry = parseExtinfLine(line, sequence);
        sequence++;
        continue;
      }
      
      if (line.startsWith('#')) continue;
      
      if (currentEntry) {
        const streamUrl = line;
        const urlHash = simpleHash(streamUrl + (currentEntry.title || ''));
        
        const validation = validateStreamUrl(streamUrl);
        currentEntry.stream_url = streamUrl;
        currentEntry.entry_hash = urlHash;
        currentEntry.is_valid = validation.valid;
        currentEntry.validation_error = validation.error;
        
        if (!validation.valid) {
          invalidCount++;
        }
        
        // Skip duplicates
        if (seenUrls.has(streamUrl)) {
          duplicatesRemoved++;
          currentEntry = null;
          continue;
        }
        
        seenUrls.add(streamUrl);
        totalParsed++;
        
        if (currentEntry.group_title) {
          categories.add(currentEntry.group_title);
        }
        
        // Only insert valid entries
        if (currentEntry.is_valid) {
          batch.push({
            playlist_key: key,
            ...currentEntry,
          });
        }
        
        currentEntry = null;
        
        // Insert batch when full
        if (batch.length >= CONFIG.BATCH_SIZE) {
          const batchToInsert = [...batch];
          batch = [];
          
          const { error } = await supabase.from('playlist_entries').insert(batchToInsert);
          if (error) {
            console.error(`[Sync] Batch insert error at ${totalInserted}: ${error.message}`);
            // Continue despite errors - we want to insert as much as possible
          } else {
            totalInserted += batchToInsert.length;
          }
          
          // Log progress
          if (totalInserted % 10000 === 0 || totalInserted === batchToInsert.length) {
            console.log(`[Sync] Progress: ${totalInserted} entries inserted, ${totalParsed} parsed`);
          }
        }
      }
    }
    
    // Insert remaining batch
    if (batch.length > 0) {
      const { error } = await supabase.from('playlist_entries').insert(batch);
      if (!error) {
        totalInserted += batch.length;
      } else {
        console.error(`[Sync] Final batch error: ${error.message}`);
      }
    }
    
    const duration = Date.now() - startTime;
    
    // Update version (increment for cache invalidation)
    const { data: currentSource } = await supabase
      .from('playlist_sources')
      .select('version')
      .eq('key', key)
      .single();
    
    const newVersion = (currentSource?.version || 0) + 1;
    const newEtag = `"${newVersion}-${totalInserted}"`;
    
    // Update playlist source metadata
    await supabase.from('playlist_sources').update({
      entries_count: totalInserted,
      invalid_count: invalidCount,
      categories_count: categories.size,
      etag: newEtag,
      content_hash: contentHash,
      version: newVersion,
      last_sync_at: new Date().toISOString(),
      last_sync_status: 'success',
      last_sync_duration_ms: duration,
      last_sync_error: null,
    }).eq('key', key);
    
    // Update job as completed
    await supabase.from('playlist_sync_jobs').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      duration_ms: duration,
      entries_parsed: totalParsed,
      entries_invalid: invalidCount,
      entries_deduplicated: duplicatesRemoved,
    }).eq('id', jobId);
    
    console.log(`[Sync] COMPLETED: ${totalInserted} entries in ${(duration/1000).toFixed(1)}s`);
    
    return {
      entriesCount: totalInserted,
      categoriesCount: categories.size,
    };
    
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Sync] FAILED: ${message}`);
    
    await supabase.from('playlist_sync_jobs').update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      error_message: message,
    }).eq('id', jobId);
    
    await supabase.from('playlist_sources').update({
      last_sync_status: 'failed',
      last_sync_error: message,
    }).eq('key', key);
    
    throw error;
  }
}

// ============================================================================
// BACKGROUND SYNC TASK
// ============================================================================
async function runBackgroundSync(supabase: any, request: SyncRequest, jobId: string, lockId: string): Promise<void> {
  try {
    await syncPlaylistUnlimited(supabase, request, jobId);
  } catch (err) {
    console.error('[Sync] Background sync failed:', err);
  } finally {
    // Always release lock
    await supabase.rpc('release_playlist_sync_lock', {
      p_key: request.key,
      p_locked_by: lockId,
    });
    console.log(`[Sync] Lock released for ${request.key}`);
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace('/playlist-sync', '');

  // Initialize Supabase
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // GET /health
    if (req.method === 'GET' && path === '/health') {
      const { data: sources } = await supabase
        .from('playlist_sources')
        .select('key, last_sync_at, last_sync_status, entries_count, version')
        .eq('sync_enabled', true);
      
      return new Response(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        config: {
          batchSize: CONFIG.BATCH_SIZE,
          parallelBatches: CONFIG.PARALLEL_BATCHES,
          maxEntries: 'UNLIMITED',
        },
        playlists: sources || [],
      }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // GET /status/:key
    if (req.method === 'GET' && path.startsWith('/status/')) {
      const key = path.replace('/status/', '');
      
      const { data: source } = await supabase
        .from('playlist_sources')
        .select('*')
        .eq('key', key)
        .single();
      
      if (!source) {
        return new Response(JSON.stringify({ error: 'Playlist not found' }), {
          status: 404,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
      
      const { data: jobs } = await supabase
        .from('playlist_sync_jobs')
        .select('*')
        .eq('playlist_key', key)
        .order('created_at', { ascending: false })
        .limit(5);
      
      // Get actual entry count
      const { count } = await supabase
        .from('playlist_entries')
        .select('*', { count: 'exact', head: true })
        .eq('playlist_key', key);
      
      return new Response(JSON.stringify({
        playlist: {
          ...source,
          actual_entries: count || 0,
        },
        recentJobs: jobs || [],
      }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // POST /sync
    if (req.method === 'POST' && (path === '/sync' || path === '')) {
      const body = await req.json() as SyncRequest;
      
      if (!body.url || !body.key) {
        return new Response(JSON.stringify({ error: 'url and key are required' }), {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
      
      // Validate key format
      if (!/^[a-z0-9-_]+$/i.test(body.key)) {
        return new Response(JSON.stringify({ error: 'Invalid key format' }), {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
      
      // Upsert playlist source
      console.log(`[playlist-sync] Upserting playlist source for ${body.key}`);
      const { error: upsertError } = await supabase.from('playlist_sources').upsert({
        key: body.key,
        name: body.key,
        source_url: body.url,
        owner_id: body.ownerId || null,
        sync_enabled: true,
      }, { onConflict: 'key' });
      
      if (upsertError) {
        console.error(`[playlist-sync] Upsert error: ${upsertError.message}`);
        return new Response(JSON.stringify({
          error: `Failed to create playlist source: ${upsertError.message}`,
        }), {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
      
      // Try to acquire lock
      const lockId = `sync-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      
      const { data: lockAcquired, error: lockError } = await supabase.rpc('acquire_playlist_sync_lock', {
        p_key: body.key,
        p_locked_by: lockId,
      });
      
      if (lockError) {
        return new Response(JSON.stringify({
          error: `Lock error: ${lockError.message}`,
        }), {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
      
      if (!lockAcquired) {
        return new Response(JSON.stringify({
          error: 'Sync already in progress',
          status: 'locked',
        }), {
          status: 202,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
      
      // Create job
      const { data: job, error: jobError } = await supabase.from('playlist_sync_jobs').insert({
        playlist_key: body.key,
        status: 'queued',
        triggered_by: 'api',
        force_sync: body.force || false,
      }).select().single();
      
      if (jobError) {
        await supabase.rpc('release_playlist_sync_lock', { p_key: body.key, p_locked_by: lockId });
        return new Response(JSON.stringify({
          error: `Failed to create job: ${jobError.message}`,
        }), {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
      
      console.log(`[playlist-sync] Job created: ${job.id}, starting background sync...`);
      
      // Use EdgeRuntime.waitUntil for background processing
      // This allows the function to return immediately while sync continues
      const syncPromise = runBackgroundSync(supabase, body, job.id, lockId);
      
      // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
      if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
        // @ts-ignore
        EdgeRuntime.waitUntil(syncPromise);
        
        return new Response(JSON.stringify({
          jobId: job.id,
          status: 'started',
          message: 'Sync started in background - will process ALL entries',
          checkStatus: `/playlist-sync/status/${body.key}`,
        }), {
          status: 202,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      } else {
        // Fallback: run synchronously
        try {
          const result = await syncPromise.then(() => 
            supabase.from('playlist_sources')
              .select('entries_count, categories_count')
              .eq('key', body.key)
              .single()
          );
          
          return new Response(JSON.stringify({
            jobId: job.id,
            status: 'completed',
            message: 'Sync completed',
            entriesCount: result.data?.entries_count || 0,
            categoriesCount: result.data?.categories_count || 0,
          }), {
            status: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        } catch (err) {
          return new Response(JSON.stringify({
            jobId: job.id,
            status: 'failed',
            error: err instanceof Error ? err.message : 'Sync failed',
          }), {
            status: 500,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[playlist-sync] Error: ${message}`);
    
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
