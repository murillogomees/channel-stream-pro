/**
 * useSeekThumbnails - Thumbnail previews on seek bar
 * 
 * Generates and displays thumbnail previews when hovering/dragging
 * on the video seek bar (for VOD content).
 */

import { useState, useCallback, useRef, useEffect } from 'react';

interface Thumbnail {
  time: number;
  url: string;
  width: number;
  height: number;
}

interface UseSeekThumbnailsOptions {
  thumbnailWidth?: number;
  thumbnailHeight?: number;
  interval?: number;          // Interval between thumbnails in seconds
  maxThumbnails?: number;     // Max thumbnails to generate
  enabled?: boolean;
}

const DEFAULT_OPTIONS: UseSeekThumbnailsOptions = {
  thumbnailWidth: 160,
  thumbnailHeight: 90,
  interval: 10,
  maxThumbnails: 100,
  enabled: true,
};

export function useSeekThumbnails(options: UseSeekThumbnailsOptions = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options };
  
  const [thumbnails, setThumbnails] = useState<Thumbnail[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentPreview, setCurrentPreview] = useState<Thumbnail | null>(null);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const abortRef = useRef(false);

  /**
   * Generate thumbnails from video
   */
  const generateThumbnails = useCallback(async (video: HTMLVideoElement) => {
    if (!config.enabled || isGenerating) return;
    if (!video.duration || video.duration === Infinity) return; // Skip live streams

    setIsGenerating(true);
    setProgress(0);
    abortRef.current = false;

    const duration = video.duration;
    const interval = Math.max(config.interval!, duration / config.maxThumbnails!);
    const count = Math.min(Math.floor(duration / interval), config.maxThumbnails!);

    // Create offscreen canvas
    const canvas = document.createElement('canvas');
    canvas.width = config.thumbnailWidth!;
    canvas.height = config.thumbnailHeight!;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      setIsGenerating(false);
      return;
    }

    canvasRef.current = canvas;

    // Create hidden video for thumbnail extraction
    const thumbVideo = document.createElement('video');
    thumbVideo.crossOrigin = 'anonymous';
    thumbVideo.muted = true;
    thumbVideo.preload = 'auto';
    thumbVideo.src = video.currentSrc || video.src;

    const newThumbnails: Thumbnail[] = [];

    try {
      await new Promise<void>((resolve, reject) => {
        thumbVideo.onloadeddata = () => resolve();
        thumbVideo.onerror = () => reject(new Error('Failed to load video'));
        setTimeout(() => reject(new Error('Timeout')), 10000);
      });

      for (let i = 0; i < count && !abortRef.current; i++) {
        const time = i * interval;
        
        // Seek to time
        thumbVideo.currentTime = time;
        
        await new Promise<void>((resolve) => {
          thumbVideo.onseeked = () => resolve();
          setTimeout(resolve, 500); // Fallback timeout
        });

        // Draw frame to canvas
        ctx.drawImage(thumbVideo, 0, 0, config.thumbnailWidth!, config.thumbnailHeight!);
        
        // Get data URL
        const url = canvas.toDataURL('image/jpeg', 0.7);
        
        newThumbnails.push({
          time,
          url,
          width: config.thumbnailWidth!,
          height: config.thumbnailHeight!,
        });

        setProgress(((i + 1) / count) * 100);
      }

      if (!abortRef.current) {
        setThumbnails(newThumbnails);
      }
    } catch (error) {
      console.warn('[SeekThumbnails] Generation failed:', error);
    } finally {
      thumbVideo.src = '';
      setIsGenerating(false);
    }
  }, [config.enabled, config.interval, config.maxThumbnails, config.thumbnailWidth, config.thumbnailHeight, isGenerating]);

  /**
   * Get thumbnail for a specific time
   */
  const getThumbnailAt = useCallback((time: number): Thumbnail | null => {
    if (thumbnails.length === 0) return null;

    // Find closest thumbnail
    let closest = thumbnails[0];
    let minDiff = Math.abs(time - closest.time);

    for (const thumb of thumbnails) {
      const diff = Math.abs(time - thumb.time);
      if (diff < minDiff) {
        minDiff = diff;
        closest = thumb;
      }
    }

    return closest;
  }, [thumbnails]);

  /**
   * Show preview at time
   */
  const showPreviewAt = useCallback((time: number) => {
    const thumbnail = getThumbnailAt(time);
    setCurrentPreview(thumbnail);
  }, [getThumbnailAt]);

  /**
   * Hide preview
   */
  const hidePreview = useCallback(() => {
    setCurrentPreview(null);
  }, []);

  /**
   * Attach video element
   */
  const attachVideo = useCallback((video: HTMLVideoElement) => {
    videoRef.current = video;

    // Generate thumbnails when metadata is loaded
    const handleLoadedMetadata = () => {
      // Only generate for VOD (finite duration)
      if (video.duration && video.duration !== Infinity && video.duration > 30) {
        // Delay generation to not interfere with initial playback
        setTimeout(() => {
          if (!abortRef.current) {
            generateThumbnails(video);
          }
        }, 2000);
      }
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    
    // If already loaded
    if (video.duration && video.duration !== Infinity) {
      handleLoadedMetadata();
    }

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      abortRef.current = true;
    };
  }, [generateThumbnails]);

  /**
   * Clear thumbnails
   */
  const clearThumbnails = useCallback(() => {
    abortRef.current = true;
    setThumbnails([]);
    setCurrentPreview(null);
    setProgress(0);
  }, []);

  /**
   * Cancel generation
   */
  const cancelGeneration = useCallback(() => {
    abortRef.current = true;
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      abortRef.current = true;
    };
  }, []);

  return {
    // State
    thumbnails,
    isGenerating,
    progress,
    currentPreview,
    hasThumbnails: thumbnails.length > 0,

    // Actions
    attachVideo,
    generateThumbnails,
    getThumbnailAt,
    showPreviewAt,
    hidePreview,
    clearThumbnails,
    cancelGeneration,
  };
}

export default useSeekThumbnails;
