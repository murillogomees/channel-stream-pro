import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// R2 Configuration
const R2_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID');
const R2_SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY');
const R2_BUCKET = 'iptvlink-cdn';
const R2_ENDPOINT = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const CDN_BASE_URL = 'https://cdn.iptvlink.com.br';

interface MigrationConfig {
  batchSize: number;
  concurrency: number;
  maxRetries: number;
  dryRun: boolean;
  targetTable: 'm3u_sync_entries' | 'm3u_channels' | 'playlist_entries';
}

interface MigrationResult {
  itemId: string;
  status: 'success' | 'failed' | 'skipped';
  fromUrl?: string;
  toPath?: string;
  etagOld?: string;
  etagNew?: string;
  sizeBytes?: number;
  durationMs: number;
  error?: string;
}

// Simple SHA-256 hash for content verification
async function sha256(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generate AWS Signature V4 for R2
async function signR2Request(
  method: string,
  path: string,
  headers: Record<string, string>,
  body?: Uint8Array
): Promise<Record<string, string>> {
  const datetime = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const date = datetime.slice(0, 8);
  const region = 'auto';
  const service = 's3';
  
  const signedHeaders: Record<string, string> = {
    ...headers,
    'host': `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    'x-amz-date': datetime,
    'x-amz-content-sha256': body ? await sha256(body) : 'UNSIGNED-PAYLOAD',
  };
  
  // Simplified signing - in production use full AWS Sig V4
  return signedHeaders;
}

// R2 Storage Operations
class R2Storage {
  private supabase: ReturnType<typeof createClient>;
  
  constructor(supabase: ReturnType<typeof createClient>) {
    this.supabase = supabase;
  }

  async headObject(key: string): Promise<{ etag: string; size: number; lastModified: string } | null> {
    try {
      const response = await fetch(`${R2_ENDPOINT}/${R2_BUCKET}/${key}`, {
        method: 'HEAD',
        headers: {
          'Authorization': `Bearer ${R2_SECRET_ACCESS_KEY}`,
        },
      });
      
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`HEAD failed: ${response.status}`);
      
      return {
        etag: response.headers.get('etag') || '',
        size: parseInt(response.headers.get('content-length') || '0'),
        lastModified: response.headers.get('last-modified') || '',
      };
    } catch (error) {
      console.error(`[R2] HEAD error for ${key}:`, error);
      return null;
    }
  }

  async uploadFile(
    key: string,
    data: Uint8Array,
    contentType: string,
    cacheControl?: string
  ): Promise<{ etag: string; size: number } | null> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': contentType,
        'Content-Length': data.length.toString(),
      };
      
      if (cacheControl) {
        headers['Cache-Control'] = cacheControl;
      }
      
      // Use Supabase function to proxy R2 upload (avoids CORS)
      const { data: result, error } = await this.supabase.functions.invoke('r2-upload-proxy', {
        body: {
          key,
          contentType,
          cacheControl,
          data: Array.from(data), // Convert to array for JSON
        },
      });
      
      if (error) throw error;
      
      return {
        etag: result?.etag || '',
        size: data.length,
      };
    } catch (error) {
      console.error(`[R2] Upload error for ${key}:`, error);
      return null;
    }
  }

  async downloadFromUrl(url: string): Promise<{ data: Uint8Array; contentType: string } | null> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout
      
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'IPTVLink-Migration/1.0',
        },
      });
      
      clearTimeout(timeout);
      
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }
      
      const data = new Uint8Array(await response.arrayBuffer());
      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      
      return { data, contentType };
    } catch (error) {
      console.error(`[R2] Download error from ${url}:`, error);
      return null;
    }
  }

  generatePublicUrl(key: string): string {
    return `${CDN_BASE_URL}/${key}`;
  }
}

// Migration Worker
class MigrationWorker {
  private supabase: ReturnType<typeof createClient>;
  private r2: R2Storage;
  private config: MigrationConfig;
  private jobId: string;
  private processedCount = 0;
  private successCount = 0;
  private failedCount = 0;
  private skippedCount = 0;
  private startTime = Date.now();

  constructor(
    supabase: ReturnType<typeof createClient>,
    config: MigrationConfig,
    jobId: string
  ) {
    this.supabase = supabase;
    this.r2 = new R2Storage(supabase);
    this.config = config;
    this.jobId = jobId;
  }

  async processM3uSyncEntry(entry: any): Promise<MigrationResult> {
    const startTime = Date.now();
    const result: MigrationResult = {
      itemId: entry.id,
      status: 'failed',
      durationMs: 0,
    };

    try {
      // Check if already synced
      if (entry.is_synced && entry.r2_path) {
        result.status = 'skipped';
        result.durationMs = Date.now() - startTime;
        return result;
      }

      // Get source URL (stream_url or tvg_logo)
      const sourceUrl = entry.stream_url;
      if (!sourceUrl) {
        result.status = 'skipped';
        result.error = 'No source URL';
        result.durationMs = Date.now() - startTime;
        return result;
      }

      // Generate R2 key
      const r2Key = `m3u/entries/${entry.id}`;

      // Check if already exists in R2
      if (!this.config.dryRun) {
        const existing = await this.r2.headObject(r2Key);
        if (existing) {
          // Update DB to mark as synced
          await this.supabase
            .from('m3u_sync_entries')
            .update({
              r2_path: r2Key,
              r2_etag: existing.etag,
              is_synced: true,
              migrated_at: new Date().toISOString(),
            })
            .eq('id', entry.id);

          result.status = 'success';
          result.toPath = r2Key;
          result.etagNew = existing.etag;
          result.durationMs = Date.now() - startTime;
          return result;
        }
      }

      // For M3U entries, we store metadata, not download the stream
      // The actual stream URL remains external
      const metadata = {
        id: entry.id,
        title: entry.title,
        stream_url: entry.stream_url,
        tvg_logo: entry.tvg_logo,
        tvg_id: entry.tvg_id,
        tvg_name: entry.tvg_name,
        group_title: entry.group_title,
        migrated_at: new Date().toISOString(),
      };

      const metadataJson = new TextEncoder().encode(JSON.stringify(metadata));

      if (!this.config.dryRun) {
        const uploadResult = await this.r2.uploadFile(
          `${r2Key}.json`,
          metadataJson,
          'application/json',
          'public, max-age=3600'
        );

        if (!uploadResult) {
          throw new Error('Upload failed');
        }

        // Update DB
        await this.supabase
          .from('m3u_sync_entries')
          .update({
            r2_path: `${r2Key}.json`,
            r2_etag: uploadResult.etag,
            is_synced: true,
            migrated_at: new Date().toISOString(),
          })
          .eq('id', entry.id);

        result.toPath = `${r2Key}.json`;
        result.etagNew = uploadResult.etag;
        result.sizeBytes = metadataJson.length;
      }

      result.status = 'success';
      result.fromUrl = sourceUrl;
      result.durationMs = Date.now() - startTime;
      return result;
    } catch (error) {
      result.status = 'failed';
      result.error = error instanceof Error ? error.message : 'Unknown error';
      result.durationMs = Date.now() - startTime;
      return result;
    }
  }

  async processM3uChannel(channel: any): Promise<MigrationResult> {
    const startTime = Date.now();
    const result: MigrationResult = {
      itemId: channel.id,
      status: 'failed',
      durationMs: 0,
    };

    try {
      // Check if already synced
      if (channel.is_logo_synced && channel.r2_logo_path) {
        result.status = 'skipped';
        result.durationMs = Date.now() - startTime;
        return result;
      }

      const logoUrl = channel.logo_url;
      if (!logoUrl) {
        result.status = 'skipped';
        result.error = 'No logo URL';
        result.durationMs = Date.now() - startTime;
        return result;
      }

      const r2Key = `logos/${channel.id}`;

      if (!this.config.dryRun) {
        // Download logo
        const downloaded = await this.r2.downloadFromUrl(logoUrl);
        if (!downloaded) {
          throw new Error('Logo download failed');
        }

        // Determine extension from content type
        let ext = 'png';
        if (downloaded.contentType.includes('jpeg') || downloaded.contentType.includes('jpg')) {
          ext = 'jpg';
        } else if (downloaded.contentType.includes('webp')) {
          ext = 'webp';
        } else if (downloaded.contentType.includes('svg')) {
          ext = 'svg';
        }

        const fullKey = `${r2Key}.${ext}`;

        // Upload to R2
        const uploadResult = await this.r2.uploadFile(
          fullKey,
          downloaded.data,
          downloaded.contentType,
          'public, max-age=31536000, immutable'
        );

        if (!uploadResult) {
          throw new Error('Logo upload failed');
        }

        // Update DB
        await this.supabase
          .from('m3u_channels')
          .update({
            r2_logo_path: fullKey,
            r2_logo_etag: uploadResult.etag,
            is_logo_synced: true,
            logo_migrated_at: new Date().toISOString(),
          })
          .eq('id', channel.id);

        result.toPath = fullKey;
        result.etagNew = uploadResult.etag;
        result.sizeBytes = downloaded.data.length;
      }

      result.status = 'success';
      result.fromUrl = logoUrl;
      result.durationMs = Date.now() - startTime;
      return result;
    } catch (error) {
      result.status = 'failed';
      result.error = error instanceof Error ? error.message : 'Unknown error';
      result.durationMs = Date.now() - startTime;
      return result;
    }
  }

  async processPlaylistEntry(entry: any): Promise<MigrationResult> {
    const startTime = Date.now();
    const result: MigrationResult = {
      itemId: entry.id,
      status: 'failed',
      durationMs: 0,
    };

    try {
      if (entry.is_output_synced && entry.r2_output_path) {
        result.status = 'skipped';
        result.durationMs = Date.now() - startTime;
        return result;
      }

      const outputUrl = entry.output_url;
      if (!outputUrl) {
        result.status = 'skipped';
        result.error = 'No output URL';
        result.durationMs = Date.now() - startTime;
        return result;
      }

      const r2Key = `playlists/${entry.playlist_id}/${entry.id}`;

      if (!this.config.dryRun) {
        // Download content
        const downloaded = await this.r2.downloadFromUrl(outputUrl);
        if (!downloaded) {
          throw new Error('Playlist download failed');
        }

        // Upload to R2
        const uploadResult = await this.r2.uploadFile(
          r2Key,
          downloaded.data,
          downloaded.contentType,
          'public, max-age=60, stale-while-revalidate=300'
        );

        if (!uploadResult) {
          throw new Error('Playlist upload failed');
        }

        // Update DB
        await this.supabase
          .from('playlist_entries')
          .update({
            r2_output_path: r2Key,
            r2_output_etag: uploadResult.etag,
            is_output_synced: true,
            output_migrated_at: new Date().toISOString(),
          })
          .eq('id', entry.id);

        result.toPath = r2Key;
        result.etagNew = uploadResult.etag;
        result.sizeBytes = downloaded.data.length;
      }

      result.status = 'success';
      result.fromUrl = outputUrl;
      result.durationMs = Date.now() - startTime;
      return result;
    } catch (error) {
      result.status = 'failed';
      result.error = error instanceof Error ? error.message : 'Unknown error';
      result.durationMs = Date.now() - startTime;
      return result;
    }
  }

  async logResult(result: MigrationResult): Promise<void> {
    try {
      await this.supabase.from('r2_migration_logs').insert({
        job_id: this.jobId,
        item_table: this.config.targetTable,
        item_id: result.itemId,
        from_url: result.fromUrl,
        to_path: result.toPath,
        etag_old: result.etagOld,
        etag_new: result.etagNew,
        size_bytes: result.sizeBytes,
        duration_ms: result.durationMs,
        status: result.status,
        error: result.error,
      });
    } catch (error) {
      console.error('[Migration] Failed to log result:', error);
    }
  }

  async processBatch(items: any[]): Promise<MigrationResult[]> {
    const results: MigrationResult[] = [];
    
    // Process with concurrency limit
    const chunks: any[][] = [];
    for (let i = 0; i < items.length; i += this.config.concurrency) {
      chunks.push(items.slice(i, i + this.config.concurrency));
    }

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map(async (item) => {
          let result: MigrationResult;
          
          switch (this.config.targetTable) {
            case 'm3u_sync_entries':
              result = await this.processM3uSyncEntry(item);
              break;
            case 'm3u_channels':
              result = await this.processM3uChannel(item);
              break;
            case 'playlist_entries':
              result = await this.processPlaylistEntry(item);
              break;
            default:
              result = {
                itemId: item.id,
                status: 'failed',
                error: 'Unknown table type',
                durationMs: 0,
              };
          }

          // Update counters
          this.processedCount++;
          if (result.status === 'success') this.successCount++;
          else if (result.status === 'failed') this.failedCount++;
          else this.skippedCount++;

          // Log result
          await this.logResult(result);

          return result;
        })
      );

      results.push(...chunkResults);
    }

    return results;
  }

  async updateJobProgress(): Promise<void> {
    const elapsedMs = Date.now() - this.startTime;
    const throughputPerMin = this.processedCount / (elapsedMs / 60000);
    const avgDurationMs = elapsedMs / Math.max(this.processedCount, 1);

    await this.supabase
      .from('r2_migration_jobs')
      .update({
        processed_items: this.processedCount,
        success_items: this.successCount,
        failed_items: this.failedCount,
        skipped_items: this.skippedCount,
        avg_duration_ms: avgDurationMs,
        throughput_per_min: throughputPerMin,
        last_checkpoint: {
          processed: this.processedCount,
          timestamp: new Date().toISOString(),
        },
      })
      .eq('id', this.jobId);
  }

  async run(): Promise<{ success: boolean; processed: number; failed: number }> {
    console.log(`[Migration] Starting job ${this.jobId} for ${this.config.targetTable}`);

    // Update job status to running
    await this.supabase
      .from('r2_migration_jobs')
      .update({
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .eq('id', this.jobId);

    let offset = 0;
    let hasMore = true;

    try {
      while (hasMore) {
        // Check if job should be paused/stopped
        const { data: job } = await this.supabase
          .from('r2_migration_jobs')
          .select('status')
          .eq('id', this.jobId)
          .single();

        if (job?.status === 'paused' || job?.status === 'cancelled') {
          console.log(`[Migration] Job ${this.jobId} was ${job.status}`);
          break;
        }

        // Fetch batch
        let query = this.supabase.from(this.config.targetTable).select('*');

        // Filter for unsynced items
        switch (this.config.targetTable) {
          case 'm3u_sync_entries':
            query = query.or('is_synced.is.null,is_synced.eq.false');
            break;
          case 'm3u_channels':
            query = query.or('is_logo_synced.is.null,is_logo_synced.eq.false');
            break;
          case 'playlist_entries':
            query = query.or('is_output_synced.is.null,is_output_synced.eq.false');
            break;
        }

        const { data: items, error } = await query
          .range(offset, offset + this.config.batchSize - 1);

        if (error) {
          throw error;
        }

        if (!items || items.length === 0) {
          hasMore = false;
          break;
        }

        // Process batch
        await this.processBatch(items);

        // Update progress
        await this.updateJobProgress();

        offset += this.config.batchSize;

        // Small delay to prevent overwhelming
        await new Promise(r => setTimeout(r, 100));
      }

      // Mark job as completed
      await this.supabase
        .from('r2_migration_jobs')
        .update({
          status: 'completed',
          finished_at: new Date().toISOString(),
        })
        .eq('id', this.jobId);

      console.log(`[Migration] Job ${this.jobId} completed: ${this.successCount} success, ${this.failedCount} failed, ${this.skippedCount} skipped`);

      return {
        success: true,
        processed: this.processedCount,
        failed: this.failedCount,
      };
    } catch (error) {
      console.error(`[Migration] Job ${this.jobId} failed:`, error);

      await this.supabase
        .from('r2_migration_jobs')
        .update({
          status: 'failed',
          finished_at: new Date().toISOString(),
          error_summary: {
            message: error instanceof Error ? error.message : 'Unknown error',
            processed: this.processedCount,
            failed: this.failedCount,
          },
        })
        .eq('id', this.jobId);

      return {
        success: false,
        processed: this.processedCount,
        failed: this.failedCount,
      };
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { action, ...params } = await req.json();

    switch (action) {
      case 'start': {
        const { targetTable, batchSize = 100, concurrency = 8, dryRun = false } = params;

        // Create job record
        const { data: job, error: jobError } = await supabase
          .from('r2_migration_jobs')
          .insert({
            job_type: dryRun ? 'dry_run' : 'full',
            target_table: targetTable,
            batch_size: batchSize,
            concurrency,
            status: 'pending',
            config: { dryRun },
          })
          .select()
          .single();

        if (jobError) throw jobError;

        // Get total count
        const { count } = await supabase
          .from(targetTable)
          .select('*', { count: 'exact', head: true });

        await supabase
          .from('r2_migration_jobs')
          .update({ total_items: count || 0 })
          .eq('id', job.id);

        // Start worker (in background via EdgeRuntime.waitUntil if available)
        const worker = new MigrationWorker(
          supabase,
          { targetTable, batchSize, concurrency, maxRetries: 3, dryRun },
          job.id
        );

        // Run in background
        EdgeRuntime.waitUntil(worker.run());

        return new Response(JSON.stringify({
          success: true,
          jobId: job.id,
          message: `Migration job started for ${targetTable}`,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'status': {
        const { jobId } = params;
        
        const { data: job, error } = await supabase
          .from('r2_migration_jobs')
          .select('*')
          .eq('id', jobId)
          .single();

        if (error) throw error;

        return new Response(JSON.stringify({ success: true, job }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'pause': {
        const { jobId } = params;
        
        await supabase
          .from('r2_migration_jobs')
          .update({ status: 'paused', paused_at: new Date().toISOString() })
          .eq('id', jobId);

        return new Response(JSON.stringify({ success: true, message: 'Job paused' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'resume': {
        const { jobId } = params;
        
        const { data: job } = await supabase
          .from('r2_migration_jobs')
          .select('*')
          .eq('id', jobId)
          .single();

        if (job) {
          const worker = new MigrationWorker(
            supabase,
            {
              targetTable: job.target_table as any,
              batchSize: job.batch_size,
              concurrency: job.concurrency,
              maxRetries: 3,
              dryRun: job.config?.dryRun || false,
            },
            job.id
          );

          EdgeRuntime.waitUntil(worker.run());
        }

        return new Response(JSON.stringify({ success: true, message: 'Job resumed' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'cancel': {
        const { jobId } = params;
        
        await supabase
          .from('r2_migration_jobs')
          .update({ status: 'cancelled', finished_at: new Date().toISOString() })
          .eq('id', jobId);

        return new Response(JSON.stringify({ success: true, message: 'Job cancelled' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'stats': {
        const { data: stats, error } = await supabase.rpc('get_r2_migration_stats');
        
        if (error) throw error;

        return new Response(JSON.stringify({ success: true, stats }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'logs': {
        const { jobId, limit = 100, status } = params;
        
        let query = supabase
          .from('r2_migration_logs')
          .select('*')
          .eq('job_id', jobId)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (status) {
          query = query.eq('status', status);
        }

        const { data: logs, error } = await query;
        
        if (error) throw error;

        return new Response(JSON.stringify({ success: true, logs }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'retry_failed': {
        const { jobId } = params;
        
        // Reset failed items for retry
        await supabase
          .from('r2_migration_failed')
          .update({
            retry_count: 0,
            resolved: false,
            next_retry_at: new Date().toISOString(),
          })
          .eq('job_id', jobId)
          .eq('resolved', false);

        return new Response(JSON.stringify({ success: true, message: 'Failed items queued for retry' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'rollback_item': {
        const { table, itemId } = params;
        
        let updateData: Record<string, any> = { is_synced: false };
        
        switch (table) {
          case 'm3u_sync_entries':
            updateData = { is_synced: false, r2_path: null, r2_etag: null };
            break;
          case 'm3u_channels':
            updateData = { is_logo_synced: false, r2_logo_path: null, r2_logo_etag: null };
            break;
          case 'playlist_entries':
            updateData = { is_output_synced: false, r2_output_path: null, r2_output_etag: null };
            break;
        }

        await supabase.from(table).update(updateData).eq('id', itemId);

        return new Response(JSON.stringify({ success: true, message: 'Item rolled back' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error) {
    console.error('[r2-migration-worker] Error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});