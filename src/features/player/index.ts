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
export { useProfile } from './hooks/useProfile';
export { useContinueWatching } from './hooks/useContinueWatching';
