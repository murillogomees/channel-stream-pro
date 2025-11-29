/**
 * ============================================================================
 * ABR Service - Adaptive Bitrate Management
 * ============================================================================
 * 
 * Gerencia qualidade adaptativa de vídeo:
 * - Detecção de níveis de qualidade disponíveis
 * - Troca automática baseada em bandwidth
 * - Preferências do usuário
 * - Métricas de performance
 */

import Hls from 'hls.js';

// =============================================================================
// TYPES
// =============================================================================

export interface QualityLevel {
  index: number;
  bitrate: number;
  height: number;
  width: number;
  codec?: string;
  label: string;
  isAuto: boolean;
}

export interface ABRConfig {
  defaultQuality: 'auto' | number; // 'auto' or quality index
  maxAutoBitrate?: number;
  minAutoBitrate?: number;
  preferredResolution?: number; // e.g., 1080, 720, 480
  enableABR: boolean;
}

export interface ABRStats {
  currentBitrate: number;
  estimatedBandwidth: number;
  bufferLength: number;
  droppedFrames: number;
  qualityChanges: number;
  averageBitrate: number;
}

export type ABRMode = 'auto' | 'manual';

// =============================================================================
// QUALITY LABEL HELPERS
// =============================================================================

export function getQualityLabel(height: number): string {
  if (height >= 2160) return '4K';
  if (height >= 1440) return '1440p';
  if (height >= 1080) return '1080p';
  if (height >= 720) return '720p';
  if (height >= 480) return '480p';
  if (height >= 360) return '360p';
  return `${height}p`;
}

export function getQualityBadge(height: number): { label: string; color: string } {
  if (height >= 2160) return { label: '4K UHD', color: 'bg-purple-500' };
  if (height >= 1080) return { label: 'Full HD', color: 'bg-blue-500' };
  if (height >= 720) return { label: 'HD', color: 'bg-green-500' };
  return { label: 'SD', color: 'bg-gray-500' };
}

export function formatBitrate(bitrate: number): string {
  if (bitrate >= 1000000) {
    return `${(bitrate / 1000000).toFixed(1)} Mbps`;
  }
  return `${Math.round(bitrate / 1000)} Kbps`;
}

// =============================================================================
// ABR SERVICE CLASS
// =============================================================================

class ABRService {
  private hls: Hls | null = null;
  private mode: ABRMode = 'auto';
  private manualLevel: number = -1;
  private stats: ABRStats = {
    currentBitrate: 0,
    estimatedBandwidth: 0,
    bufferLength: 0,
    droppedFrames: 0,
    qualityChanges: 0,
    averageBitrate: 0,
  };
  private bitrateHistory: number[] = [];
  private onQualityChange?: (level: QualityLevel) => void;

  /**
   * Attach to HLS instance
   */
  attach(hls: Hls, onQualityChange?: (level: QualityLevel) => void): void {
    this.hls = hls;
    this.onQualityChange = onQualityChange;
    
    // Listen for level changes
    hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
      const level = hls.levels[data.level];
      if (level) {
        this.stats.currentBitrate = level.bitrate;
        this.stats.qualityChanges++;
        this.bitrateHistory.push(level.bitrate);
        
        // Keep history limited
        if (this.bitrateHistory.length > 100) {
          this.bitrateHistory.shift();
        }
        
        // Calculate average
        this.stats.averageBitrate = Math.round(
          this.bitrateHistory.reduce((a, b) => a + b, 0) / this.bitrateHistory.length
        );
        
        console.log('[ABR] Level switched to:', getQualityLabel(level.height), formatBitrate(level.bitrate));
        
        if (this.onQualityChange) {
          this.onQualityChange(this.mapHlsLevel(data.level, level));
        }
      }
    });

    // Track bandwidth estimation
    hls.on(Hls.Events.FRAG_LOADED, (_event, data) => {
      this.stats.estimatedBandwidth = hls.bandwidthEstimate;
      this.stats.bufferLength = hls.media?.buffered.length 
        ? hls.media.buffered.end(hls.media.buffered.length - 1) - (hls.media?.currentTime || 0)
        : 0;
    });

    console.log('[ABR] Service attached to HLS instance');
  }

  /**
   * Detach from HLS instance
   */
  detach(): void {
    this.hls = null;
    this.onQualityChange = undefined;
    this.bitrateHistory = [];
    this.stats = {
      currentBitrate: 0,
      estimatedBandwidth: 0,
      bufferLength: 0,
      droppedFrames: 0,
      qualityChanges: 0,
      averageBitrate: 0,
    };
  }

  /**
   * Get available quality levels
   */
  getAvailableLevels(): QualityLevel[] {
    if (!this.hls) return [];

    const levels = this.hls.levels.map((level, index) => 
      this.mapHlsLevel(index, level)
    );

    // Add auto option at the beginning
    const autoLevel: QualityLevel = {
      index: -1,
      bitrate: 0,
      height: 0,
      width: 0,
      label: 'Auto',
      isAuto: true,
    };

    return [autoLevel, ...levels.sort((a, b) => b.height - a.height)];
  }

  /**
   * Map HLS level to QualityLevel
   */
  private mapHlsLevel(index: number, level: any): QualityLevel {
    return {
      index,
      bitrate: level.bitrate,
      height: level.height,
      width: level.width,
      codec: level.videoCodec,
      label: getQualityLabel(level.height),
      isAuto: false,
    };
  }

  /**
   * Get current quality level
   */
  getCurrentLevel(): QualityLevel | null {
    if (!this.hls) return null;

    if (this.mode === 'auto') {
      return {
        index: -1,
        bitrate: this.stats.currentBitrate,
        height: 0,
        width: 0,
        label: 'Auto',
        isAuto: true,
      };
    }

    const currentIndex = this.hls.currentLevel;
    const level = this.hls.levels[currentIndex];
    if (!level) return null;

    return this.mapHlsLevel(currentIndex, level);
  }

  /**
   * Set quality level
   * @param levelIndex -1 for auto, or specific level index
   */
  setLevel(levelIndex: number): void {
    if (!this.hls) return;

    if (levelIndex === -1) {
      // Enable ABR
      this.hls.currentLevel = -1;
      this.hls.nextLevel = -1;
      this.mode = 'auto';
      console.log('[ABR] Switched to AUTO mode');
    } else {
      // Set specific level
      this.hls.currentLevel = levelIndex;
      this.hls.nextLevel = levelIndex;
      this.mode = 'manual';
      this.manualLevel = levelIndex;
      
      const level = this.hls.levels[levelIndex];
      if (level) {
        console.log('[ABR] Manual quality:', getQualityLabel(level.height));
      }
    }
  }

  /**
   * Get current mode
   */
  getMode(): ABRMode {
    return this.mode;
  }

  /**
   * Get ABR stats
   */
  getStats(): ABRStats {
    if (this.hls?.media) {
      const video = this.hls.media as HTMLVideoElement;
      if (video.getVideoPlaybackQuality) {
        const quality = video.getVideoPlaybackQuality();
        this.stats.droppedFrames = quality.droppedVideoFrames;
      }
    }
    return { ...this.stats };
  }

  /**
   * Set max auto bitrate (cap for ABR)
   */
  setMaxAutoBitrate(maxBitrate: number): void {
    if (!this.hls) return;
    
    const levels = this.hls.levels;
    const maxLevel = levels.findIndex(l => l.bitrate > maxBitrate);
    
    if (maxLevel > 0) {
      this.hls.autoLevelCapping = maxLevel - 1;
      console.log('[ABR] Max auto level capped to:', maxLevel - 1);
    }
  }

  /**
   * Clear max auto bitrate cap
   */
  clearMaxAutoBitrate(): void {
    if (!this.hls) return;
    this.hls.autoLevelCapping = -1;
  }

  /**
   * Get recommended quality based on current bandwidth
   */
  getRecommendedLevel(): QualityLevel | null {
    if (!this.hls) return null;

    const bandwidth = this.hls.bandwidthEstimate;
    const targetBitrate = bandwidth * 0.7; // 30% headroom

    const levels = this.hls.levels;
    let bestMatch = levels[0];
    let bestIndex = 0;

    for (let i = levels.length - 1; i >= 0; i--) {
      if (levels[i].bitrate <= targetBitrate) {
        bestMatch = levels[i];
        bestIndex = i;
        break;
      }
    }

    return this.mapHlsLevel(bestIndex, bestMatch);
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const abrService = new ABRService();
export default abrService;
