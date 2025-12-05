/**
 * StreamProtocolEngine
 * Enterprise-grade stream detection, routing, and failover system
 * 
 * @module stream-engine
 * @version 1.0.0
 * 
 * Architecture:
 * - ProtocolDetector: Detects stream protocols without heuristics
 * - XtreamNormalizer: Transforms Xtream API URLs to playable streams
 * - CdnRouter: Routes streams to best available CDN
 * - RouteHealthChecker: Async health checks with caching
 * - MpegtsLoader: Intelligent mpegts.js loading
 */

import { ProtocolDetector, getProtocolDetector, detectStreamType, detectStreamTypeSync } from './protocol-detector';
import { XtreamNormalizer, getXtreamNormalizer, normalizeXtreamUrl, isXtreamUrl } from './xtream-normalizer';
import { CdnRouter, getCdnRouter, routeStream, createFailoverPath } from './cdn-router';
import { RouteHealthChecker, getRouteHealthChecker, checkEndpointHealth, getPreferredRoute } from './route-health';
import { MpegtsLoader, getMpegtsLoader, shouldUseMpegts, createMpegtsPlayer } from './mpegts-loader';

import type {
  ProtocolType,
  ProtocolDetectionResult,
  XtreamNormalizedResult,
  CdnEndpoint,
  CdnEndpointType,
  RouteDecision,
  FailoverPath,
  HealthCheckResult,
  StreamResolutionRequest,
  StreamResolutionResult,
  MpegtsLoadDecision,
  LogHandler,
  StreamEngineLog,
} from './types';

// Re-export types
export type {
  ProtocolType,
  ProtocolDetectionResult,
  XtreamNormalizedResult,
  CdnEndpoint,
  CdnEndpointType,
  RouteDecision,
  FailoverPath,
  HealthCheckResult,
  StreamResolutionRequest,
  StreamResolutionResult,
  MpegtsLoadDecision,
  LogHandler,
  StreamEngineLog,
};

// Re-export classes
export {
  ProtocolDetector,
  XtreamNormalizer,
  CdnRouter,
  RouteHealthChecker,
  MpegtsLoader,
};

// Re-export singleton getters
export {
  getProtocolDetector,
  getXtreamNormalizer,
  getCdnRouter,
  getRouteHealthChecker,
  getMpegtsLoader,
};

// Re-export utility functions
export {
  detectStreamType,
  detectStreamTypeSync,
  normalizeXtreamUrl,
  isXtreamUrl,
  routeStream,
  createFailoverPath,
  checkEndpointHealth,
  getPreferredRoute,
  shouldUseMpegts,
  createMpegtsPlayer,
};

/**
 * StreamProtocolEngine - Main facade for stream resolution
 */
export class StreamProtocolEngine {
  private protocolDetector: ProtocolDetector;
  private xtreamNormalizer: XtreamNormalizer;
  private cdnRouter: CdnRouter;
  private mpegtsLoader: MpegtsLoader;
  private logHandler?: LogHandler;

  constructor(options?: {
    logHandler?: LogHandler;
  }) {
    this.logHandler = options?.logHandler;
    this.protocolDetector = getProtocolDetector({ logHandler: options?.logHandler });
    this.xtreamNormalizer = getXtreamNormalizer({ logHandler: options?.logHandler });
    this.cdnRouter = getCdnRouter({ logHandler: options?.logHandler });
    this.mpegtsLoader = getMpegtsLoader({ logHandler: options?.logHandler });
  }

  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>) {
    this.logHandler?.({
      level,
      module: 'StreamProtocolEngine',
      message,
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Main entry point - Resolve a stream URL to a playable configuration
   */
  async resolveStream(request: StreamResolutionRequest): Promise<StreamResolutionResult> {
    const { originalUrl, channelId, forceProtocol, skipHealthCheck, preferredCdn } = request;

    this.log('info', 'Resolving stream', { originalUrl, channelId });

    // Step 1: Detect protocol
    let detection = await this.protocolDetector.detectStreamType(originalUrl);
    let workingUrl = originalUrl;

    // Step 2: Handle Xtream URLs
    if (detection.protocol === 'xtream') {
      this.log('info', 'Xtream URL detected, normalizing');
      const normalized = await this.xtreamNormalizer.normalize(originalUrl);
      
      if (normalized.isValid) {
        workingUrl = normalized.preferredUrl;
        // Re-detect with normalized URL
        detection = await this.protocolDetector.detectStreamType(workingUrl);
        detection.metadata = {
          ...detection.metadata,
          xtreamInfo: normalized.streamInfo,
        };
      }
    }

    // Override protocol if forced
    if (forceProtocol) {
      detection = { ...detection, protocol: forceProtocol };
    }

    // Step 3: Route through CDN
    const route = await this.cdnRouter.route({
      originalUrl: workingUrl,
      channelId,
      protocol: detection.protocol,
      forceEndpoint: preferredCdn,
      skipHealthCheck,
    });

    // Step 4: Create failover path
    const failoverPath = await this.cdnRouter.createFailoverPath({
      originalUrl: workingUrl,
      channelId,
      protocol: detection.protocol,
    });

    // Step 5: Determine player requirements
    const requiresMpegts = await this.shouldUseMpegts(route.selectedEndpoint.url, detection.protocol);
    const requiresHls = detection.protocol === 'hls';

    const result: StreamResolutionResult = {
      finalUrl: route.selectedEndpoint.url,
      protocol: detection.protocol,
      cdnEndpoint: route.selectedEndpoint.type,
      requiresMpegts,
      requiresHls,
      failoverPath,
      detection,
      route,
    };

    this.log('info', 'Stream resolved', {
      finalUrl: result.finalUrl,
      protocol: result.protocol,
      cdn: result.cdnEndpoint,
      requiresMpegts: result.requiresMpegts,
    });

    return result;
  }

  /**
   * Quick synchronous resolution (no network calls)
   */
  resolveStreamSync(request: StreamResolutionRequest): Partial<StreamResolutionResult> {
    const { originalUrl, channelId, forceProtocol } = request;
    
    let detection = this.protocolDetector.detectStreamTypeSync(originalUrl);
    let workingUrl = originalUrl;

    // Handle Xtream
    if (detection.protocol === 'xtream') {
      // For sync, we just check if it's Xtream and assume HLS
      detection = {
        ...detection,
        protocol: 'hls',
        metadata: { isXtream: true },
      };
    }

    if (forceProtocol) {
      detection = { ...detection, protocol: forceProtocol };
    }

    // For sync, always use proxy
    const proxyUrl = `https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/stream-proxy?url=${encodeURIComponent(workingUrl)}`;

    return {
      finalUrl: proxyUrl,
      protocol: detection.protocol,
      cdnEndpoint: 'proxy',
      requiresMpegts: detection.protocol === 'ts',
      requiresHls: detection.protocol === 'hls',
      detection,
    };
  }

  /**
   * Check if mpegts.js should be used
   */
  private async shouldUseMpegts(url: string, protocol: ProtocolType): Promise<boolean> {
    if (protocol !== 'ts') return false;
    const decision = await this.mpegtsLoader.shouldLoadMpegts({ url, protocol });
    return decision.shouldLoad;
  }

  /**
   * Handle playback error and get next failover URL
   */
  async handlePlaybackError(failoverPath: FailoverPath, error: Error): Promise<CdnEndpoint | null> {
    this.log('warn', 'Playback error, attempting failover', { 
      error: error.message,
      currentIndex: failoverPath.currentIndex,
    });

    const nextEndpoint = this.cdnRouter.getNextEndpoint(failoverPath);
    
    if (nextEndpoint) {
      this.log('info', 'Failover to next endpoint', { 
        type: nextEndpoint.type,
        url: nextEndpoint.url,
      });
    } else {
      this.log('error', 'All failover options exhausted');
    }

    return nextEndpoint;
  }

  /**
   * Preload mpegts.js for TS streams
   */
  async preloadMpegts(): Promise<void> {
    await this.mpegtsLoader.loadMpegts();
  }

  /**
   * Run health check on all CDN endpoints
   */
  async runHealthCheck(testUrl?: string): Promise<void> {
    await this.cdnRouter.getHealthChecker().checkAllEndpoints(testUrl);
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.protocolDetector.clearCache();
    this.cdnRouter.clearCache();
    this.cdnRouter.getHealthChecker().clearCache();
    this.log('info', 'All caches cleared');
  }

  /**
   * Get engine status
   */
  getStatus(): {
    protocolDetectorCache: { size: number; maxAge: number };
    healthStatus: { preferredRoute: CdnEndpointType; lastCheck: number };
    mpegtsLoaded: boolean;
  } {
    return {
      protocolDetectorCache: this.protocolDetector.getCacheStats(),
      healthStatus: {
        preferredRoute: this.cdnRouter.getHealthChecker().getPreferredRoute(),
        lastCheck: this.cdnRouter.getHealthChecker().getHealthStatus().lastFullCheck,
      },
      mpegtsLoaded: this.mpegtsLoader.isLoaded(),
    };
  }
}

// Singleton engine instance
let engineInstance: StreamProtocolEngine | null = null;

export function getStreamEngine(options?: {
  logHandler?: LogHandler;
}): StreamProtocolEngine {
  if (!engineInstance) {
    engineInstance = new StreamProtocolEngine(options);
  }
  return engineInstance;
}

// Default export
export default StreamProtocolEngine;

/**
 * Technical Manual
 * ================
 * 
 * ## Module Communication Flow
 * 
 * 1. StreamProtocolEngine.resolveStream(request)
 *    └── ProtocolDetector.detectStreamType(url)
 *        └── Returns: ProtocolDetectionResult
 *    └── [If Xtream] XtreamNormalizer.normalize(url)
 *        └── Returns: XtreamNormalizedResult
 *    └── CdnRouter.route(options)
 *        └── RouteHealthChecker.checkAllEndpoints()
 *        └── Returns: RouteDecision
 *    └── MpegtsLoader.shouldLoadMpegts(options)
 *        └── Returns: MpegtsLoadDecision
 *    └── Returns: StreamResolutionResult
 * 
 * ## Integration with Player
 * 
 * ```typescript
 * import { getStreamEngine } from '@/modules/player/stream-engine';
 * 
 * const engine = getStreamEngine({
 *   logHandler: (log) => console.log(`[${log.module}]`, log.message, log.data)
 * });
 * 
 * // Resolve stream
 * const result = await engine.resolveStream({
 *   originalUrl: channelUrl,
 *   channelId: channel.id,
 * });
 * 
 * // Use result
 * if (result.requiresMpegts) {
 *   // Use mpegts.js player
 *   const player = await createMpegtsPlayer(result.finalUrl);
 * } else if (result.requiresHls) {
 *   // Use HLS.js or native
 * } else {
 *   // Use Video.js native
 * }
 * 
 * // Handle errors with failover
 * player.on('error', async (error) => {
 *   const nextEndpoint = await engine.handlePlaybackError(result.failoverPath, error);
 *   if (nextEndpoint) {
 *     player.src(nextEndpoint.url);
 *   }
 * });
 * ```
 * 
 * ## Key Design Decisions
 * 
 * 1. NO port-based heuristics - Protocol is detected by extension, Content-Type, or pattern
 * 2. Xtream URLs are NOT assumed to be TS - They are normalized to HLS when possible
 * 3. mpegts.js is ONLY loaded when confirmed TS stream via Content-Type
 * 4. CDN routing respects health checks and caches decisions
 * 5. All modules are decoupled and can be used independently
 */
