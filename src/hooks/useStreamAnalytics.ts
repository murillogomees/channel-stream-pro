/**
 * ============================================================================
 * useStreamAnalytics - Hook for tracking streaming performance
 * ============================================================================
 * 
 * Coleta métricas de performance do player para análise:
 * - Tempo de startup
 * - Eventos de buffering
 * - Qualidade do stream
 * - Erros
 */

import { useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface StreamSession {
  sessionId: string;
  channelId?: string;
  startTime: number;
  bufferEvents: number;
  rebufferDurationMs: number;
  qualityChanges: number;
  startupTimeMs?: number;
  deviceType: string;
  lastBitrate?: number;
}

interface AnalyticsEvent {
  type: 'startup' | 'buffer_start' | 'buffer_end' | 'quality_change' | 'error' | 'end';
  timestamp: number;
  data?: Record<string, unknown>;
}

function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function detectDeviceType(): string {
  const ua = navigator.userAgent.toLowerCase();
  
  // Smart TVs
  if (ua.includes('tizen') || ua.includes('webos') || 
      ua.includes('android tv') || ua.includes('smarttv')) {
    return 'tv';
  }
  
  // Mobile
  if (/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
    return 'mobile';
  }
  
  // WebView
  if (ua.includes('wv') || ua.includes('webview')) {
    return 'webview';
  }
  
  return 'desktop';
}

export function useStreamAnalytics(channelId?: string, userId?: string) {
  const sessionRef = useRef<StreamSession | null>(null);
  const bufferStartRef = useRef<number | null>(null);
  const eventsRef = useRef<AnalyticsEvent[]>([]);

  // Initialize session
  const startSession = useCallback(() => {
    sessionRef.current = {
      sessionId: generateSessionId(),
      channelId,
      startTime: Date.now(),
      bufferEvents: 0,
      rebufferDurationMs: 0,
      qualityChanges: 0,
      deviceType: detectDeviceType(),
    };
    eventsRef.current = [];
    
    console.log('[Analytics] Session started:', sessionRef.current.sessionId);
  }, [channelId]);

  // Record startup time (when video starts playing)
  const recordStartup = useCallback((startupMs: number) => {
    if (!sessionRef.current) return;
    
    sessionRef.current.startupTimeMs = startupMs;
    eventsRef.current.push({
      type: 'startup',
      timestamp: Date.now(),
      data: { startupMs },
    });
    
    console.log('[Analytics] Startup recorded:', startupMs, 'ms');
  }, []);

  // Record buffer start
  const recordBufferStart = useCallback(() => {
    if (!sessionRef.current) return;
    
    bufferStartRef.current = Date.now();
    sessionRef.current.bufferEvents++;
    
    eventsRef.current.push({
      type: 'buffer_start',
      timestamp: Date.now(),
    });
  }, []);

  // Record buffer end
  const recordBufferEnd = useCallback(() => {
    if (!sessionRef.current || !bufferStartRef.current) return;
    
    const duration = Date.now() - bufferStartRef.current;
    sessionRef.current.rebufferDurationMs += duration;
    bufferStartRef.current = null;
    
    eventsRef.current.push({
      type: 'buffer_end',
      timestamp: Date.now(),
      data: { durationMs: duration },
    });
    
    console.log('[Analytics] Buffer ended, duration:', duration, 'ms');
  }, []);

  // Record quality change
  const recordQualityChange = useCallback((newBitrate: number) => {
    if (!sessionRef.current) return;
    
    if (sessionRef.current.lastBitrate && 
        sessionRef.current.lastBitrate !== newBitrate) {
      sessionRef.current.qualityChanges++;
    }
    sessionRef.current.lastBitrate = newBitrate;
    
    eventsRef.current.push({
      type: 'quality_change',
      timestamp: Date.now(),
      data: { bitrate: newBitrate },
    });
  }, []);

  // Record error
  const recordError = useCallback((errorCode: string, errorMessage: string) => {
    eventsRef.current.push({
      type: 'error',
      timestamp: Date.now(),
      data: { errorCode, errorMessage },
    });
    
    console.error('[Analytics] Error recorded:', errorCode, errorMessage);
  }, []);

  // End session and send data
  const endSession = useCallback(async () => {
    if (!sessionRef.current) return;
    
    const session = sessionRef.current;
    const endTime = Date.now();
    
    // Find any errors
    const errorEvent = eventsRef.current.find(e => e.type === 'error');
    
    try {
      await supabase.from('stream_analytics').insert({
        user_id: userId || null,
        channel_id: session.channelId || null,
        session_id: session.sessionId,
        device_type: session.deviceType,
        startup_time_ms: session.startupTimeMs || null,
        buffer_events: session.bufferEvents,
        rebuffer_duration_ms: session.rebufferDurationMs,
        quality_changes: session.qualityChanges,
        avg_bitrate_kbps: session.lastBitrate ? Math.round(session.lastBitrate / 1000) : null,
        error_code: errorEvent?.data?.errorCode as string || null,
        error_message: errorEvent?.data?.errorMessage as string || null,
        created_at: new Date(session.startTime).toISOString(),
        ended_at: new Date(endTime).toISOString(),
      });
      
      console.log('[Analytics] Session ended and sent:', session.sessionId);
    } catch (err) {
      console.error('[Analytics] Failed to send session:', err);
    }
    
    sessionRef.current = null;
    eventsRef.current = [];
  }, [userId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sessionRef.current) {
        endSession();
      }
    };
  }, [endSession]);

  return {
    startSession,
    recordStartup,
    recordBufferStart,
    recordBufferEnd,
    recordQualityChange,
    recordError,
    endSession,
    sessionId: sessionRef.current?.sessionId,
  };
}

export default useStreamAnalytics;
