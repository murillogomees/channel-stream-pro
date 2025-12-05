/**
 * StreamProtocolEngine Types
 * Enterprise-grade type definitions for stream detection, routing and failover
 */

// ============================================================================
// Protocol Detection Types
// ============================================================================

export type ProtocolType = 'hls' | 'ts' | 'dash' | 'mp4' | 'xtream' | 'unknown';

export interface ProtocolDetectionResult {
  protocol: ProtocolType;
  confidence: 'high' | 'medium' | 'low';
  detectionMethod: 'extension' | 'content-type' | 'pattern' | 'fallback';
  contentType?: string;
  originalUrl: string;
  normalizedUrl: string;
  metadata?: Record<string, unknown>;
}

export interface ContentTypeMapping {
  contentType: string;
  protocol: ProtocolType;
}

// ============================================================================
// Xtream API Types
// ============================================================================

export interface XtreamCredentials {
  server: string;
  username: string;
  password: string;
  port?: number;
}

export interface XtreamStreamInfo {
  streamId: string;
  streamType: 'live' | 'movie' | 'series';
  credentials: XtreamCredentials;
  originalUrl: string;
}

export interface XtreamNormalizedResult {
  hlsUrl: string;
  tsUrl: string;
  preferredUrl: string;
  preferredProtocol: ProtocolType;
  streamInfo: XtreamStreamInfo;
  isValid: boolean;
  error?: string;
}

// ============================================================================
// CDN Router Types
// ============================================================================

export type CdnEndpointType = 'proxy' | 'r2' | 'cf-stream' | 'origin';

export interface CdnEndpoint {
  type: CdnEndpointType;
  url: string;
  priority: number;
  available: boolean;
  latency?: number;
  lastChecked?: number;
}

export interface RouteDecision {
  selectedEndpoint: CdnEndpoint;
  allEndpoints: CdnEndpoint[];
  reason: string;
  timestamp: number;
  cacheable: boolean;
}

export interface FailoverPath {
  endpoints: CdnEndpoint[];
  currentIndex: number;
  maxRetries: number;
  retryDelay: number;
}

export interface CdnRouterConfig {
  proxyBaseUrl: string;
  r2BaseUrl: string;
  cfStreamBaseUrl: string;
  healthCheckTimeout: number;
  cacheDecisionMs: number;
  maxRetries: number;
}

// ============================================================================
// Health Check Types
// ============================================================================

export interface HealthCheckResult {
  endpoint: CdnEndpointType;
  healthy: boolean;
  latencyMs: number;
  statusCode?: number;
  error?: string;
  checkedAt: number;
}

export interface RouteHealthCache {
  results: Map<CdnEndpointType, HealthCheckResult>;
  lastFullCheck: number;
  preferredRoute?: CdnEndpointType;
}

// ============================================================================
// Stream Resolution Types
// ============================================================================

export interface StreamResolutionRequest {
  originalUrl: string;
  channelId?: string;
  forceProtocol?: ProtocolType;
  skipHealthCheck?: boolean;
  preferredCdn?: CdnEndpointType;
}

export interface StreamResolutionResult {
  finalUrl: string;
  protocol: ProtocolType;
  cdnEndpoint: CdnEndpointType;
  requiresMpegts: boolean;
  requiresHls: boolean;
  failoverPath: FailoverPath;
  detection: ProtocolDetectionResult;
  route: RouteDecision;
}

// ============================================================================
// Mpegts Loader Types
// ============================================================================

export interface MpegtsLoadDecision {
  shouldLoad: boolean;
  reason: string;
  protocol: ProtocolType;
  contentType?: string;
}

export interface MpegtsConfig {
  enableWorker: boolean;
  lazyLoad: boolean;
  lazyLoadMaxDuration: number;
  seekType: 'range' | 'param';
  liveBufferLatencyChasing: boolean;
  liveBufferLatencyMaxLatency: number;
  liveBufferLatencyMinRemain: number;
}

// ============================================================================
// Logging Types
// ============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface StreamEngineLog {
  level: LogLevel;
  module: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp: number;
}

export type LogHandler = (log: StreamEngineLog) => void;
