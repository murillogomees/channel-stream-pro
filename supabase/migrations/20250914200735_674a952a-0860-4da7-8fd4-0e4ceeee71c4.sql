-- Corrigir problemas de segurança
-- 1. Atualizar função handle_updated_at com search_path
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 2. Criar bucket de storage para arquivos M3U
INSERT INTO storage.buckets (id, name, public) 
VALUES ('m3u-files', 'm3u-files', false);

-- 3. Políticas de storage para arquivos M3U
CREATE POLICY "Admins can upload M3U files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'm3u-files' AND auth.uid() IN (SELECT id FROM public.admins));

CREATE POLICY "Admins can view M3U files" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'm3u-files' AND auth.uid() IN (SELECT id FROM public.admins));

CREATE POLICY "Admins can delete M3U files" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'm3u-files' AND auth.uid() IN (SELECT id FROM public.admins));

-- 4. Criar índices para performance
CREATE INDEX idx_affiliate_clicks_affiliate_id ON public.affiliate_clicks(affiliate_id);
CREATE INDEX idx_affiliate_sales_affiliate_id ON public.affiliate_sales(affiliate_id);
CREATE INDEX idx_m3u_lists_status ON public.m3u_lists(status);
CREATE INDEX idx_affiliates_code ON public.affiliates(affiliate_code);
CREATE INDEX idx_recommended_players_featured ON public.recommended_players(featured, sort_order);