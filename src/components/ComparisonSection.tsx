import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, TrendingDown, TrendingUp } from "lucide-react";

const ComparisonSection = () => {
  const monthlyPrice = 30.00;
  
  const plans = [
    {
      name: "Trimestral",
      price: 109.00,
      months: 3,
      highlighted: false
    },
    {
      name: "Semestral",
      price: 200.00,
      months: 6,
      highlighted: true
    },
    {
      name: "Anual",
      price: 360.00,
      months: 12,
      highlighted: false
    }
  ];

  const calculateSavings = (planPrice: number, months: number) => {
    const monthlyTotal = monthlyPrice * months;
    const savings = monthlyTotal - planPrice;
    const savingsPercent = ((savings / monthlyTotal) * 100).toFixed(1);
    return { savings, savingsPercent, monthlyTotal };
  };

  return (
    <section className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-card to-background">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12 lg:mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6">
            Compare e Economize
          </h2>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto px-4">
            Veja quanto você economiza escolhendo planos de maior duração
          </p>
        </div>

        {/* Comparison Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto mb-12">
          {plans.map((plan, index) => {
            const { savings, savingsPercent, monthlyTotal } = calculateSavings(plan.price, plan.months);
            const hasPositiveSavings = savings > 0;
            
            return (
              <Card 
                key={index}
                className={`relative bg-gradient-card border-2 transition-smooth hover:scale-[1.02] hover:shadow-elevated ${
                  plan.highlighted ? "border-primary shadow-glow" : "border-border hover:border-primary/40"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <div className="bg-gradient-primary rounded-full text-xs font-semibold text-primary-foreground shadow-glow py-1 px-3">
                      Melhor Custo-Benefício
                    </div>
                  </div>
                )}

                <CardHeader className="text-center pb-4">
                  <CardTitle className="text-2xl font-bold mb-2">
                    Plano {plan.name}
                  </CardTitle>
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">
                      {plan.months} meses por
                    </div>
                    <div className="text-3xl font-bold text-gradient-primary">
                      R$ {plan.price.toFixed(2).replace('.', ',')}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Monthly comparison */}
                  <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Pagamento mensal:</span>
                      <span className="font-semibold">R$ {monthlyTotal.toFixed(2).replace('.', ',')}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Pagamento {plan.name.toLowerCase()}:</span>
                      <span className="font-semibold">R$ {plan.price.toFixed(2).replace('.', ',')}</span>
                    </div>
                    <div className="h-px bg-border my-2"></div>
                    <div className={`flex items-center justify-between font-bold ${
                      hasPositiveSavings ? "text-green-500" : savings < 0 ? "text-red-500" : "text-muted-foreground"
                    }`}>
                      <span className="flex items-center gap-1">
                        {hasPositiveSavings ? (
                          <TrendingDown className="h-4 w-4" />
                        ) : savings < 0 ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : null}
                        {hasPositiveSavings ? "Economia:" : savings < 0 ? "Diferença:" : "Sem diferença"}
                      </span>
                      <span>
                        R$ {Math.abs(savings).toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  </div>

                  {/* Savings percentage */}
                  {hasPositiveSavings && (
                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-center">
                      <div className="text-green-500 font-bold text-lg">
                        {savingsPercent}% de desconto
                      </div>
                      <div className="text-xs text-green-500/80 mt-1">
                        comparado ao pagamento mensal
                      </div>
                    </div>
                  )}

                  {/* Benefits */}
                  <ul className="space-y-2 pt-2">
                    <li className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                      <span>Pagamento único</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                      <span>Sem preocupação mensal</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                      <span>Acesso garantido por {plan.months} meses</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Bottom info */}
        <div className="text-center space-y-4">
          <p className="text-muted-foreground text-sm max-w-2xl mx-auto">
            💡 <strong>Dica:</strong> Planos de maior duração garantem seu preço fixo sem reajustes durante todo o período contratado
          </p>
        </div>
      </div>
    </section>
  );
};

export default ComparisonSection;
