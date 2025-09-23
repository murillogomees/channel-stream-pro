import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircle, Phone, Mail, MapPin, Clock, Headphones } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";

const ContactSection = () => {
  const { settings } = useSettings();
  
  const whatsappNumber = "5561314258880";
  const whatsappMessage = "Olá! Gostaria de saber mais sobre os planos IPTV.";
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`;
  
  const contactMethods = [
    {
      icon: MessageCircle,
      title: "WhatsApp",
      description: "Resposta em até 5 minutos",
      action: "Chamar no WhatsApp",
      href: whatsappUrl,
      featured: true,
    },
  ];

  return (
    <section id="contato" className="py-20 bg-background">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gradient-primary mb-4">
            {settings.contact.title}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {settings.contact.description}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {/* Main WhatsApp Contact Card */}
          <div className="lg:col-span-1">
            <Card className="bg-gradient-card border-border text-center h-full flex flex-col shadow-glow ring-2 ring-primary/20">
              <CardHeader className="flex-shrink-0">
                <div className="mx-auto p-4 rounded-full w-fit bg-gradient-primary shadow-glow">
                  <MessageCircle className="h-8 w-8 text-primary-foreground" />
                </div>
                <CardTitle className="text-xl text-foreground leading-tight min-h-[3rem] flex items-center justify-center">
                  WhatsApp
                </CardTitle>
                <CardDescription className="text-muted-foreground font-medium px-2">
                  Resposta em até 5 minutos
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-end">
                <Button
                  variant="default"
                  className="w-full font-semibold"
                  onClick={() => window.location.href = whatsappUrl}
                >
                  Chamar no WhatsApp
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Horário de Atendimento */}
          <div className="lg:col-span-1">
            <Card className="bg-gradient-card border-border text-center h-full flex flex-col">
              <CardHeader className="flex-shrink-0">
                <div className="mx-auto p-4 rounded-full w-fit bg-gradient-accent">
                  <Clock className="h-8 w-8 text-primary-foreground" />
                </div>
                <CardTitle className="text-xl text-foreground leading-tight min-h-[3rem] flex items-center justify-center">
                  Horário de Atendimento
                </CardTitle>
                <CardDescription className="text-muted-foreground font-medium px-2">
                  Nossos horários de funcionamento
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-center">
                <div className="text-center space-y-2">
                  <span className="text-foreground font-medium block">Atendimento:</span>
                  <span className="text-muted-foreground">{settings.contact.info.schedule}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Suporte Técnico */}
          <div className="lg:col-span-1">
            <Card className="bg-gradient-card border-border text-center h-full flex flex-col">
              <CardHeader className="flex-shrink-0">
                <div className="mx-auto p-4 rounded-full w-fit bg-gradient-accent">
                  <Headphones className="h-8 w-8 text-primary-foreground" />
                </div>
                <CardTitle className="text-xl text-foreground leading-tight min-h-[3rem] flex items-center justify-center">
                  Suporte Técnico
                </CardTitle>
                <CardDescription className="text-muted-foreground font-medium px-2">
                  Estamos aqui para ajudar
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-center">
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-foreground text-sm">Configuração de Apps</span>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-foreground text-sm">Problemas de Conexão</span>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-foreground text-sm">Instalação de Players</span>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-foreground text-sm">Dúvidas sobre Planos</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ContactSection;