/**
 * useSubtitles - Subtitle/Closed Caption support
 * 
 * Manages subtitles from HLS streams and external sources.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import Hls from 'hls.js';

export interface SubtitleTrack {
  id: number;
  name: string;
  lang?: string;
  url?: string;
  default: boolean;
  forced: boolean;
}

interface UseSubtitlesOptions {
  enabled?: boolean;
  defaultLang?: string;
  onTrackChange?: (track: SubtitleTrack | null) => void;
}

export function useSubtitles(options: UseSubtitlesOptions = {}) {
  const { enabled = true, defaultLang, onTrackChange } = options;

  const [tracks, setTracks] = useState<SubtitleTrack[]>([]);
  const [currentTrack, setCurrentTrack] = useState<number>(-1);
  const [isVisible, setIsVisible] = useState(true);

  const hlsRef = useRef<Hls | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  /**
   * Update tracks from HLS instance
   */
  const updateHlsTracks = useCallback(() => {
    const hls = hlsRef.current;
    if (!hls) return;

    const subtitleTracks = hls.subtitleTracks;
    if (subtitleTracks.length > 0) {
      const mapped: SubtitleTrack[] = subtitleTracks.map((track, index) => ({
        id: index,
        name: track.name || track.lang || `Subtitle ${index + 1}`,
        lang: track.lang,
        url: track.url,
        default: track.default || false,
        forced: track.forced || false,
      }));
      setTracks(mapped);

      // Auto-select default or preferred language
      if (currentTrack === -1) {
        const defaultTrack = mapped.find(t => t.default);
        const langTrack = defaultLang ? mapped.find(t => t.lang?.startsWith(defaultLang)) : null;
        
        if (langTrack) {
          setTrack(langTrack.id);
        } else if (defaultTrack) {
          setTrack(defaultTrack.id);
        }
      }
    }
  }, [currentTrack, defaultLang]);

  /**
   * Update tracks from native video element
   */
  const updateNativeTracks = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const textTracks = video.textTracks;
    if (textTracks.length > 0) {
      const mapped: SubtitleTrack[] = [];
      
      for (let i = 0; i < textTracks.length; i++) {
        const track = textTracks[i];
        if (track.kind === 'subtitles' || track.kind === 'captions') {
          mapped.push({
            id: i,
            name: track.label || track.language || `Track ${i + 1}`,
            lang: track.language,
            default: track.mode === 'showing',
            forced: false,
          });
        }
      }
      
      setTracks(mapped);
    }
  }, []);

  /**
   * Attach HLS instance
   */
  const attachHls = useCallback((hls: Hls) => {
    hlsRef.current = hls;

    hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, updateHlsTracks);
    hls.on(Hls.Events.SUBTITLE_TRACK_SWITCH, (_, data) => {
      setCurrentTrack(data.id);
      const track = tracks.find(t => t.id === data.id) || null;
      onTrackChange?.(track);
    });

    // Initial update
    updateHlsTracks();

    return () => {
      hls.off(Hls.Events.SUBTITLE_TRACKS_UPDATED, updateHlsTracks);
    };
  }, [updateHlsTracks, tracks, onTrackChange]);

  /**
   * Attach video element
   */
  const attachVideo = useCallback((video: HTMLVideoElement) => {
    videoRef.current = video;

    const handleTrackChange = () => updateNativeTracks();
    
    video.textTracks.addEventListener('change', handleTrackChange);
    video.textTracks.addEventListener('addtrack', handleTrackChange);
    
    updateNativeTracks();

    return () => {
      video.textTracks.removeEventListener('change', handleTrackChange);
      video.textTracks.removeEventListener('addtrack', handleTrackChange);
    };
  }, [updateNativeTracks]);

  /**
   * Set subtitle track by ID
   */
  const setTrack = useCallback((trackId: number) => {
    const hls = hlsRef.current;
    const video = videoRef.current;

    if (hls && hls.subtitleTracks.length > 0) {
      hls.subtitleTrack = trackId;
      setCurrentTrack(trackId);
    } else if (video && video.textTracks.length > 0) {
      // Disable all tracks first
      for (let i = 0; i < video.textTracks.length; i++) {
        video.textTracks[i].mode = 'disabled';
      }
      
      // Enable selected track
      if (trackId >= 0 && trackId < video.textTracks.length) {
        video.textTracks[trackId].mode = 'showing';
        setCurrentTrack(trackId);
      } else {
        setCurrentTrack(-1);
      }
    }

    const track = tracks.find(t => t.id === trackId) || null;
    onTrackChange?.(track);
  }, [tracks, onTrackChange]);

  /**
   * Disable subtitles
   */
  const disableSubtitles = useCallback(() => {
    const hls = hlsRef.current;
    const video = videoRef.current;

    if (hls) {
      hls.subtitleTrack = -1;
    }
    
    if (video) {
      for (let i = 0; i < video.textTracks.length; i++) {
        video.textTracks[i].mode = 'disabled';
      }
    }

    setCurrentTrack(-1);
    onTrackChange?.(null);
  }, [onTrackChange]);

  /**
   * Toggle subtitle visibility
   */
  const toggleVisibility = useCallback(() => {
    setIsVisible(prev => !prev);
    
    const video = videoRef.current;
    if (video && currentTrack >= 0 && currentTrack < video.textTracks.length) {
      video.textTracks[currentTrack].mode = isVisible ? 'hidden' : 'showing';
    }
  }, [currentTrack, isVisible]);

  /**
   * Add external subtitle track (VTT/SRT)
   */
  const addExternalTrack = useCallback((url: string, label: string, lang?: string, isDefault?: boolean) => {
    const video = videoRef.current;
    if (!video) return null;

    const track = document.createElement('track');
    track.kind = 'subtitles';
    track.src = url;
    track.label = label;
    track.srclang = lang || 'und';
    track.default = isDefault || false;

    video.appendChild(track);
    
    // Update tracks list
    setTimeout(updateNativeTracks, 100);

    return track;
  }, [updateNativeTracks]);

  /**
   * Get track label for display
   */
  const getTrackLabel = useCallback((track: SubtitleTrack): string => {
    if (track.lang) {
      const langNames: Record<string, string> = {
        'pt': 'Português',
        'en': 'English',
        'es': 'Español',
        'fr': 'Français',
        'de': 'Deutsch',
        'it': 'Italiano',
        'ja': '日本語',
        'ko': '한국어',
        'zh': '中文',
      };
      const baseLang = track.lang.substring(0, 2);
      return langNames[baseLang] || track.name;
    }
    return track.name;
  }, []);

  /**
   * Get current track object
   */
  const getCurrentTrack = useCallback((): SubtitleTrack | null => {
    if (currentTrack === -1) return null;
    return tracks.find(t => t.id === currentTrack) || null;
  }, [currentTrack, tracks]);

  return {
    // State
    tracks,
    currentTrack,
    isVisible,
    hasSubtitles: tracks.length > 0,

    // Actions
    attachHls,
    attachVideo,
    setTrack,
    disableSubtitles,
    toggleVisibility,
    addExternalTrack,

    // Helpers
    getTrackLabel,
    getCurrentTrack,
    isSubtitleActive: currentTrack !== -1,
  };
}

export default useSubtitles;
