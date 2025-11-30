/**
 * Enhanced ABR Service - Adaptive Bitrate with Smart Tuning
 * 
 * Features:
 * - Initial bitrate heuristic based on connection
 * - Aggressive up-switch when bandwidth improves
 * - Conservative down-switch to avoid quality drops
 */

import Hls from 'hls.js';
import { getQualityLabel, formatBitrate } from './abrService';

export interface ABRTuningConfig {
  // Initial bitrate selection
  initialBitrateMultiplier: number; // Start at X% of estimated bandwidth (default: 0.7)
  
  // Up-switch tuning (aggressive)
  upSwitchBandwidthThreshold: number; // Switch up when bandwidth is X% above current bitrate (default: 1.2)
  upSwitchMinBufferSeconds: number; // Min buffer before considering up-switch (default: 4)
  upSwitchSafetyFactor: number; // Safety margin for up-switch (default: 0.9)
  
  // Down-switch tuning (conservative)
  downSwitchBandwidthThreshold: number; // Switch down when bandwidth is X% below current bitrate (default: 0.6)
  downSwitchMinBufferSeconds: number; // Switch down immediately if buffer below this (default: 2)
  downSwitchGracePeriodMs: number; // Wait before switching down (default: 5000)
  downSwitchMinIntervalMs: number; // Minimum time between down-switches (default: 10000)
}

const DEFAULT_ABR_TUNING: ABRTuningConfig = {
  initialBitrateMultiplier: 0.7,
  upSwitchBandwidthThreshold: 1.2,
  upSwitchMinBufferSeconds: 4,
  upSwitchSafetyFactor: 0.9,
  downSwitchBandwidthThreshold: 0.6,
  downSwitchMinBufferSeconds: 2,
  downSwitchGracePeriodMs: 5000,
  downSwitchMinIntervalMs: 10000,
};

export interface ABRMetrics {
  currentBitrate: number;
  estimatedBandwidth: number;
  bufferLength: number;
  qualityLevel: number;
  qualityLabel: string;
  upSwitchCount: number;
  downSwitchCount: number;
  lastSwitchTime: number;
  bandwidthHistory: number[];
}

class EnhancedABRService {
  private hls: Hls | null = null;
  private config: ABRTuningConfig = DEFAULT_ABR_TUNING;
  private metrics: ABRMetrics = {
    currentBitrate: 0,
    estimatedBandwidth: 0,
    bufferLength: 0,
    qualityLevel: -1,
    qualityLabel: 'Auto',
    upSwitchCount: 0,
    downSwitchCount: 0,
    lastSwitchTime: 0,
    bandwidthHistory: [],
  };
  
  private lastDownSwitchTime: number = 0;
  private pendingDownSwitch: NodeJS.Timeout | null = null;
  private onLevelChange?: (level: number, label: string, direction: 'up' | 'down' | 'initial') => void;

  /**
   * Configure ABR tuning parameters
   */
  configure(config: Partial<ABRTuningConfig>): void {
    this.config = { ...DEFAULT_ABR_TUNING, ...config };
    console.log('[EnhancedABR] Configured with:', this.config);
  }

  /**
   * Attach to HLS instance with enhanced ABR logic
   */
  attach(
    hls: Hls, 
    onLevelChange?: (level: number, label: string, direction: 'up' | 'down' | 'initial') => void
  ): void {
    this.hls = hls;
    this.onLevelChange = onLevelChange;
    this.resetMetrics();

    // Disable HLS.js default ABR temporarily for our custom logic
    hls.config.abrEwmaDefaultEstimate = this.getInitialBandwidthEstimate();
    
    // Set aggressive up-switch
    hls.config.abrBandWidthUpFactor = this.config.upSwitchSafetyFactor;
    
    // Set conservative down-switch
    hls.config.abrBandWidthFactor = this.config.downSwitchBandwidthThreshold;

    // Listen for manifest parsed to set initial quality
    hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
      this.selectInitialLevel(data.levels);
    });

    // Listen for level switches
    hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
      this.handleLevelSwitch(data.level);
    });

    // Track bandwidth on fragment load
    hls.on(Hls.Events.FRAG_LOADED, () => {
      this.updateBandwidthMetrics();
      this.evaluateQualitySwitch();
    });

    // Monitor buffer for emergency down-switch
    hls.on(Hls.Events.BUFFER_APPENDED, () => {
      this.checkBufferHealth();
    });

    console.log('[EnhancedABR] Attached with tuned ABR logic');
  }

  /**
   * Detach from HLS instance
   */
  detach(): void {
    if (this.pendingDownSwitch) {
      clearTimeout(this.pendingDownSwitch);
      this.pendingDownSwitch = null;
    }
    this.hls = null;
    this.onLevelChange = undefined;
    this.resetMetrics();
  }

  /**
   * Get initial bandwidth estimate based on connection
   */
  private getInitialBandwidthEstimate(): number {
    const connection = (navigator as any).connection;
    
    if (connection) {
      // Use Network Information API if available
      const effectiveType = connection.effectiveType;
      const downlink = connection.downlink; // Mbps
      
      if (downlink) {
        return downlink * 1000000 * this.config.initialBitrateMultiplier;
      }
      
      // Fallback based on connection type
      switch (effectiveType) {
        case '4g': return 5000000; // 5 Mbps
        case '3g': return 1500000; // 1.5 Mbps
        case '2g': return 300000; // 300 Kbps
        default: return 3000000; // 3 Mbps default
      }
    }
    
    // No connection info, use conservative default
    return 3000000; // 3 Mbps
  }

  /**
   * Select initial quality level based on bandwidth heuristic
   */
  private selectInitialLevel(levels: any[]): void {
    if (!this.hls || levels.length === 0) return;

    const estimatedBandwidth = this.getInitialBandwidthEstimate();
    const targetBitrate = estimatedBandwidth * this.config.initialBitrateMultiplier;
    
    // Find best matching level (highest quality that fits bandwidth)
    let selectedLevel = 0;
    for (let i = levels.length - 1; i >= 0; i--) {
      if (levels[i].bitrate <= targetBitrate) {
        selectedLevel = i;
        break;
      }
    }

    // Start with this level
    this.hls.startLevel = selectedLevel;
    this.hls.nextLevel = selectedLevel;
    
    console.log(
      '[EnhancedABR] Initial level selected:',
      selectedLevel,
      getQualityLabel(levels[selectedLevel].height),
      '| Estimated bandwidth:',
      formatBitrate(estimatedBandwidth)
    );

    this.metrics.qualityLevel = selectedLevel;
    this.metrics.qualityLabel = getQualityLabel(levels[selectedLevel].height);
    this.onLevelChange?.(selectedLevel, this.metrics.qualityLabel, 'initial');
  }

  /**
   * Handle level switch events
   */
  private handleLevelSwitch(newLevel: number): void {
    if (!this.hls) return;

    const level = this.hls.levels[newLevel];
    if (!level) return;

    const previousLevel = this.metrics.qualityLevel;
    const direction = newLevel > previousLevel ? 'up' : 'down';
    
    this.metrics.qualityLevel = newLevel;
    this.metrics.currentBitrate = level.bitrate;
    this.metrics.qualityLabel = getQualityLabel(level.height);
    this.metrics.lastSwitchTime = Date.now();

    if (direction === 'up') {
      this.metrics.upSwitchCount++;
    } else if (previousLevel !== -1) {
      this.metrics.downSwitchCount++;
      this.lastDownSwitchTime = Date.now();
    }

    console.log(
      `[EnhancedABR] Quality ${direction}-switch:`,
      this.metrics.qualityLabel,
      formatBitrate(level.bitrate)
    );

    this.onLevelChange?.(newLevel, this.metrics.qualityLabel, direction);
  }

  /**
   * Update bandwidth metrics
   */
  private updateBandwidthMetrics(): void {
    if (!this.hls) return;

    this.metrics.estimatedBandwidth = this.hls.bandwidthEstimate;
    this.metrics.bandwidthHistory.push(this.hls.bandwidthEstimate);
    
    // Keep last 20 samples
    if (this.metrics.bandwidthHistory.length > 20) {
      this.metrics.bandwidthHistory.shift();
    }

    // Update buffer length
    const video = this.hls.media;
    if (video && video.buffered.length > 0) {
      const currentTime = video.currentTime;
      const bufferedEnd = video.buffered.end(video.buffered.length - 1);
      this.metrics.bufferLength = bufferedEnd - currentTime;
    }
  }

  /**
   * Evaluate if quality switch is needed
   */
  private evaluateQualitySwitch(): void {
    if (!this.hls || this.hls.currentLevel === -1) return;

    const currentLevel = this.hls.levels[this.hls.currentLevel];
    if (!currentLevel) return;

    const avgBandwidth = this.getAverageBandwidth();
    const currentBitrate = currentLevel.bitrate;

    // Check for up-switch opportunity (aggressive)
    if (avgBandwidth > currentBitrate * this.config.upSwitchBandwidthThreshold) {
      if (this.metrics.bufferLength >= this.config.upSwitchMinBufferSeconds) {
        const targetBitrate = avgBandwidth * this.config.upSwitchSafetyFactor;
        const betterLevel = this.findBetterLevel(targetBitrate);
        
        if (betterLevel !== null && betterLevel > this.hls.currentLevel) {
          console.log('[EnhancedABR] Aggressive up-switch triggered');
          this.hls.nextLevel = betterLevel;
        }
      }
    }
    
    // Check for down-switch need (conservative)
    if (avgBandwidth < currentBitrate * this.config.downSwitchBandwidthThreshold) {
      this.scheduleDownSwitch();
    } else {
      // Cancel any pending down-switch
      if (this.pendingDownSwitch) {
        clearTimeout(this.pendingDownSwitch);
        this.pendingDownSwitch = null;
      }
    }
  }

  /**
   * Get average bandwidth from history
   */
  private getAverageBandwidth(): number {
    if (this.metrics.bandwidthHistory.length === 0) {
      return this.metrics.estimatedBandwidth;
    }
    
    // Use weighted average (recent samples weighted more)
    const weights = this.metrics.bandwidthHistory.map((_, i) => i + 1);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    
    const weightedSum = this.metrics.bandwidthHistory.reduce(
      (sum, bw, i) => sum + bw * weights[i], 0
    );
    
    return weightedSum / totalWeight;
  }

  /**
   * Find better quality level for target bitrate
   */
  private findBetterLevel(targetBitrate: number): number | null {
    if (!this.hls) return null;

    const levels = this.hls.levels;
    let bestLevel: number | null = null;
    
    for (let i = levels.length - 1; i >= 0; i--) {
      if (levels[i].bitrate <= targetBitrate) {
        bestLevel = i;
        break;
      }
    }
    
    return bestLevel;
  }

  /**
   * Schedule conservative down-switch
   */
  private scheduleDownSwitch(): void {
    if (this.pendingDownSwitch) return; // Already scheduled
    
    const timeSinceLastDown = Date.now() - this.lastDownSwitchTime;
    if (timeSinceLastDown < this.config.downSwitchMinIntervalMs) {
      return; // Too soon since last down-switch
    }

    console.log('[EnhancedABR] Down-switch scheduled (conservative)');
    
    this.pendingDownSwitch = setTimeout(() => {
      if (!this.hls) return;
      
      const avgBandwidth = this.getAverageBandwidth();
      const lowerLevel = this.findBetterLevel(avgBandwidth * 0.8);
      
      if (lowerLevel !== null && lowerLevel < this.hls.currentLevel) {
        console.log('[EnhancedABR] Conservative down-switch executed');
        this.hls.nextLevel = lowerLevel;
      }
      
      this.pendingDownSwitch = null;
    }, this.config.downSwitchGracePeriodMs);
  }

  /**
   * Check buffer health for emergency actions
   */
  private checkBufferHealth(): void {
    if (!this.hls) return;

    // Emergency down-switch if buffer is critically low
    if (this.metrics.bufferLength < this.config.downSwitchMinBufferSeconds) {
      const currentLevel = this.hls.currentLevel;
      
      if (currentLevel > 0) {
        console.log('[EnhancedABR] Emergency down-switch - buffer critical');
        this.hls.nextLevel = Math.max(0, currentLevel - 1);
        this.lastDownSwitchTime = Date.now();
      }
    }
  }

  /**
   * Reset metrics
   */
  private resetMetrics(): void {
    this.metrics = {
      currentBitrate: 0,
      estimatedBandwidth: 0,
      bufferLength: 0,
      qualityLevel: -1,
      qualityLabel: 'Auto',
      upSwitchCount: 0,
      downSwitchCount: 0,
      lastSwitchTime: 0,
      bandwidthHistory: [],
    };
    this.lastDownSwitchTime = 0;
  }

  /**
   * Get current metrics
   */
  getMetrics(): ABRMetrics {
    return { ...this.metrics };
  }

  /**
   * Get current config
   */
  getConfig(): ABRTuningConfig {
    return { ...this.config };
  }
}

export const enhancedABRService = new EnhancedABRService();
export default enhancedABRService;
