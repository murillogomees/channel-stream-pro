-- Create table for PWA settings
CREATE TABLE public.pwa_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  -- General settings
  app_name TEXT NOT NULL DEFAULT 'IPTV Link',
  short_name TEXT NOT NULL DEFAULT 'IPTV',
  description TEXT DEFAULT 'Sua plataforma de streaming favorita',
  language TEXT DEFAULT 'pt-BR',
  theme_color TEXT DEFAULT '#1a1a2e',
  background_color TEXT DEFAULT '#0f0f23',
  orientation TEXT DEFAULT 'any' CHECK (orientation IN ('portrait', 'landscape', 'any')),
  display_mode TEXT DEFAULT 'standalone' CHECK (display_mode IN ('browser', 'standalone', 'fullscreen', 'minimal-ui')),
  start_url TEXT DEFAULT '/',
  scope TEXT DEFAULT '/',
  categories TEXT[] DEFAULT ARRAY['entertainment', 'streaming'],
  prefer_related_applications BOOLEAN DEFAULT false,
  
  -- Icons (URLs from storage)
  icon_192 TEXT,
  icon_512 TEXT,
  icon_maskable TEXT,
  favicon_16 TEXT,
  favicon_32 TEXT,
  
  -- Service Worker settings
  sw_enabled BOOLEAN DEFAULT true,
  sw_app_shell_precache BOOLEAN DEFAULT true,
  sw_js_css_strategy TEXT DEFAULT 'cache-first' CHECK (sw_js_css_strategy IN ('cache-first', 'stale-while-revalidate', 'network-first')),
  sw_images_strategy TEXT DEFAULT 'cache-first' CHECK (sw_images_strategy IN ('cache-first', 'stale-while-revalidate', 'network-first')),
  sw_api_strategy TEXT DEFAULT 'network-first' CHECK (sw_api_strategy IN ('cache-first', 'stale-while-revalidate', 'network-first')),
  sw_offline_page_url TEXT,
  sw_cache_expiration_days INTEGER DEFAULT 30,
  sw_max_cache_items INTEGER DEFAULT 100,
  sw_auto_update BOOLEAN DEFAULT true,
  sw_show_update_popup BOOLEAN DEFAULT true,
  sw_skip_waiting BOOLEAN DEFAULT false,
  sw_clients_claim BOOLEAN DEFAULT true,
  
  -- Push Notifications
  push_enabled BOOLEAN DEFAULT false,
  push_vapid_public_key TEXT,
  push_vapid_private_key TEXT,
  push_endpoint TEXT,
  
  -- Installation Banner
  install_banner_enabled BOOLEAN DEFAULT true,
  install_banner_style TEXT DEFAULT 'bottom-sheet' CHECK (install_banner_style IN ('modal', 'bottom-sheet', 'snackbar')),
  install_banner_message TEXT DEFAULT 'Instale nosso app para uma experiência melhor!',
  install_banner_delay_seconds INTEGER DEFAULT 30,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.pwa_settings ENABLE ROW LEVEL SECURITY;

-- Only admins/masters can access PWA settings
CREATE POLICY "Admin and master users can view PWA settings"
ON public.pwa_settings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'master')
  )
);

CREATE POLICY "Admin and master users can insert PWA settings"
ON public.pwa_settings
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'master')
  )
);

CREATE POLICY "Admin and master users can update PWA settings"
ON public.pwa_settings
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'master')
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_pwa_settings_updated_at
BEFORE UPDATE ON public.pwa_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default settings
INSERT INTO public.pwa_settings (id) VALUES (gen_random_uuid());

-- Create storage bucket for PWA assets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('pwa-assets', 'pwa-assets', true, 5242880, ARRAY['image/png', 'image/webp', 'image/svg+xml', 'text/html'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies for PWA assets
CREATE POLICY "PWA assets are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'pwa-assets');

CREATE POLICY "Admins can upload PWA assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'pwa-assets' AND
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'master')
  )
);

CREATE POLICY "Admins can update PWA assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'pwa-assets' AND
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'master')
  )
);

CREATE POLICY "Admins can delete PWA assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'pwa-assets' AND
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'master')
  )
);