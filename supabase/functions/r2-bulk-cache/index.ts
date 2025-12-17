/**
 * R2 Bulk Cache Edge Function
 * Downloads VOD content from source and uploads to Cloudflare R2
 * Processes in batches of 50 items
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  uploadToR2, 
  checkR2Config,
  generateChannelKey,
  getCdnUrl,
  getMimeType
} from "../_shared/r2-config.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BATCH_SIZE = 50;
const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5GB max
const DOWNLOAD_TIMEOUT = 300000; // 5 minutes per file

interface BulkCacheRequest {
  action: 'start' | 'continue' | 'status' | 'cancel';
  jobId?: string;
  contentFilter?: 'vod' | 'all' | 'movies' | 'series';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { action, jobId, contentFilter = 'vod' } = await req.json() as BulkCacheRequest;

    // Check R2 config
    const r2Status = checkR2Config();
    if (!r2Status.configured) {
      return new Response(JSON.stringify({
        success: false,
        error: 'R2 not configured',
        missing: r2Status.missing
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    switch (action) {
      case 'start':
        return await startBulkCache(supabase, contentFilter);
      
      case 'continue':
        if (!jobId) {
          return new Response(JSON.stringify({ success: false, error: 'jobId required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        return await continueBulkCache(supabase, jobId);
      
      case 'status':
        return await getJobStatus(supabase, jobId);
      
      case 'cancel':
        if (!jobId) {
          return new Response(JSON.stringify({ success: false, error: 'jobId required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        return await cancelJob(supabase, jobId);
      
      default:
        return new Response(JSON.stringify({ success: false, error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
  } catch (error: any) {
    console.error('[r2-bulk-cache] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function startBulkCache(supabase: any, contentFilter: string) {
  console.log('[r2-bulk-cache] Starting new bulk cache job, filter:', contentFilter);

  // Count total uncached items
  const { count: totalItems } = await supabase
    .from('iptv_channels')
    .select('id', { count: 'exact', head: true })
    .in('content_type', getContentTypes(contentFilter))
    .not('original_url', 'is', null)
    .not('original_url', 'eq', '');

  if (!totalItems || totalItems === 0) {
    return new Response(JSON.stringify({
      success: true,
      message: 'No items to cache',
      totalItems: 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Check how many are already cached
  const { count: cachedCount } = await supabase
    .from('r2_cached_content')
    .select('id', { count: 'exact', head: true });

  const pendingItems = totalItems - (cachedCount || 0);

  // Create job
  const { data: job, error: jobError } = await supabase
    .from('r2_bulk_cache_jobs')
    .insert({
      status: 'running',
      total_items: pendingItems,
      batch_size: BATCH_SIZE,
      content_filter: contentFilter,
      started_at: new Date().toISOString()
    })
    .select()
    .single();

  if (jobError) {
    throw new Error(`Failed to create job: ${jobError.message}`);
  }

  console.log(`[r2-bulk-cache] Created job ${job.id} with ${pendingItems} pending items`);

  // Process first batch
  const result = await processBatch(supabase, job.id, contentFilter, 0);

  return new Response(JSON.stringify({
    success: true,
    jobId: job.id,
    totalItems: pendingItems,
    ...result
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function continueBulkCache(supabase: any, jobId: string) {
  console.log('[r2-bulk-cache] Continuing job:', jobId);

  // Get job
  const { data: job, error: jobError } = await supabase
    .from('r2_bulk_cache_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (jobError || !job) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Job not found'
    }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  if (job.status === 'cancelled') {
    return new Response(JSON.stringify({
      success: false,
      error: 'Job was cancelled'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  if (job.status === 'completed') {
    return new Response(JSON.stringify({
      success: true,
      message: 'Job already completed',
      ...job
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Process next batch
  const result = await processBatch(
    supabase, 
    jobId, 
    job.content_filter, 
    job.processed_items
  );

  return new Response(JSON.stringify({
    success: true,
    jobId,
    ...result
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function processBatch(
  supabase: any, 
  jobId: string, 
  contentFilter: string,
  offset: number
) {
  console.log(`[r2-bulk-cache] Processing batch at offset ${offset}`);

  // Get uncached channels
  const { data: channels, error: channelsError } = await supabase
    .rpc('get_uncached_vod_channels', { 
      p_limit: BATCH_SIZE, 
      p_offset: 0 // Always 0 because we exclude already cached
    });

  if (channelsError) {
    throw new Error(`Failed to get channels: ${channelsError.message}`);
  }

  if (!channels || channels.length === 0) {
    // Job complete
    await supabase
      .from('r2_bulk_cache_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);

    return {
      status: 'completed',
      processed: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      hasMore: false
    };
  }

  let successCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  const errors: string[] = [];

  for (const channel of channels) {
    try {
      // Check if already cached (race condition protection)
      const { data: existing } = await supabase
        .from('r2_cached_content')
        .select('id')
        .eq('channel_id', channel.channel_id)
        .single();

      if (existing) {
        skippedCount++;
        continue;
      }

      // Download content from source
      console.log(`[r2-bulk-cache] Downloading channel ${channel.channel_id}: ${channel.channel_name}`);
      
      const downloadResult = await downloadContent(channel.original_url);
      
      if (!downloadResult.success) {
        console.error(`[r2-bulk-cache] Download failed for ${channel.channel_id}:`, downloadResult.error);
        failedCount++;
        errors.push(`${channel.channel_id}: ${downloadResult.error}`);
        continue;
      }

      // Generate R2 key
      const extension = getExtensionFromUrl(channel.original_url);
      const r2Key = generateChannelKey(
        channel.channel_id.toString(),
        `content.${extension}`,
        'vod'
      );

      // Upload to R2
      console.log(`[r2-bulk-cache] Uploading to R2: ${r2Key}`);
      
      const uploadResult = await uploadToR2({
        key: r2Key,
        body: downloadResult.data!,
        contentType: downloadResult.contentType,
        metadata: {
          'source-url': channel.original_url,
          'channel-id': channel.channel_id.toString(),
          'channel-name': channel.channel_name || '',
          'cached-at': new Date().toISOString()
        },
        cacheControl: 'public, max-age=31536000, immutable' // 1 year cache for VOD
      });

      // Record in database
      await supabase
        .from('r2_cached_content')
        .insert({
          channel_id: channel.channel_id,
          original_url: channel.original_url,
          r2_key: r2Key,
          r2_url: uploadResult.cdnUrl,
          content_type: channel.content_type,
          file_size: uploadResult.size,
          mime_type: downloadResult.contentType,
          job_id: jobId
        });

      // Update iptv_channels with R2 info
      await supabase
        .from('iptv_channels')
        .update({
          r2_uploaded: true,
          r2_url: uploadResult.cdnUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', channel.channel_id);

      successCount++;
      console.log(`[r2-bulk-cache] ✓ Cached channel ${channel.channel_id}`);

    } catch (error: any) {
      console.error(`[r2-bulk-cache] Error processing channel ${channel.channel_id}:`, error);
      failedCount++;
      errors.push(`${channel.channel_id}: ${error.message}`);
    }
  }

  // Get current job state to increment counters
  const { data: currentJob } = await supabase
    .from('r2_bulk_cache_jobs')
    .select('success_items, failed_items, skipped_items')
    .eq('id', jobId)
    .single();

  // Update job progress with incremented values
  const { data: updatedJob } = await supabase
    .from('r2_bulk_cache_jobs')
    .update({
      processed_items: offset + channels.length,
      success_items: (currentJob?.success_items || 0) + successCount,
      failed_items: (currentJob?.failed_items || 0) + failedCount,
      skipped_items: (currentJob?.skipped_items || 0) + skippedCount,
      current_batch: Math.floor((offset + channels.length) / BATCH_SIZE),
      updated_at: new Date().toISOString()
    })
    .eq('id', jobId)
    .select()
    .single();

  // Check if there are more items
  const { count: remainingCount } = await supabase
    .rpc('get_uncached_vod_channels', { p_limit: 1, p_offset: 0 });

  const hasMore = (remainingCount || 0) > 0;

  if (!hasMore) {
    await supabase
      .from('r2_bulk_cache_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);
  }

  return {
    status: hasMore ? 'running' : 'completed',
    processed: channels.length,
    success: successCount,
    failed: failedCount,
    skipped: skippedCount,
    hasMore,
    errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    job: updatedJob
  };
}

async function downloadContent(url: string): Promise<{
  success: boolean;
  data?: Uint8Array;
  contentType?: string;
  error?: string;
}> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    // Check content length
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_FILE_SIZE) {
      return { success: false, error: 'File too large' };
    }

    const contentType = response.headers.get('content-type') || getMimeType(url);
    const data = new Uint8Array(await response.arrayBuffer());

    if (data.length > MAX_FILE_SIZE) {
      return { success: false, error: 'File too large' };
    }

    return { success: true, data, contentType };

  } catch (error: any) {
    if (error.name === 'AbortError') {
      return { success: false, error: 'Download timeout' };
    }
    return { success: false, error: error.message };
  }
}

async function getJobStatus(supabase: any, jobId?: string) {
  if (jobId) {
    const { data: job, error } = await supabase
      .from('r2_bulk_cache_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) {
      return new Response(JSON.stringify({ success: false, error: 'Job not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true, job }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Get all recent jobs
  const { data: jobs } = await supabase
    .from('r2_bulk_cache_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  // Get cache stats
  const { count: totalCached } = await supabase
    .from('r2_cached_content')
    .select('id', { count: 'exact', head: true });

  const { count: totalChannels } = await supabase
    .from('iptv_channels')
    .select('id', { count: 'exact', head: true })
    .in('content_type', ['vod', 'movie', 'series']);

  return new Response(JSON.stringify({
    success: true,
    jobs,
    stats: {
      totalCached: totalCached || 0,
      totalVodChannels: totalChannels || 0,
      cachePercentage: totalChannels ? Math.round((totalCached || 0) / totalChannels * 100) : 0
    }
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function cancelJob(supabase: any, jobId: string) {
  const { error } = await supabase
    .from('r2_bulk_cache_jobs')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString()
    })
    .eq('id', jobId)
    .eq('status', 'running');

  if (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ success: true, message: 'Job cancelled' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

function getContentTypes(filter: string): string[] {
  switch (filter) {
    case 'movies':
      return ['movie'];
    case 'series':
      return ['series'];
    case 'vod':
      return ['vod', 'movie', 'series'];
    case 'all':
      return ['vod', 'movie', 'series', 'live'];
    default:
      return ['vod', 'movie', 'series'];
  }
}

function getExtensionFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const ext = pathname.split('.').pop()?.toLowerCase();
    if (ext && ['mp4', 'mkv', 'avi', 'webm', 'mov', 'ts', 'm3u8'].includes(ext)) {
      return ext;
    }
  } catch {}
  return 'mp4'; // Default
}
