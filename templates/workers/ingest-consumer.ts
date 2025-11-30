/**
 * Ingest Consumer Worker Template
 * 
 * Processes M3U files and video URLs for ingestion into the system
 * 
 * Environment Variables Required:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - R2_ACCOUNT_ID
 * - R2_ACCESS_KEY_ID
 * - R2_SECRET_ACCESS_KEY
 * - R2_BUCKET_NAME
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Types
interface IngestJob {
  id: string;
  source_type: 'm3u' | 'url' | 'upload';
  source_url?: string;
  source_content?: string;
  target_list_id: string;
  created_by: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  metadata?: Record<string, unknown>;
}

interface M3UChannel {
  name: string;
  streamUrl: string;
  groupTitle?: string;
  tvgId?: string;
  tvgName?: string;
  tvgLogo?: string;
}

interface ParseResult {
  channels: M3UChannel[];
  categories: Set<string>;
  errors: string[];
}

// M3U Parser
function parseM3U(content: string): ParseResult {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  const channels: M3UChannel[] = [];
  const categories = new Set<string>();
  const errors: string[] = [];

  let currentInfo: Partial<M3UChannel> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('#EXTM3U')) {
      continue;
    }

    if (line.startsWith('#EXTINF:')) {
      try {
        const match = line.match(/#EXTINF:(-?\d+)\s*(.*),(.*)$/);
        if (match) {
          const attrs = match[2];
          const name = match[3].trim();

          currentInfo = { name };

          // Parse attributes
          const tvgId = attrs.match(/tvg-id="([^"]*)"/)?.[1];
          const tvgName = attrs.match(/tvg-name="([^"]*)"/)?.[1];
          const tvgLogo = attrs.match(/tvg-logo="([^"]*)"/)?.[1];
          const groupTitle = attrs.match(/group-title="([^"]*)"/)?.[1];

          if (tvgId) currentInfo.tvgId = tvgId;
          if (tvgName) currentInfo.tvgName = tvgName;
          if (tvgLogo) currentInfo.tvgLogo = tvgLogo;
          if (groupTitle) {
            currentInfo.groupTitle = groupTitle;
            categories.add(groupTitle);
          }
        }
      } catch (e) {
        errors.push(`Line ${i + 1}: Failed to parse EXTINF`);
      }
    } else if (line.startsWith('http') && currentInfo) {
      channels.push({
        ...currentInfo,
        streamUrl: line,
      } as M3UChannel);
      currentInfo = null;
    }
  }

  return { channels, categories, errors };
}

// Fetch M3U from URL
async function fetchM3U(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'IPTVLINK-Ingest/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch M3U: ${response.status}`);
  }

  return response.text();
}

// Process ingest job
async function processJob(
  job: IngestJob,
  supabase: SupabaseClient,
  env: Record<string, string>
): Promise<{ success: boolean; channelsProcessed: number; error?: string }> {
  console.log(`[Ingest] Processing job ${job.id}, type: ${job.source_type}`);

  try {
    // Update status to processing
    await supabase
      .from('m3u_import_sessions')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', job.id);

    let content: string;

    // Get content based on source type
    switch (job.source_type) {
      case 'm3u':
        if (job.source_url) {
          content = await fetchM3U(job.source_url);
        } else if (job.source_content) {
          content = job.source_content;
        } else {
          throw new Error('No source URL or content provided');
        }
        break;
      case 'url':
        // Single URL - create minimal M3U
        content = `#EXTM3U\n#EXTINF:-1,Video\n${job.source_url}`;
        break;
      case 'upload':
        // Content should be in source_content
        content = job.source_content || '';
        break;
      default:
        throw new Error(`Unknown source type: ${job.source_type}`);
    }

    // Parse M3U
    const parsed = parseM3U(content);
    console.log(`[Ingest] Parsed ${parsed.channels.length} channels, ${parsed.categories.size} categories`);

    if (parsed.errors.length > 0) {
      console.warn(`[Ingest] Parse warnings:`, parsed.errors);
    }

    // Create categories
    const categoryMap = new Map<string, string>();
    for (const categoryName of parsed.categories) {
      const { data: category, error } = await supabase
        .from('m3u_categories')
        .upsert({
          custom_list_id: job.target_list_id,
          name: categoryName.toLowerCase().replace(/\s+/g, '_'),
          display_name: categoryName,
        }, { onConflict: 'custom_list_id,name' })
        .select('id')
        .single();

      if (category) {
        categoryMap.set(categoryName, category.id);
      }
    }

    // Insert channels in batches
    const BATCH_SIZE = 100;
    let processedCount = 0;

    for (let i = 0; i < parsed.channels.length; i += BATCH_SIZE) {
      const batch = parsed.channels.slice(i, i + BATCH_SIZE);
      
      const channelsToInsert = batch.map(ch => ({
        category_id: categoryMap.get(ch.groupTitle || 'Uncategorized') || categoryMap.values().next().value,
        name: ch.name,
        stream_url: ch.streamUrl,
        group_title: ch.groupTitle,
        tvg_id: ch.tvgId,
        tvg_name: ch.tvgName,
        tvg_logo: ch.tvgLogo,
        is_vod: detectVOD(ch),
        content_type: detectContentType(ch),
      }));

      const { error } = await supabase
        .from('m3u_channels')
        .upsert(channelsToInsert, { onConflict: 'category_id,stream_url' });

      if (error) {
        console.error(`[Ingest] Batch insert error:`, error);
      } else {
        processedCount += batch.length;
      }

      // Update progress
      await supabase
        .from('m3u_import_sessions')
        .update({
          processed_channels: processedCount,
          total_channels: parsed.channels.length,
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);
    }

    // Update list totals
    await supabase
      .from('m3u_custom_lists')
      .update({
        total_channels: processedCount,
        total_categories: parsed.categories.size,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.target_list_id);

    // Mark as completed
    await supabase
      .from('m3u_import_sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    return { success: true, channelsProcessed: processedCount };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Ingest] Job ${job.id} failed:`, error);

    await supabase
      .from('m3u_import_sessions')
      .update({
        status: 'failed',
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    return { success: false, channelsProcessed: 0, error: errorMessage };
  }
}

// Detect if channel is VOD
function detectVOD(channel: M3UChannel): boolean {
  const vodPatterns = [
    /filme/i, /movie/i, /cinema/i, /vod/i,
    /serie/i, /series/i, /temporada/i, /season/i,
    /\/movie\//i, /\/series\//i, /\/vod\//i,
  ];

  const text = `${channel.name} ${channel.groupTitle || ''} ${channel.streamUrl}`;
  return vodPatterns.some(p => p.test(text));
}

// Detect content type
function detectContentType(channel: M3UChannel): string {
  if (detectVOD(channel)) return 'vod';
  
  const livePatterns = [/live/i, /ao vivo/i, /tv/i, /\.m3u8/i];
  const text = `${channel.name} ${channel.groupTitle || ''} ${channel.streamUrl}`;
  
  if (livePatterns.some(p => p.test(text))) return 'live';
  return 'unknown';
}

// Main handler - Queue consumer
export default {
  async queue(batch: MessageBatch<IngestJob>, env: Record<string, string>): Promise<void> {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    for (const message of batch.messages) {
      const job = message.body;
      console.log(`[Ingest] Processing message for job ${job.id}`);

      const result = await processJob(job, supabase, env);

      if (result.success) {
        message.ack();
        console.log(`[Ingest] Job ${job.id} completed: ${result.channelsProcessed} channels`);
      } else {
        message.retry();
        console.error(`[Ingest] Job ${job.id} failed: ${result.error}`);
      }
    }
  },

  // HTTP handler for manual triggers
  async fetch(request: Request, env: Record<string, string>): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    const job = await request.json() as IngestJob;

    const result = await processJob(job, supabase, env);

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
      status: result.success ? 200 : 500,
    });
  },
};
