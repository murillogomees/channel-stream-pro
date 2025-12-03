/**
 * useResumePlayback - Remember playback position for VOD
 * 
 * Saves and restores playback position for VOD content,
 * allowing users to continue where they left off.
 */

import { useState, useCallback, useEffect, useRef } from 'react';

interface ResumeData {
  position: number;
  duration: number;
  timestamp: number;
  channelName?: string;
}

interface UseResumePlaybackOptions {
  storageKey?: string;
  minDuration?: number;      // Min duration to save (seconds)
  minProgress?: number;      // Min progress to save (0-1)
  maxProgress?: number;      // Max progress to save (0-1) - don't save if almost finished
  expirationDays?: number;   // Days before data expires
  saveInterval?: number;     // Save interval in seconds
}

const DEFAULT_OPTIONS: UseResumePlaybackOptions = {
  storageKey: 'player_resume_data',
  minDuration: 60,           // At least 1 minute
  minProgress: 0.02,         // At least 2% watched
  maxProgress: 0.95,         // Don't save if >95% watched
  expirationDays: 30,
  saveInterval: 10,          // Save every 10 seconds
};

export function useResumePlayback(options: UseResumePlaybackOptions = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options };
  
  const [resumeData, setResumeData] = useState<Map<string, ResumeData>>(new Map());
  const [currentChannelId, setCurrentChannelId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const saveIntervalRef = useRef<number | null>(null);

  /**
   * Load resume data from localStorage
   */
  const loadData = useCallback(() => {
    try {
      const stored = localStorage.getItem(config.storageKey!);
      if (stored) {
        const parsed = JSON.parse(stored);
        const now = Date.now();
        const expirationMs = config.expirationDays! * 24 * 60 * 60 * 1000;

        // Filter expired entries
        const filtered = Object.entries(parsed).filter(([_, data]) => {
          return now - (data as ResumeData).timestamp < expirationMs;
        });

        setResumeData(new Map(filtered as [string, ResumeData][]));
      }
    } catch (error) {
      console.error('[ResumePlayback] Failed to load data:', error);
    }
  }, [config.storageKey, config.expirationDays]);

  /**
   * Save resume data to localStorage
   */
  const saveData = useCallback((data: Map<string, ResumeData>) => {
    try {
      const obj = Object.fromEntries(data);
      localStorage.setItem(config.storageKey!, JSON.stringify(obj));
    } catch (error) {
      console.error('[ResumePlayback] Failed to save data:', error);
    }
  }, [config.storageKey]);

  /**
   * Save current position for a channel
   */
  const savePosition = useCallback((channelId: string, position: number, duration: number, channelName?: string) => {
    // Validate conditions
    if (duration < config.minDuration!) return;
    
    const progress = position / duration;
    if (progress < config.minProgress! || progress > config.maxProgress!) {
      // Remove if almost finished
      if (progress > config.maxProgress!) {
        setResumeData(prev => {
          const next = new Map(prev);
          next.delete(channelId);
          saveData(next);
          return next;
        });
      }
      return;
    }

    const data: ResumeData = {
      position,
      duration,
      timestamp: Date.now(),
      channelName,
    };

    setResumeData(prev => {
      const next = new Map(prev);
      next.set(channelId, data);
      saveData(next);
      return next;
    });
  }, [config.minDuration, config.minProgress, config.maxProgress, saveData]);

  /**
   * Get resume position for a channel
   */
  const getResumePosition = useCallback((channelId: string): number | null => {
    const data = resumeData.get(channelId);
    if (!data) return null;

    // Check expiration
    const expirationMs = config.expirationDays! * 24 * 60 * 60 * 1000;
    if (Date.now() - data.timestamp > expirationMs) {
      return null;
    }

    return data.position;
  }, [resumeData, config.expirationDays]);

  /**
   * Get resume data for a channel
   */
  const getResumeData = useCallback((channelId: string): ResumeData | null => {
    return resumeData.get(channelId) || null;
  }, [resumeData]);

  /**
   * Clear resume data for a channel
   */
  const clearResumeData = useCallback((channelId: string) => {
    setResumeData(prev => {
      const next = new Map(prev);
      next.delete(channelId);
      saveData(next);
      return next;
    });
  }, [saveData]);

  /**
   * Attach video element for automatic position tracking
   */
  const attachVideo = useCallback((video: HTMLVideoElement, channelId: string, channelName?: string) => {
    videoRef.current = video;
    setCurrentChannelId(channelId);

    // Clear existing interval
    if (saveIntervalRef.current) {
      clearInterval(saveIntervalRef.current);
    }

    // Set up periodic saving
    saveIntervalRef.current = window.setInterval(() => {
      if (video && !video.paused && video.duration > 0) {
        savePosition(channelId, video.currentTime, video.duration, channelName);
      }
    }, config.saveInterval! * 1000);

    // Save on pause
    const handlePause = () => {
      if (video.duration > 0) {
        savePosition(channelId, video.currentTime, video.duration, channelName);
      }
    };

    // Save on visibility change
    const handleVisibilityChange = () => {
      if (document.hidden && video.duration > 0) {
        savePosition(channelId, video.currentTime, video.duration, channelName);
      }
    };

    video.addEventListener('pause', handlePause);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
      }
      video.removeEventListener('pause', handlePause);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [savePosition, config.saveInterval]);

  /**
   * Resume playback at saved position
   */
  const resumeAt = useCallback((channelId: string, video?: HTMLVideoElement) => {
    const position = getResumePosition(channelId);
    if (position === null) return false;

    const targetVideo = video || videoRef.current;
    if (!targetVideo) return false;

    targetVideo.currentTime = position;
    return true;
  }, [getResumePosition]);

  /**
   * Format position for display
   */
  const formatPosition = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }, []);

  /**
   * Get all channels with resume data
   */
  const getResumeChannels = useCallback((): Array<{ channelId: string; data: ResumeData }> => {
    return Array.from(resumeData.entries()).map(([channelId, data]) => ({
      channelId,
      data,
    }));
  }, [resumeData]);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
      }
    };
  }, []);

  return {
    // State
    resumeData,
    currentChannelId,

    // Actions
    attachVideo,
    savePosition,
    getResumePosition,
    getResumeData,
    clearResumeData,
    resumeAt,
    getResumeChannels,

    // Helpers
    formatPosition,
    hasResumeData: (channelId: string) => resumeData.has(channelId),
  };
}

export default useResumePlayback;
