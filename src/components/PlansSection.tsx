import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Crown, Star, Zap } from "lucide-react";

const PlansSection = () => {
  const plans = [
    {
      name: "Mensal",
      price: "R$ 29,90",
      period: "/mês",
      icon: Zap,
      description: "Perfeito para testar nosso serviço",
      features: [
        "10.000+ Canais",
        "Filmes e Séries",
        "Qualidade Full HD",
        "2 Telas simultâneas",
        "Suporte 24/7",
        "EPG (Guia de programação)",
      ],
      popular: false,
      ctaText: "Escolher Plano",
    },
    {
      name: "Trimestral",
      price: "R$ 69,90",
      period: "/3 meses",
      icon: Star,
      description: "Economia de 22% - Mais popular",
      features: [
        "10.000+ Canais",
        "Filmes e Séries",
        "Qualidade Full HD + 4K",
        "3 Telas simultâneas",
        "Suporte 24/7",
        "EPG (Guia de programação)",
        "Acesso a conteúdo adulto",
      ],
      popular: true,
      ctaText: "Mais Popular",
    },
    {
      name: "Semestral",
      price: "R$ 119,90",
      period: "/6 meses",
      icon: Crown,
      description: "Economia de 33% - Melhor custo-benefício",
      features: [
        "10.000+ Canais",
        "Filmes e Séries",
        "Qualidade Full HD + 4K",
        "4 Telas simultâneas",
        "Suporte 24/7 prioritário",
        "EPG (Guia de programação)",
        "Acesso a conteúdo adulto",
        "Download offline",
      ],
      popular: false,
      ctaText: "Melhor Oferta",
    },
    {
      name: "Anual",
      price: "R$ 199,90",
      period: "/ano",
      icon: Crown,
      description: "Economia de 44% - Máximo valor",
      features: [
        "10.000+ Canais",
        "Filmes e Séries",
        "Qualidade Full HD + 4K",
        "5 Telas simultâneas",
        "Suporte 24/7 VIP",
        "EPG (Guia de programação)",
        "Acesso a conteúdo adulto",
        "Download offline",
        "Conteúdo exclusivo",
      ],
      popular: false,
      ctaText: "Máxima Economia",
    },
  ];

  return (
    <section className="py-20 px-6 bg-gradient-to-b from-background to-card">
      <div className="container mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Escolha o{" "}
            <span className="text-gradient-primary">plano ideal</span>{" "}
            para você
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Todos os planos incluem teste grátis de 24 horas.
            Cancele quando quiser, sem burocracia.
          </p>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {plans.map((plan, index) => {
            const IconComponent = plan.icon;
            return (
              <Card
                key={index}
                className={`relative bg-gradient-card border-2 transition-smooth hover:scale-[1.02] hover:shadow-elevated ${
                  plan.popular
                    ? "border-primary shadow-glow"
                    : "border-border hover:border-primary/40"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <div className="bg-gradient-primary px-6 py-2 rounded-full text-sm font-bold text-primary-foreground shadow-glow">
                      Mais Popular
                    </div>
                  </div>
                )}

                <CardHeader className="text-center pb-4">
                  <div className="flex justify-center mb-4">
                    <div className={`p-3 rounded-full ${
                      plan.popular ? "bg-gradient-primary shadow-glow" : "bg-secondary"
                    }`}>
                      <IconComponent className={`h-8 w-8 ${
                        plan.popular ? "text-primary-foreground" : "text-primary"
                      }`} />
                    </div>
                  </div>
                  <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
                  <div className="space-y-1">
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-3xl font-bold text-gradient-primary">
                        {plan.price}
                      </span>
                      <span className="text-muted-foreground">{plan.period}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{plan.description}</p>
                  </div>
                </CardHeader>

                <CardContent className="space-y-6">
                  {/* Features */}
                  <ul className="space-y-3">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  <Button
                    variant={plan.popular ? "hero" : "premium"}
                    size="default"
                    className="w-full"
                  >
                    {plan.ctaText}
                  </Button>
                </CardContent>
              </Card>
            );
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
    </section>
  );
};

export default PlansSection;