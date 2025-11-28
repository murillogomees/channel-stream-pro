/**
 * IPTV Player Feature - Main Export
 * Enterprise-grade IPTV player module
 */

// Types
export * from './types';

// Services
export {
  profileService,
  watchProgressService,
  favoritesService,
  recommendationsService,
  tmdbService,
  analyticsService,
} from './services';

// Hooks
export {
  useProfile,
  useContinueWatching,
  useTrending,
  useRecommendations,
} from './hooks';

// Components
export {
  TVHeroCarousel,
  ContinueWatchingRow,
  Top10Row,
  ContentRow,
} from './components';
