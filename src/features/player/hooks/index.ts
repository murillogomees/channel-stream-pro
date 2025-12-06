/**
 * Player Hooks - Export all hooks
 */

export { useProfile } from './useProfile';
export { useContinueWatching } from './useContinueWatching';
export { useTrending } from './useTrending';
export { useRecommendations } from './useRecommendations';
export { useWatchProgress } from './useWatchProgress';
export { useHomeContent } from './useHomeContent';
export type { HomeContentSection, ContinueWatchingItem } from './useHomeContent';

// Live TV hooks
export { useEPG, useChannelEPG } from './useEPG';
export { useChannelZapping } from './useChannelZapping';
export { usePictureInPicture } from './usePictureInPicture';

// Movie hooks
export { useMovieMetadata } from './useMovieMetadata';

// Series hooks
export { useSeriesMetadata } from './useSeriesMetadata';

// Personalized content
export { usePersonalizedContent } from './usePersonalizedContent';
