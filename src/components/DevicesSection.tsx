import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import devicesImageWebP from "@/assets/devices-mockup-opt.webp";
import androidIconWebP from "@/assets/icons/android-device-sm.webp";
import iosIconWebP from "@/assets/icons/ios-device-sm.webp";
import windowsIconWebP from "@/assets/icons/windows-device-sm.webp";
import macIconWebP from "@/assets/icons/mac-device-sm.webp";
import tabletIconWebP from "@/assets/icons/tablet-device-sm.webp";
import smarttvIconWebP from "@/assets/icons/smarttv-device-sm.webp";

const DevicesSection = () => {
  const devicesConfig = {
    title: "Assista em Qualquer Dispositivo",
    subtitle: "Compatível com todas as plataformas",
    description: "Acesse seu conteúdo favorito em smartphones, tablets, Smart TVs e computadores",
    platforms: [
      { id: "android", name: "Android", enabled: true, downloadUrl: "https://play.google.com" },
      { id: "ios", name: "iOS", enabled: true, downloadUrl: "https://apps.apple.com" },
      { id: "windows", name: "Windows", enabled: true, downloadUrl: "#" },
      { id: "mac", name: "Mac", enabled: true, downloadUrl: "#" },
      { id: "tablet", name: "Tablet", enabled: true, downloadUrl: "#" },
      { id: "smarttv", name: "Smart TV", enabled: true, downloadUrl: "#" }
    ]
  };

  const deviceImageMapWebP: Record<string, string> = {
    android: androidIconWebP,
    ios: iosIconWebP,
    windows: windowsIconWebP,
    mac: macIconWebP,
    tablet: tabletIconWebP,
    smarttv: smarttvIconWebP,
  };

  return (
    <section className="py-20 px-4 bg-gradient-to-b from-background via-surface/50 to-background">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            {devicesConfig.title}
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground mb-2">
            {devicesConfig.subtitle}
          </p>
          <p className="text-base text-muted-foreground max-w-2xl mx-auto">
            {devicesConfig.description}
          </p>
        </div>

        {/* Devices Image */}
        <div className="mb-16 rounded-2xl overflow-hidden shadow-2xl">
          <img
            src={devicesImageWebP}
            alt="IPTV disponível em todos os dispositivos: smartphones Android e iOS, tablets, Smart TVs, computadores Windows e Mac, mostrando compatibilidade multiplataforma total"
            className="w-full h-auto object-cover"
            width="1440"
            height="810"
            loading="lazy"
            decoding="async"
            role="img"
            aria-label="Demonstração de compatibilidade do IPTV LINK em múltiplos dispositivos"
          />
        </div>

        {/* Platform Icons Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
          {devicesConfig.platforms
            ?.filter((platform: any) => platform.enabled)
            .map((platform: any) => {
              const deviceImageWebP = deviceImageMapWebP[platform.id];
              
              return (
                <Card
                  key={platform.id}
                  className="p-6 flex flex-col items-center justify-center gap-4 hover:shadow-lg hover:scale-105 transition-all duration-300 cursor-pointer group bg-surface/50 backdrop-blur border-muted/20"
                  onClick={() => {
                    if (platform.downloadUrl) {
                      window.open(platform.downloadUrl, "_blank");
                    }
                  }}
                  role="button"
                  aria-label={`Baixar aplicativo IPTV para ${platform.name}`}
                  tabIndex={0}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && platform.downloadUrl) {
                      window.open(platform.downloadUrl, "_blank");
                    }
                  }}
                >
                  <div className="w-20 h-20 flex items-center justify-center" role="img" aria-label={`Ícone da plataforma ${platform.name}`}>
                    <img 
                      src={deviceImageWebP} 
                      alt={`Ícone do dispositivo ${platform.name} - compatível com IPTV LINK para streaming de TV ao vivo`}
                      className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-300"
                      width="160"
                      height="160"
                      loading="lazy"
                      decoding="async"
                      aria-hidden="true"
                    />
                  </div>
                  <span className="text-sm font-semibold text-center group-hover:text-primary transition-colors">
                    {platform.name}
                  </span>
                </Card>
              );
            })}
        </div>

        {/* CTA Button */}
        <div className="text-center mt-12">
          <Button
            size="lg"
            className="bg-primary hover:bg-primary/90 text-onPrimary font-semibold px-8 py-6 text-lg shadow-lg hover:shadow-xl transition-all"
            onClick={() => {
              window.open("https://wa.me/556131425880?text=Olá%21+Gostaria+de+fazer+o+teste+grátis+do+IPTV", "_blank");
            }}
          >
            Fale Conosco para Baixar
          </Button>
        </div>
      </div>
    </section>
  );
};

export default DevicesSection;
