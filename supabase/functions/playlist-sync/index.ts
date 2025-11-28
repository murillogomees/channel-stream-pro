/**
 * ============================================================================
 * Playlist Sync Pipeline - Edge Function
 * ============================================================================
 * 
 * Handles: fetch → parse → normalize → deduplicate → store → index
 * 
 * Endpoints:
 * - POST /sync - Trigger sync for a playlist
 * - GET /status/:key - Get sync status
 * - GET /health - Health check
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Configuration - optimized for edge function timeouts
const CONFIG = {
  FETCH_TIMEOUT_MS: 25000,
  MAX_REDIRECTS: 3,
  MAX_ENTRIES: 15000, // Limit for edge function timeout (increase later with cron)
  BATCH_SIZE: 2000,
  LOCK_TTL_MINUTES: 3,
  MAX_RETRIES: 2,
  RETRY_DELAY_MS: 500,
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

interface ParseResult {
  entries: PlaylistEntry[];
  categories: Set<string>;
  invalidCount: number;
  duplicatesRemoved: number;
  parseWarnings: string[];
}

interface SyncRequest {
  url: string;
  key: string;
  ownerId?: string;
  force?: boolean;
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
// M3U PARSER - Robust & Fast
// ============================================================================
function parseM3U(content: string): ParseResult {
  const lines = content.split(/\r?\n/);
  const entries: PlaylistEntry[] = [];
  const categories = new Set<string>();
  const seenUrls = new Map<string, number>(); // url -> index for dedup
  const parseWarnings: string[] = [];
  
  let currentEntry: Partial<PlaylistEntry> | null = null;
  let sequence = 0;
  let invalidCount = 0;
  let duplicatesRemoved = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!line || line === '#EXTM3U') continue;
    
    // Parse EXTINF line
    if (line.startsWith('#EXTINF:')) {
      try {
        currentEntry = parseExtinfLine(line, sequence);
        sequence++;
      } catch (err) {
        parseWarnings.push(`Line ${i + 1}: Failed to parse EXTINF - ${err}`);
        currentEntry = null;
      }
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
      
      // Check for duplicates
      const existingIndex = seenUrls.get(streamUrl);
      if (existingIndex !== undefined) {
        // Keep the one with better metadata
        const existing = entries[existingIndex];
        if (shouldReplaceEntry(existing, currentEntry as PlaylistEntry)) {
          entries[existingIndex] = currentEntry as PlaylistEntry;
        }
        duplicatesRemoved++;
      } else {
        seenUrls.set(streamUrl, entries.length);
        entries.push(currentEntry as PlaylistEntry);
        
        if (currentEntry.group_title) {
          categories.add(currentEntry.group_title);
        }
      }
      
      currentEntry = null;
    }
    
    // Enforce max entries
    if (entries.length >= CONFIG.MAX_ENTRIES) {
      parseWarnings.push(`Reached max entries limit (${CONFIG.MAX_ENTRIES})`);
      break;
    }
  }

  return {
    entries,
    categories,
    invalidCount,
    duplicatesRemoved,
    parseWarnings,
  };
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

function shouldReplaceEntry(existing: PlaylistEntry, newEntry: PlaylistEntry): boolean {
  // Prefer entry with more metadata
  const existingScore = (existing.tvg_logo ? 1 : 0) + (existing.tvg_id ? 1 : 0) + (existing.title !== 'Sem título' ? 1 : 0);
  const newScore = (newEntry.tvg_logo ? 1 : 0) + (newEntry.tvg_id ? 1 : 0) + (newEntry.title !== 'Sem título' ? 1 : 0);
  return newScore > existingScore;
}

// ============================================================================
// HTTP FETCHER WITH RETRY
// ============================================================================
async function fetchM3UContent(url: string): Promise<{ content: string; etag?: string }> {
  let lastError: Error | null = null;
  let currentUrl = url;
  
  // Try HTTPS first, fallback to HTTP
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

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// SYNC PIPELINE
// ============================================================================
async function syncPlaylist(supabase: any, request: SyncRequest, jobId: string): Promise<void> {
  const { url, key } = request;
  const startTime = Date.now();
  const PARALLEL_BATCHES = 5;
  const OPTIMIZED_BATCH_SIZE = 2000;
  
  console.log(`[Sync] Starting sync for ${key} from ${url.substring(0, 50)}...`);
  
  try {
    // Update job status to running
    await supabase.from('playlist_sync_jobs').update({
      status: 'running',
      started_at: new Date().toISOString(),
    }).eq('id', jobId);
    
    // Fetch content
    console.log('[Sync] Fetching content...');
    const { content, etag } = await fetchM3UContent(url);
    console.log(`[Sync] Fetched ${(content.length / 1024 / 1024).toFixed(2)}MB`);
    
    // Compute content hash
    const contentHash = await sha256(content.substring(0, 10000));
    
    // Check if content changed (if not force sync)
    if (!request.force) {
      const { data: existing } = await supabase
        .from('playlist_sources')
        .select('content_hash')
        .eq('key', key)
        .single();
      
      if (existing?.content_hash === contentHash) {
        console.log('[Sync] Content unchanged, skipping...');
        await supabase.from('playlist_sync_jobs').update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
        }).eq('id', jobId);
        
        await supabase.from('playlist_sources').update({
          last_sync_at: new Date().toISOString(),
          last_sync_status: 'success',
        }).eq('key', key);
        
        return;
      }
    }
    
    // Parse content
    console.log('[Sync] Parsing content...');
    const parseResult = parseM3U(content);
    console.log(`[Sync] Parsed ${parseResult.entries.length} entries in ${Date.now() - startTime}ms`);
    
    // Delete old entries first
    console.log('[Sync] Clearing old entries...');
    await supabase.from('playlist_entries').delete().eq('playlist_key', key);
    
    // Insert new entries in parallel batches
    console.log('[Sync] Inserting entries in parallel...');
    const validEntries = parseResult.entries.filter(e => e.is_valid);
    const totalBatches = Math.ceil(validEntries.length / OPTIMIZED_BATCH_SIZE);
    
    // Process in parallel groups
    for (let groupStart = 0; groupStart < totalBatches; groupStart += PARALLEL_BATCHES) {
      const batchPromises: Promise<any>[] = [];
      
      for (let i = 0; i < PARALLEL_BATCHES && (groupStart + i) < totalBatches; i++) {
        const batchIndex = groupStart + i;
        const start = batchIndex * OPTIMIZED_BATCH_SIZE;
        const batch = validEntries.slice(start, start + OPTIMIZED_BATCH_SIZE).map(entry => ({
          playlist_key: key,
          ...entry,
        }));
        
        batchPromises.push(
          supabase.from('playlist_entries').insert(batch)
            .then((result: any) => {
              if (result.error) {
                console.error(`[Sync] Batch ${batchIndex + 1} error: ${result.error.message}`);
              }
              return result;
            })
        );
      }
      
      await Promise.all(batchPromises);
      console.log(`[Sync] Completed batches ${groupStart + 1}-${Math.min(groupStart + PARALLEL_BATCHES, totalBatches)} of ${totalBatches}`);
    }
    
    // Update playlist source metadata
    const duration = Date.now() - startTime;
    await supabase.from('playlist_sources').update({
      entries_count: validEntries.length,
      invalid_count: parseResult.invalidCount,
      categories_count: parseResult.categories.size,
      etag: etag || null,
      content_hash: contentHash,
      version: 1,
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
      entries_parsed: parseResult.entries.length,
      entries_invalid: parseResult.invalidCount,
      entries_deduplicated: parseResult.duplicatesRemoved,
      parse_warnings: parseResult.parseWarnings.slice(0, 10), // Limit warnings
    }).eq('id', jobId);
    
    console.log(`[Sync] Completed ${validEntries.length} entries in ${duration}ms`);
    
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Sync] Failed: ${message}`);
    
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
        .select('key, last_sync_at, last_sync_status, entries_count')
        .eq('sync_enabled', true);
      
      return new Response(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
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
      
      return new Response(JSON.stringify({
        playlist: source,
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
      
      // First, ensure playlist source exists (required for lock FK)
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
      
      // Now try to acquire lock
      const lockId = `sync-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      console.log(`[playlist-sync] Attempting lock for ${body.key} with lockId ${lockId}`);
      
      const { data: lockAcquired, error: lockError } = await supabase.rpc('acquire_playlist_sync_lock', {
        p_key: body.key,
        p_locked_by: lockId,
      });
      
      console.log(`[playlist-sync] Lock result: ${lockAcquired}, error: ${lockError?.message}`);
      
      if (lockError) {
        console.error(`[playlist-sync] Lock error: ${lockError.message}`);
        return new Response(JSON.stringify({
          error: `Lock error: ${lockError.message}`,
          status: 'error',
        }), {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
      
      if (lockAcquired === false) {
        return new Response(JSON.stringify({
          error: 'Sync already in progress',
          status: 'locked',
        }), {
          status: 202,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
      
      try {
        // Create job
        console.log(`[playlist-sync] Creating sync job for ${body.key}`);
        const { data: job, error: jobError } = await supabase.from('playlist_sync_jobs').insert({
          playlist_key: body.key,
          status: 'queued',
          triggered_by: 'api',
          force_sync: body.force || false,
        }).select().single();
        
        if (jobError) {
          throw new Error(`Failed to create job: ${jobError.message}`);
        }
        
        console.log(`[playlist-sync] Job created: ${job.id}, starting sync...`);
        
        // Run sync synchronously (Supabase Edge Functions don't support background processing)
        try {
          await syncPlaylist(supabase, body, job.id);
          console.log(`[playlist-sync] Sync completed for ${body.key}`);
          
          // Get updated stats
          const { data: updatedSource } = await supabase
            .from('playlist_sources')
            .select('entries_count, categories_count')
            .eq('key', body.key)
            .single();
          
          return new Response(JSON.stringify({
            jobId: job.id,
            status: 'completed',
            message: 'Sync completed successfully',
            entriesCount: updatedSource?.entries_count || 0,
            categoriesCount: updatedSource?.categories_count || 0,
          }), {
            status: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        } catch (syncError) {
          console.error(`[playlist-sync] Sync failed for ${body.key}: ${syncError instanceof Error ? syncError.message : syncError}`);
          return new Response(JSON.stringify({
            jobId: job.id,
            status: 'failed',
            error: syncError instanceof Error ? syncError.message : 'Sync failed',
          }), {
            status: 500,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        } finally {
          await supabase.rpc('release_playlist_sync_lock', {
            p_key: body.key,
            p_locked_by: lockId,
          });
        }
        
      } catch (error) {
        // Release lock on error
        console.error(`[playlist-sync] Error in sync setup: ${error instanceof Error ? error.message : error}`);
        await supabase.rpc('release_playlist_sync_lock', {
          p_key: body.key,
          p_locked_by: lockId,
        });
        throw error;
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
