/**
 * ============================================================================
 * Error Recovery Service - Streaming Error Handling
 * ============================================================================
 * 
 * Implementa retry automático com fallback de qualidade para erros de streaming.
 * Estratégias: retry exponencial, fallback de qualidade, URL alternativa.
 */

import Hls from 'hls.js';

// =============================================================================
// TYPES
// =============================================================================

export type ErrorSeverity = 'recoverable' | 'fatal';
export type RecoveryAction = 'retry' | 'quality-fallback' | 'reload-manifest' | 'restart' | 'give-up';

export interface StreamError {
  type: string;
  details: string;
  fatal: boolean;
  url?: string;
  response?: { code: number; text: string };
  timestamp: number;
}

export interface RecoveryAttempt {
  action: RecoveryAction;
  timestamp: number;
  success: boolean;
  error?: StreamError;
}

export interface RecoveryConfig {
  maxRetries: number;
  retryDelayMs: number;
  maxRetryDelayMs: number;
  enableQualityFallback: boolean;
  enableManifestReload: boolean;
  cooldownMs: number;
}

export interface RecoveryStats {
  totalErrors: number;
  recoveredErrors: number;
  fatalErrors: number;
  qualityFallbacks: number;
  manifestReloads: number;
  averageRecoveryTimeMs: number;
}

export interface RecoveryCallback {
  onRecoveryStart: (error: StreamError, action: RecoveryAction) => void;
  onRecoverySuccess: (error: StreamError, action: RecoveryAction) => void;
  onRecoveryFailed: (error: StreamError, action: RecoveryAction) => void;
  onFatalError: (error: StreamError) => void;
}

// =============================================================================
// DEFAULT CONFIG
// =============================================================================

const DEFAULT_CONFIG: RecoveryConfig = {
  maxRetries: 3,
  retryDelayMs: 1000,
  maxRetryDelayMs: 8000,
  enableQualityFallback: true,
  enableManifestReload: true,
  cooldownMs: 5000,
};

// =============================================================================
// ERROR RECOVERY SERVICE CLASS
// =============================================================================

class ErrorRecoveryService {
  private hls: Hls | null = null;
  private config: RecoveryConfig = DEFAULT_CONFIG;
  private retryCount: number = 0;
  private lastErrorTime: number = 0;
  private currentQualityLevel: number = -1;
  private lowestQualityLevel: number = 0;
  private recoveryHistory: RecoveryAttempt[] = [];
  private stats: RecoveryStats = {
    totalErrors: 0,
    recoveredErrors: 0,
    fatalErrors: 0,
    qualityFallbacks: 0,
    manifestReloads: 0,
    averageRecoveryTimeMs: 0,
  };
  private callbacks: Partial<RecoveryCallback> = {};
  private recoveryStartTime: number = 0;
  private isRecovering: boolean = false;

  /**
   * Attach to HLS instance
   */
  attach(hls: Hls, config: Partial<RecoveryConfig> = {}, callbacks: Partial<RecoveryCallback> = {}): void {
    this.hls = hls;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.callbacks = callbacks;
    this.resetState();

    // Store quality level info
    hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
      this.lowestQualityLevel = data.levels.length - 1;
      console.log('[Recovery] Manifest parsed, levels:', data.levels.length);
    });

    hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
      this.currentQualityLevel = data.level;
    });

    // Handle errors
    hls.on(Hls.Events.ERROR, (_event, data) => {
      this.handleError(data);
    });

    console.log('[Recovery] Attached to HLS instance');
  }

  /**
   * Detach from HLS instance
   */
  detach(): void {
    this.hls = null;
    this.callbacks = {};
    console.log('[Recovery] Detached');
  }

  /**
   * Reset recovery state
   */
  private resetState(): void {
    this.retryCount = 0;
    this.isRecovering = false;
    this.recoveryStartTime = 0;
  }

  /**
   * Handle HLS error
   */
  private handleError(data: any): void {
    const error: StreamError = {
      type: data.type,
      details: data.details,
      fatal: data.fatal,
      url: data.url,
      response: data.response,
      timestamp: Date.now(),
    };

    this.stats.totalErrors++;
    console.log('[Recovery] Error:', error.type, error.details, 'fatal:', error.fatal);

    // Check cooldown
    if (Date.now() - this.lastErrorTime < this.config.cooldownMs && !error.fatal) {
      console.log('[Recovery] In cooldown, skipping');
      return;
    }

    this.lastErrorTime = Date.now();

    if (error.fatal) {
      this.handleFatalError(error);
    } else {
      this.handleRecoverableError(error);
    }
  }

  /**
   * Handle recoverable error
   */
  private handleRecoverableError(error: StreamError): void {
    if (this.retryCount >= this.config.maxRetries) {
      console.log('[Recovery] Max retries reached, treating as fatal');
      this.handleFatalError(error);
      return;
    }

    const action = this.determineRecoveryAction(error);
    this.executeRecovery(error, action);
  }

  /**
   * Handle fatal error
   */
  private handleFatalError(error: StreamError): void {
    if (this.isRecovering) return;
    this.isRecovering = true;
    this.recoveryStartTime = Date.now();

    const action = this.determineFatalRecoveryAction(error);
    
    if (action === 'give-up') {
      this.stats.fatalErrors++;
      this.callbacks.onFatalError?.(error);
      this.recordAttempt(action, false, error);
      this.isRecovering = false;
      return;
    }

    this.executeRecovery(error, action);
  }

  /**
   * Determine recovery action for non-fatal error
   */
  private determineRecoveryAction(error: StreamError): RecoveryAction {
    const { type, details } = error;

    // Network errors - retry
    if (type === Hls.ErrorTypes.NETWORK_ERROR) {
      if (details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR) {
        return 'reload-manifest';
      }
      return 'retry';
    }

    // Media errors - try quality fallback
    if (type === Hls.ErrorTypes.MEDIA_ERROR) {
      if (this.config.enableQualityFallback && this.canFallbackQuality()) {
        return 'quality-fallback';
      }
      return 'retry';
    }

    return 'retry';
  }

  /**
   * Determine recovery action for fatal error
   */
  private determineFatalRecoveryAction(error: StreamError): RecoveryAction {
    const { type, details } = error;

    // Already tried everything
    if (this.retryCount >= this.config.maxRetries) {
      return 'give-up';
    }

    // Network errors
    if (type === Hls.ErrorTypes.NETWORK_ERROR) {
      if (details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR) {
        return this.config.enableManifestReload ? 'reload-manifest' : 'restart';
      }
      if (details === Hls.ErrorDetails.FRAG_LOAD_ERROR) {
        return this.config.enableQualityFallback && this.canFallbackQuality() 
          ? 'quality-fallback' 
          : 'restart';
      }
      return 'restart';
    }

    // Media errors
    if (type === Hls.ErrorTypes.MEDIA_ERROR) {
      return 'restart';
    }

    return 'give-up';
  }

  /**
   * Check if we can fallback to lower quality
   */
  private canFallbackQuality(): boolean {
    return this.currentQualityLevel < this.lowestQualityLevel;
  }

  /**
   * Execute recovery action
   */
  private async executeRecovery(error: StreamError, action: RecoveryAction): Promise<void> {
    if (!this.hls) return;

    this.retryCount++;
    const delay = this.calculateRetryDelay();

    console.log('[Recovery] Executing:', action, 'attempt:', this.retryCount, 'delay:', delay);
    this.callbacks.onRecoveryStart?.(error, action);

    await this.sleep(delay);

    try {
      switch (action) {
        case 'retry':
          this.hls.startLoad();
          break;

        case 'quality-fallback':
          this.fallbackQuality();
          this.stats.qualityFallbacks++;
          break;

        case 'reload-manifest':
          this.reloadManifest();
          this.stats.manifestReloads++;
          break;

        case 'restart':
          this.restartPlayback();
          break;

        default:
          throw new Error(`Unknown action: ${action}`);
      }

      // Success tracking
      setTimeout(() => {
        if (!this.isRecovering) return;
        
        const recoveryTime = Date.now() - this.recoveryStartTime;
        this.stats.recoveredErrors++;
        this.updateAverageRecoveryTime(recoveryTime);
        
        this.callbacks.onRecoverySuccess?.(error, action);
        this.recordAttempt(action, true, error);
        this.resetState();
      }, 2000); // Wait 2s to confirm recovery

    } catch (err) {
      console.error('[Recovery] Action failed:', err);
      this.callbacks.onRecoveryFailed?.(error, action);
      this.recordAttempt(action, false, error);
      
      // Try next action
      if (this.retryCount < this.config.maxRetries) {
        this.handleFatalError(error);
      } else {
        this.stats.fatalErrors++;
        this.callbacks.onFatalError?.(error);
        this.isRecovering = false;
      }
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(): number {
    const baseDelay = this.config.retryDelayMs;
    const maxDelay = this.config.maxRetryDelayMs;
    const exponentialDelay = baseDelay * Math.pow(2, this.retryCount - 1);
    return Math.min(exponentialDelay, maxDelay);
  }

  /**
   * Fallback to lower quality level
   */
  private fallbackQuality(): void {
    if (!this.hls) return;

    const newLevel = Math.min(this.currentQualityLevel + 1, this.lowestQualityLevel);
    console.log('[Recovery] Falling back quality from', this.currentQualityLevel, 'to', newLevel);
    
    this.hls.currentLevel = newLevel;
    this.hls.nextLevel = newLevel;
    this.hls.startLoad();
  }

  /**
   * Reload manifest
   */
  private reloadManifest(): void {
    if (!this.hls) return;

    console.log('[Recovery] Reloading manifest');
    const currentSrc = (this.hls as any).url;
    
    if (currentSrc) {
      this.hls.loadSource(currentSrc);
      this.hls.startLoad();
    }
  }

  /**
   * Restart playback completely
   */
  private restartPlayback(): void {
    if (!this.hls) return;

    console.log('[Recovery] Restarting playback');
    this.hls.recoverMediaError();
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Record recovery attempt
   */
  private recordAttempt(action: RecoveryAction, success: boolean, error?: StreamError): void {
    this.recoveryHistory.push({
      action,
      timestamp: Date.now(),
      success,
      error,
    });

    // Keep only last 50 attempts
    if (this.recoveryHistory.length > 50) {
      this.recoveryHistory.shift();
    }
  }

  /**
   * Update average recovery time
   */
  private updateAverageRecoveryTime(newTime: number): void {
    const successCount = this.stats.recoveredErrors;
    const currentAvg = this.stats.averageRecoveryTimeMs;
    this.stats.averageRecoveryTimeMs = 
      (currentAvg * (successCount - 1) + newTime) / successCount;
  }

  /**
   * Get recovery statistics
   */
  getStats(): RecoveryStats {
    return { ...this.stats };
  }

  /**
   * Get recovery history
   */
  getHistory(): RecoveryAttempt[] {
    return [...this.recoveryHistory];
  }

  /**
   * Get recovery rate
   */
  getRecoveryRate(): number {
    const total = this.stats.totalErrors;
    if (total === 0) return 100;
    return Math.round((this.stats.recoveredErrors / total) * 100);
  }

  /**
   * Check if currently recovering
   */
  isInRecovery(): boolean {
    return this.isRecovering;
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalErrors: 0,
      recoveredErrors: 0,
      fatalErrors: 0,
      qualityFallbacks: 0,
      manifestReloads: 0,
      averageRecoveryTimeMs: 0,
    };
    this.recoveryHistory = [];
    this.retryCount = 0;
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const errorRecoveryService = new ErrorRecoveryService();
export default errorRecoveryService;
