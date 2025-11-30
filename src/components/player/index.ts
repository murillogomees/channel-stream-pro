/**
 * Player Components - Exports
 */

export { VideoPlayer, default } from './VideoPlayer';
export { SignedStreamPlayer } from './SignedStreamPlayer';
export { PreloadIndicator } from './PreloadIndicator';
export { PreloadStats } from './PreloadStats';
export { QualitySelector } from './QualitySelector';
export { QualityBadge } from './QualityBadge';
export { ConnectionIndicator } from './ConnectionIndicator';
export { RecoveryStatus } from './RecoveryStatus';

// Re-export performance hooks
export { useVisibilityOptimization } from '@/hooks/useVisibilityOptimization';
export { useAdvancedHlsConfig, applyDynamicConfig } from '@/hooks/useAdvancedHlsConfig';
export { useStreamPreloader } from '@/hooks/useStreamPreloader';
export { usePlayerErrorRecovery } from '@/hooks/usePlayerErrorRecovery';
