/**
 * Checkout Success Page
 * Displayed after successful payment
 */

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export default function CheckoutSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Refresh user data to get updated subscription
    const init = async () => {
      await refreshUser();
      setLoading(false);
    };
    init();
  }, [refreshUser]);

  const paymentId = searchParams.get("payment_id");
  const status = searchParams.get("status");

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4">
      {/* Background Image with overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ 
          backgroundImage: 'url(/images/checkout-success-bg.png)',
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
              className="mx-auto w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center"
            >
              <CheckCircle2 className="h-10 w-10 text-green-500" />
            </motion.div>
            <CardTitle className="text-2xl">Pagamento Confirmado!</CardTitle>
            <CardDescription>
              Sua assinatura está ativa. Aproveite todo o conteúdo!
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-8">
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {paymentId && (
                  <p className="text-xs text-muted-foreground mb-6">
                    ID do pagamento: {paymentId}
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
                      onClick={() => navigate("/app/player")}
                    >
                      Começar a Assistir
                    </Button>
                  </motion.div>
                  
                  <Button 
                    variant="destructive" 
                    className="w-full h-11 text-base font-semibold rounded-lg"
                    onClick={() => navigate("/conta")}
                  >
                    Ver Minha Conta
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
