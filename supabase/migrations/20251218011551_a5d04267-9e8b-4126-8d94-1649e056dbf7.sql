-- Adicionar colunas faltantes na tabela pwa_settings
ALTER TABLE public.pwa_settings 
ADD COLUMN IF NOT EXISTS language text DEFAULT 'pt-BR',
ADD COLUMN IF NOT EXISTS display_mode text DEFAULT 'standalone',
ADD COLUMN IF NOT EXISTS start_url text DEFAULT '/app',
ADD COLUMN IF NOT EXISTS scope text DEFAULT '/',
ADD COLUMN IF NOT EXISTS categories jsonb DEFAULT '["entertainment", "streaming"]',
ADD COLUMN IF NOT EXISTS prefer_related_applications boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS icon_maskable text,
ADD COLUMN IF NOT EXISTS sw_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS sw_app_shell_precache boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS sw_js_css_strategy text DEFAULT 'cache-first',
ADD COLUMN IF NOT EXISTS sw_images_strategy text DEFAULT 'cache-first',
ADD COLUMN IF NOT EXISTS sw_api_strategy text DEFAULT 'network-first',
ADD COLUMN IF NOT EXISTS sw_cache_expiration_days integer DEFAULT 30,
ADD COLUMN IF NOT EXISTS sw_max_cache_items integer DEFAULT 100,
ADD COLUMN IF NOT EXISTS sw_auto_update boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS sw_show_update_popup boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS sw_skip_waiting boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS sw_clients_claim boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS sw_offline_page_url text DEFAULT '/offline.html',
ADD COLUMN IF NOT EXISTS push_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS push_vapid_public_key text,
ADD COLUMN IF NOT EXISTS push_vapid_private_key text,
ADD COLUMN IF NOT EXISTS push_server_endpoint text,
ADD COLUMN IF NOT EXISTS install_banner_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS install_banner_style text DEFAULT 'bottom-sheet',
ADD COLUMN IF NOT EXISTS install_banner_message text DEFAULT 'Instale nosso app para uma experiência melhor!',
ADD COLUMN IF NOT EXISTS install_banner_delay_seconds integer DEFAULT 30;

-- Inserir configuração padrão se não existir
INSERT INTO public.pwa_settings (
  id, app_name, short_name, description, theme_color, background_color, display, orientation,
  language, display_mode, start_url, scope, categories, icon_192, icon_512,
  sw_enabled, sw_app_shell_precache, install_banner_enabled
)
SELECT 
  gen_random_uuid(), 'IPTV LINK PLAYER', 'IPTV LINK', 'Assista mais de 209.000 canais em Full HD e 4K',
  '#0A0A0A', '#0A0A0A', 'standalone', 'any', 'pt-BR', 'standalone', '/app', '/app',
  '["entertainment", "streaming", "video"]', '/pwa-icon.png', '/pwa-icon.png', true, true, true
WHERE NOT EXISTS (SELECT 1 FROM public.pwa_settings LIMIT 1);

-- Enable RLS
ALTER TABLE public.pwa_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can manage pwa_settings" ON public.pwa_settings;
DROP POLICY IF EXISTS "Public can read pwa_settings" ON public.pwa_settings;

-- Policy: Admins can manage PWA settings
CREATE POLICY "Admins can manage pwa_settings" ON public.pwa_settings FOR ALL 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'master')));

-- Policy: Public can read PWA settings
CREATE POLICY "Public can read pwa_settings" ON public.pwa_settings FOR SELECT USING (true);