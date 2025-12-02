/**
 * Core Player Types
 * Enterprise IPTV Platform - Type Definitions
 */

// ============= PLAYER STATE MACHINE =============

export enum PlayerState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  LOADED = 'LOADED',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  BUFFERING = 'BUFFERING',
  ERROR = 'ERROR',
  ENDED = 'ENDED',
}

export enum PlayerEvent {
  LOAD = 'LOAD',
  PLAY = 'PLAY',
  PAUSE = 'PAUSE',
  BUFFER = 'BUFFER',
  ERROR = 'ERROR',
  END = 'END',
  SEEK = 'SEEK',
  RETRY = 'RETRY',
}

export interface StateTransition {
  from: PlayerState;
  to: PlayerState;
  event: PlayerEvent;
  timestamp: number;
}

// ============= TECH ADAPTER =============

export enum TechType {
  HLS_JS = 'HLS_JS',
  NATIVE = 'NATIVE',
  MPEGTS = 'MPEGTS',
}

export interface TechConfig {
  type: TechType;
  autoRecovery: boolean;
  maxRetries: number;
  debug: boolean;
}

export interface StreamMetadata {
  url: string;
  type: 'live' | 'vod';
  protocol: 'hls' | 'mpegts' | 'http';
  duration?: number;
}

// ============= QoS MONITOR =============

export interface QoSMetrics {
  timestamp: number;
  bufferedSeconds: number;
  droppedFrames: number;
  currentBitrate: number;
  latency: number;
  bufferHealth: number; // 0-100
  videoResolution: string;
  audioCodec: string;
  videoCodec: string;
}

export interface QoSEvent {
  type: 'buffer_empty' | 'buffer_full' | 'bitrate_change' | 'quality_change' | 'error';
  timestamp: number;
  data: Record<string, unknown>;
}

// ============= DEVICE DETECTOR =============

export enum DevicePlatform {
  TIZEN = 'TIZEN',
  WEBOS = 'WEBOS',
  ANDROID_TV = 'ANDROID_TV',
  FIRE_TV = 'FIRE_TV',
  BROWSER_DESKTOP = 'BROWSER_DESKTOP',
  BROWSER_MOBILE = 'BROWSER_MOBILE',
  IOS = 'IOS',
  ANDROID = 'ANDROID',
  UNKNOWN = 'UNKNOWN',
}

export interface DeviceCapabilities {
  platform: DevicePlatform;
  hasHLS: boolean;
  hasMSE: boolean;
  hasNativeControls: boolean;
  supportsFullscreen: boolean;
  maxResolution: string;
  hasRemoteControl: boolean;
  screenSize: { width: number; height: number };
  isTV: boolean;
  isMobile: boolean;
  isDesktop: boolean;
}

// ============= REMOTE KEY MAP =============

export enum UniversalKey {
  UP = 'UP',
  DOWN = 'DOWN',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
  ENTER = 'ENTER',
  BACK = 'BACK',
  PLAY_PAUSE = 'PLAY_PAUSE',
  STOP = 'STOP',
  REWIND = 'REWIND',
  FAST_FORWARD = 'FAST_FORWARD',
  VOLUME_UP = 'VOLUME_UP',
  VOLUME_DOWN = 'VOLUME_DOWN',
  MUTE = 'MUTE',
  CHANNEL_UP = 'CHANNEL_UP',
  CHANNEL_DOWN = 'CHANNEL_DOWN',
  HOME = 'HOME',
  MENU = 'MENU',
  INFO = 'INFO',
}

export interface KeyMapping {
  keyCode?: number;
  key?: string;
  code?: string;
  universalKey: UniversalKey;
}

// ============= LOGGER =============

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  FATAL = 'FATAL',
}

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  component: string;
  message: string;
  context?: Record<string, unknown>;
  error?: Error;
  stackTrace?: string;
}

// ============= PLAYER EVENTS =============

export interface PlayerEventPayload {
  state?: PlayerState;
  error?: Error;
  metrics?: QoSMetrics;
  metadata?: StreamMetadata;
  timestamp: number;
}
