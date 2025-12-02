-- Fix RLS policies for whatsapp_config and mercado_pago_config
-- Allow both admin and master roles to access integration configs

-- Drop old restrictive policies
DROP POLICY IF EXISTS "Admins podem gerenciar config WhatsApp" ON public.whatsapp_config;
DROP POLICY IF EXISTS "Admins can manage mercado pago config" ON public.mercado_pago_config;

-- Create new policies allowing both admin and master roles
CREATE POLICY "Admins and masters full access whatsapp_config"
ON public.whatsapp_config
FOR ALL
USING (is_admin_or_master(auth.uid()));

CREATE POLICY "Admins and masters full access mercado_pago_config"
ON public.mercado_pago_config
FOR ALL
USING (is_admin_or_master(auth.uid()));

-- Also fix auto_notification_config policy if needed
DROP POLICY IF EXISTS "Admins podem gerenciar config de notificações automáticas" ON public.auto_notification_config;

CREATE POLICY "Admins and masters full access auto_notification_config"
ON public.auto_notification_config
FOR ALL
USING (is_admin_or_master(auth.uid()));