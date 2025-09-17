import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Crown, Star, Zap } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";

const PlansSection = () => {
  const { config } = useSiteConfig();
  
  const iconMap = {
    "Zap": Zap,
    "Star": Star,
    "Crown": Crown
  };

  const plans = config.plans?.items || [];

  return (
    <section className="py-20 px-6 bg-gradient-to-b from-background to-card">
      <div className="container mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            {config.plans?.title || "Escolha o plano ideal para você"}
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {config.plans?.subtitle || "Todos os planos incluem teste grátis de 24 horas. Cancele quando quiser, sem burocracia."}
          </p>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {plans.map((plan, index) => {
            const IconComponent = Star; // Default icon
            return (
              <Card
                key={index}
                className={`relative bg-gradient-card border-2 transition-smooth hover:scale-[1.02] hover:shadow-elevated ${
                  plan.highlighted
                    ? "border-primary shadow-glow"
                    : "border-border hover:border-primary/40"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <div className="bg-gradient-primary px-6 py-2 rounded-full text-sm font-bold text-primary-foreground shadow-glow">
                      Mais Popular
                    </div>
                  </div>
                )}

                <CardHeader className="text-center pb-4">
                  <div className="flex justify-center mb-4">
                    <div className={`p-3 rounded-full ${
                      plan.highlighted ? "bg-gradient-primary shadow-glow" : "bg-secondary"
                    }`}>
                      <IconComponent className={`h-8 w-8 ${
                        plan.highlighted ? "text-primary-foreground" : "text-primary"
                      }`} />
                    </div>
                  </div>
                  <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
                  <div className="space-y-1">
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-3xl font-bold text-gradient-primary">
                        {plan.currency}{plan.price}
                      </span>
                      <span className="text-muted-foreground">{plan.period}</span>
                    </div>
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
                    variant={plan.highlighted ? "hero" : "default"}
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