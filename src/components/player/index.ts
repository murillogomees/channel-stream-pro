/**
 * Player Components - Exports
 */

export { VideoPlayer, default } from './VideoPlayer';
export { SignedStreamPlayer } from './SignedStreamPlayer';
export { PreloadIndicator } from './PreloadIndicator';
export { PreloadStats } from './PreloadStats';
export { PlayerControls } from './PlayerControls';
export { QualitySelector } from './QualitySelector';
export { QualityBadge } from './QualityBadge';
export { ConnectionIndicator } from './ConnectionIndicator';
export { RecoveryStatus } from './RecoveryStatus';
export { ResumeDialog } from './ResumeDialog';
export { SeekBar } from './SeekBar';
export { StatsOverlay } from './StatsOverlay';
export { SleepTimerDialog } from './SleepTimerDialog';
export { CastButton } from './CastButton';
export { GestureIndicator } from './GestureIndicator';
export { DoubleTapIndicator } from './DoubleTapIndicator';
export { ThumbnailPreview } from './ThumbnailPreview';

// Re-export performance hooks
export { useVisibilityOptimization } from '@/hooks/useVisibilityOptimization';
export { useAdvancedHlsConfig, applyDynamicConfig } from '@/hooks/useAdvancedHlsConfig';
export { useStreamPreloader } from '@/hooks/useStreamPreloader';
export { usePlayerErrorRecovery } from '@/hooks/usePlayerErrorRecovery';
export { useEnhancedPlayer } from '@/hooks/useEnhancedPlayer';
export { useThumbnailPreview } from '@/hooks/useThumbnailPreview';
export { usePlayerStats } from '@/hooks/usePlayerStats';

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

// Re-export enterprise hooks
export { useSleepTimer } from '@/hooks/useSleepTimer';
export { useAutoFullscreen } from '@/hooks/useAutoFullscreen';
export { useChromecast } from '@/hooks/useChromecast';

// Re-export mobile/UX hooks
export { useMobileGestures } from '@/hooks/useMobileGestures';
export { useDoubleTapSeek } from '@/hooks/useDoubleTapSeek';
export { useSubtitles } from '@/hooks/useSubtitles';

// Re-export performance V2 hooks
export { useFastStartupV2 } from '@/hooks/useFastStartupV2';
export { useSmartBuffer } from '@/hooks/useSmartBuffer';
export { useMemoryManager } from '@/hooks/useMemoryManager';
export { useFrameDropPrevention } from '@/hooks/useFrameDropPrevention';
export { usePlayerPerformanceV2 } from '@/hooks/usePlayerPerformanceV2';
