/**
 * useCFStreamAnalytics - Hook para métricas de playback do Cloudflare Stream
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ChannelMetrics {
  channel_id: string;
  channel_name: string;
  cf_stream_uid: string;
  views: number;
  bandwidth_gb: number;
  errors: number;
  avg_watch_time_seconds: number;
  unique_viewers: number;
  status: string;
  duration_seconds: number | null;
}

export interface AggregatedMetrics {
  total_views: number;
  total_bandwidth_gb: number;
  total_errors: number;
  total_vods_ready: number;
  total_vods_processing: number;
  total_vods_failed: number;
  avg_processing_time_minutes: number;
  success_rate: number;
  retry_rate: number;
}

export interface MetricsTimeRange {
  label: string;
  value: string;
  days: number;
}

export const TIME_RANGES: MetricsTimeRange[] = [
  { label: "Últimas 24h", value: "24h", days: 1 },
  { label: "Últimos 7 dias", value: "7d", days: 7 },
  { label: "Últimos 30 dias", value: "30d", days: 30 },
  { label: "Últimos 90 dias", value: "90d", days: 90 },
];

export function useCFStreamAnalytics(timeRangeDays: number = 7) {
  const [channelMetrics, setChannelMetrics] = useState<ChannelMetrics[]>([]);
  const [aggregated, setAggregated] = useState<AggregatedMetrics>({
    total_views: 0,
    total_bandwidth_gb: 0,
    total_errors: 0,
    total_vods_ready: 0,
    total_vods_processing: 0,
    total_vods_failed: 0,
    avg_processing_time_minutes: 0,
    success_rate: 0,
    retry_rate: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - timeRangeDays);

      // Fetch upload data with channel info
      const { data: uploads, error: uploadsError } = await supabase
        .from("cf_stream_uploads")
        .select(`
          id,
          channel_id,
          cf_stream_uid,
          status,
          progress_percent,
          retry_count,
          created_at,
          started_at,
          completed_at,
          error_message,
          metadata
        `)
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: false });

      if (uploadsError) throw uploadsError;

      // Fetch channel names
      const channelIds = [...new Set((uploads || []).map(u => u.channel_id).filter(Boolean))];
      let channelMap: Record<string, { name: string; duration: number | null }> = {};

      if (channelIds.length > 0) {
        const { data: channels } = await supabase
          .from("m3u_channels")
          .select("id, name, cf_stream_duration_seconds")
          .in("id", channelIds);

        if (channels) {
          channelMap = channels.reduce((acc, ch) => {
            acc[ch.id] = { 
              name: ch.name, 
              duration: ch.cf_stream_duration_seconds 
            };
            return acc;
          }, {} as Record<string, { name: string; duration: number | null }>);
        }
      }

      // Calculate per-channel metrics
      const channelStats: Record<string, ChannelMetrics> = {};

      for (const upload of uploads || []) {
        const channelInfo = channelMap[upload.channel_id] || { name: upload.channel_id, duration: null };
        
        if (!channelStats[upload.channel_id]) {
          channelStats[upload.channel_id] = {
            channel_id: upload.channel_id,
            channel_name: channelInfo.name,
            cf_stream_uid: upload.cf_stream_uid || "",
            views: 0,
            bandwidth_gb: 0,
            errors: 0,
            avg_watch_time_seconds: 0,
            unique_viewers: 0,
            status: upload.status,
            duration_seconds: channelInfo.duration,
          };
        }

        const stat = channelStats[upload.channel_id];

        // Update status to most recent
        stat.status = upload.status;
        stat.cf_stream_uid = upload.cf_stream_uid || stat.cf_stream_uid;
        stat.duration_seconds = channelInfo.duration;

        // Extract metrics from metadata if available
        if (upload.metadata && typeof upload.metadata === 'object') {
          const meta = upload.metadata as Record<string, any>;
          // CF Stream doesn't provide views in copy API, but we can estimate based on duration
          if (meta.duration) {
            stat.bandwidth_gb += (meta.size || 0) / (1024 * 1024 * 1024);
          }
        }

        // Count errors
        if (upload.status === 'error' || upload.error_message) {
          stat.errors++;
        }
      }

      const metricsArray = Object.values(channelStats);
      setChannelMetrics(metricsArray);

      // Calculate aggregated metrics
      const statusCounts = {
        ready: 0,
        processing: 0,
        failed: 0,
        total_retries: 0,
        total_uploads: uploads?.length || 0,
      };

      let totalProcessingTime = 0;
      let processedCount = 0;

      for (const upload of uploads || []) {
        if (upload.status === 'ready') statusCounts.ready++;
        else if (upload.status === 'processing' || upload.status === 'uploading' || upload.status === 'downloading') statusCounts.processing++;
        else if (upload.status === 'error' || upload.status === 'failed' || upload.status === 'needs_r2_fallback') statusCounts.failed++;

        if (upload.retry_count && upload.retry_count > 0) {
          statusCounts.total_retries++;
        }

        // Calculate processing time for completed uploads
        if (upload.completed_at && upload.started_at) {
          const start = new Date(upload.started_at).getTime();
          const end = new Date(upload.completed_at).getTime();
          totalProcessingTime += (end - start) / 60000; // minutes
          processedCount++;
        }
      }

      const totalBandwidth = metricsArray.reduce((sum, m) => sum + m.bandwidth_gb, 0);
      const totalErrors = metricsArray.reduce((sum, m) => sum + m.errors, 0);

      setAggregated({
        total_views: 0, // Would need CF analytics API
        total_bandwidth_gb: totalBandwidth,
        total_errors: totalErrors,
        total_vods_ready: statusCounts.ready,
        total_vods_processing: statusCounts.processing,
        total_vods_failed: statusCounts.failed,
        avg_processing_time_minutes: processedCount > 0 ? totalProcessingTime / processedCount : 0,
        success_rate: statusCounts.total_uploads > 0 
          ? (statusCounts.ready / statusCounts.total_uploads) * 100 
          : 0,
        retry_rate: statusCounts.total_uploads > 0 
          ? (statusCounts.total_retries / statusCounts.total_uploads) * 100 
          : 0,
      });

    } catch (err: any) {
      console.error("Error fetching CF Stream analytics:", err);
      setError(err.message);
      toast.error("Erro ao carregar métricas", { description: err.message });
    } finally {
      setIsLoading(false);
    }
  }, [timeRangeDays]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return {
    channelMetrics,
    aggregated,
    isLoading,
    error,
    refresh: fetchMetrics,
  };
}
