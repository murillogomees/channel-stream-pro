import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// M3U Parser - robust parsing with multi-line EXTINF support
function parseM3U(content: string): { entries: ParsedEntry[]; invalidCount: number; warnings: string[] } {
  const lines = content.split(/\r?\n/);
  const entries: ParsedEntry[] = [];
  const warnings: string[] = [];
  let invalidCount = 0;
  let currentExtInf: string | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines and header
    if (!line || line === '#EXTM3U') continue;
    
    // Handle EXTINF line
    if (line.startsWith('#EXTINF:')) {
      currentExtInf = line;
      // Check for multi-line EXTINF (continues on next lines until URL)
      let j = i + 1;
      while (j < lines.length && !isValidUrl(lines[j].trim()) && !lines[j].trim().startsWith('#')) {
        currentExtInf += ' ' + lines[j].trim();
        j++;
      }
      continue;
    }
    
    // Skip other directives
    if (line.startsWith('#')) continue;
    
    // This should be a URL
    if (currentExtInf && isValidUrl(line)) {
      const entry = parseExtInf(currentExtInf, line);
      if (entry) {
        entries.push(entry);
      } else {
        invalidCount++;
        warnings.push(`Line ${i + 1}: Failed to parse entry`);
      }
      currentExtInf = null;
    } else if (isValidUrl(line)) {
      // URL without EXTINF
      entries.push({
        title: extractTitleFromUrl(line),
        streamUrl: line,
        duration: -1,
        rawExtInf: '',
      });
    } else if (currentExtInf) {
      invalidCount++;
      warnings.push(`Line ${i + 1}: Invalid URL after EXTINF`);
      currentExtInf = null;
    }
  }
  
  return { entries, invalidCount, warnings };
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

function parseExtInf(extinf: string, url: string): ParsedEntry | null {
  try {
    // Extract duration and rest
    const match = extinf.match(/#EXTINF:(-?\d+)(?:\s+(.*))?(?:,(.*))?$/);
    if (!match) {
      // Try alternative format
      const altMatch = extinf.match(/#EXTINF:(-?\d+)\s*,?\s*(.*)/);
      if (altMatch) {
        return {
          title: altMatch[2]?.trim() || extractTitleFromUrl(url),
          streamUrl: url,
          duration: parseInt(altMatch[1]) || -1,
          rawExtInf: extinf,
        };
      }
      return null;
    }
    
    const duration = parseInt(match[1]) || -1;
    const attributes = match[2] || '';
    const title = match[3]?.trim() || extractTitleFromUrl(url);
    
    // Parse attributes
    const attrs = parseAttributes(attributes);
    
    return {
      title: attrs['tvg-name'] || title,
      streamUrl: url,
      groupTitle: attrs['group-title'],
      tvgId: attrs['tvg-id'],
      tvgName: attrs['tvg-name'],
      tvgLogo: attrs['tvg-logo'],
      tvgLanguage: attrs['tvg-language'],
      duration,
      rawExtInf: extinf,
    };
  } catch (e) {
    console.error('[Parser] Error parsing EXTINF:', e);
    return null;
  }
}

function parseAttributes(str: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  // Match key="value" or key='value'
  const regex = /([\w-]+)=["']([^"']*)["']/g;
  let match;
  while ((match = regex.exec(str)) !== null) {
    attrs[match[1].toLowerCase()] = match[2];
  }
  return attrs;
}

function isValidUrl(str: string): boolean {
  if (!str) return false;
  const trimmed = str.trim();
  return /^(https?|rtmp|rtmps|rtsp|mms):\/\/.+/i.test(trimmed);
}

function extractTitleFromUrl(url: string): string {
  try {
    const parts = url.split('/');
    const filename = parts[parts.length - 1];
    return filename.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
  } catch {
    return 'Unknown';
  }
}

function generateHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

function generateM3UContent(entries: ParsedEntry[]): string {
  let content = '#EXTM3U\n';
  for (const entry of entries) {
    const attrs: string[] = [];
    if (entry.tvgId) attrs.push(`tvg-id="${entry.tvgId}"`);
    if (entry.tvgName) attrs.push(`tvg-name="${entry.tvgName}"`);
    if (entry.tvgLogo) attrs.push(`tvg-logo="${entry.tvgLogo}"`);
    if (entry.tvgLanguage) attrs.push(`tvg-language="${entry.tvgLanguage}"`);
    if (entry.groupTitle) attrs.push(`group-title="${entry.groupTitle}"`);
    
    const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';
    content += `#EXTINF:${entry.duration}${attrStr},${entry.title}\n`;
    content += `${entry.streamUrl}\n`;
  }
  return content;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  const url = new URL(req.url);
  const path = url.pathname.replace('/m3u-sync', '');
  
  // Initialize Supabase client
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // GET /health - Health check
    if (req.method === 'GET' && (path === '/health' || path === '')) {
      console.log('[M3U-Sync] Health check');
      
      const { data: stats } = await supabase.rpc('get_m3u_sync_stats');
      
      return new Response(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        stats: stats?.[0] || {},
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // GET /sources - List all sources
    if (req.method === 'GET' && path === '/sources') {
      console.log('[M3U-Sync] Listing sources');
      
      const { data, error } = await supabase
        .from('m3u_sync_sources')
        .select('*')
        .order('name');
      
      if (error) throw error;
      
      return new Response(JSON.stringify({ sources: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // GET /source/:key - Get source details
    if (req.method === 'GET' && path.startsWith('/source/')) {
      const key = path.replace('/source/', '');
      console.log(`[M3U-Sync] Getting source: ${key}`);
      
      const { data: source, error } = await supabase
        .from('m3u_sync_sources')
        .select('*')
        .eq('key', key)
        .single();
      
      if (error || !source) {
        return new Response(JSON.stringify({ error: 'Source not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Get recent jobs
      const { data: jobs } = await supabase
        .from('m3u_sync_jobs')
        .select('*')
        .eq('source_id', source.id)
        .order('started_at', { ascending: false })
        .limit(20);
      
      // Get entries preview
      const { data: entries, count } = await supabase
        .from('m3u_sync_entries')
        .select('*', { count: 'exact' })
        .eq('source_id', source.id)
        .eq('is_valid', true)
        .limit(20);
      
      return new Response(JSON.stringify({
        source,
        jobs: jobs || [],
        entries_preview: entries || [],
        total_entries: count || 0,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // POST /sync or POST / - Trigger sync
    if (req.method === 'POST' && (path === '/sync' || path === '' || path === '/')) {
      // Verify authorization
      const authHeader = req.headers.get('authorization');
      const cronSecret = Deno.env.get('CRON_SECRET');
      
      // Allow service role, cron secret, or authenticated admin user
      let isAuthorized = authHeader?.includes(supabaseKey) || 
                         authHeader === `Bearer ${cronSecret}`;
      
      // If not already authorized, check if user is authenticated admin
      if (!isAuthorized && authHeader?.startsWith('Bearer ')) {
        try {
          const token = authHeader.replace('Bearer ', '');
          // Create client with user token to verify
          const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
            global: { headers: { Authorization: `Bearer ${token}` } }
          });
          
          const { data: { user }, error: authError } = await userClient.auth.getUser();
          
          if (!authError && user) {
            // Check if user has admin role
            const { data: roles } = await supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', user.id);
            
            const isAdmin = roles?.some(r => r.role === 'admin' || r.role === 'super_admin');
            if (isAdmin) {
              isAuthorized = true;
              console.log(`[M3U-Sync] Authorized admin user: ${user.email}`);
            }
          }
        } catch (e) {
          console.log('[M3U-Sync] Token verification failed:', e);
        }
      }
      
      if (!isAuthorized) {
        console.log('[M3U-Sync] Unauthorized sync attempt');
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      const body = await req.json().catch(() => ({}));
      const { key, url: sourceUrl, triggered_by = 'api' } = body;
      
      console.log(`[M3U-Sync] Starting sync - key: ${key || 'all'}, triggered_by: ${triggered_by}`);
      
      // Get sources to sync
      let query = supabase.from('m3u_sync_sources').select('*').eq('enabled', true);
      if (key) {
        query = query.eq('key', key);
      }
      
      const { data: sources, error: sourcesError } = await query;
      
      if (sourcesError) throw sourcesError;
      if (!sources || sources.length === 0) {
        return new Response(JSON.stringify({ error: 'No sources to sync' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      const results = [];
      
      for (const source of sources) {
        const jobStartTime = Date.now();
        
        // Create job record
        const { data: job, error: jobError } = await supabase
          .from('m3u_sync_jobs')
          .insert({
            source_id: source.id,
            status: 'running',
            triggered_by,
          })
          .select()
          .single();
        
        if (jobError) {
          console.error(`[M3U-Sync] Failed to create job for ${source.key}:`, jobError);
          continue;
        }
        
        try {
          console.log(`[M3U-Sync] Fetching ${source.key} from ${source.source_url}`);
          
          // Fetch M3U content
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout
          
          const response = await fetch(source.source_url, {
            signal: controller.signal,
            headers: {
              'User-Agent': 'M3U-Sync/1.0',
              'Accept': 'application/vnd.apple.mpegurl, audio/x-mpegurl, text/plain, */*',
            },
          });
          clearTimeout(timeout);
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const content = await response.text();
          const fileSize = new TextEncoder().encode(content).length;
          
          console.log(`[M3U-Sync] Downloaded ${fileSize} bytes for ${source.key}`);
          
          // Parse M3U
          const { entries, invalidCount, warnings } = parseM3U(content);
          console.log(`[M3U-Sync] Parsed ${entries.length} entries, ${invalidCount} invalid for ${source.key}`);
          
          // Deduplicate entries
          const seenHashes = new Set<string>();
          const uniqueEntries: ParsedEntry[] = [];
          for (const entry of entries) {
            const hash = generateHash(entry.streamUrl + entry.title);
            if (!seenHashes.has(hash)) {
              seenHashes.add(hash);
              uniqueEntries.push(entry);
            }
          }
          
          console.log(`[M3U-Sync] ${uniqueEntries.length} unique entries after dedup for ${source.key}`);
          
          // Update entries in database
          // First, delete old entries
          await supabase
            .from('m3u_sync_entries')
            .delete()
            .eq('source_id', source.id);
          
          // Insert new entries in batches
          const batchSize = 500;
          for (let i = 0; i < uniqueEntries.length; i += batchSize) {
            const batch = uniqueEntries.slice(i, i + batchSize).map(entry => ({
              source_id: source.id,
              entry_hash: generateHash(entry.streamUrl + entry.title),
              title: entry.title.substring(0, 500),
              stream_url: entry.streamUrl,
              group_title: entry.groupTitle?.substring(0, 200),
              tvg_id: entry.tvgId?.substring(0, 100),
              tvg_name: entry.tvgName?.substring(0, 200),
              tvg_logo: entry.tvgLogo?.substring(0, 500),
              tvg_language: entry.tvgLanguage?.substring(0, 50),
              duration: entry.duration,
              raw_extinf: entry.rawExtInf.substring(0, 1000),
              is_valid: true,
            }));
            
            const { error: insertError } = await supabase
              .from('m3u_sync_entries')
              .insert(batch);
            
            if (insertError) {
              console.error(`[M3U-Sync] Batch insert error:`, insertError);
            }
          }
          
          // Generate normalized M3U content
          const normalizedM3U = generateM3UContent(uniqueEntries);
          const normalizedSize = new TextEncoder().encode(normalizedM3U).length;
          
          // Store in storage or just keep metadata
          // For now, we store the normalized content reference
          const checksum = generateHash(normalizedM3U);
          
          // Update source record
          const duration = Date.now() - jobStartTime;
          
          await supabase
            .from('m3u_sync_sources')
            .update({
              last_sync_at: new Date().toISOString(),
              last_sync_status: 'completed',
              last_error: null,
              entries_count: uniqueEntries.length,
              invalid_entries_count: invalidCount,
              file_size_bytes: normalizedSize,
              checksum,
              metadata: {
                ...(source.metadata || {}),
                last_warnings: warnings.slice(0, 10),
                last_duration_ms: duration,
              },
            })
            .eq('id', source.id);
          
          // Update job record
          await supabase
            .from('m3u_sync_jobs')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              duration_ms: duration,
              entries_count: uniqueEntries.length,
              invalid_entries_count: invalidCount,
              file_size_bytes: normalizedSize,
              metadata: { warnings: warnings.slice(0, 10) },
            })
            .eq('id', job.id);
          
          results.push({
            key: source.key,
            status: 'completed',
            entries: uniqueEntries.length,
            invalid: invalidCount,
            duration_ms: duration,
          });
          
          console.log(`[M3U-Sync] Completed sync for ${source.key} in ${duration}ms`);
          
        } catch (syncError: any) {
          const duration = Date.now() - jobStartTime;
          const errorMsg = syncError.message || 'Unknown error';
          
          console.error(`[M3U-Sync] Sync failed for ${source.key}:`, errorMsg);
          
          // Update source with error
          await supabase
            .from('m3u_sync_sources')
            .update({
              last_sync_at: new Date().toISOString(),
              last_sync_status: 'failed',
              last_error: errorMsg,
            })
            .eq('id', source.id);
          
          // Update job with error
          await supabase
            .from('m3u_sync_jobs')
            .update({
              status: 'failed',
              completed_at: new Date().toISOString(),
              duration_ms: duration,
              error_message: errorMsg,
            })
            .eq('id', job.id);
          
          // Log error
          await supabase
            .from('m3u_sync_errors')
            .insert({
              source_id: source.id,
              job_id: job.id,
              error_type: 'sync_failed',
              error_message: errorMsg,
              error_details: { stack: syncError.stack },
            });
          
          results.push({
            key: source.key,
            status: 'failed',
            error: errorMsg,
            duration_ms: duration,
          });
        }
      }
      
      return new Response(JSON.stringify({
        success: true,
        results,
        synced_at: new Date().toISOString(),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // POST /source - Create new source
    if (req.method === 'POST' && path === '/source') {
      const authHeader = req.headers.get('authorization');
      if (!authHeader?.includes(supabaseKey)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      const body = await req.json();
      const { key, name, source_url, sync_interval_minutes = 30 } = body;
      
      if (!key || !name || !source_url) {
        return new Response(JSON.stringify({ error: 'Missing required fields: key, name, source_url' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Validate key format
      if (!/^[a-z0-9-_]+$/.test(key)) {
        return new Response(JSON.stringify({ error: 'Key must contain only lowercase letters, numbers, hyphens and underscores' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      const { data, error } = await supabase
        .from('m3u_sync_sources')
        .insert({
          key,
          name,
          source_url,
          sync_interval_minutes,
          enabled: true,
        })
        .select()
        .single();
      
      if (error) {
        if (error.code === '23505') {
          return new Response(JSON.stringify({ error: 'Source with this key already exists' }), {
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        throw error;
      }
      
      console.log(`[M3U-Sync] Created source: ${key}`);
      
      return new Response(JSON.stringify({ source: data }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // DELETE /source/:key - Delete source
    if (req.method === 'DELETE' && path.startsWith('/source/')) {
      const authHeader = req.headers.get('authorization');
      if (!authHeader?.includes(supabaseKey)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      const key = path.replace('/source/', '');
      
      const { error } = await supabase
        .from('m3u_sync_sources')
        .delete()
        .eq('key', key);
      
      if (error) throw error;
      
      console.log(`[M3U-Sync] Deleted source: ${key}`);
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // GET /search - Search entries
    if (req.method === 'GET' && path === '/search') {
      const q = url.searchParams.get('q');
      const sourceKey = url.searchParams.get('source');
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);
      
      if (!q || q.length < 2) {
        return new Response(JSON.stringify({ error: 'Query must be at least 2 characters' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      console.log(`[M3U-Sync] Searching: "${q}" in ${sourceKey || 'all sources'}`);
      
      const { data, error } = await supabase.rpc('search_m3u_entries', {
        search_query: q,
        source_key: sourceKey || null,
        limit_count: limit,
      });
      
      if (error) throw error;
      
      return new Response(JSON.stringify({
        query: q,
        results: data || [],
        count: data?.length || 0,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error: any) {
    console.error('[M3U-Sync] Error:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Internal server error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
