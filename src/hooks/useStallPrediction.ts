/**
 * useStallPrediction - Stall Prediction System
 * 
 * Prevê stalls antes de acontecerem e aumenta buffer preventivamente
 */

import { useEffect, useRef, useCallback, useState } from 'react';

interface StallPredictionState {
  stallRisk: 'low' | 'medium' | 'high';
  bufferTrend: 'growing' | 'stable' | 'declining';
  predictedStallIn: number | null; // seconds until predicted stall
  preventiveActions: number;
}

interface BufferSample {
  timestamp: number;
  bufferLength: number;
  playbackRate: number;
}

interface UseStallPredictionOptions {
  enabled?: boolean;
  sampleIntervalMs?: number;
  sampleWindowSize?: number;
  onHighRisk?: () => void;
  onPreventiveAction?: () => void;
}

export function useStallPrediction(options: UseStallPredictionOptions = {}) {
  const {
    enabled = true,
    sampleIntervalMs = 500,
    sampleWindowSize = 20,
    onHighRisk,
    onPreventiveAction,
  } = options;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<any>(null);
  const samplesRef = useRef<BufferSample[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const preventiveActionsRef = useRef<number>(0);

  const [state, setState] = useState<StallPredictionState>({
    stallRisk: 'low',
    bufferTrend: 'stable',
    predictedStallIn: null,
    preventiveActions: 0,
  });

  /**
   * Calculate buffer trend from samples
   */
  const calculateTrend = useCallback((samples: BufferSample[]): 'growing' | 'stable' | 'declining' => {
    if (samples.length < 5) return 'stable';

    const recentSamples = samples.slice(-10);
    const firstHalf = recentSamples.slice(0, Math.floor(recentSamples.length / 2));
    const secondHalf = recentSamples.slice(Math.floor(recentSamples.length / 2));

    const avgFirst = firstHalf.reduce((sum, s) => sum + s.bufferLength, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((sum, s) => sum + s.bufferLength, 0) / secondHalf.length;

    const diff = avgSecond - avgFirst;
    
    if (diff > 0.5) return 'growing';
    if (diff < -0.5) return 'declining';
    return 'stable';
  }, []);

  /**
   * Predict time until stall
   */
  const predictStallTime = useCallback((samples: BufferSample[]): number | null => {
    if (samples.length < 5) return null;

    const recentSamples = samples.slice(-10);
    
    // Calculate buffer depletion rate
    const timeDiff = (recentSamples[recentSamples.length - 1].timestamp - recentSamples[0].timestamp) / 1000;
    const bufferDiff = recentSamples[recentSamples.length - 1].bufferLength - recentSamples[0].bufferLength;
    
    if (bufferDiff >= 0) return null; // Buffer growing or stable

    const depletionRate = bufferDiff / timeDiff; // seconds per second
    const currentBuffer = recentSamples[recentSamples.length - 1].bufferLength;

    if (depletionRate >= 0) return null;

    // Time until buffer reaches 0
    const timeToStall = currentBuffer / Math.abs(depletionRate);
    
    return timeToStall > 0 && timeToStall < 60 ? timeToStall : null;
  }, []);

  /**
   * Calculate stall risk level
   */
  const calculateRisk = useCallback((
    currentBuffer: number,
    trend: 'growing' | 'stable' | 'declining',
    predictedStall: number | null
  ): 'low' | 'medium' | 'high' => {
    // High risk: buffer declining and stall predicted in <10s
    if (predictedStall !== null && predictedStall < 10) return 'high';
    
    // High risk: very low buffer
    if (currentBuffer < 3) return 'high';
    
    // Medium risk: declining trend or low buffer
    if (trend === 'declining' && currentBuffer < 10) return 'medium';
    if (currentBuffer < 5) return 'medium';
    if (predictedStall !== null && predictedStall < 20) return 'medium';
    
    return 'low';
  }, []);

  /**
   * Take preventive action
   */
  const takePreventiveAction = useCallback(() => {
    const hls = hlsRef.current;
    if (!hls) return;

    preventiveActionsRef.current++;
    console.log(`[StallPrediction] Taking preventive action #${preventiveActionsRef.current}`);

    try {
      // Action 1: Lower quality temporarily
      if (hls.levels && hls.levels.length > 1 && hls.currentLevel > 0) {
        const lowerLevel = Math.max(0, hls.currentLevel - 1);
        hls.nextLevel = lowerLevel;
        console.log(`[StallPrediction] Dropping quality to level ${lowerLevel}`);
      }

      // Action 2: Increase buffer targets
      if (hls.config) {
        hls.config.maxBufferLength = Math.min(120, hls.config.maxBufferLength + 10);
        hls.config.maxMaxBufferLength = Math.min(180, hls.config.maxMaxBufferLength + 20);
        console.log(`[StallPrediction] Increased buffer targets`);
      }

      onPreventiveAction?.();
    } catch (e) {
      console.warn('[StallPrediction] Preventive action failed:', e);
    }
  }, [onPreventiveAction]);

  /**
   * Sample buffer state
   */
  const sampleBuffer = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.paused) return;

    let bufferLength = 0;
    if (video.buffered.length > 0) {
      const currentTime = video.currentTime;
      for (let i = 0; i < video.buffered.length; i++) {
        if (currentTime >= video.buffered.start(i) && currentTime <= video.buffered.end(i)) {
          bufferLength = video.buffered.end(i) - currentTime;
          break;
        }
      }
    }

    const sample: BufferSample = {
      timestamp: Date.now(),
      bufferLength,
      playbackRate: video.playbackRate,
    };

    samplesRef.current.push(sample);
    
    // Keep window size
    if (samplesRef.current.length > sampleWindowSize) {
      samplesRef.current = samplesRef.current.slice(-sampleWindowSize);
    }

    // Analyze
    const trend = calculateTrend(samplesRef.current);
    const predictedStall = predictStallTime(samplesRef.current);
    const risk = calculateRisk(bufferLength, trend, predictedStall);

    setState({
      stallRisk: risk,
      bufferTrend: trend,
      predictedStallIn: predictedStall,
      preventiveActions: preventiveActionsRef.current,
    });

    // Take action if high risk
    if (risk === 'high') {
      onHighRisk?.();
      
      // Only take preventive action once per prediction cycle
      if (predictedStall && predictedStall < 5) {
        takePreventiveAction();
      }
    }
  }, [sampleWindowSize, calculateTrend, predictStallTime, calculateRisk, onHighRisk, takePreventiveAction]);

  /**
   * Attach video element
   */
  const attachVideo = useCallback((video: HTMLVideoElement) => {
    videoRef.current = video;
    samplesRef.current = [];
    preventiveActionsRef.current = 0;
  }, []);

  /**
   * Attach HLS instance
   */
  const attachHls = useCallback((hls: any) => {
    hlsRef.current = hls;
  }, []);

  /**
   * Reset prediction state
   */
  const reset = useCallback(() => {
    samplesRef.current = [];
    preventiveActionsRef.current = 0;
    setState({
      stallRisk: 'low',
      bufferTrend: 'stable',
      predictedStallIn: null,
      preventiveActions: 0,
    });
  }, []);

  // Start sampling interval
  useEffect(() => {
    if (!enabled) return;

    intervalRef.current = setInterval(sampleBuffer, sampleIntervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, sampleIntervalMs, sampleBuffer]);

  return {
    attachVideo,
    attachHls,
    reset,
    state,
    stallRisk: state.stallRisk,
    bufferTrend: state.bufferTrend,
    predictedStallIn: state.predictedStallIn,
  };
}

export default useStallPrediction;
