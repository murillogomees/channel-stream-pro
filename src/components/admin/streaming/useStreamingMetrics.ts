import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StreamingMetrics {
  totalSessions: number;
  avgStartupTime: number;
  avgBufferEvents: number;
  avgRebufferDuration: number;
  avgBitrate: number;
  totalErrors: number;
  cacheHitRate: number;
  deviceBreakdown: { device: string; count: number }[];
  hourlyData: { hour: string; sessions: number; errors: number; avgStartup: number }[];
  routeTypeBreakdown: { route: string; count: number }[];
  topChannels: { channelId: string; sessions: number; avgStartup: number }[];
}

export function useStreamingMetrics(days: number = 7) {
  return useQuery({
    queryKey: ["streaming-metrics", days],
    queryFn: async (): Promise<StreamingMetrics> => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Fetch all analytics data
      const { data: analytics, error } = await supabase
        .from("stream_analytics")
        .select("*")
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (!analytics || analytics.length === 0) {
        return {
          totalSessions: 0,
          avgStartupTime: 0,
          avgBufferEvents: 0,
          avgRebufferDuration: 0,
          avgBitrate: 0,
          totalErrors: 0,
          cacheHitRate: 0,
          deviceBreakdown: [],
          hourlyData: [],
          routeTypeBreakdown: [],
          topChannels: [],
        };
      }

      // Calculate metrics
      const totalSessions = analytics.length;
      
      const startupTimes = analytics
        .filter((a) => a.startup_time_ms != null)
        .map((a) => a.startup_time_ms!);
      const avgStartupTime = startupTimes.length > 0
        ? Math.round(startupTimes.reduce((a, b) => a + b, 0) / startupTimes.length)
        : 0;

      const bufferEvents = analytics
        .filter((a) => a.buffer_events != null)
        .map((a) => a.buffer_events!);
      const avgBufferEvents = bufferEvents.length > 0
        ? Number((bufferEvents.reduce((a, b) => a + b, 0) / bufferEvents.length).toFixed(2))
        : 0;

      const rebufferDurations = analytics
        .filter((a) => a.rebuffer_duration_ms != null)
        .map((a) => a.rebuffer_duration_ms!);
      const avgRebufferDuration = rebufferDurations.length > 0
        ? Math.round(rebufferDurations.reduce((a, b) => a + b, 0) / rebufferDurations.length)
        : 0;

      const bitrates = analytics
        .filter((a) => a.avg_bitrate_kbps != null && a.avg_bitrate_kbps > 0)
        .map((a) => a.avg_bitrate_kbps!);
      const avgBitrate = bitrates.length > 0
        ? Math.round(bitrates.reduce((a, b) => a + b, 0) / bitrates.length)
        : 0;

      const totalErrors = analytics.filter((a) => a.error_code != null || a.error_message != null).length;

      // Cache hit rate
      const cacheStatuses = analytics.filter((a) => a.cache_status != null);
      const cacheHits = cacheStatuses.filter((a) => 
        a.cache_status === "HIT" || a.cache_status === "hit"
      ).length;
      const cacheHitRate = cacheStatuses.length > 0
        ? Number(((cacheHits / cacheStatuses.length) * 100).toFixed(1))
        : 0;

      // Device breakdown
      const deviceMap = new Map<string, number>();
      analytics.forEach((a) => {
        const device = a.device_type || "unknown";
        deviceMap.set(device, (deviceMap.get(device) || 0) + 1);
      });
      const deviceBreakdown = Array.from(deviceMap.entries())
        .map(([device, count]) => ({ device, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Route type breakdown
      const routeMap = new Map<string, number>();
      analytics.forEach((a) => {
        const route = a.route_type || "direct";
        routeMap.set(route, (routeMap.get(route) || 0) + 1);
      });
      const routeTypeBreakdown = Array.from(routeMap.entries())
        .map(([route, count]) => ({ route, count }))
        .sort((a, b) => b.count - a.count);

      // Hourly data (last 24 hours)
      const last24h = new Date();
      last24h.setHours(last24h.getHours() - 24);
      const recentAnalytics = analytics.filter(
        (a) => new Date(a.created_at!) >= last24h
      );
      
      const hourlyMap = new Map<string, { sessions: number; errors: number; startupSum: number; startupCount: number }>();
      for (let i = 0; i < 24; i++) {
        const hour = String(i).padStart(2, "0") + ":00";
        hourlyMap.set(hour, { sessions: 0, errors: 0, startupSum: 0, startupCount: 0 });
      }
      
      recentAnalytics.forEach((a) => {
        const date = new Date(a.created_at!);
        const hour = String(date.getHours()).padStart(2, "0") + ":00";
        const current = hourlyMap.get(hour) || { sessions: 0, errors: 0, startupSum: 0, startupCount: 0 };
        current.sessions++;
        if (a.error_code || a.error_message) current.errors++;
        if (a.startup_time_ms) {
          current.startupSum += a.startup_time_ms;
          current.startupCount++;
        }
        hourlyMap.set(hour, current);
      });
      
      const hourlyData = Array.from(hourlyMap.entries())
        .map(([hour, data]) => ({
          hour,
          sessions: data.sessions,
          errors: data.errors,
          avgStartup: data.startupCount > 0 ? Math.round(data.startupSum / data.startupCount) : 0,
        }))
        .sort((a, b) => a.hour.localeCompare(b.hour));

      // Top channels
      const channelMap = new Map<string, { sessions: number; startupSum: number; startupCount: number }>();
      analytics.forEach((a) => {
        if (!a.channel_id) return;
        const current = channelMap.get(a.channel_id) || { sessions: 0, startupSum: 0, startupCount: 0 };
        current.sessions++;
        if (a.startup_time_ms) {
          current.startupSum += a.startup_time_ms;
          current.startupCount++;
        }
        channelMap.set(a.channel_id, current);
      });
      const topChannels = Array.from(channelMap.entries())
        .map(([channelId, data]) => ({
          channelId,
          sessions: data.sessions,
          avgStartup: data.startupCount > 0 ? Math.round(data.startupSum / data.startupCount) : 0,
        }))
        .sort((a, b) => b.sessions - a.sessions)
        .slice(0, 10);

      return {
        totalSessions,
        avgStartupTime,
        avgBufferEvents,
        avgRebufferDuration,
        avgBitrate,
        totalErrors,
        cacheHitRate,
        deviceBreakdown,
        hourlyData,
        routeTypeBreakdown,
        topChannels,
      };
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}
