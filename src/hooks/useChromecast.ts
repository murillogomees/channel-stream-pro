/**
 * useChromecast - Google Cast/Chromecast support
 * 
 * Enables casting video to Chromecast and other Cast-enabled devices.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

// Cast SDK types
declare global {
  interface Window {
    __onGCastApiAvailable?: (isAvailable: boolean) => void;
    cast?: {
      framework: {
        CastContext: {
          getInstance: () => CastContext;
        };
        CastContextEventType: {
          SESSION_STATE_CHANGED: string;
          CAST_STATE_CHANGED: string;
        };
        SessionState: {
          SESSION_STARTED: string;
          SESSION_RESUMED: string;
          SESSION_ENDED: string;
        };
        CastState: {
          NO_DEVICES_AVAILABLE: string;
          NOT_CONNECTED: string;
          CONNECTING: string;
          CONNECTED: string;
        };
        RemotePlayer: new () => RemotePlayer;
        RemotePlayerController: new (player: RemotePlayer) => RemotePlayerController;
        RemotePlayerEventType: {
          ANY_CHANGE: string;
          IS_CONNECTED_CHANGED: string;
          IS_MEDIA_LOADED_CHANGED: string;
          PLAYER_STATE_CHANGED: string;
          CURRENT_TIME_CHANGED: string;
        };
      };
    };
    chrome?: {
      cast: {
        media: {
          DEFAULT_MEDIA_RECEIVER_APP_ID: string;
          MediaInfo: new (contentId: string, contentType: string) => MediaInfo;
          GenericMediaMetadata: new () => GenericMediaMetadata;
          LoadRequest: new (mediaInfo: MediaInfo) => LoadRequest;
        };
      };
    };
  }
}

interface CastContext {
  setOptions: (options: any) => void;
  requestSession: () => Promise<void>;
  endCurrentSession: (stopCasting: boolean) => void;
  getCurrentSession: () => CastSession | null;
  getCastState: () => string;
  addEventListener: (type: string, listener: (event: any) => void) => void;
  removeEventListener: (type: string, listener: (event: any) => void) => void;
}

interface CastSession {
  loadMedia: (request: LoadRequest) => Promise<void>;
  getMediaSession: () => MediaSession | null;
}

interface MediaSession {
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (seekRequest: any) => void;
}

interface MediaInfo {
  metadata: GenericMediaMetadata;
  streamType: string;
}

interface GenericMediaMetadata {
  title: string;
  images: Array<{ url: string }>;
}

interface LoadRequest {
  autoplay: boolean;
  currentTime: number;
}

interface RemotePlayer {
  isConnected: boolean;
  isMediaLoaded: boolean;
  currentTime: number;
  duration: number;
  volumeLevel: number;
  isMuted: boolean;
  playerState: string;
}

interface RemotePlayerController {
  playOrPause: () => void;
  stop: () => void;
  seek: () => void;
  setVolumeLevel: () => void;
  muteOrUnmute: () => void;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

interface UseChromecastOptions {
  receiverAppId?: string;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: Error) => void;
}

type CastState = 'unavailable' | 'available' | 'connecting' | 'connected';

export function useChromecast(options: UseChromecastOptions = {}) {
  const { 
    receiverAppId,
    onConnected, 
    onDisconnected, 
    onError 
  } = options;

  const [isAvailable, setIsAvailable] = useState(false);
  const [castState, setCastState] = useState<CastState>('unavailable');
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const castContextRef = useRef<CastContext | null>(null);
  const playerRef = useRef<RemotePlayer | null>(null);
  const controllerRef = useRef<RemotePlayerController | null>(null);

  /**
   * Initialize Cast SDK
   */
  useEffect(() => {
    // Load Cast SDK
    if (!document.getElementById('cast-sdk')) {
      const script = document.createElement('script');
      script.id = 'cast-sdk';
      script.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
      script.async = true;
      document.head.appendChild(script);
    }

    // Wait for SDK to load
    window.__onGCastApiAvailable = (isAvailable: boolean) => {
      if (isAvailable && window.cast && window.chrome) {
        initializeCast();
      } else {
        setIsAvailable(false);
        setCastState('unavailable');
      }
    };

    // Check if already loaded
    if (window.cast?.framework) {
      initializeCast();
    }

    return () => {
      window.__onGCastApiAvailable = undefined;
    };
  }, []);

  /**
   * Initialize Cast context
   */
  const initializeCast = useCallback(() => {
    try {
      const context = window.cast!.framework.CastContext.getInstance();
      
      context.setOptions({
        receiverApplicationId: receiverAppId || window.chrome!.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
        autoJoinPolicy: 'ORIGIN_SCOPED',
      });

      castContextRef.current = context;

      // Create remote player
      const player = new window.cast!.framework.RemotePlayer();
      const controller = new window.cast!.framework.RemotePlayerController(player);
      
      playerRef.current = player;
      controllerRef.current = controller;

      // Listen for state changes
      context.addEventListener(
        window.cast!.framework.CastContextEventType.CAST_STATE_CHANGED,
        handleCastStateChanged
      );

      context.addEventListener(
        window.cast!.framework.CastContextEventType.SESSION_STATE_CHANGED,
        handleSessionStateChanged
      );

      setIsAvailable(true);
      updateCastState(context.getCastState());

      console.log('[Chromecast] Initialized successfully');
    } catch (error) {
      console.error('[Chromecast] Initialization failed:', error);
      setIsAvailable(false);
      onError?.(error as Error);
    }
  }, [receiverAppId, onError]);

  /**
   * Handle cast state changes
   */
  const handleCastStateChanged = useCallback((event: any) => {
    updateCastState(event.castState);
  }, []);

  /**
   * Update cast state
   */
  const updateCastState = useCallback((state: string) => {
    const cast = window.cast?.framework;
    if (!cast) return;

    switch (state) {
      case cast.CastState.NO_DEVICES_AVAILABLE:
        setCastState('unavailable');
        break;
      case cast.CastState.NOT_CONNECTED:
        setCastState('available');
        setDeviceName(null);
        break;
      case cast.CastState.CONNECTING:
        setCastState('connecting');
        break;
      case cast.CastState.CONNECTED:
        setCastState('connected');
        const session = castContextRef.current?.getCurrentSession();
        if (session) {
          // Get device name if available
          setDeviceName('Chromecast');
        }
        onConnected?.();
        break;
    }
  }, [onConnected]);

  /**
   * Handle session state changes
   */
  const handleSessionStateChanged = useCallback((event: any) => {
    const cast = window.cast?.framework;
    if (!cast) return;

    switch (event.sessionState) {
      case cast.SessionState.SESSION_STARTED:
      case cast.SessionState.SESSION_RESUMED:
        onConnected?.();
        break;
      case cast.SessionState.SESSION_ENDED:
        setIsPlaying(false);
        onDisconnected?.();
        break;
    }
  }, [onConnected, onDisconnected]);

  /**
   * Start casting session
   */
  const startCasting = useCallback(async () => {
    if (!castContextRef.current) return false;

    try {
      await castContextRef.current.requestSession();
      return true;
    } catch (error) {
      console.error('[Chromecast] Failed to start session:', error);
      onError?.(error as Error);
      return false;
    }
  }, [onError]);

  /**
   * Stop casting session
   */
  const stopCasting = useCallback(() => {
    if (castContextRef.current) {
      castContextRef.current.endCurrentSession(true);
    }
  }, []);

  /**
   * Cast media to device
   */
  const castMedia = useCallback(async (
    url: string, 
    title?: string, 
    posterUrl?: string,
    startTime?: number
  ) => {
    if (!window.chrome?.cast?.media) return false;

    const session = castContextRef.current?.getCurrentSession();
    if (!session) {
      // Start session first
      const started = await startCasting();
      if (!started) return false;
    }

    try {
      const mediaInfo = new window.chrome.cast.media.MediaInfo(url, 'application/x-mpegurl');
      mediaInfo.metadata = new window.chrome.cast.media.GenericMediaMetadata();
      mediaInfo.metadata.title = title || 'Video';
      
      if (posterUrl) {
        mediaInfo.metadata.images = [{ url: posterUrl }];
      }

      const request = new window.chrome.cast.media.LoadRequest(mediaInfo);
      request.autoplay = true;
      request.currentTime = startTime || 0;

      const currentSession = castContextRef.current?.getCurrentSession();
      if (currentSession) {
        await currentSession.loadMedia(request);
        setIsPlaying(true);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[Chromecast] Failed to cast media:', error);
      onError?.(error as Error);
      return false;
    }
  }, [startCasting, onError]);

  /**
   * Control playback
   */
  const play = useCallback(() => {
    controllerRef.current?.playOrPause();
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => {
    controllerRef.current?.playOrPause();
    setIsPlaying(false);
  }, []);

  const stop = useCallback(() => {
    controllerRef.current?.stop();
    setIsPlaying(false);
  }, []);

  return {
    // State
    isAvailable,
    castState,
    isConnected: castState === 'connected',
    deviceName,
    isPlaying,

    // Actions
    startCasting,
    stopCasting,
    castMedia,
    play,
    pause,
    stop,
  };
}

export default useChromecast;
