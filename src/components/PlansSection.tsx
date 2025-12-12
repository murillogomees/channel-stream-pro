import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Star, Zap } from "lucide-react";
import { trackEvent } from "@/services/metaPixelService";
import { supabase } from "@/lib/supabase";
import { Skeleton } from "@/components/ui/skeleton";

interface Plan {
  id: string;
  name: string;
  price: number;
  currency: string;
  period: string;
  features: string[];
  cta_text: string;
  is_highlighted: boolean;
  savings_amount: number | null;
  savings_percent: number | null;
  whatsapp_message: string | null;
}

interface SectionContent {
  title: string;
  subtitle: string;
  trial_text: string;
  benefits: string[];
  whatsapp_number: string;
}

const PlansSection = () => {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [content, setContent] = useState<SectionContent>({
    title: "Planos e Preços",
    subtitle: "Escolha o plano ideal para você e sua família",
    trial_text: "🔥 Teste Grátis por 24 horas em todos os planos",
    benefits: ["Sem taxa de instalação", "Sem fidelidade", "Cancele quando quiser", "Acesso imediato"],
    whatsapp_number: "556131425880",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Buscar planos
        const { data: plansData } = await supabase
          .from('subscription_plans')
          .select('*')
          .eq('is_active', true)
          .order('display_order', { ascending: true });

        if (plansData && plansData.length > 0) {
          setPlans(plansData.map(p => ({
            ...p,
            features: (p.features as string[] | null) || []
          })));
        }

        // Buscar conteúdo da seção
        const { data: contentData } = await supabase
          .from('homepage_content')
          .select('content')
          .eq('section_key', 'plans')
          .single();

        if (contentData?.content) {
          setContent(contentData.content as unknown as SectionContent);
        }
      } catch (error) {
        console.error('Erro ao carregar planos:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <section className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-background to-card">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-8 sm:mb-12 lg:mb-16">
            <Skeleton className="h-12 w-64 mx-auto mb-4" />
            <Skeleton className="h-6 w-96 mx-auto" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-96 w-full" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-background to-card">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12 lg:mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6">
            {content.title}
          </h2>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto px-4">
            {content.subtitle}
          </p>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 max-w-7xl mx-auto">
          {plans.map((plan) => (
            <Card 
              key={plan.id} 
              className={`relative bg-gradient-card border-2 transition-smooth hover:scale-[1.02] hover:shadow-elevated h-full flex flex-col ${plan.is_highlighted ? "border-primary shadow-glow" : "border-border hover:border-primary/40"}`}
            >
              {plan.is_highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <div className="bg-gradient-primary rounded-full text-xs font-semibold text-primary-foreground shadow-glow py-1 px-3">
                    Mais Popular
                  </div>
                </div>
              )}

              {plan.savings_percent && (
                <div className="absolute -top-3 right-4">
                  <div className="bg-success text-success-foreground rounded-full text-xs font-bold shadow-lg py-1.5 px-3 flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    -{plan.savings_percent}%
                  </div>
                </div>
              )}

              <CardHeader className="text-center pb-4 flex-shrink-0">
                <div className="flex justify-center mb-4">
                  <div className={`p-3 rounded-full ${plan.is_highlighted ? "bg-gradient-primary shadow-glow" : "bg-secondary"}`}>
                    <Star className={`h-6 w-6 ${plan.is_highlighted ? "text-primary-foreground" : "text-primary"}`} />
                  </div>
                </div>
                <CardTitle className="text-2xl font-bold leading-tight min-h-[3rem] flex items-center justify-center">
                  {plan.name}
                </CardTitle>
                <div className="space-y-2 mt-4">
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-3xl font-bold text-gradient-primary">
                      {plan.currency}{plan.price.toFixed(2).replace('.', ',')}
                    </span>
                    <span className="text-muted-foreground font-medium">{plan.period}</span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-6 flex-1 flex flex-col justify-between">
                {/* Features */}
                <ul className="space-y-3 flex-1">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm leading-relaxed">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <div className="pt-4">
                  <Button 
                    variant={plan.is_highlighted ? "hero" : "default"} 
                    size="default" 
                    className="w-full font-semibold"
                    onClick={() => {
                      trackEvent('AddToCart', { 
                        content_name: `Plano ${plan.name}`, 
                        content_type: 'product',
                        value: plan.price,
                        currency: 'BRL'
                      });
                      // Redirect to signup with plan pre-selected
                      navigate(`/signup?plan=${plan.id}`);
                    }}
                  >
                    {plan.cta_text}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Additional Info */}
        <div className="text-center mt-12 space-y-4">
          <p className="text-muted-foreground">
            <strong>{content.trial_text}</strong>
          </p>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
            {content.benefits.map((benefit, index) => (
              <span key={index}>✅ {benefit}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default PlansSection;
