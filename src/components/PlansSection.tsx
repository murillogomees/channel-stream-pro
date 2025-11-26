import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Crown, Star, Zap } from "lucide-react";
import { trackEvent } from "@/services/metaPixelService";

const PlansSection = () => {
  const plans = [
    {
      name: "Mensal",
      price: "30,00",
      currency: "R$",
      period: "/mês",
      features: ["Mais de 10.000 canais", "Qualidade Full HD e 4K", "Suporte 24/7", "Sem contrato"],
      ctaText: "Assinar Agora",
      highlighted: false,
      savings: null,
      savingsPercent: null
    },
    {
      name: "Trimestral",
      price: "79,90",
      currency: "R$",
      period: "/3 meses",
      features: ["Mais de 10.000 canais", "Qualidade Full HD e 4K", "Suporte prioritário 24/7", "Sem contrato", "Economize R$ 10"],
      ctaText: "Assinar Agora",
      highlighted: true,
      savings: 10.10,
      savingsPercent: 11.2
    },
    {
      name: "Semestral",
      price: "149,90",
      currency: "R$",
      period: "/6 meses",
      features: ["Mais de 10.000 canais", "Qualidade Full HD e 4K", "Suporte VIP 24/7", "Sem contrato", "Economize R$ 30"],
      ctaText: "Assinar Agora",
      highlighted: false,
      savings: 30.10,
      savingsPercent: 16.7
    },
    {
      name: "Anual",
      price: "279,90",
      currency: "R$",
      period: "/ano",
      features: ["Mais de 10.000 canais", "Qualidade Full HD e 4K", "Suporte VIP dedicado 24/7", "Sem contrato", "Economize R$ 80"],
      ctaText: "Assinar Agora",
      highlighted: false,
      savings: 80.10,
      savingsPercent: 22.3
    }
  ];
  return <section className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-background to-card">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12 lg:mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6">
            Planos e Preços
          </h2>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto px-4">
            Escolha o plano ideal para você e sua família
          </p>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 max-w-7xl mx-auto">
        {plans.map((plan, index) => {
          const IconComponent = Star; // Default icon
          return <Card key={index} className={`relative bg-gradient-card border-2 transition-smooth hover:scale-[1.02] hover:shadow-elevated h-full flex flex-col ${plan.highlighted ? "border-primary shadow-glow" : "border-border hover:border-primary/40"}`}>
                {plan.highlighted && <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <div className="bg-gradient-primary rounded-full text-xs font-semibold text-primary-foreground shadow-glow py-1 px-3">
                      Mais Popular
                    </div>
                  </div>}

                {plan.savingsPercent && (
                  <div className="absolute -top-3 right-4">
                    <div className="bg-success text-success-foreground rounded-full text-xs font-bold shadow-lg py-1.5 px-3 flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      -{plan.savingsPercent}%
                    </div>
                  </div>
                )}

                <CardHeader className="text-center pb-4 flex-shrink-0">
                  <div className="flex justify-center mb-4">
                    <div className={`p-3 rounded-full ${plan.highlighted ? "bg-gradient-primary shadow-glow" : "bg-secondary"}`}>
                      <IconComponent className={`h-6 w-6 ${plan.highlighted ? "text-primary-foreground" : "text-primary"}`} />
                    </div>
                  </div>
                  <CardTitle className="text-2xl font-bold leading-tight min-h-[3rem] flex items-center justify-center">
                    {plan.name}
                  </CardTitle>
                  <div className="space-y-2 mt-4">
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-3xl font-bold text-gradient-primary">
                        {plan.currency}{plan.price}
                      </span>
                      <span className="text-muted-foreground font-medium">{plan.period}</span>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-6 flex-1 flex flex-col justify-between">
                  {/* Features */}
                  <ul className="space-y-3 flex-1">
                    {plan.features.map((feature, featureIndex) => <li key={featureIndex} className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <span className="text-sm leading-relaxed">{feature}</span>
                      </li>)}
                  </ul>

                  {/* CTA Button */}
                  <div className="pt-4">
                    <Button 
                      variant={plan.highlighted ? "hero" : "default"} 
                      size="default" 
                      className="w-full font-semibold"
                      onClick={() => {
                        trackEvent('AddToCart', { 
                          content_name: `Plano ${plan.name}`, 
                          content_type: 'product',
                          value: parseFloat(plan.price.replace(',', '.')),
                          currency: 'BRL'
                        });
                        const message = `Olá! Tenho interesse no plano ${plan.name}. Gostaria de mais informações.`;
                        window.location.href = `https://wa.me/556131425880?text=${encodeURIComponent(message)}`;
                      }}
                    >
                      {plan.ctaText}
                    </Button>
                  </div>
                </CardContent>
              </Card>;
        })}
        </div>

        {/* Additional Info */}
        <div className="text-center mt-12 space-y-4">
          <p className="text-muted-foreground">
            🔥 <strong>Teste Grátis por 24 horas</strong> em todos os planos
          </p>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
            <span>✅ Sem taxa de instalação</span>
            <span>✅ Sem fidelidade</span>
            <span>✅ Cancele quando quiser</span>
            <span>✅ Acesso imediato</span>
          </div>
        </div>
      </div>
    </section>;
};
export default PlansSection;