/**
 * IPTV Player Types
 */

export interface IptvPlayerProps {
  playlistUrl?: string;
  /** Direct stream URL - bypasses playlist loading */
  streamUrl?: string;
  channelId?: string;
  /** Channel name for display when using direct streamUrl */
  channelName?: string;
  /** Channel logo for display when using direct streamUrl */
  channelLogo?: string;
  epgUrl?: string;
  authToken?: string;
  options?: IptvPlayerOptions;
  onEvent?: (evt: IptvPlayerEvent, data?: any) => void;
  className?: string;
}

export interface IptvPlayerOptions {
  cdnFallback?: string[];
  maxRetries?: number;
  preferLowLatency?: boolean;
  drm?: DrmConfig;
  autoplay?: boolean;
  muted?: boolean;
  poster?: string;
}

export interface DrmConfig {
  type: 'widevine' | 'fairplay' | 'playready';
  licenseUri: string;
  certificateUri?: string;
}

export type IptvPlayerEvent = 
  | 'play' 
  | 'pause' 
  | 'buffering' 
  | 'ready'
  | 'error' 
  | 'cdnswitch'
  | 'qualitychange'
  | 'timeupdate'
  | 'ended'
  | 'channelchange'
  | 'back';

export interface IptvChannel {
  id: string;
  name: string;
  url: string;
  logo?: string;
  group?: string;
  tvgId?: string;
  tvgName?: string;
  catchup?: string;
  catchupDays?: number;
}

export interface IptvPlaylist {
  channels: IptvChannel[];
  groups: string[];
  metadata?: {
    name?: string;
    url?: string;
    lastUpdated?: Date;
  };
}

export interface EpgProgram {
  id: string;
  channelId: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  category?: string;
  icon?: string;
}

export interface EpgData {
  programs: EpgProgram[];
  channels: Map<string, EpgProgram[]>;
}

export interface CdnEndpoint {
  url: string;
  priority: number;
  region?: string;
  type: 'r2' | 'cf-stream' | 'origin' | 'proxy';
}

export interface PlayResponse {
  url: string;
  cdnList: CdnEndpoint[];
  expiresAt: string;
  token?: string;
}

export interface PlayerMetrics {
  bufferLength: number;
  droppedFrames: number;
  currentBitrate: number;
  latency: number;
  loadTime: number;
  cdnSwitches: number;
  errors: number;
}
