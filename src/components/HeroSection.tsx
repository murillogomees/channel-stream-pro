import { Button } from "@/components/ui/button";
import { Play, CheckCircle, Smartphone, Monitor, Tv } from "lucide-react";
import heroBackground from "@/assets/hero-bg.jpg";
import { useSettingsContext } from "@/context/SettingsContext";

const HeroSection = () => {
  const { settings, getAsset, getIcon } = useSettingsContext();
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-hero px-4 sm:px-6 lg:px-8">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <img
          src={getAsset('heroImage')}
          alt="IPTV Premium Streaming Background"
          className="w-full h-full object-cover opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background/60" />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8">
          {/* Logo as Main Title */}
          <div className="flex justify-center mb-4">
            <img
              src={getAsset('logo')}
              alt="IPTV LINK Logo"
              className="h-16 sm:h-20 md:h-24 lg:h-28 xl:h-32 w-auto object-contain filter brightness-0 invert"
              style={{ maxWidth: '90vw' }}
            />
          </div>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl text-muted-foreground max-w-3xl mx-auto leading-relaxed px-4">
            {settings.components.hero.description}
          </p>

          {/* Key Benefits */}
          <div className="flex flex-wrap justify-center gap-3 sm:gap-4 lg:gap-6 my-6 sm:my-8 px-4">
            {settings.components.hero.features.map((feature, index) => (
              <div key={index} className="flex items-center gap-2 bg-gradient-card px-3 sm:px-4 py-2 sm:py-3 rounded-lg shadow-card">
                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                <span className="text-xs sm:text-sm font-medium">{feature}</span>
              </div>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center pt-4 sm:pt-6 px-4">
            {settings.components.hero.ctaButtons.map((button, index) => (
              <Button 
                key={index}
                variant={button.variant === "primary" ? "hero" : "cta"} 
                size="lg" 
                className="w-full sm:w-auto sm:min-w-48 lg:min-w-64"
                onClick={() => window.open("https://wa.me/5561314258880", '_blank')}
              >
                {index === 0 ? <Play className="h-5 w-5 sm:h-6 sm:w-6" /> : <Tv className="h-5 w-5 sm:h-6 sm:w-6" />}
                {button.text}
              </Button>
            ))}
          </div>

          {/* Trust Indicators */}
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6 lg:gap-8 pt-6 sm:pt-8 text-xs sm:text-sm text-muted-foreground px-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
              <span>Sem Contrato</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
              <span>Suporte 24/7</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
              <span>Acesso Global</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
              <span>Cancele Quando Quiser</span>
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