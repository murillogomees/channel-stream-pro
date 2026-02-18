import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Download, CheckCircle, Tv, ExternalLink, Zap, Film, Globe, Headphones, Smartphone, Star, Shield } from "lucide-react";
import { OptimizedImage } from "@/components/OptimizedImage";
import { toast } from "sonner";
// Logo com fundo transparente para melhor integração visual
import logoWhite from "@/assets/logo-white.png";
import heroBg from "@/assets/hero-bg.jpg";
import { trackEvent } from "@/services/metaPixelService";
import { supabase } from "@/lib/supabase";

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
  
  const deferredPromptRef = useRef<any>(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    const checkInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isIOSStandalone = (window.navigator as any).standalone === true;
      setIsAppInstalled(isStandalone || isIOSStandalone);
    };
    
    checkInstalled();

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e;
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsAppInstalled(true);
      deferredPromptRef.current = null;
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    trackEvent('Lead', { content_name: 'Hero CTA - Download App', content_category: 'button' });
    
    if (isAppInstalled) {
      // App is already installed - open it
      window.location.href = '/app';
      return;
    }

    if (deferredPromptRef.current) {
      // Show the install prompt
      deferredPromptRef.current.prompt();
      const { outcome } = await deferredPromptRef.current.userChoice;
      
      if (outcome === 'accepted') {
        toast.success('App instalado com sucesso!');
        setIsAppInstalled(true);
      }
      deferredPromptRef.current = null;
    } else {
      // Fallback for iOS or browsers that don't support beforeinstallprompt
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        toast.info('Para instalar: toque em Compartilhar e depois "Adicionar à Tela de Início"', {
          duration: 5000,
        });
      } else {
        // Redirect to install page as fallback
        window.location.href = '/app/install';
      }
    }
  };

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
      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          
          {/* Left - Text Content */}
          <div className="text-center lg:text-left space-y-6">
            {/* Logo */}
            <div className="flex justify-center lg:justify-start">
              <img
                src={logoWhite}
                alt="IPTV LINK - Logotipo da empresa de streaming premium com mais de 10.000 canais em Full HD e 4K"
                className="h-20 sm:h-24 md:h-28 lg:h-32 w-auto object-contain drop-shadow-lg"
                style={{ maxWidth: '80vw' }}
                width={400}
                height={175}
                loading="eager"
                decoding="async"
                // @ts-ignore
                fetchpriority="high"
                role="img"
                aria-label="IPTV LINK - Streaming Premium"
              />
            </div>

            {/* Subtitle */}
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0 leading-relaxed">
              {settings.description}
            </p>

            {/* Key Benefits pills */}
            <div className="flex flex-wrap justify-center lg:justify-start gap-2 sm:gap-3">
              {settings.features.map((feature, index) => (
                <div key={index} className="flex items-center gap-1.5 bg-gradient-card px-3 py-2 rounded-lg shadow-card">
                  <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-xs sm:text-sm font-medium">{feature}</span>
                </div>
              ))}
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start pt-2">
              <Button 
                variant="hero"
                size="lg" 
                className="w-full sm:w-auto sm:min-w-48"
                onClick={() => {
                  trackEvent('InitiateCheckout', { content_name: 'Hero CTA - Ativar Acesso', content_category: 'button' });
                  window.location.href = "/signup";
                }}
              >
                <Tv className="h-5 w-5" />
                {settings.cta_primary_text}
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                className="w-full sm:w-auto sm:min-w-48"
                onClick={handleInstallClick}
              >
                {isAppInstalled ? (
                  <>
                    <ExternalLink className="h-5 w-5" />
                    Abrir APP
                  </>
                ) : (
                  <>
                    <Download className="h-5 w-5" />
                    Download do APP
                  </>
                )}
              </Button>
            </div>

            {/* Trust Indicators */}
            <div className="flex flex-wrap justify-center lg:justify-start gap-4 pt-2 text-xs text-muted-foreground">
              {settings.trust_indicators.map((indicator, index) => (
                <div key={index} className="flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5 text-primary" />
                  <span>{indicator}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right - Price Card */}
          <div className="flex justify-center lg:justify-end">
            <div className="relative w-full max-w-sm">
              {/* Glow effect behind card */}
              <div className="absolute -inset-1 bg-gradient-to-r from-primary/30 via-accent/20 to-primary/30 rounded-2xl blur-xl opacity-60" />
              
              <div className="relative bg-card/90 backdrop-blur-xl border border-primary/20 rounded-2xl p-6 sm:p-8 shadow-2xl">
                {/* Popular badge */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <div className="bg-gradient-to-r from-primary to-accent text-primary-foreground px-4 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-lg">
                    <Star className="h-3 w-3 fill-current" />
                    MAIS POPULAR
                  </div>
                </div>

                {/* Price */}
                <div className="text-center pt-4 pb-5 border-b border-border/50">
                  <p className="text-sm text-muted-foreground mb-1">A partir de</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-lg text-muted-foreground font-medium">R$</span>
                    <span className="text-6xl sm:text-7xl font-extrabold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent leading-none">
                      45
                    </span>
                    <span className="text-sm text-muted-foreground">/mês</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">ou menos nos planos maiores</p>
                </div>

                {/* Benefits list */}
                <ul className="space-y-3 py-5">
                  {[
                    { icon: Film, text: "+10.000 canais ao vivo" },
                    { icon: Tv, text: "Qualidade Full HD e 4K" },
                    { icon: Globe, text: "Filmes e séries sob demanda" },
                    { icon: Smartphone, text: "Todos os dispositivos" },
                    { icon: Headphones, text: "Suporte 24/7 dedicado" },
                    { icon: Zap, text: "Ativação instantânea" },
                    { icon: Shield, text: "Teste grátis de 6 horas" },
                    { icon: Star, text: "Sem contrato ou multa" },
                  ].map(({ icon: Icon, text }, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <span className="text-sm font-medium">{text}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA in card */}
                <Button 
                  variant="hero"
                  size="lg"
                  className="w-full text-base"
                  onClick={() => {
                    trackEvent('InitiateCheckout', { content_name: 'Hero Price Card CTA', content_category: 'button' });
                    window.location.href = "/signup";
                  }}
                >
                  <Zap className="h-5 w-5" />
                  Começar Agora
                </Button>

                <p className="text-center text-[11px] text-muted-foreground mt-3">
                  Cancele quando quiser • Sem fidelidade
                </p>
              </div>
            </div>
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
