/**
 * Feature Flags Service - Gradual Migration Support
 * 
 * Enables gradual rollout of new features with:
 * - Percentage-based rollout
 * - User/device targeting
 * - A/B testing support
 * - Local storage persistence
 */

export type FeatureFlag = 
  | 'enhanced_abr'
  | 'segment_prefetch'
  | 'resume_support'
  | 'player_analytics'
  | 'new_home_ui'
  | 'new_detail_ui'
  | 'new_mylist_ui'
  | 'web_vitals_tracking'
  | 'tv_optimizations';

interface FeatureFlagConfig {
  enabled: boolean;
  percentage?: number; // 0-100 for gradual rollout
  targetDevices?: ('desktop' | 'mobile' | 'tablet' | 'tv')[];
  targetUsers?: string[]; // User IDs for targeted rollout
  description: string;
}

interface FeatureFlagsState {
  flags: Record<FeatureFlag, FeatureFlagConfig>;
  userId?: string;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'tv';
}

// Default feature flag configuration
const DEFAULT_FLAGS: Record<FeatureFlag, FeatureFlagConfig> = {
  enhanced_abr: {
    enabled: true,
    percentage: 100,
    description: 'Enhanced ABR with aggressive up-switch, conservative down-switch',
  },
  segment_prefetch: {
    enabled: true,
    percentage: 100,
    description: 'Prefetch 1-2 HLS segments on hover/start',
  },
  resume_support: {
    enabled: true,
    percentage: 100,
    description: 'Resume playback from last position (server + local fallback)',
  },
  player_analytics: {
    enabled: true,
    percentage: 100,
    description: 'Send player events to /api/player/events',
  },
  new_home_ui: {
    enabled: true,
    percentage: 100,
    description: 'New Netflix-style home page UI',
  },
  new_detail_ui: {
    enabled: true,
    percentage: 100,
    description: 'New content detail sheet UI',
  },
  new_mylist_ui: {
    enabled: true,
    percentage: 100,
    description: 'New My List page UI',
  },
  web_vitals_tracking: {
    enabled: true,
    percentage: 100,
    description: 'Track Core Web Vitals for Lighthouse optimization',
  },
  tv_optimizations: {
    enabled: true,
    targetDevices: ['tv'],
    description: 'TV-specific UI and performance optimizations',
  },
};

const STORAGE_KEY = 'feature_flags_override';

class FeatureFlagsService {
  private state: FeatureFlagsState;
  private overrides: Partial<Record<FeatureFlag, boolean>> = {};
  private userHash: number = 0;

  constructor() {
    this.state = {
      flags: { ...DEFAULT_FLAGS },
      deviceType: this.detectDeviceType(),
    };
    this.loadOverrides();
  }

  /**
   * Detect device type from user agent
   */
  private detectDeviceType(): 'desktop' | 'mobile' | 'tablet' | 'tv' {
    const ua = navigator.userAgent.toLowerCase();
    
    if (/android tv|webos|tizen|smart-tv|hbbtv|appletv|roku|firetv/i.test(ua)) {
      return 'tv';
    }
    if (/ipad|android(?!.*mobile)/i.test(ua)) {
      return 'tablet';
    }
    if (/mobile|android|iphone|ipod/i.test(ua)) {
      return 'mobile';
    }
    return 'desktop';
  }

  /**
   * Generate consistent hash from user ID for percentage-based rollout
   */
  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash % 100);
  }

  /**
   * Load overrides from local storage
   */
  private loadOverrides(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.overrides = JSON.parse(stored);
      }
    } catch {
      // Ignore errors
    }
  }

  /**
   * Save overrides to local storage
   */
  private saveOverrides(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.overrides));
    } catch {
      // Ignore errors
    }
  }

  /**
   * Set user ID for percentage-based targeting
   */
  setUserId(userId: string): void {
    this.state.userId = userId;
    this.userHash = this.hashUserId(userId);
  }

  /**
   * Check if a feature flag is enabled
   */
  isEnabled(flag: FeatureFlag): boolean {
    // Check for local override first
    if (this.overrides[flag] !== undefined) {
      return this.overrides[flag];
    }

    const config = this.state.flags[flag];
    if (!config) return false;

    // Check if globally disabled
    if (!config.enabled) return false;

    // Check device targeting
    if (config.targetDevices && config.targetDevices.length > 0) {
      if (!config.targetDevices.includes(this.state.deviceType)) {
        return false;
      }
    }

    // Check user targeting
    if (config.targetUsers && config.targetUsers.length > 0) {
      if (!this.state.userId || !config.targetUsers.includes(this.state.userId)) {
        return false;
      }
    }

    // Check percentage-based rollout
    if (config.percentage !== undefined && config.percentage < 100) {
      return this.userHash < config.percentage;
    }

    return true;
  }

  /**
   * Override a feature flag locally (for testing)
   */
  override(flag: FeatureFlag, enabled: boolean): void {
    this.overrides[flag] = enabled;
    this.saveOverrides();
    console.log(`[FeatureFlags] ${flag} overridden to ${enabled}`);
  }

  /**
   * Clear override for a feature flag
   */
  clearOverride(flag: FeatureFlag): void {
    delete this.overrides[flag];
    this.saveOverrides();
  }

  /**
   * Clear all overrides
   */
  clearAllOverrides(): void {
    this.overrides = {};
    this.saveOverrides();
  }

  /**
   * Get all feature flags with their status
   */
  getAllFlags(): Record<FeatureFlag, { enabled: boolean; config: FeatureFlagConfig; overridden: boolean }> {
    const result: any = {};
    
    for (const flag of Object.keys(this.state.flags) as FeatureFlag[]) {
      result[flag] = {
        enabled: this.isEnabled(flag),
        config: this.state.flags[flag],
        overridden: this.overrides[flag] !== undefined,
      };
    }
    
    return result;
  }

  /**
   * Get device type
   */
  getDeviceType(): 'desktop' | 'mobile' | 'tablet' | 'tv' {
    return this.state.deviceType;
  }

  /**
   * Check if running on TV
   */
  isTV(): boolean {
    return this.state.deviceType === 'tv';
  }

  /**
   * Check if running on mobile
   */
  isMobile(): boolean {
    return this.state.deviceType === 'mobile';
  }

  /**
   * Update flag config (for admin/testing)
   */
  updateFlagConfig(flag: FeatureFlag, config: Partial<FeatureFlagConfig>): void {
    this.state.flags[flag] = {
      ...this.state.flags[flag],
      ...config,
    };
  }
}

export const featureFlagsService = new FeatureFlagsService();
export default featureFlagsService;
