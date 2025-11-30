/**
 * useResume - Hook for resume support with server + local fallback
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { resumeService, ResumeProgress } from '@/services/resumeService';

interface UseResumeOptions {
  contentId: string;
  contentType: 'live' | 'movie' | 'series' | 'episode';
  contentName: string;
  metadata?: Record<string, any>;
  saveInterval?: number; // Save every N seconds (default: 15)
  minProgressToSave?: number; // Min progress in seconds to save (default: 10)
}

export function useResume({
  contentId,
  contentType,
  contentName,
  metadata,
  saveInterval = 15,
  minProgressToSave = 10,
}: UseResumeOptions) {
  const [resumePoint, setResumePoint] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const currentProgressRef = useRef(0);
  const durationRef = useRef(0);
  const lastSaveRef = useRef(0);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Load resume point on mount
   */
  useEffect(() => {
    const loadResumePoint = async () => {
      setIsLoading(true);
      try {
        const progress = await resumeService.getProgress(contentId);
        if (progress && progress.progressSeconds > minProgressToSave) {
          // Don't resume if near end (95%+)
          const percentComplete = progress.progressSeconds / progress.durationSeconds;
          if (percentComplete < 0.95) {
            setResumePoint(progress.progressSeconds);
          }
        }
      } catch (error) {
        console.warn('[useResume] Error loading progress:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadResumePoint();
  }, [contentId, minProgressToSave]);

  /**
   * Update progress (call from player time update)
   */
  const updateProgress = useCallback((currentTime: number, duration: number) => {
    currentProgressRef.current = currentTime;
    durationRef.current = duration;
  }, []);

  /**
   * Save progress to storage
   */
  const saveProgress = useCallback(async (force = false) => {
    const now = Date.now();
    const currentTime = currentProgressRef.current;
    const duration = durationRef.current;

    // Skip if not enough progress
    if (currentTime < minProgressToSave) return;

    // Skip if not enough time passed (unless forced)
    if (!force && now - lastSaveRef.current < saveInterval * 1000) return;

    lastSaveRef.current = now;

    await resumeService.saveProgress({
      contentId,
      contentType,
      contentName,
      progressSeconds: currentTime,
      durationSeconds: duration,
      updatedAt: new Date().toISOString(),
      metadata,
    });
  }, [contentId, contentType, contentName, metadata, saveInterval, minProgressToSave]);

  /**
   * Start periodic save
   */
  const startPeriodicSave = useCallback(() => {
    if (saveTimerRef.current) return;

    saveTimerRef.current = setInterval(() => {
      saveProgress();
    }, saveInterval * 1000);
  }, [saveProgress, saveInterval]);

  /**
   * Stop periodic save
   */
  const stopPeriodicSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearInterval(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  }, []);

  /**
   * Clear resume point (e.g., when video completes)
   */
  const clearResumePoint = useCallback(async () => {
    setResumePoint(null);
    await resumeService.clearProgress(contentId);
  }, [contentId]);

  /**
   * Decline resume (user chose to start from beginning)
   */
  const declineResume = useCallback(() => {
    setResumePoint(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPeriodicSave();
      // Force save on unmount
      saveProgress(true);
    };
  }, [stopPeriodicSave, saveProgress]);

  // Save before page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (currentProgressRef.current > minProgressToSave) {
        // Use sendBeacon for reliability
        const data = JSON.stringify({
          contentId,
          contentType,
          contentName,
          progressSeconds: currentProgressRef.current,
          durationSeconds: durationRef.current,
        });
        
        navigator.sendBeacon('/api/save-progress', data);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [contentId, contentType, contentName, minProgressToSave]);

  return {
    // State
    resumePoint,
    isLoading,
    hasResumePoint: resumePoint !== null && resumePoint > 0,

    // Actions
    updateProgress,
    saveProgress,
    clearResumePoint,
    declineResume,
    startPeriodicSave,
    stopPeriodicSave,
  };
}

export default useResume;
