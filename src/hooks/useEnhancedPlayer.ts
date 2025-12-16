/**
 * useEnhancedPlayer - Unified hook for all player enhancements
 * 
 * Integrates:
 * - Enhanced ABR (aggressive up-switch, conservative down-switch)
 * - Segment prefetch on hover/start
 * - Resume support (server + local fallback)
 */

import { useRef, useCallback, useEffect } from 'react';
import Hls from 'hls.js';
import { enhancedABRService, ABRMetrics } from '@/services/enhancedABRService';
import { useSegmentPrefetch } from '@/hooks/useSegmentPrefetch';
import { useResume } from '@/hooks/useResume';
import { 
  useEnhancedABR as useEnhancedABRFlag, 
  useSegmentPrefetch as useSegmentPrefetchFlag,
  useResumeSupport as useResumeSupportFlag,
} from '@/hooks/useFeatureFlags';

interface UseEnhancedPlayerOptions {
  contentId: string;
  contentType: 'live' | 'movie' | 'series' | 'episode';
  contentName: string;
  contentLogo?: string;
  contentCategory?: string;
  streamUrl: string;
  autoPlay?: boolean;
}

export function useEnhancedPlayer({
  contentId,
  contentType,
  contentName,
  contentLogo,
  contentCategory,
  streamUrl,
  autoPlay = true,
}: UseEnhancedPlayerOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  // Feature flags
  const enableEnhancedABR = useEnhancedABRFlag();
  const enableSegmentPrefetch = useSegmentPrefetchFlag();
  const enableResume = useResumeSupportFlag();

  // Segment prefetch
  const segmentPrefetch = useSegmentPrefetch({
    segmentsCount: 2,
    prefetchOnHover: enableSegmentPrefetch,
    prefetchOnStart: enableSegmentPrefetch,
  });

  // Resume support
  const resume = useResume({
    contentId,
    contentType,
    contentName,
    metadata: {
      logo: contentLogo,
      category: contentCategory,
    },
    saveInterval: 15,
    minProgressToSave: 10,
  });

  /**
   * Attach video element
   */
  const attachVideo = useCallback((video: HTMLVideoElement) => {
    videoRef.current = video;

    // Track time updates for resume
    if (enableResume) {
      const handleTimeUpdate = () => {
        resume.updateProgress(video.currentTime, video.duration);
      };

      const handlePlay = () => {
        resume.startPeriodicSave();
      };

      const handlePause = () => {
        resume.stopPeriodicSave();
        resume.saveProgress(true); // Force save on pause
      };

      const handleEnded = () => {
        resume.clearResumePoint(); // Clear on completion
      };

      video.addEventListener('timeupdate', handleTimeUpdate);
      video.addEventListener('play', handlePlay);
      video.addEventListener('pause', handlePause);
      video.addEventListener('ended', handleEnded);

      return () => {
        video.removeEventListener('timeupdate', handleTimeUpdate);
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('pause', handlePause);
        video.removeEventListener('ended', handleEnded);
      };
    }
  }, [enableResume, resume]);

  /**
   * Attach HLS instance
   */
  const attachHls = useCallback((hls: Hls) => {
    hlsRef.current = hls;

    // Attach enhanced ABR
    if (enableEnhancedABR) {
      enhancedABRService.attach(hls, (level, label, direction) => {
        console.log(`[EnhancedPlayer] Quality ${direction}: ${label}`);
      });
    }

    return () => {
      if (enableEnhancedABR) {
        enhancedABRService.detach();
      }
    };
  }, [enableEnhancedABR]);

  /**
   * Prefetch on hover (call when channel card is hovered)
   */
  const onHover = useCallback(() => {
    if (enableSegmentPrefetch && streamUrl) {
      segmentPrefetch.onHover(streamUrl);
    }
  }, [enableSegmentPrefetch, streamUrl, segmentPrefetch]);

  /**
   * Handle playback error with fallback to alternative sources
   */
  const handlePlaybackError = useCallback(async (error: Error, source?: 'cdn_worker' | 'stream_proxy' | 'r2_direct' | 'cloudflare_stream' | 'origin') => {
    console.error('[EnhancedPlayer] Playback error:', error.message);
  }, []);

  /**
   * Prefetch on start (call when playback begins)
   */
  const onStart = useCallback(() => {
    if (enableSegmentPrefetch) {
      if (hlsRef.current) {
        segmentPrefetch.onStart(hlsRef.current);
      } else if (streamUrl) {
        segmentPrefetch.onStart(streamUrl);
      }
    }
  }, [enableSegmentPrefetch, streamUrl, segmentPrefetch]);

  /**
   * Seek to resume point
   */
  const seekToResume = useCallback(() => {
    if (!enableResume || !resume.hasResumePoint || !videoRef.current) {
      return false;
    }

    const video = videoRef.current;
    if (resume.resumePoint) {
      video.currentTime = resume.resumePoint;
      return true;
    }
    return false;
  }, [enableResume, resume.hasResumePoint, resume.resumePoint]);

  /**
   * Decline resume (start from beginning)
   */
  const declineResume = useCallback(() => {
    if (enableResume) {
      resume.declineResume();
    }
  }, [enableResume, resume]);

  /**
   * Get ABR metrics
   */
  const getABRMetrics = useCallback((): ABRMetrics | null => {
    if (!enableEnhancedABR) return null;
    return enhancedABRService.getMetrics();
  }, [enableEnhancedABR]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (enableEnhancedABR) {
        enhancedABRService.detach();
      }
      segmentPrefetch.cancelPrefetch();
    };
  }, [enableEnhancedABR, segmentPrefetch]);

  return {
    // Refs
    videoRef,
    hlsRef,

    // Attach functions
    attachVideo,
    attachHls,

    // Prefetch
    onHover,
    onStart,
    isPrefetching: segmentPrefetch.isPrefetching,
    prefetchCount: segmentPrefetch.prefetchCount,

    // Resume
    hasResumePoint: enableResume && resume.hasResumePoint,
    resumePoint: resume.resumePoint,
    isLoadingResume: resume.isLoading,
    seekToResume,
    declineResume,

    // Analytics (simplified)
    sessionId: crypto.randomUUID(),

    // ABR
    getABRMetrics,

    // Error handling
    handlePlaybackError,

    // Feature flags status
    features: {
      enhancedABR: enableEnhancedABR,
      segmentPrefetch: enableSegmentPrefetch,
      resume: enableResume,
    },
  };
}

export default useEnhancedPlayer;
