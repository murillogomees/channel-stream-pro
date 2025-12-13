-- Add TOTP/2FA columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS totp_secret TEXT,
ADD COLUMN IF NOT EXISTS totp_verified_at TIMESTAMP WITH TIME ZONE;