/**
 * PWA Configuration Types
 */

export interface PwaSettings {
  id: string;
  // General settings
  app_name: string;
  short_name: string;
  description: string | null;
  language: string;
  theme_color: string;
  background_color: string;
  orientation: 'portrait' | 'landscape' | 'any';
  display_mode: 'browser' | 'standalone' | 'fullscreen' | 'minimal-ui';
  start_url: string;
  scope: string;
  categories: string[];
  prefer_related_applications: boolean;
  
  // Icons
  icon_192: string | null;
  icon_512: string | null;
  icon_maskable: string | null;
  favicon_16: string | null;
  favicon_32: string | null;
  
  // Service Worker
  sw_enabled: boolean;
  sw_app_shell_precache: boolean;
  sw_js_css_strategy: 'cache-first' | 'stale-while-revalidate' | 'network-first';
  sw_images_strategy: 'cache-first' | 'stale-while-revalidate' | 'network-first';
  sw_api_strategy: 'cache-first' | 'stale-while-revalidate' | 'network-first';
  sw_offline_page_url: string | null;
  sw_cache_expiration_days: number;
  sw_max_cache_items: number;
  sw_auto_update: boolean;
  sw_show_update_popup: boolean;
  sw_skip_waiting: boolean;
  sw_clients_claim: boolean;
  
  // Push Notifications
  push_enabled: boolean;
  push_vapid_public_key: string | null;
  push_vapid_private_key: string | null;
  push_endpoint: string | null;
  
  // Installation Banner
  install_banner_enabled: boolean;
  install_banner_style: 'modal' | 'bottom-sheet' | 'snackbar';
  install_banner_message: string;
  install_banner_delay_seconds: number;
  
  // Metadata
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

export interface ManifestJson {
  name: string;
  short_name: string;
  description: string;
  lang: string;
  theme_color: string;
  background_color: string;
  orientation: string;
  display: string;
  start_url: string;
  scope: string;
  categories: string[];
  prefer_related_applications: boolean;
  icons: ManifestIcon[];
}

export interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
}

export const CACHE_STRATEGIES = [
  { value: 'cache-first', label: 'Cache First', description: 'Prioriza cache, mais rápido' },
  { value: 'stale-while-revalidate', label: 'Stale While Revalidate', description: 'Retorna cache e atualiza em background' },
  { value: 'network-first', label: 'Network First', description: 'Prioriza rede, dados mais frescos' },
] as const;

export const DISPLAY_MODES = [
  { value: 'standalone', label: 'Standalone', description: 'App nativo sem UI do browser' },
  { value: 'fullscreen', label: 'Fullscreen', description: 'Tela cheia imersiva' },
  { value: 'minimal-ui', label: 'Minimal UI', description: 'Controles mínimos do browser' },
  { value: 'browser', label: 'Browser', description: 'Aba normal do navegador' },
] as const;

export const ORIENTATIONS = [
  { value: 'any', label: 'Qualquer', description: 'Rotação livre' },
  { value: 'portrait', label: 'Retrato', description: 'Apenas vertical' },
  { value: 'landscape', label: 'Paisagem', description: 'Apenas horizontal' },
] as const;

export const BANNER_STYLES = [
  { value: 'bottom-sheet', label: 'Bottom Sheet', description: 'Painel deslizante inferior' },
  { value: 'modal', label: 'Modal', description: 'Popup centralizado' },
  { value: 'snackbar', label: 'Snackbar', description: 'Notificação discreta' },
] as const;
