/**
 * IPTV Player Module
 * 
 * Modular IPTV player with Video.js + HLS.js, CDN failover, EPG support,
 * and universal remote control (TV/Firestick/Desktop/Mobile).
 */

// Main Component
export { IptvPlayer, default } from './components';
export { EpgDisplay } from './components';

// Hooks
export { useVideoJs } from './hooks/useVideoJs';
export { useRemoteControl } from './hooks/useRemoteControl';
export { useEpg } from './hooks/useEpg';

// Services
export { PlaylistParser, playlistParser } from './services/playlistParser';
export { CdnFailoverService, cdnFailover } from './services/cdnFailover';
export { EpgService, epgService } from './services/epgService';
export { RemoteControlService, remoteControl } from './services/remoteControl';
export type { RemoteAction } from './services/remoteControl';

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
