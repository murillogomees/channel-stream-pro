import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calculator, TrendingDown, Sparkles } from "lucide-react";

const SavingsCalculator = () => {
  const [selectedPlan, setSelectedPlan] = useState("trimestral");

  const monthlyPrice = 30.00;

  const plans = {
    mensal: { name: "Mensal", price: 30.00, months: 1 },
    trimestral: { name: "Trimestral", price: 79.90, months: 3 },
    semestral: { name: "Semestral", price: 149.90, months: 6 },
    anual: { name: "Anual", price: 279.90, months: 12 }
  };

  const calculateSavings = (planKey: string) => {
    const plan = plans[planKey as keyof typeof plans];
    const monthlyTotal = monthlyPrice * plan.months;
    const savings = monthlyTotal - plan.price;
    const savingsPercent = ((savings / monthlyTotal) * 100).toFixed(1);
    return { savings, savingsPercent, monthlyTotal, plan };
  };

  const result = calculateSavings(selectedPlan);

  return (
    <section className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-background to-card">
      <div className="container mx-auto max-w-5xl">
        <div className="text-center mb-8 sm:mb-12">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Calculator className="h-8 w-8 text-primary" />
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold">
              Calculadora de Economia
            </h2>
          </div>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            Escolha a duração do seu plano e veja quanto você economiza
          </p>
        </div>

        <Card className="bg-gradient-card border-2 border-primary/20 shadow-glow">
          <CardHeader>
            <CardTitle className="text-center text-2xl">
              Selecione a duração do plano
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Radio Group */}
            <RadioGroup value={selectedPlan} onValueChange={setSelectedPlan} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(plans).map(([key, plan]) => (
                <div key={key} className="relative">
                  <RadioGroupItem value={key} id={key} className="peer sr-only" />
                  <Label
                    htmlFor={key}
                    className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-background/50 p-4 hover:bg-accent hover:border-primary cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 peer-data-[state=checked]:shadow-glow"
                  >
                    <span className="text-lg font-bold">{plan.name}</span>
                    <span className="text-2xl font-bold text-primary mt-2">
                      R$ {plan.price.toFixed(2).replace('.', ',')}
                    </span>
                    <span className="text-sm text-muted-foreground mt-1">
                      {plan.months} {plan.months === 1 ? 'mês' : 'meses'}
                    </span>
                  </Label>
                </div>
              ))}
            </RadioGroup>

            {/* Results */}
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-6 space-y-4 border border-primary/20">
              <div className="flex items-center gap-2 text-primary font-semibold text-lg">
                <Sparkles className="h-5 w-5" />
                <span>Resultado da Simulação</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Monthly Total */}
                <div className="bg-background/80 rounded-lg p-4 text-center">
                  <div className="text-sm text-muted-foreground mb-1">
                    Pagamento Mensal
                  </div>
                  <div className="text-2xl font-bold">
                    R$ {result.monthlyTotal.toFixed(2).replace('.', ',')}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {result.plan.months}x de R$ {monthlyPrice.toFixed(2).replace('.', ',')}
                  </div>
                </div>

                {/* Selected Plan */}
                <div className="bg-primary/20 rounded-lg p-4 text-center border-2 border-primary">
                  <div className="text-sm text-primary-foreground/80 mb-1">
                    Plano {result.plan.name}
                  </div>
                  <div className="text-2xl font-bold text-primary-foreground">
                    R$ {result.plan.price.toFixed(2).replace('.', ',')}
                  </div>
                  <div className="text-xs text-primary-foreground/80 mt-1">
                    Pagamento único
                  </div>
                </div>

                {/* Savings */}
                <div className="bg-green-500/20 rounded-lg p-4 text-center border-2 border-green-500/50">
                  <div className="text-sm text-green-700 dark:text-green-400 mb-1 flex items-center justify-center gap-1">
                    <TrendingDown className="h-4 w-4" />
                    Você Economiza
                  </div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    R$ {result.savings.toFixed(2).replace('.', ',')}
                  </div>
                  <div className="text-xs text-green-700 dark:text-green-400 mt-1">
                    {result.savingsPercent}% de desconto
                  </div>
                </div>
              </div>

              {/* Additional Info */}
              {result.savings > 0 && (
                <div className="bg-background/60 rounded-lg p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    💡 Com o plano <span className="font-semibold text-foreground">{result.plan.name}</span>, você paga{" "}
                    <span className="font-semibold text-green-600 dark:text-green-400">
                      R$ {result.savings.toFixed(2).replace('.', ',')} a menos
                    </span>{" "}
                    do que pagaria mensalmente durante {result.plan.months} {result.plan.months === 1 ? 'mês' : 'meses'}!
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default SavingsCalculator;
