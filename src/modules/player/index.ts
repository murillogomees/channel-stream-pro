/**
 * ============================================================================
 * Player Module - Exports
 * ============================================================================
 * 
 * Módulo de player IPTV universal enterprise.
 */

// Components
export { default as UniversalPlayer } from '@/components/app/UniversalPlayer';
export { default as TVFocusableCard } from './components/TVFocusableCard';
export { TVGridLayout, TVChannelGrid as TVChannelGridLayout, TVMovieGrid, TVCompactGrid } from './components/TVGridLayout';
export { default as PlayerOverlay } from './components/PlayerOverlay';
export { VideoPlayer } from '@/components/player/VideoPlayer';

// Core exports
export {
  PlayerStateMachine,
  createPlayerStateMachine,
  TelemetryService,
  telemetryService,
  BaseTechAdapter,
  NativeAdapter,
  HlsJsAdapter,
  detectCapabilities,
  selectBestTech,
  createAdapter,
  DeviceDetector,
  deviceDetector,
  QoSMonitor,
  qosMonitor,
  RemoteKeyMap,
  remoteKeyMap,
  Logger,
  logger,
  type PlayerState,
  type PlayerContext,
  type PlayerEvent,
  type PlaybackMetrics,
  type ErrorEvent,
  type BufferMetrics,
  type TechType as CoreTechType,
  type TechCapabilities,
  type TechAdapterEvents,
  type TechAdapterConfig,
  type DeviceInfo,
  type DevicePlatform,
  type InputMethod,
  type DeviceCapabilities,
  type QoSMetrics,
  type QoSReport,
  type RemoteAction as CoreRemoteAction,
  type RemotePlatform,
  type LogLevel,
  type LogEntry,
  type LogContext,
  type LoggerConfig,
} from './core';

// M3U Pipeline exports
export {
  M3UParser,
  m3uParser,
  parseM3U,
  M3UValidator,
  m3uValidator,
  validateM3U,
  M3USanitizer,
  m3uSanitizer,
  sanitizeM3U,
  M3ULoader,
  m3uLoader,
  loadM3U,
  type M3UChannel,
  type M3UCategory,
  type M3UParseResult,
  type ValidationResult,
  type SanitizeResult,
  type LoadResult,
} from './m3u';

// Engine exports
export {
  PlayerEngine,
  createPlayerEngine,
  type EngineState,
  type TechType as EngineTechType,
  type EngineConfig,
  type EngineEvents,
  type EngineError,
  type EngineMetrics,
} from './engine';

// TV UI Components
export { TVChannelGrid } from './ui/TVChannelGrid';
export { TVPlayerOverlay } from './ui/TVPlayerOverlay';

// Services
export { streamService, type Channel, type Category, type M3UFetchResult, type StreamHealthResult } from './services';
export { focusManager, default as FocusManager } from './FocusManager';

// Hooks - Focus
export {
  useFocusable,
  useFocusGroup,
  useFocusManagerInit,
  useBackHandler,
  useCurrentFocus,
} from './hooks/useFocusManager';

// Hooks - Player
export { usePlayerController, type PlayerState as PlayerControllerState, type PlayerControls } from './hooks/usePlayerController';
export { useRemoteInput, type RemoteAction } from './hooks/useRemoteInput';
export { useIPTVPlaylist, type PlaylistState, type PlaylistFilters } from './hooks/useIPTVPlaylist';
