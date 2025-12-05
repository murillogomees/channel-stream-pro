-- Fix RLS policies for affiliates table to verify active affiliate status
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Affiliates can view own data" ON public.affiliates;
DROP POLICY IF EXISTS "Affiliates can update own pix info" ON public.affiliates;

-- Create stricter policies that verify affiliate is active
CREATE POLICY "Affiliates can view own data if active"
ON public.affiliates FOR SELECT
USING (
  auth.uid() = user_id 
  AND status = 'active'
);

CREATE POLICY "Affiliates can update own pix info if active"
ON public.affiliates FOR UPDATE
USING (
  auth.uid() = user_id 
  AND status = 'active'
)
WITH CHECK (
  auth.uid() = user_id 
  AND status = 'active'
);