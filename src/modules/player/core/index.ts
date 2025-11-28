/**
 * Player Core - Exports
 */

export { 
  PlayerStateMachine, 
  createPlayerStateMachine,
  type PlayerState,
  type PlayerEvent,
  type PlayerContext,
} from './PlayerStateMachine';

export { 
  telemetryService,
  default as TelemetryService,
  type PlaybackMetrics,
  type ErrorEvent,
  type BufferMetrics,
} from './TelemetryService';

export {
  BaseTechAdapter,
  NativeAdapter,
  HlsJsAdapter,
  detectCapabilities,
  selectBestTech,
  createAdapter,
  type TechType,
  type TechCapabilities,
  type TechAdapterEvents,
  type TechAdapterConfig,
} from './TechAdapter';

export {
  logger,
  default as Logger,
  type LogLevel,
  type LogEntry,
  type LogContext,
  type LoggerConfig,
} from './Logger';

export {
  deviceDetector,
  default as DeviceDetector,
  type Platform as DevicePlatform,
  type DeviceCapabilities,
  type DeviceInfo,
  type InputMethod,
} from './DeviceDetector';

export {
  qosMonitor,
  default as QoSMonitor,
  type QoSMetrics,
  type QoSReport,
} from './QoSMonitor';

export {
  remoteKeyMap,
  default as RemoteKeyMap,
  type RemoteAction,
  type Platform as RemotePlatform,
} from './RemoteKeyMap';
