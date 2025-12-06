/**
 * IPTV Player Module
 * 
 * Modular IPTV player with Video.js + HLS.js, CDN failover, EPG support,
 * universal remote control (TV/Firestick/Desktop/Mobile), and advanced controls.
 */

// Main Component
export { IptvPlayer, default } from './components';
export { EpgDisplay } from './components';
export { TvFocusableButton } from './components/TvFocusableButton';
export { PlayerSettingsPanel, usePlayerSettings } from './components/PlayerSettingsPanel';
export { PlayerQuickControls } from './components/PlayerQuickControls';
export { GestureOverlay } from './components/GestureOverlay';
export { StatsOverlay } from './components/StatsOverlay';

// Hooks
export { useVideoJs } from './hooks/useVideoJs';
export { useRemoteControl } from './hooks/useRemoteControl';
export { useSmartTv } from './hooks/useSmartTv';
export { useEpg } from './hooks/useEpg';
export { useAdvancedPlayerControls } from './hooks/useAdvancedPlayerControls';
export { useTouchGestures } from './hooks/useTouchGestures';
export { useParentalControl } from './hooks/useParentalControl';

// Services
export { PlaylistParser, playlistParser } from './services/playlistParser';
export { CdnFailoverService, cdnFailover } from './services/cdnFailover';
export { EpgService, epgService } from './services/epgService';
export { RemoteControlService, remoteControl } from './services/remoteControl';
export { StreamOptimizerService, streamOptimizer } from './services/streamOptimizer';
export { smartTvDetection } from './services/smartTvDetection';
export type { RemoteAction } from './services/remoteControl';
export type { StreamProtocol, StreamSource, OptimizedStream } from './services/streamOptimizer';
export type { SmartTvPlatform, SmartTvInfo } from './services/smartTvDetection';

// Types
export type {
  IptvPlayerProps,
  IptvPlayerOptions,
  IptvPlayerEvent,
  IptvChannel,
  IptvPlaylist,
  EpgProgram,
  EpgData,
  CdnEndpoint,
  PlayResponse,
  PlayerMetrics,
  DrmConfig,
} from './types';

// Advanced Controls Types
export type {
  QualityLevel,
  AudioTrack,
  SubtitleTrack,
  VideoFilters,
  AspectRatio,
  AdvancedControlsState,
  PlayerStats,
} from './hooks/useAdvancedPlayerControls';

export type { PlayerSettings } from './components/PlayerSettingsPanel';
export type { GestureState, TouchGestureConfig } from './hooks/useTouchGestures';
export type { ParentalControlState } from './hooks/useParentalControl';
