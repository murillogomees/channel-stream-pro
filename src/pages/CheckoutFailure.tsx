/**
 * Checkout Failure Page
 * Displayed after failed or rejected payment
 */

import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { XCircle } from "lucide-react";
import { motion } from "framer-motion";

export default function CheckoutFailure() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const paymentId = searchParams.get("payment_id");
  const status = searchParams.get("status");

  const getErrorMessage = () => {
    switch (status) {
      case "rejected":
        return "Seu pagamento foi recusado. Por favor, verifique os dados do cartão ou tente outro método de pagamento.";
      case "cancelled":
        return "O pagamento foi cancelado. Você pode tentar novamente quando quiser.";
      default:
        return "Não foi possível processar seu pagamento. Por favor, tente novamente.";
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4">
      {/* Background Image with overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ 
          backgroundImage: 'url(/images/checkout-failure-bg.png)',
        }}
      />
      <div className="absolute inset-0 bg-background/55" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative z-10"
      >
        <Card className="w-full max-w-md text-center bg-card/95 backdrop-blur-sm border-border/50 shadow-2xl">
          <CardHeader className="space-y-4 pb-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="mx-auto w-20 h-20 rounded-full bg-destructive/20 flex items-center justify-center"
            >
              <XCircle className="h-10 w-10 text-destructive" />
            </motion.div>
            <CardTitle className="text-2xl">Pagamento não concluído</CardTitle>
            <CardDescription>{getErrorMessage()}</CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-8">
            {paymentId && (
              <p className="text-xs text-muted-foreground mb-6">
                Referência: {paymentId}
              </p>
            )}
            
            <div className="flex flex-col items-center gap-4">
              <motion.div
                animate={{ 
                  scale: [1, 1.02, 1],
                  boxShadow: [
                    "0 0 20px rgba(34, 197, 94, 0.3)",
                    "0 0 40px rgba(34, 197, 94, 0.5)",
                    "0 0 20px rgba(34, 197, 94, 0.3)"
                  ]
                }}
                transition={{ 
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="w-full rounded-xl"
              >
                <Button 
                  size="lg" 
                  className="w-full bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 hover:from-emerald-600 hover:via-green-600 hover:to-teal-600 text-white font-bold text-base shadow-xl border-0 h-14 rounded-xl"
                  onClick={() => navigate("/checkout")}
                >
                  Tentar Novamente
                </Button>
              </motion.div>
              
              <Button 
                variant="destructive" 
                className="w-full h-11 text-base font-semibold rounded-lg"
                onClick={() => window.open("https://wa.me/5511999999999?text=Preciso de ajuda com meu pagamento", "_blank")}
              >
                Preciso de Ajuda
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
