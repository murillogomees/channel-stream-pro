-- Adicionar políticas SELECT para admins nas tabelas de configuração

-- mercado_pago_config
CREATE POLICY "Admins can select mp config" 
ON public.mercado_pago_config 
FOR SELECT 
USING (is_admin_or_master());

-- whatsapp_config  
CREATE POLICY "Admins can select whatsapp" 
ON public.whatsapp_config 
FOR SELECT 
USING (is_admin_or_master());