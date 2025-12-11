/**
 * usePwaSettings - Hook for PWA settings management
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { PwaSettings, ManifestJson } from './types';

export function usePwaSettings() {
  const [settings, setSettings] = useState<PwaSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('pwa_settings')
        .select('*')
        .limit(1)
        .single();

      if (error) throw error;
      setSettings(data as unknown as PwaSettings);
    } catch (err) {
      console.error('[PWA] Error fetching settings:', err);
      toast.error('Erro ao carregar configurações PWA');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = useCallback(async (updates: Partial<PwaSettings>) => {
    if (!settings?.id) return false;
    
    try {
      setIsSaving(true);
      const { error } = await supabase
        .from('pwa_settings')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', settings.id);

      if (error) throw error;
      
      setSettings(prev => prev ? { ...prev, ...updates } : null);
      toast.success('Configurações salvas');
      return true;
    } catch (err) {
      console.error('[PWA] Error saving settings:', err);
      toast.error('Erro ao salvar configurações');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [settings?.id]);

  const generateManifest = useCallback((): ManifestJson | null => {
    if (!settings) return null;

    const icons = [];
    
    if (settings.icon_192) {
      icons.push({
        src: settings.icon_192,
        sizes: '192x192',
        type: 'image/png',
      });
    }
    
    if (settings.icon_512) {
      icons.push({
        src: settings.icon_512,
        sizes: '512x512',
        type: 'image/png',
      });
    }
    
    if (settings.icon_maskable) {
      icons.push({
        src: settings.icon_maskable,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      });
    }

    return {
      name: settings.app_name,
      short_name: settings.short_name,
      description: settings.description || '',
      lang: settings.language,
      theme_color: settings.theme_color,
      background_color: settings.background_color,
      orientation: settings.orientation,
      display: settings.display_mode,
      start_url: settings.start_url,
      scope: settings.scope,
      categories: settings.categories || [],
      prefer_related_applications: settings.prefer_related_applications,
      icons,
    };
  }, [settings]);

  const generateServiceWorker = useCallback((): string => {
    if (!settings) return '';

    const strategies = {
      'cache-first': 'CacheFirst',
      'stale-while-revalidate': 'StaleWhileRevalidate',
      'network-first': 'NetworkFirst',
    };

    return `// Service Worker gerado automaticamente
// Atualizado em: ${new Date().toISOString()}

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { ${strategies[settings.sw_js_css_strategy]}, ${strategies[settings.sw_images_strategy]}, ${strategies[settings.sw_api_strategy]} } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

// Configurações
const CACHE_EXPIRATION_DAYS = ${settings.sw_cache_expiration_days};
const MAX_CACHE_ITEMS = ${settings.sw_max_cache_items};

${settings.sw_skip_waiting ? `
// Skip waiting - ativar imediatamente
self.skipWaiting();
` : ''}

${settings.sw_clients_claim ? `
// Claim clients - controlar páginas abertas
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});
` : ''}

${settings.sw_app_shell_precache ? `
// Precache App Shell
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
` : ''}

// Estratégia para JS/CSS: ${settings.sw_js_css_strategy}
registerRoute(
  ({ request }) => 
    request.destination === 'script' || 
    request.destination === 'style',
  new ${strategies[settings.sw_js_css_strategy]}({
    cacheName: 'static-resources',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: MAX_CACHE_ITEMS,
        maxAgeSeconds: CACHE_EXPIRATION_DAYS * 24 * 60 * 60,
      }),
    ],
  })
);

// Estratégia para imagens: ${settings.sw_images_strategy}
registerRoute(
  ({ request }) => request.destination === 'image',
  new ${strategies[settings.sw_images_strategy]}({
    cacheName: 'images-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: ${Math.floor(settings.sw_max_cache_items / 2)},
        maxAgeSeconds: CACHE_EXPIRATION_DAYS * 24 * 60 * 60,
      }),
    ],
  })
);

// Estratégia para API: ${settings.sw_api_strategy}
registerRoute(
  ({ url }) => url.pathname.startsWith('/api') || url.hostname.includes('supabase'),
  new ${strategies[settings.sw_api_strategy]}({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 10,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: ${Math.floor(settings.sw_max_cache_items / 4)},
        maxAgeSeconds: 60 * 60, // 1 hora para API
      }),
    ],
  })
);

${settings.sw_offline_page_url ? `
// Página offline
registerRoute(
  ({ request }) => request.mode === 'navigate',
  async ({ event }) => {
    try {
      return await new NetworkFirst({
        cacheName: 'pages-cache',
        networkTimeoutSeconds: 5,
      }).handle({ event, request: event.request });
    } catch (error) {
      return caches.match('${settings.sw_offline_page_url}');
    }
  }
);
` : ''}

${settings.sw_show_update_popup ? `
// Notificar sobre atualizações
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
` : ''}

console.log('[SW] Service Worker initialized');
`;
  }, [settings]);

  const uploadIcon = useCallback(async (file: File, type: string): Promise<string | null> => {
    try {
      const fileName = `${type}-${Date.now()}.${file.name.split('.').pop()}`;
      const { data, error } = await supabase.storage
        .from('pwa-assets')
        .upload(`icons/${fileName}`, file, { upsert: true });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('pwa-assets')
        .getPublicUrl(`icons/${fileName}`);

      return publicUrl;
    } catch (err) {
      console.error('[PWA] Error uploading icon:', err);
      toast.error('Erro ao fazer upload do ícone');
      return null;
    }
  }, []);

  const resetToDefaults = useCallback(async () => {
    const defaults: Partial<PwaSettings> = {
      app_name: 'IPTV Link',
      short_name: 'IPTV',
      description: 'Sua plataforma de streaming favorita',
      language: 'pt-BR',
      theme_color: '#1a1a2e',
      background_color: '#0f0f23',
      orientation: 'any',
      display_mode: 'standalone',
      start_url: '/',
      scope: '/',
      categories: ['entertainment', 'streaming'],
      prefer_related_applications: false,
      sw_enabled: true,
      sw_app_shell_precache: true,
      sw_js_css_strategy: 'cache-first',
      sw_images_strategy: 'cache-first',
      sw_api_strategy: 'network-first',
      sw_cache_expiration_days: 30,
      sw_max_cache_items: 100,
      sw_auto_update: true,
      sw_show_update_popup: true,
      sw_skip_waiting: false,
      sw_clients_claim: true,
      push_enabled: false,
      install_banner_enabled: true,
      install_banner_style: 'bottom-sheet',
      install_banner_message: 'Instale nosso app para uma experiência melhor!',
      install_banner_delay_seconds: 30,
    };

    return updateSettings(defaults);
  }, [updateSettings]);

  return {
    settings,
    isLoading,
    isSaving,
    updateSettings,
    generateManifest,
    generateServiceWorker,
    uploadIcon,
    resetToDefaults,
    refetch: fetchSettings,
  };
}
