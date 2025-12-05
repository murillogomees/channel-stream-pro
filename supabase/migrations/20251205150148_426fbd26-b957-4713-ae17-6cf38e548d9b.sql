-- Add RLS policies for automatic_notification_rules table

-- Enable RLS if not already enabled
ALTER TABLE public.automatic_notification_rules ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Admins can view notification rules" ON public.automatic_notification_rules;
DROP POLICY IF EXISTS "Admins can create notification rules" ON public.automatic_notification_rules;
DROP POLICY IF EXISTS "Admins can update notification rules" ON public.automatic_notification_rules;
DROP POLICY IF EXISTS "Admins can delete notification rules" ON public.automatic_notification_rules;

-- Create policies using is_admin_or_master function
CREATE POLICY "Admins can view notification rules" 
ON public.automatic_notification_rules 
FOR SELECT 
USING (public.is_admin_or_master(auth.uid()));

CREATE POLICY "Admins can create notification rules" 
ON public.automatic_notification_rules 
FOR INSERT 
WITH CHECK (public.is_admin_or_master(auth.uid()));

CREATE POLICY "Admins can update notification rules" 
ON public.automatic_notification_rules 
FOR UPDATE 
USING (public.is_admin_or_master(auth.uid()));

CREATE POLICY "Admins can delete notification rules" 
ON public.automatic_notification_rules 
FOR DELETE 
USING (public.is_admin_or_master(auth.uid()));