/**
 * Advanced Player Controls Hook
 * 
 * Provides advanced playback controls: quality, speed, subtitles, PiP, etc.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import Hls from 'hls.js';

export interface QualityLevel {
  index: number;
  height: number;
  width: number;
  bitrate: number;
  label: string;
}

export interface AudioTrack {
  id: number;
  name: string;
  lang: string;
  default: boolean;
}

export interface SubtitleTrack {
  id: number;
  name: string;
  lang: string;
  mode: TextTrackMode;
}

export interface VideoFilters {
  brightness: number; // 0-200, default 100
  contrast: number;   // 0-200, default 100
  saturation: number; // 0-200, default 100
}

export type AspectRatio = 'auto' | '16:9' | '4:3' | 'fill' | 'original';

export interface AdvancedControlsState {
  // Quality
  qualities: QualityLevel[];
  currentQuality: number; // -1 = auto
  // Speed
  playbackSpeed: number;
  // Filters
  filters: VideoFilters;
  // Tracks
  audioTracks: AudioTrack[];
  currentAudioTrack: number;
  subtitleTracks: SubtitleTrack[];
  currentSubtitle: number; // -1 = off
  // PiP
  isPipActive: boolean;
  isPipSupported: boolean;
  // Aspect Ratio
  aspectRatio: AspectRatio;
  // Stats
  showStats: boolean;
  stats: PlayerStats;
  // Sleep Timer
  sleepTimerMinutes: number | null;
  sleepTimerRemaining: number | null;
}

export interface PlayerStats {
  bitrate: number;
  resolution: string;
  fps: number;
  bufferLength: number;
  droppedFrames: number;
  latency: number;
  codec: string;
}

const DEFAULT_FILTERS: VideoFilters = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
};

const PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export function useAdvancedPlayerControls() {
  const hlsRef = useRef<Hls | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sleepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [state, setState] = useState<AdvancedControlsState>({
    qualities: [],
    currentQuality: -1,
    playbackSpeed: 1,
    filters: DEFAULT_FILTERS,
    audioTracks: [],
    currentAudioTrack: 0,
    subtitleTracks: [],
    currentSubtitle: -1,
    isPipActive: false,
    isPipSupported: typeof document !== 'undefined' && 'pictureInPictureEnabled' in document,
    aspectRatio: 'auto',
    showStats: false,
    stats: {
      bitrate: 0,
      resolution: '-',
      fps: 0,
      bufferLength: 0,
      droppedFrames: 0,
      latency: 0,
      codec: '-',
    },
    sleepTimerMinutes: null,
    sleepTimerRemaining: null,
  });

  // Attach HLS instance
  const attachHls = useCallback((hls: Hls) => {
    hlsRef.current = hls;

    // Get quality levels
    hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
      const qualities: QualityLevel[] = data.levels.map((level, index) => ({
        index,
        height: level.height,
        width: level.width,
        bitrate: level.bitrate,
        label: level.height ? `${level.height}p` : `${Math.round(level.bitrate / 1000)}kbps`,
      }));
      
      setState(s => ({ ...s, qualities }));
    });

    // Get audio tracks
    hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_, data) => {
      const audioTracks: AudioTrack[] = data.audioTracks.map((track, id) => ({
        id,
        name: track.name || `Track ${id + 1}`,
        lang: track.lang || 'unknown',
        default: track.default || false,
      }));
      
      setState(s => ({ ...s, audioTracks }));
    });

    // Track quality changes
    hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
      const level = hls.levels[data.level];
      if (level) {
        setState(s => ({
          ...s,
          stats: {
            ...s.stats,
            bitrate: level.bitrate,
            resolution: `${level.width}x${level.height}`,
          },
        }));
      }
    });
  }, []);

  // Attach video element
  const attachVideo = useCallback((video: HTMLVideoElement) => {
    videoRef.current = video;

    // Check PiP support
    setState(s => ({
      ...s,
      isPipSupported: 'pictureInPictureEnabled' in document && 
        !video.disablePictureInPicture,
    }));

    // Get subtitle tracks
    const updateSubtitles = () => {
      const tracks = Array.from(video.textTracks);
      const subtitleTracks: SubtitleTrack[] = tracks
        .filter(t => t.kind === 'subtitles' || t.kind === 'captions')
        .map((track, id) => ({
          id,
          name: track.label || `Subtitle ${id + 1}`,
          lang: track.language || 'unknown',
          mode: track.mode,
        }));
      
      setState(s => ({ ...s, subtitleTracks }));
    };

    video.textTracks.addEventListener('addtrack', updateSubtitles);
    video.textTracks.addEventListener('removetrack', updateSubtitles);
    updateSubtitles();

    // PiP events
    video.addEventListener('enterpictureinpicture', () => {
      setState(s => ({ ...s, isPipActive: true }));
    });
    video.addEventListener('leavepictureinpicture', () => {
      setState(s => ({ ...s, isPipActive: false }));
    });

    // Stats update interval
    const statsInterval = setInterval(() => {
      if (!video.paused && state.showStats) {
        const quality = video.getVideoPlaybackQuality?.();
        setState(s => ({
          ...s,
          stats: {
            ...s.stats,
            fps: quality ? Math.round(quality.totalVideoFrames / (video.currentTime || 1)) : 0,
            droppedFrames: quality?.droppedVideoFrames || 0,
            bufferLength: video.buffered.length > 0 
              ? video.buffered.end(video.buffered.length - 1) - video.currentTime
              : 0,
          },
        }));
      }
    }, 1000);

    return () => {
      clearInterval(statsInterval);
      video.textTracks.removeEventListener('addtrack', updateSubtitles);
      video.textTracks.removeEventListener('removetrack', updateSubtitles);
    };
  }, [state.showStats]);

  // Quality control
  const setQuality = useCallback((levelIndex: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIndex;
      setState(s => ({ ...s, currentQuality: levelIndex }));
    }
  }, []);

  // Playback speed
  const setPlaybackSpeed = useCallback((speed: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
      setState(s => ({ ...s, playbackSpeed: speed }));
    }
  }, []);

  // Video filters
  const setFilters = useCallback((filters: Partial<VideoFilters>) => {
    setState(s => {
      const newFilters = { ...s.filters, ...filters };
      
      if (videoRef.current) {
        videoRef.current.style.filter = 
          `brightness(${newFilters.brightness}%) ` +
          `contrast(${newFilters.contrast}%) ` +
          `saturate(${newFilters.saturation}%)`;
      }
      
      return { ...s, filters: newFilters };
    });
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, [setFilters]);

  // Audio track
  const setAudioTrack = useCallback((trackId: number) => {
    if (hlsRef.current) {
      hlsRef.current.audioTrack = trackId;
      setState(s => ({ ...s, currentAudioTrack: trackId }));
    }
  }, []);

  // Subtitles
  const setSubtitle = useCallback((trackId: number) => {
    if (videoRef.current) {
      Array.from(videoRef.current.textTracks).forEach((track, idx) => {
        track.mode = idx === trackId ? 'showing' : 'hidden';
      });
      setState(s => ({ ...s, currentSubtitle: trackId }));
    }
  }, []);

  const disableSubtitles = useCallback(() => {
    if (videoRef.current) {
      Array.from(videoRef.current.textTracks).forEach(track => {
        track.mode = 'hidden';
      });
      setState(s => ({ ...s, currentSubtitle: -1 }));
    }
  }, []);

  // Picture-in-Picture
  const togglePip = useCallback(async () => {
    if (!videoRef.current) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (state.isPipSupported) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.error('[PiP] Error:', err);
    }
  }, [state.isPipSupported]);

  // Aspect Ratio
  const setAspectRatio = useCallback((ratio: AspectRatio) => {
    if (videoRef.current) {
      switch (ratio) {
        case 'auto':
          videoRef.current.style.objectFit = 'contain';
          break;
        case '16:9':
        case '4:3':
          videoRef.current.style.objectFit = 'contain';
          videoRef.current.style.aspectRatio = ratio.replace(':', '/');
          break;
        case 'fill':
          videoRef.current.style.objectFit = 'cover';
          break;
        case 'original':
          videoRef.current.style.objectFit = 'none';
          break;
      }
      setState(s => ({ ...s, aspectRatio: ratio }));
    }
  }, []);

  // Stats toggle
  const toggleStats = useCallback(() => {
    setState(s => ({ ...s, showStats: !s.showStats }));
  }, []);

  // Sleep Timer
  const setSleepTimer = useCallback((minutes: number | null) => {
    // Clear existing timers
    if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    if (sleepIntervalRef.current) clearInterval(sleepIntervalRef.current);

    if (minutes === null) {
      setState(s => ({ ...s, sleepTimerMinutes: null, sleepTimerRemaining: null }));
      return;
    }

    const endTime = Date.now() + minutes * 60 * 1000;

    // Update remaining time every second
    sleepIntervalRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000 / 60));
      setState(s => ({ ...s, sleepTimerRemaining: remaining }));
      
      if (remaining <= 0 && sleepIntervalRef.current) {
        clearInterval(sleepIntervalRef.current);
      }
    }, 1000);

    // Pause video when timer ends
    sleepTimerRef.current = setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.pause();
      }
      setState(s => ({ ...s, sleepTimerMinutes: null, sleepTimerRemaining: null }));
    }, minutes * 60 * 1000);

    setState(s => ({ ...s, sleepTimerMinutes: minutes, sleepTimerRemaining: minutes }));
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
      if (sleepIntervalRef.current) clearInterval(sleepIntervalRef.current);
    };
  }, []);

  return {
    state,
    attachHls,
    attachVideo,
    // Quality
    setQuality,
    // Speed
    setPlaybackSpeed,
    availableSpeeds: PLAYBACK_SPEEDS,
    // Filters
    setFilters,
    resetFilters,
    // Audio
    setAudioTrack,
    // Subtitles
    setSubtitle,
    disableSubtitles,
    // PiP
    togglePip,
    // Aspect Ratio
    setAspectRatio,
    // Stats
    toggleStats,
    // Sleep Timer
    setSleepTimer,
  };
}

export default useAdvancedPlayerControls;
