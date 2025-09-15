-- Create table for site configurations
CREATE TABLE public.site_configurations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  section text NOT NULL,
  key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(section, key)
);

-- Enable RLS
ALTER TABLE public.site_configurations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage site configurations"
ON public.site_configurations
FOR ALL
USING (public.is_admin());

CREATE POLICY "Public can view site configurations"
ON public.site_configurations
FOR SELECT
USING (true);

-- Insert default configurations
INSERT INTO public.site_configurations (section, key, value) VALUES
-- Header configurations
('header', 'logo', '{"url": "", "alt": "IPTV Premium"}'),
('header', 'title', '{"text": "IPTV Premium", "font": "font-bold"}'),
('header', 'menu', '{"items": [
  {"name": "Início", "href": "#home"},
  {"name": "Canais", "href": "#channels"},
  {"name": "Filmes", "href": "#movies"},
  {"name": "Planos", "href": "#plans"},
  {"name": "Downloads", "href": "/downloads"},
  {"name": "Afiliados", "href": "/affiliate/login"}
]}'),

-- Hero section
('hero', 'title', '{"text": "Entretenimento Premium em suas mãos", "font": "text-4xl md:text-6xl font-bold"}'),
('hero', 'subtitle', '{"text": "Acesse milhares de canais, filmes e séries em alta definição. Compatível com todos os dispositivos.", "font": "text-xl text-muted-foreground"}'),
('hero', 'background', '{"image": "/src/assets/hero-bg.jpg", "overlay": "bg-black/60"}'),

-- Contact section
('contact', 'phones', '{"primary": "+55 11 99999-9999", "secondary": "+55 11 88888-8888"}'),
('contact', 'email', '{"primary": "contato@iptvpremium.com", "secondary": "suporte@iptvpremium.com"}'),
('contact', 'address', '{"street": "Rua Example, 123", "city": "São Paulo", "state": "SP", "zip": "01234-567"}'),
('contact', 'hours', '{"weekdays": "Segunda a Sexta: 8h às 18h", "weekend": "Sábado: 9h às 17h"}'),
('contact', 'social', '{"whatsapp": "+5511999999999", "telegram": "@iptvpremium", "instagram": "@iptvpremium"}'),

-- Plans section
('plans', 'title', '{"text": "Escolha seu Plano", "font": "text-3xl font-bold text-center mb-12"}'),
('plans', 'plans', '{"items": [
  {
    "name": "Básico",
    "price": "R$ 29,90",
    "period": "/mês",
    "features": ["+ 20.000 Canais", "Filmes e Séries", "Qualidade HD", "1 Conexão"],
    "highlighted": false
  },
  {
    "name": "Premium",
    "price": "R$ 49,90", 
    "period": "/mês",
    "features": ["+ 50.000 Canais", "Filmes e Séries 4K", "Qualidade 4K", "3 Conexões", "Suporte Premium"],
    "highlighted": true
  },
  {
    "name": "Ultimate",
    "price": "R$ 79,90",
    "period": "/mês", 
    "features": ["+ 80.000 Canais", "Filmes e Séries 4K", "Qualidade 8K", "5 Conexões", "Suporte 24h"],
    "highlighted": false
  }
]}'),

-- Colors and fonts
('theme', 'colors', '{"primary": "hsl(142, 76%, 36%)", "secondary": "hsl(142, 76%, 20%)", "accent": "hsl(142, 76%, 50%)"}'),
('theme', 'fonts', '{"heading": "font-bold", "body": "font-normal", "accent": "font-semibold"}');

-- Add trigger for updated_at
CREATE TRIGGER update_site_configurations_updated_at
BEFORE UPDATE ON public.site_configurations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();