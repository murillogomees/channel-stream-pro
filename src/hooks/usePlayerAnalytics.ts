/**
 * usePlayerAnalytics - Hook for player event tracking
 * 
 * Integrates with playerEventsService for comprehensive analytics
 */

import { useCallback, useRef, useEffect } from 'react';
import { playerEventsService, PlayerEventType } from '@/services/playerEventsService';
import { enhancedABRService } from '@/services/enhancedABRService';
import Hls from 'hls.js';

interface UsePlayerAnalyticsOptions {
  contentId: string;
  contentType: 'live' | 'movie' | 'series' | 'episode';
  autoStart?: boolean;
}

export function usePlayerAnalytics({
  contentId,
  contentType,
  autoStart = true,
}: UsePlayerAnalyticsOptions) {
  const sessionStarted = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  /**
   * Start tracking session
   */
  const startSession = useCallback(() => {
    if (sessionStarted.current) return;
    sessionStarted.current = true;
    playerEventsService.startSession(contentId, contentType);
  }, [contentId, contentType]);

  /**
   * End tracking session
   */
  const endSession = useCallback(() => {
    if (!sessionStarted.current) return;
    
    const video = videoRef.current;
    playerEventsService.trackStop({
      position: video?.currentTime,
      duration: video?.duration,
      reason: 'session_end',
    });
    playerEventsService.endSession();
    sessionStarted.current = false;
  }, []);

  /**
   * Attach to video element
   */
  const attachVideo = useCallback((video: HTMLVideoElement) => {
    videoRef.current = video;

    // Track play
    const handlePlay = () => {
      playerEventsService.trackPlay({
        position: video.currentTime,
      });
    };

    // Track pause
    const handlePause = () => {
      playerEventsService.trackPause(video.currentTime);
    };

    // Track first frame (using loadeddata + playing)
    const handlePlaying = () => {
      if (!playerEventsService.hasTrackedFirstFrame()) {
        playerEventsService.trackFirstFrame();
      }
    };

    // Track buffering
    const handleWaiting = () => {
      playerEventsService.trackBufferingStart();
    };

    const handleCanPlay = () => {
      playerEventsService.trackBufferingEnd();
    };

    // Track seeking
    let seekStart = 0;
    const handleSeeking = () => {
      seekStart = video.currentTime;
    };

    const handleSeeked = () => {
      playerEventsService.trackSeek(seekStart, video.currentTime);
    };

    // Track errors
    const handleError = () => {
      const error = video.error;
      playerEventsService.trackError(
        String(error?.code || 'UNKNOWN'),
        error?.message || 'Unknown error'
      );
    };

    // Track ended
    const handleEnded = () => {
      playerEventsService.trackStop({
        position: video.duration,
        duration: video.duration,
        reason: 'ended',
      });
    };

    // Add listeners
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('seeking', handleSeeking);
    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('error', handleError);
    video.addEventListener('ended', handleEnded);

    // Return cleanup
    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('seeking', handleSeeking);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('error', handleError);
      video.removeEventListener('ended', handleEnded);
    };
  }, []);

  /**
   * Attach to HLS instance for quality tracking
   */
  const attachHls = useCallback((hls: Hls) => {
    hlsRef.current = hls;

    // Attach enhanced ABR with analytics callback
    enhancedABRService.attach(hls, (level, label, direction) => {
      const metrics = enhancedABRService.getMetrics();
      playerEventsService.trackBitrateChange(
        metrics.currentBitrate,
        label,
        direction
      );
    });

    // Track HLS errors
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) {
        playerEventsService.trackError(
          data.type,
          data.details || 'HLS error'
        );
      }
    });

    return () => {
      enhancedABRService.detach();
    };
  }, []);

  /**
   * Manual event tracking
   */
  const trackEvent = useCallback((
    event: PlayerEventType,
    data?: Record<string, any>
  ) => {
    switch (event) {
      case 'play':
        playerEventsService.trackPlay(data);
        break;
      case 'firstFrame':
        playerEventsService.trackFirstFrame();
        break;
      case 'buffering':
        if (data?.state === 'start') {
          playerEventsService.trackBufferingStart();
        } else {
          playerEventsService.trackBufferingEnd();
        }
        break;
      case 'bitrateChange':
        playerEventsService.trackBitrateChange(
          data?.bitrate || 0,
          data?.qualityLabel || '',
          data?.direction || 'initial'
        );
        break;
      case 'stop':
        playerEventsService.trackStop(data);
        break;
      case 'error':
        playerEventsService.trackError(
          data?.errorCode || 'UNKNOWN',
          data?.errorMessage || 'Unknown error'
        );
        break;
      case 'seek':
        playerEventsService.trackSeek(data?.from || 0, data?.to || 0);
        break;
      case 'pause':
        playerEventsService.trackPause(data?.position || 0);
        break;
      case 'resume':
        playerEventsService.trackResume(data?.position || 0);
        break;
    }
  }, []);

  // Auto-start session if enabled
  useEffect(() => {
    if (autoStart) {
      startSession();
    }
    
    return () => {
      endSession();
    };
  }, [autoStart, startSession, endSession]);

  return {
    startSession,
    endSession,
    attachVideo,
    attachHls,
    trackEvent,
    sessionId: playerEventsService.getSessionId(),
    deviceType: playerEventsService.getDeviceType(),
  };
}

export default usePlayerAnalytics;
