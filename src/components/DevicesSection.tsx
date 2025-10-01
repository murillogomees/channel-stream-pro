import { useSettingsContext } from "@/context/SettingsContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import * as Icons from "lucide-react";
import devicesImage from "@/assets/devices-mockup.jpg";

const DevicesSection = () => {
  const { settings } = useSettingsContext();
  const devicesConfig = settings.devices;

  if (!devicesConfig) return null;

  const iconMap: Record<string, any> = {
    Smartphone: Icons.Smartphone,
    Monitor: Icons.Monitor,
    Laptop: Icons.Laptop,
    Tablet: Icons.Tablet,
    Tv: Icons.Tv,
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
            src={devicesImage}
            alt="Disponível em todos os dispositivos"
            className="w-full h-auto object-cover"
          />
        </div>

        {/* Platform Icons Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
          {devicesConfig.platforms
            ?.filter((platform: any) => platform.enabled)
            .map((platform: any) => {
              const IconComponent = iconMap[platform.icon] || Icons.Smartphone;
              
              return (
                <Card
                  key={platform.id}
                  className="p-6 flex flex-col items-center justify-center gap-4 hover:shadow-lg hover:scale-105 transition-all duration-300 cursor-pointer group bg-surface/50 backdrop-blur border-muted/20"
                  onClick={() => {
                    if (platform.downloadUrl) {
                      window.open(platform.downloadUrl, "_blank");
                    }
                  }}
                >
                  <div className="p-4 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <IconComponent className="w-8 h-8 text-primary" />
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
              const whatsappNumber = settings.contact?.info?.whatsapp?.replace(/\D/g, "");
              const message = encodeURIComponent("Olá! Gostaria de saber mais sobre como baixar o aplicativo em meus dispositivos.");
              window.open(`https://wa.me/${whatsappNumber}?text=${message}`, "_blank");
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
