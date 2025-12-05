import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Cloudflare pricing constants
const PRICING = {
  R2: {
    STORAGE_PER_GB: 0.015,
    CLASS_B_PER_MILLION: 0.36,
  },
  CF_STREAM: {
    ENCODING_PER_MINUTE: 0.01,
    STORAGE_PER_MINUTE: 0.005,
    DELIVERY_PER_1000_MIN: 1.00,
  }
};

export interface StorageSummary {
  r2_total_bytes: number;
  r2_object_count: number;
  cf_total_bytes: number;
  cf_object_count: number;
  cf_total_minutes: number;
  combined_total_bytes: number;
  combined_object_count: number;
}

export interface StorageCosts {
  r2_storage: number;
  r2_operations: number;
  cf_encoding: number;
  cf_storage: number;
  cf_delivery: number;
  total_monthly: number;
  projected_annual: number;
}

export interface MonthlyEvolution {
  month: string;
  r2_bytes: number;
  r2_count: number;
  cf_bytes: number;
  cf_count: number;
  cost: number;
}

export interface SyncEvent {
  id: string;
  channel_id: string;
  source_type: string;
  target_type: string;
  status: string;
  created_at: string;
  file_size_bytes: number;
}

export interface StorageDistribution {
  by_type: Array<{ type: string; count: number; bytes: number }>;
  by_status: Array<{ status: string; count: number }>;
}

export interface StorageReport {
  summary: StorageSummary;
  costs: StorageCosts;
  monthly_evolution: MonthlyEvolution[];
  recent_syncs: SyncEvent[];
  distribution: StorageDistribution;
}

export interface StorageConfig {
  auto_transcode_enabled: boolean;
  transcode_preset: string;
  monthly_alert_threshold: number;
}

export function useStorageConsolidatedReport() {
  const { toast } = useToast();
  const [report, setReport] = useState<StorageReport | null>(null);
  const [config, setConfig] = useState<StorageConfig>({
    auto_transcode_enabled: true,
    transcode_preset: 'standard',
    monthly_alert_threshold: 100
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Try Edge Function first
      const { data: edgeData, error: edgeError } = await supabase.functions.invoke('get-storage-report');

      if (!edgeError && edgeData) {
        setReport(edgeData);
        return;
      }

      // Fallback to direct queries
      console.log('[Storage Report] Edge function failed, using fallback', edgeError);

      // Get R2 stats
      const { data: r2Data } = await supabase
        .from('r2_storage_objects')
        .select('size_bytes, status, content_type, access_count, bandwidth_bytes')
        .eq('status', 'ready');

      const r2Objects = r2Data || [];
      const r2TotalBytes = r2Objects.reduce((sum, obj) => sum + (obj.size_bytes || 0), 0);
      const r2AccessCount = r2Objects.reduce((sum, obj) => sum + (obj.access_count || 0), 0);

      // Get CF Stream stats
      const { data: cfData } = await supabase
        .from('cf_stream_uploads')
        .select('metadata, status')
        .eq('status', 'ready');

      const cfObjects = cfData || [];
      const cfTotalBytes = cfObjects.reduce((sum, obj: any) => {
        const sizeBytes = obj.metadata?.size_bytes || obj.metadata?.input?.size || 0;
        return sum + sizeBytes;
      }, 0);
      const cfTotalMinutes = cfObjects.reduce((sum, obj: any) => {
        const duration = obj.metadata?.duration_seconds || obj.metadata?.input?.duration || 0;
        return sum + (duration / 60);
      }, 0);

      // Calculate costs
      const r2StorageCost = (r2TotalBytes / 1073741824) * PRICING.R2.STORAGE_PER_GB;
      const r2OperationsCost = (r2AccessCount / 1000000) * PRICING.R2.CLASS_B_PER_MILLION;
      const cfEncodingCost = cfTotalMinutes * PRICING.CF_STREAM.ENCODING_PER_MINUTE;
      const cfStorageCost = cfTotalMinutes * PRICING.CF_STREAM.STORAGE_PER_MINUTE;
      const totalMonthlyCost = r2StorageCost + r2OperationsCost + cfEncodingCost + cfStorageCost;

      // Get monthly evolution
      const { data: monthlyData } = await supabase
        .from('storage_monthly_stats')
        .select('*')
        .order('month', { ascending: false })
        .limit(12);

      // Get recent syncs
      const { data: syncData } = await supabase
        .from('storage_sync_events')
        .select('id, channel_id, source_type, target_type, status, created_at, file_size_bytes')
        .order('created_at', { ascending: false })
        .limit(20);

      const fallbackReport: StorageReport = {
        summary: {
          r2_total_bytes: r2TotalBytes,
          r2_object_count: r2Objects.length,
          cf_total_bytes: cfTotalBytes,
          cf_object_count: cfObjects.length,
          cf_total_minutes: cfTotalMinutes,
          combined_total_bytes: r2TotalBytes + cfTotalBytes,
          combined_object_count: r2Objects.length + cfObjects.length
        },
        costs: {
          r2_storage: Number(r2StorageCost.toFixed(2)),
          r2_operations: Number(r2OperationsCost.toFixed(2)),
          cf_encoding: Number(cfEncodingCost.toFixed(2)),
          cf_storage: Number(cfStorageCost.toFixed(2)),
          cf_delivery: 0,
          total_monthly: Number(totalMonthlyCost.toFixed(2)),
          projected_annual: Number((totalMonthlyCost * 12).toFixed(2))
        },
        monthly_evolution: (monthlyData || []).map((m: any) => ({
          month: m.month,
          r2_bytes: m.r2_total_bytes,
          r2_count: m.r2_objects_count,
          cf_bytes: m.cf_total_bytes,
          cf_count: m.cf_objects_count,
          cost: m.estimated_cost_usd
        })).reverse(),
        recent_syncs: syncData || [],
        distribution: {
          by_type: [],
          by_status: []
        }
      };

      setReport(fallbackReport);

    } catch (err: any) {
      console.error('[Storage Report] Error:', err);
      setError(err.message);
      toast({
        title: 'Erro ao carregar relatório',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const fetchConfig = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('storage_config')
        .select('config_key, config_value');

      if (data) {
        const configMap: Record<string, any> = {};
        data.forEach((item: any) => {
          configMap[item.config_key] = item.config_value;
        });

        setConfig({
          auto_transcode_enabled: configMap.auto_transcode_enabled?.enabled ?? true,
          transcode_preset: configMap.transcode_preset?.preset ?? 'standard',
          monthly_alert_threshold: configMap.cost_thresholds?.monthly_alert ?? 100
        });
      }
    } catch (err) {
      console.error('[Storage Config] Error:', err);
    }
  }, []);

  const updateConfig = useCallback(async (key: string, value: any) => {
    try {
      await supabase
        .from('storage_config')
        .upsert({ 
          config_key: key, 
          config_value: value,
          updated_at: new Date().toISOString()
        }, { onConflict: 'config_key' });

      await fetchConfig();
      toast({ title: 'Configuração atualizada' });
    } catch (err: any) {
      toast({
        title: 'Erro ao atualizar',
        description: err.message,
        variant: 'destructive'
      });
    }
  }, [fetchConfig, toast]);

  const triggerSync = useCallback(async (channelId: string, r2Url: string, r2Key: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('r2-to-cfstream-trigger', {
        body: { channel_id: channelId, r2_url: r2Url, r2_key: r2Key, force: true }
      });

      if (error) throw error;

      toast({ title: 'Sync iniciado', description: `Canal ${channelId} enviado para CF Stream` });
      await fetchReport();
      return data;
    } catch (err: any) {
      toast({
        title: 'Erro ao iniciar sync',
        description: err.message,
        variant: 'destructive'
      });
      throw err;
    }
  }, [fetchReport, toast]);

  useEffect(() => {
    fetchReport();
    fetchConfig();
  }, [fetchReport, fetchConfig]);

  return {
    report,
    config,
    isLoading,
    error,
    refresh: fetchReport,
    updateConfig,
    triggerSync
  };
}
