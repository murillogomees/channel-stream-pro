/**
 * R2 CDN Service
 * 
 * Frontend service for managing R2 storage and CDN operations:
 * - Upload content to R2
 * - Generate signed tokens
 * - Manage prewarm jobs
 * - Monitor CDN stats
 */

import { supabase } from "@/integrations/supabase/client";

// ============================================
// TYPES
// ============================================

export interface R2StorageObject {
  id: string;
  r2_key: string;
  r2_bucket: string;
  content_type: string;
  mime_type: string | null;
  size_bytes: number | null;
  checksum_md5: string | null;
  source_channel_id: string | null;
  source_url: string | null;
  cdn_url: string | null;
  cache_control: string;
  status: 'pending' | 'uploading' | 'ready' | 'failed' | 'deleted';
  error_message: string | null;
  access_count: number;
  last_accessed_at: string | null;
  bandwidth_bytes: number;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
}

export interface CdnSignedToken {
  id: string;
  token_hash: string;
  token_type: 'manifest' | 'segment' | 'download';
  r2_key: string;
  channel_id: string | null;
  user_profile_id: string | null;
  ip_restriction: string | null;
  referrer_restriction: string | null;
  max_uses: number;
  current_uses: number;
  issued_at: string;
  expires_at: string;
  revoked_at: string | null;
}

export interface PrewarmJob {
  id: string;
  job_type: 'nightly' | 'on_demand' | 'prediction_based';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  target_r2_keys: string[];
  segments_per_asset: number;
  total_assets: number;
  prewarmed_assets: number;
  failed_assets: number;
  scheduled_at: string;
  started_at: string | null;
  completed_at: string | null;
  total_bytes_prewarmed: number;
  avg_prewarm_time_ms: number | null;
  error_log: string[];
  created_at: string;
}

export interface PrewarmPrediction {
  id: string;
  channel_id: string;
  r2_key: string | null;
  predicted_views: number;
  moving_avg_views: number;
  ml_score: number | null;
  priority_rank: number | null;
  views_7d: number;
  views_30d: number;
  peak_hour: number | null;
  calculated_at: string;
  valid_until: string;
}

export interface CdnStats {
  total_objects: number;
  total_size_gb: number;
  ready_objects: number;
  pending_objects: number;
  total_access_count: number;
  total_bandwidth_gb: number;
  prewarm_jobs_today: number;
  active_tokens: number;
}

export interface GenerateTokenOptions {
  r2_key: string;
  channel_id?: string;
  user_profile_id?: string;
  expires_in_seconds?: number;
  ip_restriction?: string;
  referrer_restriction?: string;
  max_uses?: number;
  token_type?: 'manifest' | 'segment' | 'download';
}

// ============================================
// STORAGE OPERATIONS
// ============================================

/**
 * Upload content to R2
 */
export async function uploadToR2(options: {
  file?: File;
  source_url?: string;
  content_type: string;
  channel_id?: string;
  id?: string;
  extension?: string;
}): Promise<{ success: boolean; r2_key?: string; cdn_url?: string; error?: string }> {
  try {
    const formData = new FormData();
    
    if (options.file) {
      formData.append('file', options.file);
    }
    if (options.source_url) {
      formData.append('source_url', options.source_url);
    }
    formData.append('content_type', options.content_type);
    if (options.channel_id) {
      formData.append('channel_id', options.channel_id);
    }
    if (options.id) {
      formData.append('id', options.id);
    }
    if (options.extension) {
      formData.append('extension', options.extension);
    }

    const { data, error } = await supabase.functions.invoke('r2-upload', {
      body: formData,
      headers: {
        // Let browser set content-type with boundary for FormData
      }
    });

    if (error) throw error;

    return {
      success: true,
      r2_key: data.r2_key,
      cdn_url: data.cdn_url
    };
  } catch (error) {
    console.error('[R2CDN] Upload error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Delete object from R2
 */
export async function deleteFromR2(r2_key: string): Promise<boolean> {
  try {
    const { error } = await supabase.functions.invoke('r2-upload', {
      body: { r2_key },
      headers: { 'Content-Type': 'application/json' }
    });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('[R2CDN] Delete error:', error);
    return false;
  }
}

/**
 * List R2 storage objects
 */
export async function listR2Objects(options?: {
  status?: string;
  content_type?: string;
  channel_id?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: R2StorageObject[]; count: number }> {
  let query = supabase
    .from('r2_storage_objects')
    .select('*', { count: 'exact' });

  if (options?.status) {
    query = query.eq('status', options.status);
  }
  if (options?.content_type) {
    query = query.eq('content_type', options.content_type);
  }
  if (options?.channel_id) {
    query = query.eq('source_channel_id', options.channel_id);
  }
  
  query = query
    .order('created_at', { ascending: false })
    .range(options?.offset || 0, (options?.offset || 0) + (options?.limit || 50) - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('[R2CDN] List error:', error);
    return { data: [], count: 0 };
  }

  return { 
    data: (data as unknown as R2StorageObject[]) || [], 
    count: count || 0 
  };
}

// ============================================
// TOKEN OPERATIONS
// ============================================

/**
 * Generate signed CDN token
 */
export async function generateCdnToken(options: GenerateTokenOptions): Promise<{
  success: boolean;
  token?: string;
  cdn_url?: string;
  expires_at?: number;
  error?: string;
}> {
  try {
    console.log('[R2CDN] Generating token with options:', options);
    
    const { data, error } = await supabase.functions.invoke('cdn-token', {
      body: JSON.stringify(options),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (error) {
      console.error('[R2CDN] Edge function error:', error);
      throw error;
    }

    console.log('[R2CDN] Token generated successfully:', data);

    return {
      success: true,
      token: data.token,
      cdn_url: data.cdn_url,
      expires_at: data.expires_at
    };
  } catch (error) {
    console.error('[R2CDN] Token generation error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Revoke CDN token
 */
export async function revokeCdnToken(options: { token?: string; channel_id?: string }): Promise<boolean> {
  try {
    console.log('[R2CDN] Revoking token with options:', options);
    
    const { error } = await supabase.functions.invoke('cdn-token?action=revoke', {
      body: JSON.stringify(options),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (error) {
      console.error('[R2CDN] Edge function error:', error);
      throw error;
    }
    
    console.log('[R2CDN] Token revoked successfully');
    return true;
  } catch (error) {
    console.error('[R2CDN] Token revoke error:', error);
    return false;
  }
}

/**
 * List active tokens
 */
export async function listActiveTokens(options?: {
  channel_id?: string;
  limit?: number;
}): Promise<CdnSignedToken[]> {
  try {
    let query = supabase
      .from('cdn_signed_tokens')
      .select('*')
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString());

    if (options?.channel_id) {
      query = query.eq('channel_id', options.channel_id);
    }

    query = query
      .order('issued_at', { ascending: false })
      .limit(options?.limit || 100);

    const { data, error } = await query;

    if (error) {
      console.error('[R2CDN] List tokens error:', error);
      return [];
    }

    console.log('[R2CDN] Active tokens:', data?.length || 0);
    return (data as unknown as CdnSignedToken[]) || [];
  } catch (error) {
    console.error('[R2CDN] List active tokens exception:', error);
    return [];
  }
}

// ============================================
// PREWARM OPERATIONS
// ============================================

/**
 * Trigger prewarm job
 */
export async function triggerPrewarm(options?: {
  type?: 'nightly' | 'on_demand' | 'prediction_based';
  max_assets?: number;
  segments_per_asset?: number;
}): Promise<{ success: boolean; job_id?: string; error?: string }> {
  try {
    const params = new URLSearchParams();
    if (options?.type) params.set('type', options.type);
    if (options?.max_assets) params.set('max', String(options.max_assets));
    if (options?.segments_per_asset) params.set('segments', String(options.segments_per_asset));

    const { data, error } = await supabase.functions.invoke(`cdn-prewarm?${params.toString()}`);

    if (error) throw error;

    return {
      success: true,
      job_id: data.job_id
    };
  } catch (error) {
    console.error('[R2CDN] Prewarm trigger error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * List prewarm jobs
 */
export async function listPrewarmJobs(options?: {
  status?: string;
  limit?: number;
}): Promise<PrewarmJob[]> {
  let query = supabase
    .from('cdn_prewarm_jobs')
    .select('*');

  if (options?.status) {
    query = query.eq('status', options.status);
  }

  query = query
    .order('created_at', { ascending: false })
    .limit(options?.limit || 50);

  const { data, error } = await query;

  if (error) {
    console.error('[R2CDN] List prewarm jobs error:', error);
    return [];
  }

  return (data as unknown as PrewarmJob[]) || [];
}

/**
 * Get prewarm predictions
 */
export async function getPrewarmPredictions(limit: number = 50): Promise<PrewarmPrediction[]> {
  const { data, error } = await supabase
    .from('cdn_prewarm_predictions')
    .select('*')
    .gt('valid_until', new Date().toISOString())
    .order('priority_rank', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('[R2CDN] Get predictions error:', error);
    return [];
  }

  return (data as unknown as PrewarmPrediction[]) || [];
}

// ============================================
// STATS & ANALYTICS
// ============================================

/**
 * Get CDN statistics
 */
export async function getCdnStats(): Promise<CdnStats | null> {
  try {
    const { data, error } = await supabase.rpc('get_cdn_stats');

    if (error) {
      console.error('[R2CDN] Get stats RPC error:', error);
      throw error;
    }

    console.log('[R2CDN] Stats retrieved:', data?.[0]);
    return data?.[0] as CdnStats || null;
  } catch (error) {
    console.error('[R2CDN] Get stats exception:', error);
    return null;
  }
}

/**
 * Track content access - increments access count and bandwidth
 */
export async function trackAccess(r2_key: string, bytes: number = 0): Promise<void> {
  try {
    console.log('[R2CDN] Tracking access:', { r2_key, bytes });
    
    // Get current values and update atomically
    const { data, error: selectError } = await supabase
      .from('r2_storage_objects')
      .select('access_count, bandwidth_bytes')
      .eq('r2_key', r2_key)
      .single();

    if (selectError) {
      console.error('[R2CDN] Track access select error:', selectError);
      return;
    }

    if (data) {
      const { error: updateError } = await supabase
        .from('r2_storage_objects')
        .update({
          access_count: (data.access_count || 0) + 1,
          bandwidth_bytes: (data.bandwidth_bytes || 0) + bytes,
          last_accessed_at: new Date().toISOString()
        })
        .eq('r2_key', r2_key);
      
      if (updateError) {
        console.error('[R2CDN] Track access update error:', updateError);
      } else {
        console.log('[R2CDN] Access tracked successfully:', {
          r2_key,
          new_access_count: (data.access_count || 0) + 1,
          new_bandwidth: (data.bandwidth_bytes || 0) + bytes
        });
      }
    }
  } catch (error) {
    console.error('[R2CDN] Track access exception:', error);
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Generate R2 key following naming convention
 */
export function generateR2Key(
  env: 'prod' | 'staging' | 'dev',
  contentType: 'vod' | 'live' | 'manifest' | 'segment' | 'thumbnail',
  id: string,
  extension?: string
): string {
  const key = `iptvlink/${env}/${contentType}/${id}`;
  return extension ? `${key}.${extension}` : key;
}

/**
 * Parse R2 key to extract components
 */
export function parseR2Key(r2_key: string): {
  env?: string;
  contentType?: string;
  id?: string;
  extension?: string;
} {
  const match = r2_key.match(/^iptvlink\/([^/]+)\/([^/]+)\/(.+)$/);
  if (!match) return {};

  const [, env, contentType, filename] = match;
  const lastDot = filename.lastIndexOf('.');
  
  return {
    env,
    contentType,
    id: lastDot > 0 ? filename.substring(0, lastDot) : filename,
    extension: lastDot > 0 ? filename.substring(lastDot + 1) : undefined
  };
}

/**
 * Get CDN Worker URL for an R2 key
 */
export async function getCdnWorkerUrl(r2_key: string, options?: {
  channel_id?: string;
  expires_in_seconds?: number;
}): Promise<string | null> {
  try {
    // Try to get CDN_WORKER_URL from edge function or env
    const { data: config } = await supabase.functions.invoke('cdn-config');
    const cdnWorkerUrl = config?.cdn_worker_url || import.meta.env.VITE_CDN_WORKER_URL;

    if (!cdnWorkerUrl) {
      console.warn('[R2CDN] CDN Worker URL not configured');
      return null;
    }

    // Generate JWT token
    const tokenResult = await generateCdnToken({
      r2_key,
      channel_id: options?.channel_id,
      expires_in_seconds: options?.expires_in_seconds || 7200,
      token_type: 'manifest',
    });

    if (!tokenResult.success || !tokenResult.token) {
      console.error('[R2CDN] Failed to generate CDN token');
      return null;
    }

    // Construct CDN Worker URL with JWT
    return `${cdnWorkerUrl}/${r2_key}?jwt=${tokenResult.token}`;
  } catch (error) {
    console.error('[R2CDN] Get CDN Worker URL error:', error);
    return null;
  }
}

/**
 * Health check CDN Worker
 */
export async function checkCdnWorkerHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'down';
  responseTime?: number;
  error?: string;
}> {
  try {
    const { data: config } = await supabase.functions.invoke('cdn-config');
    const cdnWorkerUrl = config?.cdn_worker_url || import.meta.env.VITE_CDN_WORKER_URL;

    if (!cdnWorkerUrl) {
      return {
        status: 'down',
        error: 'CDN Worker URL not configured',
      };
    }

    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${cdnWorkerUrl}/health`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - start;

    if (response.ok) {
      return {
        status: responseTime > 2000 ? 'degraded' : 'healthy',
        responseTime,
      };
    }

    return {
      status: 'degraded',
      responseTime,
      error: `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get cache control header for content type
 */
export function getCacheControlHeader(contentType: string): string {
  switch (contentType) {
    case 'manifest':
      return 'public, max-age=30, stale-while-revalidate=60';
    case 'segment':
      return 'public, max-age=86400';
    case 'thumbnail':
      return 'public, max-age=604800';
    case 'vod':
      return 'public, max-age=86400';
    default:
      return 'public, max-age=3600';
  }
}

export default {
  uploadToR2,
  deleteFromR2,
  listR2Objects,
  generateCdnToken,
  revokeCdnToken,
  listActiveTokens,
  triggerPrewarm,
  listPrewarmJobs,
  getPrewarmPredictions,
  getCdnStats,
  trackAccess,
  generateR2Key,
  parseR2Key,
  getCacheControlHeader
};
