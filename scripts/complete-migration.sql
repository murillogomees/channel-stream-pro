-- ============================================================
-- MIGRAÇÃO COMPLETA: Lovable Cloud → Supabase Cloud
-- Projeto Destino: sdvyxdghxqmntyoweqbd
-- Data: 2025-12-14
-- ============================================================

-- ============================================================
-- PARTE 1: REMOVER TABELAS EXISTENTES (CASCADE)
-- ============================================================
-- Execute isso no SQL Editor do Supabase Cloud destino

DROP TABLE IF EXISTS public.ab_test_offers CASCADE;
DROP TABLE IF EXISTS public.ab_test_results CASCADE;
DROP TABLE IF EXISTS public.account_deletion_requests CASCADE;
DROP TABLE IF EXISTS public.activity_logs CASCADE;
DROP TABLE IF EXISTS public.admin_badge_notifications CASCADE;
DROP TABLE IF EXISTS public.admin_favorites CASCADE;
DROP TABLE IF EXISTS public.admin_phones CASCADE;
DROP TABLE IF EXISTS public.admin_shortcuts CASCADE;
DROP TABLE IF EXISTS public.affiliate_analytics CASCADE;
DROP TABLE IF EXISTS public.affiliate_config CASCADE;
DROP TABLE IF EXISTS public.affiliate_dashboard CASCADE;
DROP TABLE IF EXISTS public.affiliate_fraud_logs CASCADE;
DROP TABLE IF EXISTS public.affiliate_link_clicks CASCADE;
DROP TABLE IF EXISTS public.affiliate_links CASCADE;
DROP TABLE IF EXISTS public.affiliate_marketing_materials CASCADE;
DROP TABLE IF EXISTS public.affiliate_onboarding CASCADE;
DROP TABLE IF EXISTS public.affiliate_payouts CASCADE;
DROP TABLE IF EXISTS public.affiliate_promotions CASCADE;
DROP TABLE IF EXISTS public.affiliate_referrals CASCADE;
DROP TABLE IF EXISTS public.affiliate_reports CASCADE;
DROP TABLE IF EXISTS public.affiliate_tiers CASCADE;
DROP TABLE IF EXISTS public.affiliate_withdrawals CASCADE;
DROP TABLE IF EXISTS public.affiliates CASCADE;
DROP TABLE IF EXISTS public.api_usage CASCADE;
DROP TABLE IF EXISTS public.app_versions CASCADE;
DROP TABLE IF EXISTS public.auth_sessions_log CASCADE;
DROP TABLE IF EXISTS public.auto_notifications CASCADE;
DROP TABLE IF EXISTS public.banners CASCADE;
DROP TABLE IF EXISTS public.client_status_history CASCADE;
DROP TABLE IF EXISTS public.custom_status_badges CASCADE;
DROP TABLE IF EXISTS public.dashboard_widgets CASCADE;
DROP TABLE IF EXISTS public.device_fingerprints CASCADE;
DROP TABLE IF EXISTS public.discount_coupons CASCADE;
DROP TABLE IF EXISTS public.email_change_requests CASCADE;
DROP TABLE IF EXISTS public.epg_programs CASCADE;
DROP TABLE IF EXISTS public.feature_flag_config CASCADE;
DROP TABLE IF EXISTS public.health_checks CASCADE;
DROP TABLE IF EXISTS public.homepage_content CASCADE;
DROP TABLE IF EXISTS public.homepage_faqs CASCADE;
DROP TABLE IF EXISTS public.ip_blacklist CASCADE;
DROP TABLE IF EXISTS public.ip_whitelist CASCADE;
DROP TABLE IF EXISTS public.iptv_cdn_cache CASCADE;
DROP TABLE IF EXISTS public.iptv_channel_metrics CASCADE;
DROP TABLE IF EXISTS public.iptv_channels CASCADE;
DROP TABLE IF EXISTS public.iptv_playlist_channels CASCADE;
DROP TABLE IF EXISTS public.iptv_playlists CASCADE;
DROP TABLE IF EXISTS public.iptv_probe_jobs CASCADE;
DROP TABLE IF EXISTS public.iptv_stream_fingerprints CASCADE;
DROP TABLE IF EXISTS public.iptv_stream_groups CASCADE;
DROP TABLE IF EXISTS public.iptv_stream_tokens CASCADE;
DROP TABLE IF EXISTS public.iptv_transcode_jobs CASCADE;
DROP TABLE IF EXISTS public.login_alerts CASCADE;
DROP TABLE IF EXISTS public.m3u_sources CASCADE;
DROP TABLE IF EXISTS public.mercado_pago_config CASCADE;
DROP TABLE IF EXISTS public.mercado_pago_webhooks CASCADE;
DROP TABLE IF EXISTS public.migration_audit CASCADE;
DROP TABLE IF EXISTS public.notification_logs CASCADE;
DROP TABLE IF EXISTS public.notification_queue CASCADE;
DROP TABLE IF EXISTS public.notification_templates CASCADE;
DROP TABLE IF EXISTS public.passkey_credentials CASCADE;
DROP TABLE IF EXISTS public.payment_history CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.pending_email_changes CASCADE;
DROP TABLE IF EXISTS public.phone_verification_codes CASCADE;
DROP TABLE IF EXISTS public.playback_tokens CASCADE;
DROP TABLE IF EXISTS public.player_events CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.pwa_settings CASCADE;
DROP TABLE IF EXISTS public.rate_limit_tracking CASCADE;
DROP TABLE IF EXISTS public.refresh_tokens CASCADE;
DROP TABLE IF EXISTS public.remote_command_audit CASCADE;
DROP TABLE IF EXISTS public.rls_audit_resolutions CASCADE;
DROP TABLE IF EXISTS public.rls_fix_backups CASCADE;
DROP TABLE IF EXISTS public.rls_scan_results CASCADE;
DROP TABLE IF EXISTS public.security_alert_deliveries CASCADE;
DROP TABLE IF EXISTS public.security_alerts CASCADE;
DROP TABLE IF EXISTS public.security_events CASCADE;
DROP TABLE IF EXISTS public.sent_notifications CASCADE;
DROP TABLE IF EXISTS public.status_change_history CASCADE;
DROP TABLE IF EXISTS public.streaming_metrics CASCADE;
DROP TABLE IF EXISTS public.subscription_plans CASCADE;
DROP TABLE IF EXISTS public.supabase_instance_audit CASCADE;
DROP TABLE IF EXISTS public.supabase_instance_backups CASCADE;
DROP TABLE IF EXISTS public.supabase_instances CASCADE;
DROP TABLE IF EXISTS public.system_backups CASCADE;
DROP TABLE IF EXISTS public.system_config CASCADE;
DROP TABLE IF EXISTS public.template_variables CASCADE;
DROP TABLE IF EXISTS public.test_contacts CASCADE;
DROP TABLE IF EXISTS public.trending_rankings CASCADE;
DROP TABLE IF EXISTS public.two_factor_auth CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.user_sessions CASCADE;
DROP TABLE IF EXISTS public.user_subscriptions CASCADE;
DROP TABLE IF EXISTS public.watch_progress CASCADE;
DROP TABLE IF EXISTS public.whatsapp_config CASCADE;

-- Drop custom types if exist
DROP TYPE IF EXISTS public.app_role CASCADE;

-- ============================================================
-- PARTE 2: CRIAR TIPOS CUSTOMIZADOS
-- ============================================================

CREATE TYPE public.app_role AS ENUM ('client', 'admin', 'master');

-- ============================================================
-- PARTE 3: CRIAR FUNÇÕES AUXILIARES
-- ============================================================

-- Função para verificar admin/master
CREATE OR REPLACE FUNCTION public.is_admin_or_master(check_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = check_user_id
    AND role IN ('admin', 'master')
  );
$$;

-- Função has_role
CREATE OR REPLACE FUNCTION public.has_role(check_user_id uuid, check_role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = check_user_id
    AND role = check_role
  );
$$;

-- Função update_updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- PARTE 4: CRIAR TABELAS PRINCIPAIS
-- ============================================================

-- Profiles (principal)
CREATE TABLE public.profiles (
  id uuid NOT NULL PRIMARY KEY,
  email text,
  nome text,
  contact_phone text,
  cliente_ativo boolean DEFAULT true,
  data_vencimento date,
  plano text,
  valor_pago numeric DEFAULT 0.00,
  situacao text DEFAULT 'Testando',
  origem_cadastro text DEFAULT 'Website',
  data_contratacao date,
  data_ultimo_pagamento date,
  forma_ultimo_pagamento text,
  dispositivo_contratado text,
  is_recorrente boolean DEFAULT false,
  login_alerts_email boolean DEFAULT true,
  login_alerts_whatsapp boolean DEFAULT false,
  phone_verified boolean DEFAULT false,
  phone_verified_at timestamptz,
  theme text DEFAULT 'dark',
  totp_enabled boolean DEFAULT false,
  totp_secret text,
  totp_verified_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- User Roles
CREATE TABLE public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  role app_role NOT NULL DEFAULT 'client',
  created_at timestamptz DEFAULT now()
);

-- Subscription Plans
CREATE TABLE public.subscription_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  price numeric NOT NULL,
  currency text DEFAULT 'R$',
  period text DEFAULT '/mês',
  period_months integer DEFAULT 1,
  features jsonb DEFAULT '[]',
  is_active boolean DEFAULT true,
  is_highlighted boolean DEFAULT false,
  display_order integer DEFAULT 0,
  savings_percent numeric,
  savings_amount numeric,
  cta_text text DEFAULT 'Assinar Agora',
  whatsapp_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- IPTV Channels
CREATE TABLE public.iptv_channels (
  id bigserial PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL,
  original_url text NOT NULL,
  logo_url text,
  category text,
  content_type text,
  is_healthy boolean DEFAULT true,
  health_score integer DEFAULT 100,
  last_probe_at timestamptz,
  probe_error text,
  resolution text,
  bitrate_estimate integer,
  codec_hint text,
  transcode_status text,
  transcode_manifest_url text,
  fallback_channel_id bigint,
  priority integer DEFAULT 0,
  shard_id integer DEFAULT 0,
  is_series boolean DEFAULT false,
  series_name text,
  season_number integer,
  episode_number integer,
  episode_title text,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Notification Templates
CREATE TABLE public.notification_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_key text NOT NULL UNIQUE,
  template_name text NOT NULL,
  template_content text NOT NULL,
  variables jsonb DEFAULT '[]',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Auto Notifications
CREATE TABLE public.auto_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trigger_type text NOT NULL,
  template_key text,
  name text,
  description text,
  message_template text,
  conditions jsonb,
  delay_hours integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- WhatsApp Config
CREATE TABLE public.whatsapp_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  app_key text,
  auth_key text,
  webhook_url text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Test Contacts
CREATE TABLE public.test_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  phone text NOT NULL,
  notes text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Activity Logs
CREATE TABLE public.activity_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  details jsonb,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

-- Payments
CREATE TABLE public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  plan_id uuid,
  amount numeric NOT NULL,
  status text DEFAULT 'pending',
  payment_method text,
  external_id text,
  external_reference text,
  payer_email text,
  payer_phone text,
  payer_document text,
  metadata jsonb,
  paid_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Notification Logs
CREATE TABLE public.notification_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_phone text,
  recipient_name text,
  template_key text,
  message_content text,
  status text DEFAULT 'pending',
  error_message text,
  sent_at timestamptz,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- PARTE 5: TABELAS SECUNDÁRIAS
-- ============================================================

-- AB Test Offers
CREATE TABLE public.ab_test_offers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  test_name text NOT NULL,
  variant_a jsonb NOT NULL,
  variant_b jsonb NOT NULL,
  active boolean DEFAULT true,
  start_date timestamptz DEFAULT now(),
  end_date timestamptz,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- AB Test Results
CREATE TABLE public.ab_test_results (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  test_id uuid REFERENCES public.ab_test_offers(id),
  user_id uuid,
  variant_shown text NOT NULL,
  converted boolean DEFAULT false,
  session_id text,
  created_at timestamptz DEFAULT now()
);

-- Account Deletion Requests
CREATE TABLE public.account_deletion_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  reason text,
  confirmation_token text UNIQUE,
  scheduled_deletion_at timestamptz,
  cancelled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Admin Badge Notifications
CREATE TABLE public.admin_badge_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id uuid,
  badge_id uuid,
  badge_name text NOT NULL,
  badge_rarity text DEFAULT 'common',
  message text,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Admin Favorites
CREATE TABLE public.admin_favorites (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id uuid,
  item_type text NOT NULL,
  item_id text NOT NULL,
  item_name text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(admin_id, item_type, item_id)
);

-- Admin Phones
CREATE TABLE public.admin_phones (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id uuid,
  phone text NOT NULL,
  is_active boolean DEFAULT true,
  priority integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Admin Shortcuts
CREATE TABLE public.admin_shortcuts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  title text NOT NULL,
  path text NOT NULL,
  icon text DEFAULT 'Link',
  description text,
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Affiliates (base table)
CREATE TABLE public.affiliates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  code text NOT NULL UNIQUE,
  name text,
  commission_rate numeric DEFAULT 10.00,
  commission_type text DEFAULT 'percentage',
  commission_value numeric,
  total_clicks integer DEFAULT 0,
  total_referrals integer DEFAULT 0,
  total_earnings numeric DEFAULT 0,
  available_balance numeric DEFAULT 0,
  conversion_rate numeric DEFAULT 0,
  status text DEFAULT 'active',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Affiliate Analytics
CREATE TABLE public.affiliate_analytics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id uuid REFERENCES public.affiliates(id),
  period_start date NOT NULL,
  period_end date NOT NULL,
  clicks integer DEFAULT 0,
  conversions integer DEFAULT 0,
  referrals integer DEFAULT 0,
  revenue_generated numeric DEFAULT 0,
  commission_earned numeric DEFAULT 0,
  conversion_rate numeric DEFAULT 0,
  avg_order_value numeric DEFAULT 0,
  earnings numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- More tables...
CREATE TABLE public.affiliate_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_key text NOT NULL UNIQUE,
  config_value text,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.affiliate_dashboard (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id uuid REFERENCES public.affiliates(id),
  widget_config jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.affiliate_fraud_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id uuid REFERENCES public.affiliates(id),
  event_type text NOT NULL,
  severity text DEFAULT 'medium',
  ip_address text,
  user_agent text,
  details jsonb,
  notes text,
  resolved boolean DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid,
  resolution_notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.affiliate_link_clicks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id uuid REFERENCES public.affiliates(id),
  ip_address text,
  user_agent text,
  referer text,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  device_type text,
  landing_page text,
  converted boolean DEFAULT false,
  converted_at timestamptz,
  clicked_at timestamptz DEFAULT now()
);

CREATE TABLE public.affiliate_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id uuid REFERENCES public.affiliates(id),
  url text NOT NULL,
  name text,
  description text,
  short_code text UNIQUE,
  clicks integer DEFAULT 0,
  conversions integer DEFAULT 0,
  revenue numeric DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.affiliate_marketing_materials (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  type text DEFAULT 'banner',
  content_url text,
  content_text text,
  thumbnail_url text,
  dimensions text,
  file_size integer,
  download_count integer DEFAULT 0,
  downloads integer DEFAULT 0,
  is_active boolean DEFAULT true,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.affiliate_onboarding (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id uuid REFERENCES public.affiliates(id),
  step_key text NOT NULL,
  completed boolean DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.affiliate_payouts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id uuid REFERENCES public.affiliates(id),
  amount numeric NOT NULL,
  period_start date,
  period_end date,
  status text DEFAULT 'pending',
  payment_method text,
  transaction_id text,
  notes text,
  paid_at timestamptz,
  processed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.affiliate_promotions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  code text,
  discount_type text DEFAULT 'percentage',
  discount_value numeric,
  start_date timestamptz DEFAULT now(),
  end_date timestamptz,
  max_uses integer,
  usage_count integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.affiliate_referrals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id uuid REFERENCES public.affiliates(id),
  referred_user_id uuid,
  plan_value numeric DEFAULT 0,
  commission_type text DEFAULT 'percentage',
  commission_value numeric,
  commission_amount numeric DEFAULT 0,
  commission_earned numeric DEFAULT 0,
  status text DEFAULT 'pending',
  converted_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.affiliate_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id uuid REFERENCES public.affiliates(id),
  report_type text NOT NULL,
  period_start date,
  period_end date,
  data jsonb,
  generated_at timestamptz DEFAULT now()
);

CREATE TABLE public.affiliate_tiers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  commission_rate numeric NOT NULL,
  commission_percentage numeric,
  min_referrals integer DEFAULT 0,
  min_revenue numeric DEFAULT 0,
  bonus_amount numeric DEFAULT 0,
  benefits jsonb DEFAULT '[]',
  icon text,
  color text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.affiliate_withdrawals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id uuid REFERENCES public.affiliates(id),
  amount numeric NOT NULL,
  withdrawal_type text DEFAULT 'standard',
  payment_method text,
  payment_details jsonb,
  status text DEFAULT 'pending',
  notes text,
  processed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.api_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  endpoint text NOT NULL,
  method text DEFAULT 'GET',
  status_code integer,
  response_time_ms integer,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.app_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform text NOT NULL,
  version text NOT NULL,
  min_version text,
  is_required boolean DEFAULT false,
  download_url text,
  release_notes text,
  released_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.auth_sessions_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  user_email text,
  event_type text NOT NULL,
  ip_address text,
  user_agent text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.banners (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  image_url text,
  link_url text,
  position text DEFAULT 'top',
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  start_date timestamptz,
  end_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.client_status_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid REFERENCES public.profiles(id),
  old_status text,
  new_status text NOT NULL,
  reason text,
  changed_by uuid,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.custom_status_badges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  status_key text NOT NULL,
  label text NOT NULL,
  color text DEFAULT 'gray',
  icon text,
  description text,
  order_index integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.dashboard_widgets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  widget_type text NOT NULL,
  config jsonb DEFAULT '{}',
  position integer DEFAULT 0,
  is_visible boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.device_fingerprints (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  fingerprint_hash text NOT NULL,
  device_name text,
  device_type text DEFAULT 'unknown',
  browser text,
  os text,
  is_trusted boolean DEFAULT false,
  trust_expires_at timestamptz,
  login_count integer DEFAULT 1,
  first_seen_at timestamptz DEFAULT now(),
  last_seen_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, fingerprint_hash)
);

CREATE TABLE public.discount_coupons (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  discount_type text DEFAULT 'percentage',
  discount_value numeric NOT NULL,
  min_purchase_amount numeric,
  max_uses integer,
  current_uses integer DEFAULT 0,
  applies_to text DEFAULT 'all',
  valid_from timestamptz DEFAULT now(),
  valid_until timestamptz,
  is_active boolean DEFAULT true,
  active boolean DEFAULT true,
  auto_generated boolean DEFAULT false,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.email_change_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  old_email text NOT NULL,
  new_email text NOT NULL,
  token text NOT NULL,
  verification_code text,
  expires_at timestamptz NOT NULL,
  confirmed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.epg_programs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id text NOT NULL,
  title text NOT NULL,
  description text,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  category text,
  rating text,
  episode_info text,
  icon_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.feature_flag_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  flag_name text NOT NULL UNIQUE,
  enabled boolean DEFAULT false,
  percentage integer DEFAULT 100,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.health_checks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_name text NOT NULL,
  status text DEFAULT 'unknown',
  response_time_ms integer,
  error_message text,
  checked_at timestamptz DEFAULT now()
);

CREATE TABLE public.homepage_content (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  section_key text NOT NULL UNIQUE,
  content jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.homepage_faqs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question text NOT NULL,
  answer text NOT NULL,
  display_order integer DEFAULT 1,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.ip_blacklist (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address text NOT NULL UNIQUE,
  reason text,
  severity text DEFAULT 'medium',
  is_permanent boolean DEFAULT false,
  auto_blocked boolean DEFAULT false,
  failed_attempts integer DEFAULT 0,
  last_attempt_at timestamptz,
  blocked_until timestamptz,
  expires_at timestamptz,
  unblocked_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.ip_whitelist (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address text NOT NULL UNIQUE,
  description text,
  added_by uuid,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- IPTV Related Tables
CREATE TABLE public.iptv_playlists (
  id bigserial PRIMARY KEY,
  user_id uuid,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  channel_count integer DEFAULT 0,
  is_public boolean DEFAULT false,
  settings jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.iptv_playlist_channels (
  playlist_id bigint NOT NULL REFERENCES public.iptv_playlists(id),
  channel_id bigint NOT NULL REFERENCES public.iptv_channels(id),
  position integer DEFAULT 0,
  custom_name text,
  custom_logo text,
  is_hidden boolean DEFAULT false,
  added_at timestamptz DEFAULT now(),
  PRIMARY KEY (playlist_id, channel_id)
);

CREATE TABLE public.iptv_cdn_cache (
  id bigserial PRIMARY KEY,
  channel_id bigint REFERENCES public.iptv_channels(id),
  cache_key text NOT NULL,
  cdn_provider text DEFAULT 'r2',
  manifest_url text,
  segment_prefix text,
  is_warm boolean DEFAULT false,
  expires_at timestamptz,
  last_access_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.iptv_channel_metrics (
  id bigserial PRIMARY KEY,
  channel_id bigint REFERENCES public.iptv_channels(id),
  metric_type text NOT NULL,
  value numeric NOT NULL,
  recorded_at timestamptz DEFAULT now()
);

CREATE TABLE public.iptv_probe_jobs (
  id bigserial PRIMARY KEY,
  channel_id bigint REFERENCES public.iptv_channels(id),
  status text DEFAULT 'pending',
  result jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.iptv_stream_fingerprints (
  id bigserial PRIMARY KEY,
  channel_id bigint REFERENCES public.iptv_channels(id),
  fingerprint_hash text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(channel_id, fingerprint_hash)
);

CREATE TABLE public.iptv_stream_groups (
  id bigserial PRIMARY KEY,
  name text NOT NULL,
  description text,
  priority integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.iptv_stream_tokens (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  channel_id bigint NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.iptv_transcode_jobs (
  id bigserial PRIMARY KEY,
  channel_id bigint REFERENCES public.iptv_channels(id),
  status text DEFAULT 'pending',
  priority integer DEFAULT 0,
  input_url text,
  output_url text,
  progress integer DEFAULT 0,
  error_message text,
  metadata jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Continue with remaining tables...
CREATE TABLE public.login_alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  ip_address text,
  user_agent text,
  location text,
  device_type text,
  is_suspicious boolean DEFAULT false,
  alert_sent boolean DEFAULT false,
  acknowledged_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.m3u_sources (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  url text NOT NULL,
  type text DEFAULT 'url',
  is_active boolean DEFAULT true,
  last_sync_at timestamptz,
  sync_status text,
  channel_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.mercado_pago_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  access_token text,
  public_key text,
  webhook_secret text,
  sandbox_mode boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.mercado_pago_webhooks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL,
  resource_id text,
  payload jsonb,
  processed boolean DEFAULT false,
  processed_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.migration_audit (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  migration_name text NOT NULL,
  status text DEFAULT 'pending',
  started_at timestamptz,
  completed_at timestamptz,
  records_migrated integer DEFAULT 0,
  error_message text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.notification_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_phone text NOT NULL,
  recipient_name text,
  template_key text,
  message_content text NOT NULL,
  priority integer DEFAULT 0,
  status text DEFAULT 'pending',
  retry_count integer DEFAULT 0,
  max_retries integer DEFAULT 3,
  scheduled_for timestamptz,
  sent_at timestamptz,
  error_message text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.passkey_credentials (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  credential_id text NOT NULL UNIQUE,
  public_key text NOT NULL,
  counter integer DEFAULT 0,
  device_name text,
  transports jsonb,
  created_at timestamptz DEFAULT now(),
  last_used_at timestamptz
);

CREATE TABLE public.payment_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id uuid,
  status text NOT NULL,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.pending_email_changes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  new_email text NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.phone_verification_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  phone text NOT NULL,
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  attempts integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.playback_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  channel_id text NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.player_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  channel_id text,
  event_type text NOT NULL,
  duration_seconds integer,
  quality text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.pwa_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid UNIQUE,
  push_enabled boolean DEFAULT false,
  push_subscription jsonb,
  install_prompted boolean DEFAULT false,
  installed boolean DEFAULT false,
  offline_enabled boolean DEFAULT true,
  cache_strategy text DEFAULT 'network-first',
  theme_color text DEFAULT '#1a1a2e',
  notifications_enabled boolean DEFAULT true,
  auto_update boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.rate_limit_tracking (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  identifier text NOT NULL,
  identifier_type text DEFAULT 'ip',
  request_count integer DEFAULT 1,
  window_start timestamptz NOT NULL,
  window_duration_seconds integer DEFAULT 60,
  last_request_at timestamptz DEFAULT now(),
  UNIQUE(identifier, identifier_type, window_start)
);

CREATE TABLE public.refresh_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  family_id uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  is_revoked boolean DEFAULT false,
  revoked_at timestamptz,
  revoked_reason text,
  device_info jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.remote_command_audit (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  command text NOT NULL,
  target_server text,
  status text DEFAULT 'pending',
  output text,
  error_message text,
  execution_time_ms integer,
  ip_address text,
  user_agent text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.rls_audit_resolutions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_result_id uuid,
  resolution_type text NOT NULL,
  resolution_sql text,
  applied_by uuid,
  applied_at timestamptz,
  rollback_sql text,
  status text DEFAULT 'pending',
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.rls_fix_backups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name text NOT NULL,
  policy_name text NOT NULL,
  policy_definition text NOT NULL,
  backed_up_at timestamptz DEFAULT now(),
  restored_at timestamptz
);

CREATE TABLE public.rls_scan_results (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name text NOT NULL,
  finding_type text NOT NULL,
  severity text DEFAULT 'medium',
  description text,
  recommendation text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.security_alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_type text NOT NULL,
  severity text DEFAULT 'medium',
  title text NOT NULL,
  description text,
  source_ip text,
  user_id uuid,
  metadata jsonb,
  acknowledged boolean DEFAULT false,
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  resolved boolean DEFAULT false,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.security_alert_deliveries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_id uuid REFERENCES public.security_alerts(id),
  delivery_type text NOT NULL,
  recipient text NOT NULL,
  status text DEFAULT 'pending',
  sent_at timestamptz,
  delivered_at timestamptz,
  error_message text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.security_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL,
  severity text DEFAULT 'info',
  ip_address text,
  user_id uuid,
  event_details jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.sent_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid,
  notification_type text NOT NULL,
  channel text DEFAULT 'whatsapp',
  status text DEFAULT 'sent',
  error_message text,
  sent_at timestamptz DEFAULT now()
);

CREATE TABLE public.status_change_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid,
  old_status text,
  new_status text NOT NULL,
  changed_by uuid,
  reason text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.streaming_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  channel_id text,
  session_id text,
  buffer_events integer DEFAULT 0,
  quality_changes integer DEFAULT 0,
  avg_bitrate integer,
  total_duration_seconds integer,
  errors jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.supabase_instances (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  url text NOT NULL,
  anon_key text,
  service_role_key text,
  is_active boolean DEFAULT true,
  is_primary boolean DEFAULT false,
  region text,
  tier text DEFAULT 'free',
  last_health_check timestamptz,
  health_status text DEFAULT 'unknown',
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.supabase_instance_audit (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id uuid REFERENCES public.supabase_instances(id),
  action text NOT NULL,
  details jsonb,
  performed_by uuid,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.supabase_instance_backups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id uuid REFERENCES public.supabase_instances(id),
  backup_type text DEFAULT 'full',
  status text DEFAULT 'pending',
  size_bytes bigint,
  storage_path text,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.system_backups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  backup_type text NOT NULL,
  status text DEFAULT 'pending',
  file_path text,
  file_size bigint,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.system_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_key text NOT NULL UNIQUE,
  config_value text,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.template_variables (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  variable_key text NOT NULL UNIQUE,
  variable_name text NOT NULL,
  description text,
  default_value text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.trending_rankings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id text NOT NULL,
  rank_position integer NOT NULL,
  score numeric NOT NULL,
  view_count integer DEFAULT 0,
  period text DEFAULT 'daily',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.two_factor_auth (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  secret text NOT NULL,
  is_enabled boolean DEFAULT false,
  backup_codes jsonb,
  verified_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.user_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  session_token text NOT NULL UNIQUE,
  device_info jsonb,
  ip_address text,
  user_agent text,
  is_active boolean DEFAULT true,
  last_activity_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.user_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  plan_id uuid,
  status text DEFAULT 'active',
  starts_at timestamptz DEFAULT now(),
  ends_at timestamptz,
  auto_renew boolean DEFAULT true,
  payment_method text,
  external_subscription_id text,
  trial_ends_at timestamptz,
  cancelled_at timestamptz,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.watch_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  channel_id text NOT NULL,
  content_id text,
  progress_seconds integer DEFAULT 0,
  duration_seconds integer,
  completed boolean DEFAULT false,
  last_watched_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, channel_id, content_id)
);

-- ============================================================
-- PARTE 6: HABILITAR RLS EM TODAS AS TABELAS
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iptv_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ab_test_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ab_test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_badge_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_phones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_shortcuts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_dashboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_fraud_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_link_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_marketing_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_onboarding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_sessions_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_status_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_fingerprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epg_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flag_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homepage_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homepage_faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ip_blacklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ip_whitelist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iptv_playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iptv_playlist_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iptv_cdn_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iptv_channel_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iptv_probe_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iptv_stream_fingerprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iptv_stream_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iptv_stream_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iptv_transcode_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.m3u_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mercado_pago_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mercado_pago_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.migration_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passkey_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_email_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_verification_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playback_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pwa_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remote_command_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rls_audit_resolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rls_fix_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rls_scan_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_alert_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sent_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_change_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streaming_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supabase_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supabase_instance_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supabase_instance_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_variables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trending_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.two_factor_auth ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_progress ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PARTE 7: CRIAR RLS POLICIES
-- ============================================================

-- Profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id OR is_admin_or_master());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id OR is_admin_or_master());
CREATE POLICY "Admins can manage profiles" ON public.profiles FOR ALL USING (is_admin_or_master());

-- User Roles
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id OR is_admin_or_master());
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (is_admin_or_master());

-- Subscription Plans
CREATE POLICY "Anyone can view active plans" ON public.subscription_plans FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage plans" ON public.subscription_plans FOR ALL USING (is_admin_or_master());

-- IPTV Channels
CREATE POLICY "Authenticated users can view channels" ON public.iptv_channels FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can manage channels" ON public.iptv_channels FOR ALL USING (is_admin_or_master());

-- Notification Templates
CREATE POLICY "Admins can manage templates" ON public.notification_templates FOR ALL USING (is_admin_or_master());

-- Auto Notifications
CREATE POLICY "Admins can manage auto notifications" ON public.auto_notifications FOR ALL USING (is_admin_or_master());

-- WhatsApp Config
CREATE POLICY "Admins can manage whatsapp config" ON public.whatsapp_config FOR ALL USING (is_admin_or_master());

-- Test Contacts
CREATE POLICY "Admins can manage test contacts" ON public.test_contacts FOR ALL USING (is_admin_or_master());

-- Activity Logs
CREATE POLICY "Admins can view all activity" ON public.activity_logs FOR SELECT USING (is_admin_or_master());
CREATE POLICY "Users can view own activity" ON public.activity_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Anyone can insert activity" ON public.activity_logs FOR INSERT WITH CHECK (true);

-- Payments
CREATE POLICY "Users can view own payments" ON public.payments FOR SELECT USING (auth.uid() = user_id OR is_admin_or_master());
CREATE POLICY "Admins can manage payments" ON public.payments FOR ALL USING (is_admin_or_master());

-- Notification Logs
CREATE POLICY "Admins can manage notification logs" ON public.notification_logs FOR ALL USING (is_admin_or_master());

-- AB Tests
CREATE POLICY "Admins can manage ab tests" ON public.ab_test_offers FOR ALL USING (is_admin_or_master());
CREATE POLICY "Anyone can view active ab tests" ON public.ab_test_offers FOR SELECT USING (active = true);
CREATE POLICY "Admins can view ab results" ON public.ab_test_results FOR SELECT USING (is_admin_or_master());
CREATE POLICY "Anyone can insert ab results" ON public.ab_test_results FOR INSERT WITH CHECK (true);

-- Account Deletion
CREATE POLICY "Users can manage own deletion requests" ON public.account_deletion_requests FOR ALL USING (auth.uid() = user_id OR is_admin_or_master());

-- Admin tables
CREATE POLICY "Users can manage own badge notifications" ON public.admin_badge_notifications FOR ALL USING (auth.uid() = admin_id);
CREATE POLICY "Users can manage own favorites" ON public.admin_favorites FOR ALL USING (auth.uid() = admin_id);
CREATE POLICY "Admins can manage admin_phones" ON public.admin_phones FOR ALL USING (is_admin_or_master());
CREATE POLICY "Users can manage own shortcuts" ON public.admin_shortcuts FOR ALL USING (auth.uid() = user_id);

-- Affiliates
CREATE POLICY "Admins can manage affiliates" ON public.affiliates FOR ALL USING (is_admin_or_master());
CREATE POLICY "Users can view own affiliate" ON public.affiliates FOR SELECT USING (auth.uid() = user_id);

-- Affiliate related
CREATE POLICY "Admins can manage analytics" ON public.affiliate_analytics FOR ALL USING (is_admin_or_master());
CREATE POLICY "Admins can manage config" ON public.affiliate_config FOR ALL USING (is_admin_or_master());
CREATE POLICY "Anyone can view config" ON public.affiliate_config FOR SELECT USING (true);
CREATE POLICY "Admins can manage fraud logs" ON public.affiliate_fraud_logs FOR ALL USING (is_admin_or_master());
CREATE POLICY "Admins can manage clicks" ON public.affiliate_link_clicks FOR ALL USING (is_admin_or_master());
CREATE POLICY "Anyone can insert clicks" ON public.affiliate_link_clicks FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can manage marketing materials" ON public.affiliate_marketing_materials FOR ALL USING (is_admin_or_master());
CREATE POLICY "Anyone can view marketing materials" ON public.affiliate_marketing_materials FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage promotions" ON public.affiliate_promotions FOR ALL USING (is_admin_or_master());
CREATE POLICY "Anyone can view promotions" ON public.affiliate_promotions FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage tiers" ON public.affiliate_tiers FOR ALL USING (is_admin_or_master());
CREATE POLICY "Anyone can view tiers" ON public.affiliate_tiers FOR SELECT USING (true);

-- API Usage
CREATE POLICY "Admins can manage api usage" ON public.api_usage FOR ALL USING (is_admin_or_master());

-- App Versions
CREATE POLICY "Admins can manage app versions" ON public.app_versions FOR ALL USING (is_admin_or_master());
CREATE POLICY "Anyone can view app versions" ON public.app_versions FOR SELECT USING (true);

-- Auth Sessions Log
CREATE POLICY "Admins can manage auth logs" ON public.auth_sessions_log FOR ALL USING (is_admin_or_master());
CREATE POLICY "Anyone can insert auth logs" ON public.auth_sessions_log FOR INSERT WITH CHECK (true);

-- Banners
CREATE POLICY "Admins can manage banners" ON public.banners FOR ALL USING (is_admin_or_master());
CREATE POLICY "Anyone can view active banners" ON public.banners FOR SELECT USING (is_active = true);

-- Status History
CREATE POLICY "Admins can manage status history" ON public.client_status_history FOR ALL USING (is_admin_or_master());

-- Custom Status Badges
CREATE POLICY "Admins can manage badges" ON public.custom_status_badges FOR ALL USING (is_admin_or_master());
CREATE POLICY "Anyone can view badges" ON public.custom_status_badges FOR SELECT USING (true);

-- Dashboard Widgets
CREATE POLICY "Users can manage own widgets" ON public.dashboard_widgets FOR ALL USING (auth.uid() = user_id);

-- Device Fingerprints
CREATE POLICY "Users can manage own fingerprints" ON public.device_fingerprints FOR ALL USING (auth.uid() = user_id OR is_admin_or_master());

-- Discount Coupons
CREATE POLICY "Admins can manage coupons" ON public.discount_coupons FOR ALL USING (is_admin_or_master());
CREATE POLICY "Anyone can view active coupons" ON public.discount_coupons FOR SELECT USING (is_active = true);

-- Email Change Requests
CREATE POLICY "Users can manage own email changes" ON public.email_change_requests FOR ALL USING (auth.uid() = user_id);

-- EPG Programs
CREATE POLICY "Admins can manage EPG programs" ON public.epg_programs FOR ALL USING (is_admin_or_master());
CREATE POLICY "EPG programs are publicly readable" ON public.epg_programs FOR SELECT USING (true);

-- Feature Flags
CREATE POLICY "Admins can manage flags" ON public.feature_flag_config FOR ALL USING (is_admin_or_master());
CREATE POLICY "Anyone can read flags" ON public.feature_flag_config FOR SELECT USING (true);

-- Health Checks
CREATE POLICY "Admins can manage health checks" ON public.health_checks FOR ALL USING (is_admin_or_master());
CREATE POLICY "Anyone can insert health checks" ON public.health_checks FOR INSERT WITH CHECK (true);

-- Homepage Content
CREATE POLICY "Admins can manage homepage content" ON public.homepage_content FOR ALL USING (is_admin_or_master());
CREATE POLICY "Anyone can view homepage content" ON public.homepage_content FOR SELECT USING (true);

-- Homepage FAQs
CREATE POLICY "Admins can manage FAQs" ON public.homepage_faqs FOR ALL USING (is_admin_or_master());
CREATE POLICY "Anyone can view FAQs" ON public.homepage_faqs FOR SELECT USING (is_active = true);

-- IP Blacklist/Whitelist
CREATE POLICY "Admins can manage ip blacklist" ON public.ip_blacklist FOR ALL USING (is_admin_or_master());
CREATE POLICY "Admins can manage ip whitelist" ON public.ip_whitelist FOR ALL USING (is_admin_or_master());

-- IPTV Related
CREATE POLICY "Admins can manage cdn cache" ON public.iptv_cdn_cache FOR ALL USING (is_admin_or_master());
CREATE POLICY "Admins can manage channel metrics" ON public.iptv_channel_metrics FOR ALL USING (is_admin_or_master());
CREATE POLICY "Admins can manage playlists" ON public.iptv_playlists FOR ALL USING (is_admin_or_master());
CREATE POLICY "Users can view own playlists" ON public.iptv_playlists FOR SELECT USING (auth.uid() = user_id OR is_public = true);
CREATE POLICY "Admins can manage playlist channels" ON public.iptv_playlist_channels FOR ALL USING (is_admin_or_master());
CREATE POLICY "Admins can manage probe jobs" ON public.iptv_probe_jobs FOR ALL USING (is_admin_or_master());
CREATE POLICY "Admins can manage stream tokens" ON public.iptv_stream_tokens FOR ALL USING (is_admin_or_master());
CREATE POLICY "Users can view own tokens" ON public.iptv_stream_tokens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage transcode jobs" ON public.iptv_transcode_jobs FOR ALL USING (is_admin_or_master());

-- Login Alerts
CREATE POLICY "Users can manage own login alerts" ON public.login_alerts FOR ALL USING (auth.uid() = user_id OR is_admin_or_master());

-- M3U Sources
CREATE POLICY "Admins can manage m3u sources" ON public.m3u_sources FOR ALL USING (is_admin_or_master());

-- MercadoPago
CREATE POLICY "Admins can manage mercado pago" ON public.mercado_pago_config FOR ALL USING (is_admin_or_master());
CREATE POLICY "Admins can manage webhooks" ON public.mercado_pago_webhooks FOR ALL USING (is_admin_or_master());

-- Migration Audit
CREATE POLICY "Admins can manage migration audit" ON public.migration_audit FOR ALL USING (is_admin_or_master());

-- Notification Queue
CREATE POLICY "Admins can manage notification queue" ON public.notification_queue FOR ALL USING (is_admin_or_master());

-- Passkeys
CREATE POLICY "Users can manage own passkeys" ON public.passkey_credentials FOR ALL USING (auth.uid() = user_id);

-- Payment History
CREATE POLICY "Admins can manage payment history" ON public.payment_history FOR ALL USING (is_admin_or_master());

-- Phone Verification
CREATE POLICY "Users can manage own phone verification" ON public.phone_verification_codes FOR ALL USING (auth.uid() = user_id);

-- Playback Tokens
CREATE POLICY "Users can manage own playback tokens" ON public.playback_tokens FOR ALL USING (auth.uid() = user_id);

-- Player Events
CREATE POLICY "Admins can view player events" ON public.player_events FOR SELECT USING (is_admin_or_master());
CREATE POLICY "Anyone can insert player events" ON public.player_events FOR INSERT WITH CHECK (true);

-- PWA Settings
CREATE POLICY "Users can manage own pwa settings" ON public.pwa_settings FOR ALL USING (auth.uid() = user_id);

-- Rate Limit Tracking
CREATE POLICY "Admins can manage rate limits" ON public.rate_limit_tracking FOR ALL USING (is_admin_or_master());

-- Refresh Tokens
CREATE POLICY "Users can manage own refresh tokens" ON public.refresh_tokens FOR ALL USING (auth.uid() = user_id);

-- Remote Command Audit
CREATE POLICY "Admins can manage remote commands" ON public.remote_command_audit FOR ALL USING (is_admin_or_master());

-- RLS Audit
CREATE POLICY "Admins can manage rls audit" ON public.rls_audit_resolutions FOR ALL USING (is_admin_or_master());
CREATE POLICY "Admins can manage rls backups" ON public.rls_fix_backups FOR ALL USING (is_admin_or_master());
CREATE POLICY "Admins can manage rls scans" ON public.rls_scan_results FOR ALL USING (is_admin_or_master());

-- Security
CREATE POLICY "Admins can manage security alerts" ON public.security_alerts FOR ALL USING (is_admin_or_master());
CREATE POLICY "Admins can manage alert deliveries" ON public.security_alert_deliveries FOR ALL USING (is_admin_or_master());
CREATE POLICY "Admins can manage security events" ON public.security_events FOR ALL USING (is_admin_or_master());
CREATE POLICY "Anyone can insert security events" ON public.security_events FOR INSERT WITH CHECK (true);

-- Sent Notifications
CREATE POLICY "Admins can manage sent notifications" ON public.sent_notifications FOR ALL USING (is_admin_or_master());

-- Streaming Metrics
CREATE POLICY "Admins can view streaming metrics" ON public.streaming_metrics FOR SELECT USING (is_admin_or_master());
CREATE POLICY "Anyone can insert streaming metrics" ON public.streaming_metrics FOR INSERT WITH CHECK (true);

-- Supabase Instances
CREATE POLICY "Admins can manage instances" ON public.supabase_instances FOR ALL USING (is_admin_or_master());
CREATE POLICY "Admins can manage instance audit" ON public.supabase_instance_audit FOR ALL USING (is_admin_or_master());
CREATE POLICY "Admins can manage instance backups" ON public.supabase_instance_backups FOR ALL USING (is_admin_or_master());

-- System
CREATE POLICY "Admins can manage backups" ON public.system_backups FOR ALL USING (is_admin_or_master());
CREATE POLICY "Admins can manage system config" ON public.system_config FOR ALL USING (is_admin_or_master());
CREATE POLICY "Anyone can read system config" ON public.system_config FOR SELECT USING (true);

-- Template Variables
CREATE POLICY "Admins can manage template variables" ON public.template_variables FOR ALL USING (is_admin_or_master());
CREATE POLICY "Anyone can view template variables" ON public.template_variables FOR SELECT USING (true);

-- Trending
CREATE POLICY "Admins can manage trending" ON public.trending_rankings FOR ALL USING (is_admin_or_master());
CREATE POLICY "Anyone can view trending" ON public.trending_rankings FOR SELECT USING (true);

-- 2FA
CREATE POLICY "Users can manage own 2fa" ON public.two_factor_auth FOR ALL USING (auth.uid() = user_id);

-- User Sessions
CREATE POLICY "Users can manage own sessions" ON public.user_sessions FOR ALL USING (auth.uid() = user_id);

-- User Subscriptions
CREATE POLICY "Users can view own subscriptions" ON public.user_subscriptions FOR SELECT USING (auth.uid() = user_id OR is_admin_or_master());
CREATE POLICY "Admins can manage subscriptions" ON public.user_subscriptions FOR ALL USING (is_admin_or_master());

-- Watch Progress
CREATE POLICY "Users can manage own watch progress" ON public.watch_progress FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- PARTE 8: CRIAR ÍNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_contact_phone ON public.profiles(contact_phone);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);
CREATE INDEX IF NOT EXISTS idx_iptv_channels_slug ON public.iptv_channels(slug);
CREATE INDEX IF NOT EXISTS idx_iptv_channels_category ON public.iptv_channels(category);
CREATE INDEX IF NOT EXISTS idx_iptv_channels_is_healthy ON public.iptv_channels(is_healthy);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON public.notification_logs(created_at);

-- ============================================================
-- PARTE 9: TRIGGER handle_new_user
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nome, contact_phone, origem_cadastro)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'telefone',
    COALESCE(NEW.raw_user_meta_data->>'origem_cadastro', 'Website')
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'client');

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Criar trigger para novos usuários
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- FIM DO SCRIPT DE MIGRAÇÃO
-- ============================================================
-- Após executar este script, use a Edge Function data-migration
-- para copiar os dados do Lovable Cloud para este banco.
