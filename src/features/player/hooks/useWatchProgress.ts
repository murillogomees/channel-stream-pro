/**
 * useWatchProgress - Hook for tracking and persisting watch progress
 */

import { useCallback, useRef, useEffect } from 'react';
import { watchProgressService } from '../services/watchProgressService';
import { analyticsService } from '../services/analyticsService';
import type { ContentType } from '../types';

interface UseWatchProgressOptions {
  contentId: string;
  contentType: ContentType;
  contentName: string;
  contentLogo?: string;
  contentCategory?: string;
  durationSeconds?: number;
  initialProgress?: number;
  saveInterval?: number; // How often to save progress (in seconds)
}

export function useWatchProgress({
  contentId,
  contentType,
  contentName,
  contentLogo,
  contentCategory,
  durationSeconds = 0,
  initialProgress = 0,
  saveInterval = 30, // Save every 30 seconds by default
}: UseWatchProgressOptions) {
  const lastSaveTime = useRef<number>(0);
  const currentProgress = useRef<number>(initialProgress);
  const totalDuration = useRef<number>(durationSeconds);
  const isSaving = useRef<boolean>(false);
  const hasStartedPlaying = useRef<boolean>(false);

  // Save progress to database
  const saveProgress = useCallback(async (progressSeconds: number, duration: number) => {
    if (isSaving.current) return;
    if (!contentId || progressSeconds <= 0) return;

    // Update refs
    currentProgress.current = progressSeconds;
    if (duration > 0) {
      totalDuration.current = duration;
    }

    // Only save if enough time has passed since last save
    const now = Date.now();
    if (now - lastSaveTime.current < saveInterval * 1000) {
      return;
    }

    isSaving.current = true;
    lastSaveTime.current = now;

    try {
      await watchProgressService.updateProgress(
        contentId,
        contentType,
        contentName,
        progressSeconds,
        totalDuration.current,
        {
          contentLogo,
          contentCategory,
        }
      );
      console.log(`[useWatchProgress] Saved progress: ${progressSeconds}s / ${totalDuration.current}s`);
    } catch (error) {
      console.error('[useWatchProgress] Error saving progress:', error);
    } finally {
      isSaving.current = false;
    }
  }, [contentId, contentType, contentName, contentLogo, contentCategory, saveInterval]);

  // Force save progress (for when user leaves)
  const forceSaveProgress = useCallback(async () => {
    if (!contentId || currentProgress.current <= 0) return;

    isSaving.current = true;
    try {
      await watchProgressService.updateProgress(
        contentId,
        contentType,
        contentName,
        currentProgress.current,
        totalDuration.current,
        {
          contentLogo,
          contentCategory,
        }
      );
      console.log(`[useWatchProgress] Force saved progress: ${currentProgress.current}s`);
    } catch (error) {
      console.error('[useWatchProgress] Error force saving progress:', error);
    } finally {
      isSaving.current = false;
    }
  }, [contentId, contentType, contentName, contentLogo, contentCategory]);

  // Track when playback starts
  const onPlaybackStart = useCallback(async () => {
    if (hasStartedPlaying.current) return;
    hasStartedPlaying.current = true;

    // Track analytics
    await analyticsService.trackPlay(contentId, contentType, {
      category: contentCategory,
    });

    console.log(`[useWatchProgress] Playback started for: ${contentName}`);
  }, [contentId, contentType, contentName, contentCategory]);

  // Track when content finishes
  const onPlaybackComplete = useCallback(async () => {
    await watchProgressService.markCompleted(contentId);
    
    // Add to watch history
    await watchProgressService.addToHistory(
      contentId,
      contentType,
      contentName,
      totalDuration.current,
      {
        contentLogo,
        contentCategory,
      }
    );

    console.log(`[useWatchProgress] Playback completed for: ${contentName}`);
  }, [contentId, contentType, contentName, contentLogo, contentCategory]);

  // Handle time update from player
  const onTimeUpdate = useCallback((currentTime: number, duration: number) => {
    currentProgress.current = currentTime;
    if (duration > 0) {
      totalDuration.current = duration;
    }

    // Save progress periodically
    saveProgress(currentTime, duration);
  }, [saveProgress]);

  // Save progress when component unmounts or contentId changes
  useEffect(() => {
    return () => {
      if (currentProgress.current > 0) {
        // Use sync version for unmount (can't await)
        forceSaveProgress();
      }
    };
  }, [contentId, forceSaveProgress]);

  // Save progress before page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (currentProgress.current > 0) {
        // Use navigator.sendBeacon for reliability
        const data = JSON.stringify({
          contentId,
          contentType,
          contentName,
          progressSeconds: currentProgress.current,
          durationSeconds: totalDuration.current,
        });
        navigator.sendBeacon('/api/save-progress', data);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [contentId, contentType, contentName]);

  return {
    onTimeUpdate,
    onPlaybackStart,
    onPlaybackComplete,
    forceSaveProgress,
    currentProgress: currentProgress.current,
  };
}

export default useWatchProgress;
