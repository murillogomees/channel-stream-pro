/**
 * useAudioTrackSelector - Audio Track Selection
 * 
 * Allows switching between audio tracks (SAP, languages)
 * for multi-audio streams.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import Hls from 'hls.js';

// Extend HTMLVideoElement to include audioTracks (non-standard API)
interface AudioTrackList {
  length: number;
  [index: number]: {
    enabled: boolean;
    label: string;
    language: string;
  };
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

interface HTMLVideoElementWithAudio extends HTMLVideoElement {
  audioTracks?: AudioTrackList;
}

export interface AudioTrack {
  id: number;
  name: string;
  lang?: string;
  default: boolean;
  autoselect: boolean;
}

interface UseAudioTrackSelectorOptions {
  onTrackChange?: (track: AudioTrack) => void;
}

export function useAudioTrackSelector(options: UseAudioTrackSelectorOptions = {}) {
  const { onTrackChange } = options;
  
  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [currentTrack, setCurrentTrack] = useState<number>(-1);
  const hlsRef = useRef<Hls | null>(null);
  const videoRef = useRef<HTMLVideoElementWithAudio | null>(null);

  /**
   * Update tracks from HLS instance
   */
  const updateTracks = useCallback(() => {
    const hls = hlsRef.current;
    if (!hls) return;

    const audioTracks = hls.audioTracks;
    if (audioTracks.length > 0) {
      const mapped: AudioTrack[] = audioTracks.map((track, index) => ({
        id: index,
        name: track.name || `Audio ${index + 1}`,
        lang: track.lang,
        default: track.default || false,
        autoselect: track.autoselect || false,
      }));
      setTracks(mapped);
      setCurrentTrack(hls.audioTrack);
    }
  }, []);

  /**
   * Update tracks from native video element
   */
  const updateNativeTracks = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const audioTracks = video.audioTracks;
    if (audioTracks && audioTracks.length > 0) {
      const mapped: AudioTrack[] = [];
      for (let i = 0; i < audioTracks.length; i++) {
        const track = audioTracks[i];
        mapped.push({
          id: i,
          name: track.label || track.language || `Audio ${i + 1}`,
          lang: track.language,
          default: track.enabled,
          autoselect: false,
        });
        if (track.enabled) {
          setCurrentTrack(i);
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

    hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, updateTracks);
    hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (_, data) => {
      setCurrentTrack(data.id);
      const track = tracks.find(t => t.id === data.id);
      if (track) {
        onTrackChange?.(track);
      }
    });

    // Initial update
    updateTracks();

    return () => {
      hls.off(Hls.Events.AUDIO_TRACKS_UPDATED, updateTracks);
    };
  }, [updateTracks, tracks, onTrackChange]);

  /**
   * Attach video element for native audio tracks
   */
  const attachVideo = useCallback((video: HTMLVideoElement) => {
    const videoWithAudio = video as HTMLVideoElementWithAudio;
    videoRef.current = videoWithAudio;

    // Listen for audio track changes
    if (videoWithAudio.audioTracks) {
      videoWithAudio.audioTracks.addEventListener('change', updateNativeTracks);
      videoWithAudio.audioTracks.addEventListener('addtrack', updateNativeTracks);
      updateNativeTracks();
    }

    return () => {
      if (videoWithAudio.audioTracks) {
        videoWithAudio.audioTracks.removeEventListener('change', updateNativeTracks);
        videoWithAudio.audioTracks.removeEventListener('addtrack', updateNativeTracks);
      }
    };
  }, [updateNativeTracks]);

  /**
   * Set audio track by ID
   */
  const setTrack = useCallback((trackId: number) => {
    const hls = hlsRef.current;
    const video = videoRef.current;

    if (hls && hls.audioTracks.length > 0) {
      hls.audioTrack = trackId;
    } else if (video && video.audioTracks) {
      // Native audio tracks
      for (let i = 0; i < video.audioTracks.length; i++) {
        video.audioTracks[i].enabled = i === trackId;
      }
      setCurrentTrack(trackId);
      const track = tracks.find(t => t.id === trackId);
      if (track) {
        onTrackChange?.(track);
      }
    }
  }, [tracks, onTrackChange]);

  /**
   * Get track label for display
   */
  const getTrackLabel = useCallback((track: AudioTrack): string => {
    if (track.lang) {
      const langNames: Record<string, string> = {
        'pt': 'Português',
        'en': 'English',
        'es': 'Español',
        'fr': 'Français',
        'de': 'Deutsch',
        'it': 'Italiano',
        'ja': 'Japanese',
        'ko': 'Korean',
        'zh': 'Chinese',
      };
      return langNames[track.lang.substring(0, 2)] || track.name;
    }
    return track.name;
  }, []);

  return {
    tracks,
    currentTrack,
    hasMultipleTracks: tracks.length > 1,
    attachHls,
    attachVideo,
    setTrack,
    getTrackLabel,
  };
}

export default useAudioTrackSelector;
