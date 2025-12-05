/**
 * QoS (Quality of Service) Monitoring Service
 */

import { supabase } from '@/integrations/supabase/client';
import type { QoSMetrics, HealthStatus, StreamHealth } from '../types';

export interface QoSSnapshot {
  timestamp: Date;
  metrics: QoSMetrics;
  activeStreams: number;
  totalBandwidth: number;
}

export interface SystemHealthSnapshot {
  id: string;
  timestamp: string;
  overall_status: string;
  supabase_status: string;
  supabase_latency: number;
  websocket_status: string;
  websocket_latency: number;
  whatsapp_status: string;
  whatsapp_latency: number;
}

class QoSService {
  private metricsBuffer: QoSMetrics[] = [];
  private readonly BUFFER_SIZE = 100;

  /**
   * Record QoS metrics for current session
   */
  recordMetrics(metrics: Partial<QoSMetrics>): void {
    const fullMetrics: QoSMetrics = {
      buffering_ratio: metrics.buffering_ratio ?? 0,
      startup_time_ms: metrics.startup_time_ms ?? 0,
      bitrate_kbps: metrics.bitrate_kbps ?? 0,
      dropped_frames: metrics.dropped_frames ?? 0,
      errors_count: metrics.errors_count ?? 0,
      latency_ms: metrics.latency_ms ?? 0,
    };

    this.metricsBuffer.push(fullMetrics);
    if (this.metricsBuffer.length > this.BUFFER_SIZE) {
      this.metricsBuffer.shift();
    }
  }

  /**
   * Get aggregated metrics from buffer
   */
  getAggregatedMetrics(): QoSMetrics {
    if (this.metricsBuffer.length === 0) {
      return {
        buffering_ratio: 0,
        startup_time_ms: 0,
        bitrate_kbps: 0,
        dropped_frames: 0,
        errors_count: 0,
        latency_ms: 0,
      };
    }

    const sum = this.metricsBuffer.reduce(
      (acc, m) => ({
        buffering_ratio: acc.buffering_ratio + m.buffering_ratio,
        startup_time_ms: acc.startup_time_ms + m.startup_time_ms,
        bitrate_kbps: acc.bitrate_kbps + m.bitrate_kbps,
        dropped_frames: acc.dropped_frames + m.dropped_frames,
        errors_count: acc.errors_count + m.errors_count,
        latency_ms: acc.latency_ms + m.latency_ms,
      }),
      { buffering_ratio: 0, startup_time_ms: 0, bitrate_kbps: 0, dropped_frames: 0, errors_count: 0, latency_ms: 0 }
    );

    const count = this.metricsBuffer.length;
    return {
      buffering_ratio: sum.buffering_ratio / count,
      startup_time_ms: sum.startup_time_ms / count,
      bitrate_kbps: sum.bitrate_kbps / count,
      dropped_frames: sum.dropped_frames,
      errors_count: sum.errors_count,
      latency_ms: sum.latency_ms / count,
    };
  }

  /**
   * Get current system health status
   */
  async getSystemHealth(): Promise<HealthStatus> {
    try {
      const { data: snapshot } = await supabase
        .from('health_snapshots')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      if (!snapshot) {
        return this.getDefaultHealth();
      }

      return {
        overall: this.mapHealthStatus(snapshot.overall_status),
        cdn: this.mapComponentStatus(snapshot.websocket_status), // Using websocket as CDN proxy
        streaming: this.mapComponentStatus(snapshot.supabase_status),
        database: this.mapComponentStatus(snapshot.supabase_status),
      };
    } catch (error) {
      console.error('[QoSService] Health check error:', error);
      return this.getDefaultHealth();
    }
  }

  /**
   * Get health history for charts
   */
  async getHealthHistory(hours = 24): Promise<SystemHealthSnapshot[]> {
    try {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

      const { data } = await supabase
        .from('health_snapshots')
        .select('*')
        .gte('timestamp', since)
        .order('timestamp', { ascending: true });

      return (data || []) as SystemHealthSnapshot[];
    } catch (error) {
      console.error('[QoSService] Health history error:', error);
      return [];
    }
  }

  /**
   * Get channel-specific health data
   */
  async getChannelHealth(channelId?: string): Promise<StreamHealth[]> {
    try {
      let query = supabase
        .from('channel_health')
        .select('*')
        .order('last_check_at', { ascending: false });

      if (channelId) {
        query = query.eq('channel_id', channelId);
      } else {
        query = query.limit(50);
      }

      const { data } = await query;

      return (data || []).map(ch => ({
        channel_id: ch.channel_id,
        status: ch.status === 'online' ? 'online' : ch.status === 'offline' ? 'offline' : 'unknown',
        uptime_percentage: ch.uptime_percentage || 100,
        last_check_at: ch.last_check_at || new Date().toISOString(),
        error_message: ch.error_message || undefined,
      }));
    } catch (error) {
      console.error('[QoSService] Channel health error:', error);
      return [];
    }
  }

  /**
   * Get CDN performance stats
   */
  async getCDNStats(): Promise<{
    hitRate: number;
    bandwidth: number;
    latency: number;
    errors: number;
  }> {
    try {
      const { data } = await supabase
        .from('cache_stats')
        .select('hits, misses, bandwidth_saved_bytes, avg_response_time_ms, errors')
        .order('collected_at', { ascending: false })
        .limit(100);

      if (!data?.length) {
        return { hitRate: 0, bandwidth: 0, latency: 0, errors: 0 };
      }

      const totals = data.reduce(
        (acc, s) => ({
          hits: acc.hits + (s.hits || 0),
          misses: acc.misses + (s.misses || 0),
          bandwidth: acc.bandwidth + (s.bandwidth_saved_bytes || 0),
          latency: acc.latency + (s.avg_response_time_ms || 0),
          errors: acc.errors + (s.errors || 0),
        }),
        { hits: 0, misses: 0, bandwidth: 0, latency: 0, errors: 0 }
      );

      const total = totals.hits + totals.misses;
      return {
        hitRate: total > 0 ? (totals.hits / total) * 100 : 0,
        bandwidth: totals.bandwidth,
        latency: data.length > 0 ? totals.latency / data.length : 0,
        errors: totals.errors,
      };
    } catch (error) {
      console.error('[QoSService] CDN stats error:', error);
      return { hitRate: 0, bandwidth: 0, latency: 0, errors: 0 };
    }
  }

  /**
   * Get active streams count and bandwidth
   */
  async getActiveStreamsStats(): Promise<{ count: number; bandwidth: number }> {
    try {
      const { data } = await supabase
        .from('channel_demand_stats')
        .select('concurrent_viewers_current')
        .not('concurrent_viewers_current', 'is', null);

      const totalViewers = data?.reduce((sum, ch) => sum + (ch.concurrent_viewers_current || 0), 0) || 0;
      
      // Estimate bandwidth (assuming avg 5 Mbps per stream)
      const estimatedBandwidth = totalViewers * 5 * 1024 * 1024; // bytes/s

      return {
        count: totalViewers,
        bandwidth: estimatedBandwidth,
      };
    } catch (error) {
      console.error('[QoSService] Active streams error:', error);
      return { count: 0, bandwidth: 0 };
    }
  }

  private mapHealthStatus(status: string | null): 'healthy' | 'degraded' | 'critical' {
    if (!status) return 'critical';
    const s = status.toLowerCase();
    if (s === 'healthy' || s === 'online' || s === 'ok') return 'healthy';
    if (s === 'degraded' || s === 'warning') return 'degraded';
    return 'critical';
  }

  private mapComponentStatus(status: string | null): 'online' | 'degraded' | 'offline' {
    if (!status) return 'offline';
    const s = status.toLowerCase();
    if (s === 'healthy' || s === 'online' || s === 'ok') return 'online';
    if (s === 'degraded' || s === 'warning') return 'degraded';
    return 'offline';
  }

  private getDefaultHealth(): HealthStatus {
    return {
      overall: 'healthy',
      cdn: 'online',
      streaming: 'online',
      database: 'online',
    };
  }
}

export const qosService = new QoSService();
