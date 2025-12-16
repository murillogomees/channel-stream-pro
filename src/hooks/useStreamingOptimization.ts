import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { predictivePreloadService, PredictedChannel } from '@/services/predictivePreloadService';
import { smartBufferService, BufferConfig, BufferMetrics } from '@/services/smartBufferService';

interface UseStreamingOptimizationOptions {
  channelId?: number;
  contentType?: 'live' | 'vod' | 'sports';
  enablePredictivePreload?: boolean;
  enableSmartBuffer?: boolean;
}

interface StreamingOptimizationState {
  predictions: PredictedChannel[];
  bufferConfig: BufferConfig;
  bufferMetrics: BufferMetrics | null;
  isPreloading: boolean;
}

export function useStreamingOptimization(options: UseStreamingOptimizationOptions = {}) {
  const { user } = useAuth();
  const {
    channelId,
    contentType = 'live',
    enablePredictivePreload = true,
    enableSmartBuffer = true
  } = options;

  const watchStartRef = useRef<number>(0);
  const bufferEventsRef = useRef<number>(0);

  // Initialize services
  useEffect(() => {
    if (user?.id) {
      predictivePreloadService.setUserId(user.id);
    }
  }, [user?.id]);

  // Set content type for smart buffer
  useEffect(() => {
    if (enableSmartBuffer) {
      smartBufferService.setContentType(contentType);
    }
  }, [contentType, enableSmartBuffer]);

  // Start predictive preloading when channel changes
  useEffect(() => {
    if (enablePredictivePreload && user?.id && channelId) {
      // Delay preloading to prioritize current stream
      const timer = setTimeout(() => {
        predictivePreloadService.startPreloading(channelId);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [channelId, user?.id, enablePredictivePreload]);

  // Track watch start time
  useEffect(() => {
    if (channelId) {
      watchStartRef.current = Date.now();
      bufferEventsRef.current = 0;
    }
  }, [channelId]);

  // Record viewing when unmounting or channel changes
  const recordViewing = useCallback(async () => {
    if (!user?.id || !channelId || watchStartRef.current === 0) return;

    const duration = Math.round((Date.now() - watchStartRef.current) / 1000);
    
    // Only record if watched for at least 10 seconds
    if (duration < 10) return;

    try {
      await supabase.rpc('record_viewing', {
        p_user_id: user.id,
        p_channel_id: channelId,
        p_duration: duration,
        p_device_type: getDeviceType(),
        p_quality: null,
        p_buffer_events: bufferEventsRef.current
      });
      console.log(`[StreamingOptimization] Recorded ${duration}s viewing for channel ${channelId}`);
    } catch (error) {
      console.warn('[StreamingOptimization] Failed to record viewing:', error);
    }
  }, [user?.id, channelId]);

  // Record viewing on unmount
  useEffect(() => {
    return () => {
      recordViewing();
    };
  }, [recordViewing]);

  // Buffer event tracking
  const onBufferEvent = useCallback(() => {
    bufferEventsRef.current++;
  }, []);

  // Update buffer level
  const updateBufferLevel = useCallback((level: number) => {
    if (enableSmartBuffer) {
      smartBufferService.recordBufferLevel(level);
    }
  }, [enableSmartBuffer]);

  // Get buffer metrics
  const getBufferMetrics = useCallback((currentBuffer: number): BufferMetrics => {
    return smartBufferService.getMetrics(currentBuffer);
  }, []);

  // Get Shaka/HLS config
  const getPlayerConfig = useCallback((player: 'shaka' | 'hlsjs') => {
    if (!enableSmartBuffer) return {};
    
    return player === 'shaka' 
      ? smartBufferService.getShakaConfig()
      : smartBufferService.getHlsJsConfig();
  }, [enableSmartBuffer]);

  // Check if channel is preloaded
  const isChannelPreloaded = useCallback((id: number): boolean => {
    return predictivePreloadService.isChannelPreloaded(id);
  }, []);

  // Get preloaded URL
  const getPreloadedUrl = useCallback((id: number): string | null => {
    return predictivePreloadService.getPreloadedUrl(id);
  }, []);

  return {
    // Predictions
    predictions: predictivePreloadService.getPredictions(),
    isChannelPreloaded,
    getPreloadedUrl,
    
    // Buffer
    bufferConfig: smartBufferService.getConfig(),
    networkConditions: smartBufferService.getNetworkConditions(),
    updateBufferLevel,
    getBufferMetrics,
    getPlayerConfig,
    onBufferEvent,
    
    // Actions
    recordViewing,
    refreshPredictions: () => predictivePreloadService.fetchPredictions(channelId)
  };
}

function getDeviceType(): string {
  const ua = navigator.userAgent.toLowerCase();
  
  if (/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
    if (/ipad|tablet/i.test(ua)) return 'tablet';
    return 'mobile';
  }
  
  if (/smart-tv|smarttv|googletv|appletv|hbbtv|pov_tv|netcast/i.test(ua)) {
    return 'tv';
  }
  
  return 'desktop';
}
