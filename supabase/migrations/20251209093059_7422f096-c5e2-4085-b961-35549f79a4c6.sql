-- ================================================
-- COLUNAS ADICIONAIS PARA COMPATIBILIDADE COM TIPOS DO CÓDIGO
-- ================================================

-- Adicionar colunas faltantes à affiliate_fraud_logs
ALTER TABLE public.affiliate_fraud_logs
ADD COLUMN IF NOT EXISTS resolution_notes TEXT;

-- Adicionar colunas faltantes à affiliate_marketing_materials
ALTER TABLE public.affiliate_marketing_materials
ADD COLUMN IF NOT EXISTS content_text TEXT,
ADD COLUMN IF NOT EXISTS download_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- Adicionar colunas faltantes à affiliate_tiers
ALTER TABLE public.affiliate_tiers
ADD COLUMN IF NOT EXISTS min_revenue NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS commission_percentage NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS bonus_amount NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS icon TEXT,
ADD COLUMN IF NOT EXISTS color TEXT,
ADD COLUMN IF NOT EXISTS description TEXT;

-- Adicionar colunas faltantes à affiliates
ALTER TABLE public.affiliates
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS commission_type TEXT DEFAULT 'percentage',
ADD COLUMN IF NOT EXISTS commission_value NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS available_balance NUMERIC(10,2) DEFAULT 0;

-- Adicionar colunas faltantes à affiliate_links
ALTER TABLE public.affiliate_links
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS conversions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS revenue NUMERIC(10,2) DEFAULT 0;

-- Adicionar colunas faltantes à affiliate_payouts
ALTER TABLE public.affiliate_payouts
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;

-- Adicionar colunas faltantes à affiliate_promotions
ALTER TABLE public.affiliate_promotions
ADD COLUMN IF NOT EXISTS code TEXT,
ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_uses INTEGER;

-- Adicionar colunas faltantes à affiliate_withdrawals
ALTER TABLE public.affiliate_withdrawals
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Adicionar colunas faltantes à user_subscriptions
ALTER TABLE public.user_subscriptions
ADD COLUMN IF NOT EXISTS price NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS next_billing_date TIMESTAMP WITH TIME ZONE;

-- Adicionar colunas faltantes à payments  
ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS receipt_url TEXT;

-- Adicionar colunas faltantes à notification_queue
ALTER TABLE public.notification_queue
ADD COLUMN IF NOT EXISTS recipient_name TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Adicionar colunas faltantes à discount_coupons
ALTER TABLE public.discount_coupons
ADD COLUMN IF NOT EXISTS applies_to TEXT DEFAULT 'all',
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Adicionar colunas faltantes à auto_notifications
ALTER TABLE public.auto_notifications
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS message_template TEXT;

-- Adicionar colunas faltantes à security_alerts
ALTER TABLE public.security_alerts
ADD COLUMN IF NOT EXISTS ip_address TEXT,
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS resolution_notes TEXT;