/**
 * ============================================================================
 * Player Module - Exports
 * ============================================================================
 * 
 * Módulo de player IPTV universal.
 * 
 * Componentes:
 * - UniversalPlayer: Player HLS universal
 * - TVFocusableCard: Card com suporte a foco TV
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
 */

// Components
export { default as UniversalPlayer } from '@/components/app/UniversalPlayer';
export { default as TVFocusableCard } from './components/TVFocusableCard';

// Services
export { streamService, type Channel, type Category, type M3UFetchResult } from './services/StreamService';
export { focusManager, default as FocusManager } from './FocusManager';

// Hooks
export {
  useFocusable,
  useFocusGroup,
  useFocusManagerInit,
  useBackHandler,
  useCurrentFocus,
} from './hooks/useFocusManager';
