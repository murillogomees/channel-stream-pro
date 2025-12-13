-- Create email_change_requests table
CREATE TABLE IF NOT EXISTS public.email_change_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  old_email TEXT NOT NULL,
  new_email TEXT NOT NULL,
  token TEXT NOT NULL,
  verification_code TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_change_requests ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own email change requests"
ON public.email_change_requests
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own email change requests"
ON public.email_change_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own email change requests"
ON public.email_change_requests
FOR DELETE
USING (auth.uid() = user_id);

-- Add login alert preference columns to profiles if not exist
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS login_alerts_email BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS login_alerts_whatsapp BOOLEAN DEFAULT false;

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_email_change_requests_user_id ON public.email_change_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_email_change_requests_token ON public.email_change_requests(token);