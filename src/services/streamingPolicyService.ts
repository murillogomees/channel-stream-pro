/**
 * Streaming Policy Engine Service
 * 
 * Manages routing decisions for hybrid streaming:
 * - VOD → Cloudflare Stream (transcode, CDN, player gerenciado)
 * - Live → Direct origin (low latency)
 * - Agile → Origin with edge cache
 * 
 * Sprint 5: Integração com URLs assinadas do CF Stream
 */

import { supabase } from "@/integrations/supabase/client";
import { getSignedPlaybackUrl } from "@/services/cloudflareStreamService";

export type StreamingStrategy = 'USE_STREAM' | 'USE_ORIGIN' | 'STREAM_ON_DEMAND';
export type ContentType = 'live_linear' | 'vod' | 'agile' | 'unknown';

export interface StreamingPolicy {
  id: string;
  content_type: ContentType;
  strategy: StreamingStrategy;
  priority: number;
  conditions: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChannelRoutingOverride {
  id: string;
  channel_id: string;
  strategy: StreamingStrategy | 'AUTO';
  force_origin: boolean;
  reason: string | null;
  expires_at: string | null;
}

export interface RoutingDecision {
  strategy: StreamingStrategy;
  force_origin: boolean;
  source: 'override' | 'policy' | 'auto_vod' | 'auto_r2' | 'default';
  cf_stream_url: string | null;
  r2_url: string | null;
  origin_url: string;
}

export interface StreamingMetric {
  channel_id: string;
  metric_type: string;
  value: number;
  metadata?: Record<string, unknown>;
}

/**
 * Get routing decision for a channel using database function
 */
export async function getChannelRoutingStrategy(channelId: string): Promise<RoutingDecision | null> {
  try {
    const { data, error } = await supabase.rpc('get_channel_routing_strategy', {
      p_channel_id: channelId
    });

    if (error) throw error;
    
    if (!data || data.length === 0) return null;
    
    const row = data[0];
    return {
      strategy: row.strategy as StreamingStrategy,
      force_origin: row.force_origin,
      source: row.source as RoutingDecision['source'],
      cf_stream_url: row.cf_stream_url,
      r2_url: row.r2_url,
      origin_url: row.origin_url
    };
  } catch (error) {
    console.error('[PolicyEngine] Error getting routing strategy:', error);
    return null;
  }
}

/**
 * Get optimal playback URL based on routing decision
 */
export function getOptimalPlaybackUrl(decision: RoutingDecision): { 
  url: string; 
  source: 'cloudflare_stream' | 'r2' | 'origin';
  useSigned: boolean;
  cfStreamUid?: string;
} {
  if (decision.force_origin) {
    return {
      url: decision.r2_url || decision.origin_url,
      source: decision.r2_url ? 'r2' : 'origin',
      useSigned: false
    };
  }

  switch (decision.strategy) {
    case 'USE_STREAM':
      if (decision.cf_stream_url) {
        // Extract UID from CF Stream URL for signed URL generation
        const uidMatch = decision.cf_stream_url.match(/cloudflarestream\.com\/([a-f0-9]+)\//);
        const cfStreamUid = uidMatch?.[1];
        
        return {
          url: decision.cf_stream_url,
          source: 'cloudflare_stream',
          useSigned: true, // VOD content should use signed URLs
          cfStreamUid
        };
      }
      // Fallback to R2 or origin if stream not available
      return {
        url: decision.r2_url || decision.origin_url,
        source: decision.r2_url ? 'r2' : 'origin',
        useSigned: false
      };
    
    case 'USE_ORIGIN':
      return {
        url: decision.r2_url || decision.origin_url,
        source: decision.r2_url ? 'r2' : 'origin',
        useSigned: false
      };
    
    case 'STREAM_ON_DEMAND':
      // Serve from origin first, transcode on-demand
      return {
        url: decision.r2_url || decision.origin_url,
        source: decision.r2_url ? 'r2' : 'origin',
        useSigned: false
      };
    
    default:
      return {
        url: decision.origin_url,
        source: 'origin',
        useSigned: false
      };
  }
}

/**
 * Get optimal playback URL with signed URL support
 * This is the main function to use when playing content
 */
export async function getSecurePlaybackUrl(
  channelId: string,
  options?: { 
    expiresInSeconds?: number;
    skipSigning?: boolean;
  }
): Promise<{
  url: string;
  source: 'cloudflare_stream' | 'r2' | 'origin';
  isSigned: boolean;
  expiresAt?: number;
}> {
  const { expiresInSeconds = 7200, skipSigning = false } = options || {};
  
  try {
    // Get routing decision
    const decision = await getChannelRoutingStrategy(channelId);
    
    if (!decision) {
      console.warn('[PolicyEngine] No routing decision for channel:', channelId);
      return {
        url: '',
        source: 'origin',
        isSigned: false
      };
    }

    const optimal = getOptimalPlaybackUrl(decision);
    
    // If CF Stream and signing is enabled, get signed URL
    if (optimal.source === 'cloudflare_stream' && optimal.useSigned && optimal.cfStreamUid && !skipSigning) {
      console.log('[PolicyEngine] Getting signed URL for CF Stream:', optimal.cfStreamUid);
      
      const signedResult = await getSignedPlaybackUrl(optimal.cfStreamUid, expiresInSeconds);
      
      if (signedResult) {
        return {
          url: signedResult.url,
          source: 'cloudflare_stream',
          isSigned: signedResult.signed,
          expiresAt: signedResult.expiresAt
        };
      }
      
      // Fallback to unsigned if signing fails
      console.warn('[PolicyEngine] Signed URL failed, using unsigned');
    }

    return {
      url: optimal.url,
      source: optimal.source,
      isSigned: false
    };
  } catch (error) {
    console.error('[PolicyEngine] Error getting secure playback URL:', error);
    return {
      url: '',
      source: 'origin',
      isSigned: false
    };
  }
}

/**
 * Get all streaming policies
 */
export async function getStreamingPolicies(): Promise<StreamingPolicy[]> {
  try {
    const { data, error } = await supabase
      .from('streaming_policies')
      .select('*')
      .order('priority', { ascending: false });

    if (error) throw error;
    return (data as unknown as StreamingPolicy[]) || [];
  } catch (error) {
    console.error('[PolicyEngine] Error fetching policies:', error);
    return [];
  }
}

/**
 * Update a streaming policy
 */
export async function updateStreamingPolicy(
  id: string, 
  updates: { strategy?: string; priority?: number; is_active?: boolean; conditions?: Record<string, unknown> }
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('streaming_policies')
      .update({ 
        ...updates, 
        conditions: updates.conditions as any,
        updated_at: new Date().toISOString() 
      })
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('[PolicyEngine] Error updating policy:', error);
    return false;
  }
}

/**
 * Set channel routing override
 */
export async function setChannelOverride(
  channelId: string,
  strategy: StreamingStrategy | 'AUTO',
  options?: { force_origin?: boolean; reason?: string; expires_at?: Date }
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('channel_routing_overrides')
      .upsert({
        channel_id: channelId,
        strategy,
        force_origin: options?.force_origin || false,
        reason: options?.reason || null,
        expires_at: options?.expires_at?.toISOString() || null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'channel_id'
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('[PolicyEngine] Error setting override:', error);
    return false;
  }
}

/**
 * Remove channel routing override
 */
export async function removeChannelOverride(channelId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('channel_routing_overrides')
      .delete()
      .eq('channel_id', channelId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('[PolicyEngine] Error removing override:', error);
    return false;
  }
}

/**
 * Record streaming metric for analytics and decision making
 */
export async function recordStreamingMetric(metric: StreamingMetric): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('streaming_metrics')
      .insert([{
        channel_id: metric.channel_id,
        metric_type: metric.metric_type,
        value: metric.value,
        metadata: (metric.metadata || {}) as any
      }]);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('[PolicyEngine] Error recording metric:', error);
    return false;
  }
}

/**
 * Get channel overrides for admin management
 */
export async function getChannelOverrides(channelIds?: string[]): Promise<ChannelRoutingOverride[]> {
  try {
    let query = supabase
      .from('channel_routing_overrides')
      .select('*');

    if (channelIds && channelIds.length > 0) {
      query = query.in('channel_id', channelIds);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data as unknown as ChannelRoutingOverride[]) || [];
  } catch (error) {
    console.error('[PolicyEngine] Error fetching overrides:', error);
    return [];
  }
}

/**
 * Batch set routing strategy for multiple channels
 */
export async function batchSetStrategy(
  channelIds: string[],
  strategy: StreamingStrategy | 'AUTO',
  reason?: string
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const channelId of channelIds) {
    const result = await setChannelOverride(channelId, strategy, { reason });
    if (result) {
      success++;
    } else {
      failed++;
    }
  }

  return { success, failed };
}

export default {
  getChannelRoutingStrategy,
  getOptimalPlaybackUrl,
  getSecurePlaybackUrl,
  getStreamingPolicies,
  updateStreamingPolicy,
  setChannelOverride,
  removeChannelOverride,
  recordStreamingMetric,
  getChannelOverrides,
  batchSetStrategy
};
