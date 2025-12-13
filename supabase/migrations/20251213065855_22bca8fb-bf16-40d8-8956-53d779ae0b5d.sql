-- Tabelas para features avançadas de autenticação

-- Device Fingerprints para identificação única de dispositivos
CREATE TABLE IF NOT EXISTS public.device_fingerprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  fingerprint_hash TEXT NOT NULL,
  device_name TEXT,
  device_type TEXT DEFAULT 'unknown',
  browser TEXT,
  os TEXT,
  is_trusted BOOLEAN DEFAULT false,
  trust_expires_at TIMESTAMPTZ,
  first_seen_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  login_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, fingerprint_hash)
);

-- Login Alerts para notificações de novos logins
CREATE TABLE IF NOT EXISTS public.login_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  device_fingerprint_id UUID REFERENCES public.device_fingerprints(id),
  ip_address TEXT,
  location_info JSONB,
  alert_type TEXT DEFAULT 'new_device',
  alert_sent_via TEXT[], -- ['email', 'whatsapp']
  sent_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Passkeys/WebAuthn credentials
CREATE TABLE IF NOT EXISTS public.passkey_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter INTEGER DEFAULT 0,
  device_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true
);

-- Pending email changes
CREATE TABLE IF NOT EXISTS public.pending_email_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  current_email TEXT NOT NULL,
  new_email TEXT NOT NULL,
  verification_token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Phone verification codes (WhatsApp)
CREATE TABLE IF NOT EXISTS public.phone_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  phone_number TEXT NOT NULL,
  code TEXT NOT NULL,
  purpose TEXT DEFAULT 'verification', -- verification, login, mfa
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Account deletion requests
CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  reason TEXT,
  confirmation_token TEXT UNIQUE,
  scheduled_deletion_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.device_fingerprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passkey_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_email_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_verification_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

-- Device fingerprints policies
CREATE POLICY "Users can view own fingerprints" ON public.device_fingerprints
  FOR SELECT USING (auth.uid() = user_id OR is_admin_or_master());
CREATE POLICY "Users can manage own fingerprints" ON public.device_fingerprints
  FOR ALL USING (auth.uid() = user_id OR is_admin_or_master());

-- Login alerts policies
CREATE POLICY "Users can view own alerts" ON public.login_alerts
  FOR SELECT USING (auth.uid() = user_id OR is_admin_or_master());
CREATE POLICY "System can insert alerts" ON public.login_alerts
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own alerts" ON public.login_alerts
  FOR UPDATE USING (auth.uid() = user_id);

-- Passkey credentials policies
CREATE POLICY "Users can view own passkeys" ON public.passkey_credentials
  FOR SELECT USING (auth.uid() = user_id OR is_admin_or_master());
CREATE POLICY "Users can manage own passkeys" ON public.passkey_credentials
  FOR ALL USING (auth.uid() = user_id OR is_admin_or_master());

-- Pending email changes policies
CREATE POLICY "Users can view own email changes" ON public.pending_email_changes
  FOR SELECT USING (auth.uid() = user_id OR is_admin_or_master());
CREATE POLICY "Users can manage own email changes" ON public.pending_email_changes
  FOR ALL USING (auth.uid() = user_id OR is_admin_or_master());

-- Phone verification policies
CREATE POLICY "Users can view own phone codes" ON public.phone_verification_codes
  FOR SELECT USING (auth.uid() = user_id OR is_admin_or_master());
CREATE POLICY "System can insert phone codes" ON public.phone_verification_codes
  FOR INSERT WITH CHECK (true);

-- Account deletion policies
CREATE POLICY "Users can view own deletion requests" ON public.account_deletion_requests
  FOR SELECT USING (auth.uid() = user_id OR is_admin_or_master());
CREATE POLICY "Users can manage own deletion requests" ON public.account_deletion_requests
  FOR ALL USING (auth.uid() = user_id OR is_admin_or_master());

-- Add phone_verified to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;