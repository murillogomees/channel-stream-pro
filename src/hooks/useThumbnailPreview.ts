/**
 * useThumbnailPreview - Generates thumbnail sprites for seek preview
 * 
 * Creates thumbnails at intervals for seek bar preview
 */

import { useState, useRef, useCallback, useEffect } from 'react';

interface ThumbnailData {
  time: number;
  dataUrl: string;
}

interface UseThumbnailPreviewOptions {
  /** Video element ref */
  videoRef: React.RefObject<HTMLVideoElement>;
  /** Number of thumbnails to generate */
  thumbnailCount?: number;
  /** Thumbnail width */
  width?: number;
  /** Thumbnail height */
  height?: number;
  /** Enable generation */
  enabled?: boolean;
}

interface UseThumbnailPreviewReturn {
  /** Array of generated thumbnails */
  thumbnails: ThumbnailData[];
  /** Get thumbnail for specific time */
  getThumbnailAtTime: (time: number) => ThumbnailData | null;
  /** Whether thumbnails are being generated */
  isGenerating: boolean;
  /** Progress of generation (0-100) */
  progress: number;
  /** Start generating thumbnails */
  generateThumbnails: () => void;
}

export function useThumbnailPreview({
  videoRef,
  thumbnailCount = 20,
  width = 160,
  height = 90,
  enabled = true,
}: UseThumbnailPreviewOptions): UseThumbnailPreviewReturn {
  const [thumbnails, setThumbnails] = useState<ThumbnailData[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const generatingRef = useRef(false);
  const generatedForDuration = useRef<number>(0);

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
      canvasRef.current.width = width;
      canvasRef.current.height = height;
    }
  }, [width, height]);

  const generateThumbnails = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !enabled || generatingRef.current) return;
    
    const duration = video.duration;
    if (!duration || isNaN(duration) || duration === Infinity) return;
    
    // Skip if already generated for this duration
    if (generatedForDuration.current === Math.floor(duration)) return;
    
    generatingRef.current = true;
    setIsGenerating(true);
    setProgress(0);
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const newThumbnails: ThumbnailData[] = [];
    const interval = duration / thumbnailCount;
    
    // Create a clone video element for thumbnail generation
    const tempVideo = document.createElement('video');
    tempVideo.crossOrigin = 'anonymous';
    tempVideo.muted = true;
    tempVideo.preload = 'metadata';
    tempVideo.src = video.src;
    
    try {
      await new Promise<void>((resolve, reject) => {
        tempVideo.onloadedmetadata = () => resolve();
        tempVideo.onerror = () => reject(new Error('Failed to load video'));
        setTimeout(() => reject(new Error('Timeout')), 10000);
      });
      
      for (let i = 0; i < thumbnailCount; i++) {
        const time = i * interval;
        
        try {
          await new Promise<void>((resolve) => {
            tempVideo.currentTime = time;
            tempVideo.onseeked = () => {
              ctx.drawImage(tempVideo, 0, 0, width, height);
              newThumbnails.push({
                time,
                dataUrl: canvas.toDataURL('image/jpeg', 0.6),
              });
              resolve();
            };
            setTimeout(resolve, 500); // Timeout for each frame
          });
          
          setProgress(Math.round(((i + 1) / thumbnailCount) * 100));
        } catch {
          // Skip failed thumbnails
        }
      }
      
      setThumbnails(newThumbnails);
      generatedForDuration.current = Math.floor(duration);
    } catch (error) {
      console.warn('[ThumbnailPreview] Generation failed:', error);
    } finally {
      tempVideo.src = '';
      tempVideo.remove();
      setIsGenerating(false);
      generatingRef.current = false;
    }
  }, [videoRef, enabled, thumbnailCount, width, height]);

  // Get thumbnail closest to specified time
  const getThumbnailAtTime = useCallback((time: number): ThumbnailData | null => {
    if (thumbnails.length === 0) return null;
    
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

  return {
    thumbnails,
    getThumbnailAtTime,
    isGenerating,
    progress,
    generateThumbnails,
  };
}

export default useThumbnailPreview;
