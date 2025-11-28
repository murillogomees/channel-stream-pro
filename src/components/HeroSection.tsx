import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, CheckCircle, Tv } from "lucide-react";
import { OptimizedImage } from "@/components/OptimizedImage";
// Logo otimizado para performance (400px width)
import logoWhite400 from "@/assets/logo-white-400.webp";
import heroBg from "@/assets/hero-bg.jpg";
import { trackEvent } from "@/services/metaPixelService";
import { supabase } from "@/integrations/supabase/client";

interface HeroContent {
  description: string;
  features: string[];
  cta_primary_text: string;
  cta_secondary_text: string;
  trust_indicators: string[];
  whatsapp_number: string;
  whatsapp_message: string;
}

const HeroSection = () => {
  const [settings, setSettings] = useState<HeroContent>({
    description: "Mais de 10.000 canais em Full HD e 4K com qualidade premium e estabilidade incomparável",
    features: ["Teste Grátis 15 Dias", "Sem Contrato", "Suporte 24/7"],
    cta_primary_text: "Ativar Meu Acesso Agora",
    cta_secondary_text: "Falar com Suporte",
    trust_indicators: ["Sem Contrato", "Suporte 24/7", "Acesso Global", "Cancele Quando Quiser"],
    whatsapp_number: "556131425880",
    whatsapp_message: "Olá! Gostaria de fazer o teste grátis do IPTV.",
  });

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const { data } = await supabase
          .from('homepage_content')
          .select('content')
          .eq('section_key', 'hero')
          .single();

        if (data?.content) {
          setSettings(data.content as unknown as HeroContent);
        }
      } catch (error) {
        console.error('Erro ao carregar conteúdo do hero:', error);
      }
    };

    fetchContent();
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-hero px-4 sm:px-6 lg:px-8">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <OptimizedImage
          src={heroBg}
          alt="Plano de fundo com imagem de streaming de televisão premium em alta qualidade, mostrando uma experiência de entretenimento moderna e imersiva"
          className="w-full h-full object-cover opacity-20"
          width={1920}
          height={1080}
          sizes="100vw"
          eager
          decoding="async"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background/60" />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8">
          {/* Logo as Main Title */}
          <div className="flex justify-center mb-4">
            <OptimizedImage
              src={logoWhite400}
              alt="IPTV LINK - Logotipo da empresa de streaming premium com mais de 10.000 canais em Full HD e 4K"
              className="h-24 sm:h-28 md:h-32 lg:h-36 xl:h-40 w-auto object-contain"
              style={{ maxWidth: '90vw' }}
              width={400}
              height={175}
              eager
              decoding="async"
              role="img"
              aria-label="IPTV LINK - Streaming Premium"
            />
          </div>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl text-muted-foreground max-w-3xl mx-auto leading-relaxed px-4">
            {settings.description}
          </p>

          {/* Key Benefits */}
          <div className="flex flex-wrap justify-center gap-3 sm:gap-4 lg:gap-6 my-6 sm:my-8 px-4">
            {settings.features.map((feature, index) => (
              <div key={index} className="flex items-center gap-2 bg-gradient-card px-3 sm:px-4 py-2 sm:py-3 rounded-lg shadow-card">
                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                <span className="text-xs sm:text-sm font-medium">{feature}</span>
              </div>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center pt-4 sm:pt-6 px-4">
            <Button 
              variant="hero"
              size="lg" 
              className="w-full sm:w-auto sm:min-w-48 lg:min-w-64"
              onClick={() => {
                trackEvent('InitiateCheckout', { content_name: 'Hero CTA - Ativar Acesso', content_category: 'button' });
                window.location.href = "/tutorial";
              }}
            >
              <Tv className="h-5 w-5 sm:h-6 sm:w-6" />
              {settings.cta_primary_text}
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              className="w-full sm:w-auto sm:min-w-48 lg:min-w-64"
              onClick={() => {
                trackEvent('Contact', { content_name: 'Hero CTA - WhatsApp', content_category: 'button' });
                window.location.href = `https://wa.me/${settings.whatsapp_number}?text=${encodeURIComponent(settings.whatsapp_message)}`;
              }}
            >
              <Play className="h-5 w-5 sm:h-6 sm:w-6" />
              {settings.cta_secondary_text}
            </Button>
          </div>

          {/* Trust Indicators */}
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6 lg:gap-8 pt-6 sm:pt-8 text-xs sm:text-sm text-muted-foreground px-4">
            {settings.trust_indicators.map((indicator, index) => (
              <div key={index} className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
                <span>{indicator}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating Elements */}
      <div className="absolute top-20 left-10 w-2 h-2 bg-primary rounded-full animate-pulse opacity-60" />
      <div className="absolute top-40 right-20 w-3 h-3 bg-accent rounded-full animate-pulse opacity-40" />
      <div className="absolute bottom-32 left-20 w-2 h-2 bg-primary-glow rounded-full animate-pulse opacity-50" />
      <div className="absolute bottom-20 right-32 w-4 h-4 bg-accent-glow rounded-full animate-pulse opacity-30" />
    </section>
  );
};

export default HeroSection;
