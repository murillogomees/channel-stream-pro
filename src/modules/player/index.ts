/**
 * ============================================================================
 * Player Module - Exports
 * ============================================================================
 * 
 * Módulo de player IPTV universal enterprise.
 * 
 * Componentes:
 * - UniversalPlayer: Player HLS universal
 * - TVFocusableCard: Card com suporte a foco TV
 * - TVGridLayout: Grid otimizado para TVs
 * - PlayerOverlay: Overlay do player
 * 
 * Services:
 * - StreamService: Serviço de streaming
 * - FocusManager: Gerenciador de foco para TVs
 * 
 * Hooks:
 * - useFocusable: Registra elemento focável
 * - useFocusGroup: Gerencia grupo de foco
 * - useFocusManagerInit: Inicializa FocusManager
 * - useBackHandler: Handler para botão Back
 * - useCurrentFocus: Estado do foco atual
 * - usePlayerController: Controles do player
 * - useRemoteInput: Captura eventos de controle remoto
 * - useIPTVPlaylist: Gerenciamento de playlist
 */

// Components
export { default as UniversalPlayer } from '@/components/app/UniversalPlayer';
export { default as TVFocusableCard } from './components/TVFocusableCard';
export { TVGridLayout, TVChannelGrid, TVMovieGrid, TVCompactGrid } from './components/TVGridLayout';
export { default as PlayerOverlay } from './components/PlayerOverlay';

// Services
export { streamService, type Channel, type Category, type M3UFetchResult } from './services/StreamService';
export { focusManager, default as FocusManager } from './FocusManager';

// Hooks - Focus
export {
  useFocusable,
  useFocusGroup,
  useFocusManagerInit,
  useBackHandler,
  useCurrentFocus,
} from './hooks/useFocusManager';

// Hooks - Player
export { usePlayerController, type PlayerState, type PlayerControls } from './hooks/usePlayerController';
export { useRemoteInput, type RemoteAction } from './hooks/useRemoteInput';
export { useIPTVPlaylist, type PlaylistState, type PlaylistFilters } from './hooks/useIPTVPlaylist';
