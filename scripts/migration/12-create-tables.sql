-- =====================================================
-- SCRIPT 12: CREATE ALL TABLES
-- Source: Lovable Cloud (waxgowafohlrfoefwhsf)
-- Target: Supabase Cloud (sdvyxdghxqmntyoweqbd)
-- Execute AFTER types and functions
-- =====================================================

-- =====================================================
-- CORE TABLES
-- =====================================================

-- profiles (main user data table)
CREATE TABLE public.profiles (
    id UUID NOT NULL PRIMARY KEY,
    email TEXT,
    nome TEXT,
    contact_phone TEXT,
    plano TEXT,
    data_vencimento TIMESTAMP WITH TIME ZONE,
    data_contratacao TIMESTAMP WITH TIME ZONE,
    valor_pago NUMERIC,
    cliente_ativo BOOLEAN DEFAULT true,
    situacao TEXT DEFAULT 'trial',
    origem_cadastro TEXT DEFAULT 'Website',
    dispositivo_contratado TEXT,
    mac_smart_one TEXT,
    avatar_url TEXT,
    totp_enabled BOOLEAN DEFAULT false,
    totp_secret TEXT,
    totp_verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- user_roles
CREATE TABLE public.user_roles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    role app_role NOT NULL DEFAULT 'client',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(user_id, role)
);

-- subscription_plans
CREATE TABLE public.subscription_plans (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC NOT NULL,
    duration_days INTEGER NOT NULL,
    features JSONB,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- AB TESTING
-- =====================================================

CREATE TABLE public.ab_test_offers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    test_name TEXT NOT NULL,
    variant_a JSONB NOT NULL,
    variant_b JSONB NOT NULL,
    active BOOLEAN DEFAULT true,
    start_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
    end_date TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.ab_test_results (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    test_id UUID REFERENCES public.ab_test_offers(id),
    user_id UUID,
    variant_shown TEXT NOT NULL,
    converted BOOLEAN DEFAULT false,
    session_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- ACCOUNT MANAGEMENT
-- =====================================================

CREATE TABLE public.account_deletion_requests (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    reason TEXT,
    confirmation_token TEXT UNIQUE,
    scheduled_deletion_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- ACTIVITY & LOGGING
-- =====================================================

CREATE TABLE public.activity_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    details JSONB,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.auth_sessions_log (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    user_email TEXT,
    event_type TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- ADMIN FEATURES
-- =====================================================

CREATE TABLE public.admin_badge_notifications (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_id UUID,
    badge_id UUID,
    badge_name TEXT NOT NULL,
    badge_rarity TEXT,
    message TEXT,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.admin_favorites (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_id UUID,
    item_type TEXT NOT NULL,
    item_id TEXT NOT NULL,
    item_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(admin_id, item_type, item_id)
);

CREATE TABLE public.admin_phones (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_id UUID,
    phone TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.admin_shortcuts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    title TEXT NOT NULL,
    path TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- AFFILIATES
-- =====================================================

CREATE TABLE public.affiliates (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    code TEXT NOT NULL UNIQUE,
    name TEXT,
    commission_rate NUMERIC DEFAULT 10,
    commission_type TEXT DEFAULT 'percentage',
    commission_value NUMERIC,
    is_active BOOLEAN DEFAULT true,
    status TEXT DEFAULT 'active',
    total_clicks INTEGER DEFAULT 0,
    total_referrals INTEGER DEFAULT 0,
    total_earnings NUMERIC DEFAULT 0,
    available_balance NUMERIC DEFAULT 0,
    conversion_rate NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.affiliate_analytics (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    affiliate_id UUID REFERENCES public.affiliates(id),
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    clicks INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    conversion_rate NUMERIC DEFAULT 0,
    revenue_generated NUMERIC DEFAULT 0,
    commission_earned NUMERIC DEFAULT 0,
    avg_order_value NUMERIC DEFAULT 0,
    referrals INTEGER DEFAULT 0,
    earnings NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.affiliate_config (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    config_key TEXT NOT NULL UNIQUE,
    config_value TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.affiliate_dashboard (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    affiliate_id UUID REFERENCES public.affiliates(id),
    widget_config JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.affiliate_fraud_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    affiliate_id UUID REFERENCES public.affiliates(id),
    event_type TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    details JSONB,
    severity TEXT DEFAULT 'low',
    notes TEXT,
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID,
    resolution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.affiliate_link_clicks (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    affiliate_id UUID REFERENCES public.affiliates(id),
    ip_address TEXT,
    user_agent TEXT,
    referrer TEXT,
    referer TEXT,
    landing_page TEXT,
    device_type TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    utm_term TEXT,
    utm_content TEXT,
    converted BOOLEAN DEFAULT false,
    converted_at TIMESTAMP WITH TIME ZONE,
    clicked_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.affiliate_links (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    affiliate_id UUID REFERENCES public.affiliates(id),
    url TEXT NOT NULL,
    name TEXT,
    description TEXT,
    short_code TEXT UNIQUE,
    clicks INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    revenue NUMERIC DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.affiliate_marketing_materials (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    type TEXT DEFAULT 'banner',
    content_url TEXT,
    content_text TEXT,
    thumbnail_url TEXT,
    dimensions TEXT,
    file_size INTEGER,
    downloads INTEGER DEFAULT 0,
    download_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.affiliate_onboarding (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    affiliate_id UUID REFERENCES public.affiliates(id),
    step_key TEXT NOT NULL,
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.affiliate_payouts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    affiliate_id UUID REFERENCES public.affiliates(id),
    amount NUMERIC NOT NULL,
    status TEXT DEFAULT 'pending',
    payment_method TEXT,
    transaction_id TEXT,
    period_start TIMESTAMP WITH TIME ZONE,
    period_end TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    paid_at TIMESTAMP WITH TIME ZONE,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.affiliate_promotions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    code TEXT,
    discount_type TEXT DEFAULT 'percentage',
    discount_value NUMERIC DEFAULT 0,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    max_uses INTEGER,
    usage_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.affiliate_referrals (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    affiliate_id UUID REFERENCES public.affiliates(id),
    referred_user_id UUID,
    status TEXT DEFAULT 'pending',
    commission_amount NUMERIC DEFAULT 0,
    commission_earned NUMERIC DEFAULT 0,
    commission_type TEXT,
    commission_value NUMERIC,
    plan_value NUMERIC,
    converted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.affiliate_reports (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    affiliate_id UUID REFERENCES public.affiliates(id),
    report_type TEXT NOT NULL,
    period_start TIMESTAMP WITH TIME ZONE,
    period_end TIMESTAMP WITH TIME ZONE,
    data JSONB,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.affiliate_tiers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    commission_rate NUMERIC NOT NULL,
    commission_percentage NUMERIC,
    min_referrals INTEGER DEFAULT 0,
    min_revenue NUMERIC DEFAULT 0,
    bonus_amount NUMERIC DEFAULT 0,
    benefits JSONB,
    color TEXT,
    icon TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.affiliate_withdrawals (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    affiliate_id UUID REFERENCES public.affiliates(id),
    amount NUMERIC NOT NULL,
    status TEXT DEFAULT 'pending',
    payment_method TEXT,
    payment_details JSONB,
    withdrawal_type TEXT,
    notes TEXT,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- API & SYSTEM
-- =====================================================

CREATE TABLE public.api_usage (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    endpoint TEXT NOT NULL,
    method TEXT,
    status_code INTEGER,
    response_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.app_versions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    platform TEXT NOT NULL,
    version TEXT NOT NULL,
    min_version TEXT,
    is_required BOOLEAN DEFAULT false,
    release_notes TEXT,
    download_url TEXT,
    released_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.banners (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    image_url TEXT,
    link_url TEXT,
    position TEXT DEFAULT 'home',
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- CLIENT MANAGEMENT
-- =====================================================

CREATE TABLE public.client_status_history (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id UUID REFERENCES public.profiles(id),
    old_status TEXT,
    new_status TEXT NOT NULL,
    reason TEXT,
    changed_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.custom_status_badges (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    status_key TEXT NOT NULL,
    label TEXT NOT NULL,
    color TEXT,
    icon TEXT,
    description TEXT,
    order_index INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- DASHBOARD
-- =====================================================

CREATE TABLE public.dashboard_widgets (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    widget_type TEXT NOT NULL,
    config JSONB,
    position INTEGER DEFAULT 0,
    is_visible BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- SECURITY & AUTH
-- =====================================================

CREATE TABLE public.device_fingerprints (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    fingerprint_hash TEXT NOT NULL,
    device_name TEXT,
    device_type TEXT,
    browser TEXT,
    os TEXT,
    is_trusted BOOLEAN DEFAULT false,
    trust_expires_at TIMESTAMP WITH TIME ZONE,
    login_count INTEGER DEFAULT 1,
    first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(user_id, fingerprint_hash)
);

CREATE TABLE public.ip_blacklist (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    ip_address TEXT NOT NULL UNIQUE,
    reason TEXT,
    auto_blocked BOOLEAN DEFAULT false,
    is_permanent BOOLEAN DEFAULT false,
    failed_attempts INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMP WITH TIME ZONE,
    blocked_until TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    unblocked_at TIMESTAMP WITH TIME ZONE,
    severity TEXT DEFAULT 'medium',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.ip_whitelist (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    ip_address TEXT NOT NULL UNIQUE,
    description TEXT,
    added_by UUID,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.login_alerts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    device_fingerprint_id UUID REFERENCES public.device_fingerprints(id),
    alert_type TEXT DEFAULT 'new_device',
    ip_address TEXT,
    location_info JSONB,
    sent_at TIMESTAMP WITH TIME ZONE,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    alert_sent_via TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.passkey_credentials (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    credential_id TEXT NOT NULL UNIQUE,
    public_key TEXT NOT NULL,
    device_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    last_used_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE public.rate_limit_tracking (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    identifier TEXT NOT NULL,
    identifier_type TEXT NOT NULL DEFAULT 'ip',
    request_count INTEGER DEFAULT 1,
    window_start TIMESTAMP WITH TIME ZONE NOT NULL,
    window_duration_seconds INTEGER DEFAULT 60,
    last_request_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(identifier, identifier_type, window_start)
);

CREATE TABLE public.refresh_tokens (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    token_hash TEXT NOT NULL,
    family_id UUID NOT NULL,
    is_revoked BOOLEAN DEFAULT false,
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoked_reason TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.security_alerts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    alert_type TEXT NOT NULL,
    severity TEXT DEFAULT 'medium',
    title TEXT NOT NULL,
    description TEXT,
    details JSONB,
    user_id UUID,
    ip_address TEXT,
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.security_alert_deliveries (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    alert_id UUID REFERENCES public.security_alerts(id),
    channel TEXT NOT NULL,
    recipient TEXT,
    status TEXT DEFAULT 'pending',
    sent_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.security_events (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type TEXT NOT NULL,
    event_details JSONB,
    user_id UUID,
    ip_address TEXT,
    user_agent TEXT,
    severity TEXT DEFAULT 'info',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.two_factor_auth (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE,
    secret TEXT NOT NULL,
    is_enabled BOOLEAN DEFAULT false,
    backup_codes TEXT[],
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.user_sessions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    session_token TEXT NOT NULL UNIQUE,
    device_info JSONB,
    ip_address TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- COUPONS & PAYMENTS
-- =====================================================

CREATE TABLE public.discount_coupons (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    discount_type TEXT DEFAULT 'percentage',
    discount_value NUMERIC NOT NULL,
    min_purchase_amount NUMERIC,
    max_uses INTEGER,
    current_uses INTEGER DEFAULT 0,
    applies_to TEXT DEFAULT 'all',
    valid_from TIMESTAMP WITH TIME ZONE,
    valid_until TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    active BOOLEAN DEFAULT true,
    auto_generated BOOLEAN DEFAULT false,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.payments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    plan_id UUID REFERENCES public.subscription_plans(id),
    amount NUMERIC NOT NULL,
    status TEXT DEFAULT 'pending',
    payment_method TEXT,
    external_id TEXT,
    metadata JSONB,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.payment_history (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    payment_id UUID REFERENCES public.payments(id),
    action TEXT NOT NULL,
    old_status TEXT,
    new_status TEXT,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.user_subscriptions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    plan_id UUID REFERENCES public.subscription_plans(id),
    status TEXT DEFAULT 'active',
    starts_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    ends_at TIMESTAMP WITH TIME ZONE,
    auto_renew BOOLEAN DEFAULT true,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- EMAIL & PHONE
-- =====================================================

CREATE TABLE public.email_change_requests (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    old_email TEXT NOT NULL,
    new_email TEXT NOT NULL,
    token TEXT NOT NULL,
    verification_code TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.pending_email_changes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    new_email TEXT NOT NULL,
    token TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.phone_verification_codes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    phone TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    attempts INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- HOMEPAGE & CONTENT
-- =====================================================

CREATE TABLE public.homepage_content (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    section_key TEXT NOT NULL UNIQUE,
    content JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.homepage_faqs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- EPG
-- =====================================================

CREATE TABLE public.epg_programs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    channel_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    category TEXT,
    rating TEXT,
    episode_info TEXT,
    icon_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- FEATURE FLAGS & CONFIG
-- =====================================================

CREATE TABLE public.feature_flag_config (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    flag_name TEXT NOT NULL UNIQUE,
    enabled BOOLEAN DEFAULT false,
    description TEXT,
    percentage INTEGER DEFAULT 100,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.health_checks (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    service_name TEXT NOT NULL,
    status TEXT DEFAULT 'unknown',
    response_time_ms INTEGER,
    error_message TEXT,
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- IPTV
-- =====================================================

CREATE TABLE public.iptv_channels (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    original_url TEXT NOT NULL,
    logo_url TEXT,
    category TEXT,
    content_type TEXT DEFAULT 'live',
    resolution TEXT,
    codec_hint TEXT,
    bitrate_estimate INTEGER,
    is_healthy BOOLEAN DEFAULT true,
    health_score INTEGER DEFAULT 100,
    last_probe_at TIMESTAMP WITH TIME ZONE,
    probe_error TEXT,
    shard_id INTEGER DEFAULT 0,
    priority INTEGER DEFAULT 0,
    fallback_channel_id BIGINT REFERENCES public.iptv_channels(id),
    transcode_status TEXT,
    transcode_manifest_url TEXT,
    is_series BOOLEAN DEFAULT false,
    series_name TEXT,
    season_number INTEGER,
    episode_number INTEGER,
    episode_title TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.iptv_playlists (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    channel_count INTEGER DEFAULT 0,
    settings JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.iptv_playlist_channels (
    playlist_id BIGINT NOT NULL REFERENCES public.iptv_playlists(id) ON DELETE CASCADE,
    channel_id BIGINT NOT NULL REFERENCES public.iptv_channels(id) ON DELETE CASCADE,
    position INTEGER DEFAULT 0,
    custom_name TEXT,
    custom_logo TEXT,
    is_hidden BOOLEAN DEFAULT false,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    PRIMARY KEY (playlist_id, channel_id)
);

CREATE TABLE public.iptv_stream_tokens (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    channel_id BIGINT REFERENCES public.iptv_channels(id),
    token TEXT NOT NULL UNIQUE,
    ip_address TEXT,
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.iptv_probe_jobs (
    id BIGSERIAL PRIMARY KEY,
    channel_id BIGINT REFERENCES public.iptv_channels(id),
    status TEXT DEFAULT 'pending',
    result JSONB,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.iptv_transcode_jobs (
    id BIGSERIAL PRIMARY KEY,
    channel_id BIGINT REFERENCES public.iptv_channels(id),
    status TEXT DEFAULT 'pending',
    mode TEXT DEFAULT 'hls',
    target_resolutions TEXT[],
    progress INTEGER DEFAULT 0,
    output_urls JSONB,
    worker_id TEXT,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.iptv_channel_metrics (
    id BIGSERIAL PRIMARY KEY,
    channel_id BIGINT REFERENCES public.iptv_channels(id),
    metric_type TEXT NOT NULL,
    value NUMERIC NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.iptv_cdn_cache (
    id BIGSERIAL PRIMARY KEY,
    channel_id BIGINT REFERENCES public.iptv_channels(id),
    cache_key TEXT NOT NULL UNIQUE,
    cdn_provider TEXT,
    manifest_url TEXT,
    segment_prefix TEXT,
    is_warm BOOLEAN DEFAULT false,
    last_access_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.iptv_stream_fingerprints (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    channel_id BIGINT REFERENCES public.iptv_channels(id),
    perceptual_hash TEXT NOT NULL,
    hash_algorithm TEXT DEFAULT 'phash',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.iptv_stream_groups (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    display_name TEXT,
    canonical_channel_id BIGINT REFERENCES public.iptv_channels(id),
    source_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- M3U SOURCES
-- =====================================================

CREATE TABLE public.m3u_sources (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT,
    source_type TEXT DEFAULT 'url',
    is_active BOOLEAN DEFAULT true,
    sync_status TEXT DEFAULT 'pending',
    last_sync_at TIMESTAMP WITH TIME ZONE,
    entry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- MERCADO PAGO
-- =====================================================

CREATE TABLE public.mercado_pago_config (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    public_key TEXT,
    sandbox_access_token TEXT,
    production_access_token TEXT,
    use_sandbox BOOLEAN DEFAULT true,
    webhook_secret TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.mercado_pago_webhooks (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id TEXT,
    event_type TEXT,
    action TEXT,
    data_id TEXT,
    raw_payload JSONB,
    processed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- MIGRATION
-- =====================================================

CREATE TABLE public.migration_audit (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    migration_name TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    executed_by TEXT,
    rows_affected INTEGER,
    duration_ms INTEGER,
    error_message TEXT,
    details JSONB,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- NOTIFICATIONS
-- =====================================================

CREATE TABLE public.notification_templates (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    template_key TEXT NOT NULL UNIQUE,
    message_template TEXT NOT NULL,
    description TEXT,
    variables JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.template_variables (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    template_id UUID REFERENCES public.notification_templates(id),
    variable_name TEXT NOT NULL,
    variable_type TEXT DEFAULT 'text',
    description TEXT,
    default_value TEXT,
    is_required BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.auto_notifications (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    trigger_type TEXT NOT NULL,
    name TEXT,
    description TEXT,
    template_key TEXT,
    message_template TEXT,
    conditions JSONB,
    delay_hours INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.notification_queue (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    recipient_id UUID,
    recipient_phone TEXT,
    template_key TEXT,
    message_content TEXT,
    variables JSONB,
    priority INTEGER DEFAULT 5,
    status TEXT DEFAULT 'pending',
    scheduled_for TIMESTAMP WITH TIME ZONE,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    last_attempt_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.notification_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    recipient_id UUID,
    recipient_phone TEXT,
    template_key TEXT,
    message_content TEXT,
    status TEXT DEFAULT 'pending',
    external_id TEXT,
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.sent_notifications (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    notification_type TEXT NOT NULL,
    channel TEXT DEFAULT 'whatsapp',
    recipient TEXT,
    message TEXT,
    status TEXT DEFAULT 'sent',
    metadata JSONB,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.whatsapp_config (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    api_url TEXT,
    app_key TEXT,
    auth_key TEXT,
    default_phone TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.test_contacts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- PLAYER & STREAMING
-- =====================================================

CREATE TABLE public.playback_tokens (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    token TEXT NOT NULL UNIQUE,
    channel_id TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.player_events (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    session_id TEXT,
    event_type TEXT NOT NULL,
    channel_id TEXT,
    channel_name TEXT,
    timestamp_ms BIGINT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.streaming_metrics (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    channel_id TEXT,
    session_id TEXT,
    buffer_time_ms INTEGER,
    latency_ms INTEGER,
    bitrate INTEGER,
    resolution TEXT,
    errors INTEGER DEFAULT 0,
    quality_score NUMERIC,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.watch_progress (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    content_id TEXT NOT NULL,
    content_type TEXT DEFAULT 'channel',
    progress_seconds INTEGER DEFAULT 0,
    duration_seconds INTEGER,
    completed BOOLEAN DEFAULT false,
    last_watched_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(user_id, content_id)
);

CREATE TABLE public.trending_rankings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    content_id TEXT NOT NULL,
    content_type TEXT NOT NULL,
    rank_position INTEGER NOT NULL,
    view_count INTEGER DEFAULT 0,
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- PWA
-- =====================================================

CREATE TABLE public.pwa_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    app_name TEXT DEFAULT 'IPTV Link',
    short_name TEXT DEFAULT 'IPTV',
    theme_color TEXT DEFAULT '#1a1a2e',
    background_color TEXT DEFAULT '#1a1a2e',
    display TEXT DEFAULT 'standalone',
    orientation TEXT DEFAULT 'any',
    icon_192 TEXT,
    icon_512 TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- REMOTE COMMANDS
-- =====================================================

CREATE TABLE public.remote_command_audit (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    command_type TEXT NOT NULL,
    target_server TEXT,
    command_data JSONB,
    result JSONB,
    status TEXT DEFAULT 'pending',
    executed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- RLS AUDIT
-- =====================================================

CREATE TABLE public.rls_scan_results (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    scan_id TEXT NOT NULL,
    table_name TEXT NOT NULL,
    issue_type TEXT NOT NULL,
    severity TEXT DEFAULT 'medium',
    description TEXT,
    recommendation TEXT,
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.rls_fix_backups (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    scan_result_id UUID REFERENCES public.rls_scan_results(id),
    table_name TEXT NOT NULL,
    policy_name TEXT,
    original_definition TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.rls_audit_resolutions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    scan_result_id UUID REFERENCES public.rls_scan_results(id),
    resolution_type TEXT NOT NULL,
    resolution_details JSONB,
    resolved_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- STATUS HISTORY
-- =====================================================

CREATE TABLE public.status_change_history (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    old_status TEXT,
    new_status TEXT NOT NULL,
    reason TEXT,
    changed_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- SUPABASE INSTANCES
-- =====================================================

CREATE TABLE public.supabase_instances (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    anon_key TEXT,
    service_role_key TEXT,
    is_primary BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    health_status TEXT DEFAULT 'unknown',
    last_health_check TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.supabase_instance_audit (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    instance_id UUID REFERENCES public.supabase_instances(id),
    action TEXT NOT NULL,
    details JSONB,
    performed_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.supabase_instance_backups (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    instance_id UUID REFERENCES public.supabase_instances(id),
    backup_type TEXT DEFAULT 'full',
    status TEXT DEFAULT 'pending',
    file_path TEXT,
    file_size BIGINT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- SYSTEM
-- =====================================================

CREATE TABLE public.system_backups (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    backup_type TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    file_path TEXT,
    file_size BIGINT,
    tables_included TEXT[],
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.system_config (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    config_key TEXT NOT NULL UNIQUE,
    config_value TEXT,
    config_type TEXT DEFAULT 'string',
    description TEXT,
    is_sensitive BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
