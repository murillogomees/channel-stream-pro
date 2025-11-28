/**
 * ============================================================================
 * Playlist Sync Pipeline - Edge Function v3
 * ============================================================================
 * 
 * Chunked sync with resume capability - processes within CPU time limits
 * 
 * Features:
 * - Processes entries in chunks to avoid CPU timeout
 * - Saves progress to resume from where it left off
 * - Can be called multiple times to complete full sync
 * 
 * Endpoints:
 * - POST /sync - Start new sync or resume existing
 * - GET /status/:key - Get sync status with progress
 * - GET /health - Health check
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Configuration - optimized for CPU time limits
const CONFIG = {
  FETCH_TIMEOUT_MS: 50000,
  CHUNK_SIZE: 50000,           // Process 50k entries per call
  BATCH_SIZE: 3000,            // Insert 3k entries per DB batch
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
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
  entries_parsed: number;
  entries_inserted: number;
  last_sequence: number;
  categories_count: number;
  is_complete: boolean;
  content_hash: string;
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
// M3U PARSER
// ============================================================================
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

  const durationMatch = line.match(/#EXTINF:(-?\d+)/);
  if (durationMatch) {
    entry.duration = parseInt(durationMatch[1], 10);
  }

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

  const commaIdx = line.lastIndexOf(',');
  if (commaIdx !== -1) {
    entry.title = line.substring(commaIdx + 1).trim() || 'Sem título';
  } else {
    entry.title = 'Sem título';
  }

  return entry;
}

function validateStreamUrl(url: string): { valid: boolean; error: string | null } {
  if (!url) return { valid: false, error: 'Empty URL' };
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: `Invalid protocol` };
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
// HTTP FETCHER
// ============================================================================
async function fetchM3UContent(url: string): Promise<string> {
  // Always try HTTP first for this IPTV provider (known TLS issues)
  let currentUrl = url.replace('https://', 'http://');
  
  for (let attempt = 0; attempt < CONFIG.MAX_RETRIES; attempt++) {
    try {
      console.log(`[Sync] Fetching attempt ${attempt + 1}: ${currentUrl.substring(0, 50)}...`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.FETCH_TIMEOUT_MS);
      
      const response = await fetch(currentUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'VLC/3.0.21 LibVLC/3.0.21',
          'Accept': '*/*',
        },
        redirect: 'follow',
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (err) {
      const message = (err as Error).message || '';
      console.log(`[Sync] Fetch attempt ${attempt + 1} failed: ${message}`);
      
      if (attempt < CONFIG.MAX_RETRIES - 1) {
        await sleep(CONFIG.RETRY_DELAY_MS * Math.pow(2, attempt));
      } else {
        throw err;
      }
    }
  }
  throw new Error('Failed to fetch M3U');
}

// ============================================================================
// CHUNKED SYNC - Processes entries in chunks to avoid CPU timeout
// ============================================================================
async function syncChunk(
  supabase: any,
  key: string,
  content: string,
  startSequence: number,
  isFirstChunk: boolean
): Promise<SyncProgress> {
  const lines = content.split(/\r?\n/);
  const seenUrls = new Set<string>();
  const categories = new Set<string>();
  
  let currentEntry: Partial<PlaylistEntry> | null = null;
  let sequence = 0;
  let entriesParsed = 0;
  let entriesInserted = 0;
  let batch: any[] = [];
  
  // If resuming, we need to skip entries we've already processed
  // But since we're parsing the whole file, just skip sequences < startSequence
  const skipUntil = startSequence;
  
  // Delete existing entries only on first chunk
  if (isFirstChunk && startSequence === 0) {
    console.log('[Sync] First chunk - clearing old entries...');
    await supabase.from('playlist_entries').delete().eq('playlist_key', key);
  }
  
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
      
      // Skip if before our start point
      if (currentEntry.sequence! < skipUntil) {
        currentEntry = null;
        continue;
      }
      
      // Stop if we've processed enough for this chunk
      if (entriesParsed >= CONFIG.CHUNK_SIZE) {
        break;
      }
      
      // Skip duplicates
      if (seenUrls.has(streamUrl)) {
        currentEntry = null;
        continue;
      }
      seenUrls.add(streamUrl);
      
      const urlHash = simpleHash(streamUrl + (currentEntry.title || ''));
      const validation = validateStreamUrl(streamUrl);
      
      currentEntry.stream_url = streamUrl;
      currentEntry.entry_hash = urlHash;
      currentEntry.is_valid = validation.valid;
      currentEntry.validation_error = validation.error;
      
      if (currentEntry.group_title) {
        categories.add(currentEntry.group_title);
      }
      
      entriesParsed++;
      
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
        if (!error) {
          entriesInserted += batchToInsert.length;
        } else {
          console.error(`[Sync] Batch error: ${error.message}`);
        }
        
        if (entriesInserted % 10000 < CONFIG.BATCH_SIZE) {
          console.log(`[Sync] Progress: ${entriesInserted} inserted, ${entriesParsed} parsed`);
        }
      }
    }
  }
  
  // Insert remaining batch
  if (batch.length > 0) {
    const { error } = await supabase.from('playlist_entries').insert(batch);
    if (!error) {
      entriesInserted += batch.length;
    }
  }
  
  // Check if we've reached the end
  const isComplete = entriesParsed < CONFIG.CHUNK_SIZE;
  const lastSequence = startSequence + entriesParsed;
  
  console.log(`[Sync] Chunk done: ${entriesInserted} inserted (sequences ${startSequence}-${lastSequence}), complete: ${isComplete}`);
  
  return {
    entries_parsed: entriesParsed,
    entries_inserted: entriesInserted,
    last_sequence: lastSequence,
    categories_count: categories.size,
    is_complete: isComplete,
    content_hash: '',
  };
}

// ============================================================================
// MAIN SYNC ORCHESTRATOR
// ============================================================================
async function runSync(supabase: any, request: SyncRequest): Promise<{
  status: string;
  entriesInserted: number;
  totalEntries: number;
  progress: number;
  isComplete: boolean;
  nextOffset?: number;
}> {
  const { url, key, force } = request;
  const startTime = Date.now();
  
  // Get current progress from database
  const { data: source } = await supabase
    .from('playlist_sources')
    .select('sync_progress, content_hash, entries_count')
    .eq('key', key)
    .single();
  
  let currentProgress: SyncProgress | null = source?.sync_progress;
  let startSequence = 0;
  let isFirstChunk = true;
  
  // Check if we should resume or start fresh
  if (currentProgress && !force && !currentProgress.is_complete) {
    startSequence = currentProgress.last_sequence;
    isFirstChunk = false;
    console.log(`[Sync] Resuming from sequence ${startSequence}`);
  } else {
    console.log('[Sync] Starting fresh sync');
  }
  
  // Fetch M3U content
  console.log('[Sync] Fetching M3U content...');
  const content = await fetchM3UContent(url);
  const contentHash = await sha256(content.substring(0, 10000));
  console.log(`[Sync] Fetched ${(content.length / 1024 / 1024).toFixed(2)}MB`);
  
  // Count total entries (quick scan)
  let totalEntries = 0;
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    if (line.startsWith('#EXTINF:')) totalEntries++;
  }
  console.log(`[Sync] Total entries in M3U: ${totalEntries}`);
  
  // Process this chunk
  const result = await syncChunk(supabase, key, content, startSequence, isFirstChunk);
  
  // Calculate totals
  const previousInserted = currentProgress && !isFirstChunk ? 
    (source?.entries_count || 0) : 0;
  const totalInserted = previousInserted + result.entries_inserted;
  
  // Update source with progress
  const newVersion = (source?.version || 0) + (result.is_complete ? 1 : 0);
  const newEtag = `"${newVersion}-${totalInserted}"`;
  
  await supabase.from('playlist_sources').update({
    entries_count: totalInserted,
    categories_count: result.categories_count,
    content_hash: contentHash,
    etag: result.is_complete ? newEtag : source?.etag,
    version: result.is_complete ? newVersion : (source?.version || 1),
    last_sync_at: new Date().toISOString(),
    last_sync_status: result.is_complete ? 'success' : 'partial',
    last_sync_duration_ms: Date.now() - startTime,
    last_sync_error: null,
    sync_progress: {
      entries_parsed: (currentProgress?.entries_parsed || 0) + result.entries_parsed,
      entries_inserted: totalInserted,
      last_sequence: result.last_sequence,
      categories_count: result.categories_count,
      is_complete: result.is_complete,
      content_hash: contentHash,
    },
  }).eq('key', key);
  
  const progress = Math.round((result.last_sequence / totalEntries) * 100);
  
  console.log(`[Sync] ${result.is_complete ? 'COMPLETED' : 'PARTIAL'}: ${totalInserted} entries, ${progress}% complete`);
  
  return {
    status: result.is_complete ? 'completed' : 'partial',
    entriesInserted: totalInserted,
    totalEntries,
    progress,
    isComplete: result.is_complete,
    nextOffset: result.is_complete ? undefined : result.last_sequence,
  };
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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // GET /health
    if (req.method === 'GET' && path === '/health') {
      const { data: sources } = await supabase
        .from('playlist_sources')
        .select('key, last_sync_at, last_sync_status, entries_count, sync_progress')
        .eq('sync_enabled', true);
      
      return new Response(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        config: {
          chunkSize: CONFIG.CHUNK_SIZE,
          batchSize: CONFIG.BATCH_SIZE,
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
      
      const { count } = await supabase
        .from('playlist_entries')
        .select('*', { count: 'exact', head: true })
        .eq('playlist_key', key);
      
      return new Response(JSON.stringify({
        playlist: {
          ...source,
          actual_entries: count || 0,
        },
        syncProgress: source.sync_progress,
        needsResume: source.sync_progress && !source.sync_progress.is_complete,
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
      
      if (!/^[a-z0-9-_]+$/i.test(body.key)) {
        return new Response(JSON.stringify({ error: 'Invalid key format' }), {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
      
      // Upsert playlist source
      const { error: upsertError } = await supabase.from('playlist_sources').upsert({
        key: body.key,
        name: body.key,
        source_url: body.url,
        owner_id: body.ownerId || null,
        sync_enabled: true,
      }, { onConflict: 'key' });
      
      if (upsertError) {
        return new Response(JSON.stringify({
          error: `Failed to create playlist source: ${upsertError.message}`,
        }), {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
      
      // Run sync (single chunk)
      const result = await runSync(supabase, body);
      
      return new Response(JSON.stringify({
        ...result,
        message: result.isComplete 
          ? 'Sync completed successfully'
          : `Sync in progress - ${result.progress}% complete. Call again to continue.`,
      }), {
        status: result.isComplete ? 200 : 202,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
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
