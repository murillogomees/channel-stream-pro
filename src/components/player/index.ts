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
export { ResumeDialog } from './ResumeDialog';
export { StatsOverlay } from './StatsOverlay';

// Re-export performance hooks
export { useVisibilityOptimization } from '@/hooks/useVisibilityOptimization';
export { useAdvancedHlsConfig, applyDynamicConfig } from '@/hooks/useAdvancedHlsConfig';
export { useStreamPreloader } from '@/hooks/useStreamPreloader';
export { usePlayerErrorRecovery } from '@/hooks/usePlayerErrorRecovery';
export { useEnhancedPlayer } from '@/hooks/useEnhancedPlayer';

// Re-export stability hooks
export { usePlayerStability } from '@/hooks/usePlayerStability';
export { usePlaybackWatchdog } from '@/hooks/usePlaybackWatchdog';
export { useNetworkAdaptation } from '@/hooks/useNetworkAdaptation';
export { useStallPrediction } from '@/hooks/useStallPrediction';

// Re-export advanced player hooks
export { usePictureInPicture } from '@/hooks/usePictureInPicture';
export { usePlayerKeyboardShortcuts } from '@/hooks/usePlayerKeyboardShortcuts';
export { useResumePlayback } from '@/hooks/useResumePlayback';
export { useChannelPreload } from '@/hooks/useChannelPreload';
export { useChannelPreloadEffect } from '@/hooks/useChannelPreloadEffect';

// Re-export pro player hooks
export { useAudioTrackSelector } from '@/hooks/useAudioTrackSelector';
export { useLowLatencyMode } from '@/hooks/useLowLatencyMode';
export { useSeekThumbnails } from '@/hooks/useSeekThumbnails';
