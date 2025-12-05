/**
 * IPTV Player Module
 * 
 * Modular IPTV player with Video.js + HLS.js, CDN failover, EPG support,
 * and universal remote control (TV/Firestick/Desktop/Mobile).
 */

// Main Component
export { IptvPlayer, default } from './components';
export { EpgDisplay } from './components';
export { TvFocusableButton } from './components/TvFocusableButton';

// Hooks
export { useVideoJs } from './hooks/useVideoJs';
export { useRemoteControl } from './hooks/useRemoteControl';
export { useSmartTv } from './hooks/useSmartTv';
export { useEpg } from './hooks/useEpg';

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
