/**
 * Checkout Success Page
 * Displayed after successful payment
 */

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Play, ArrowRight, Loader2 } from "lucide-react";
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="w-full max-w-md text-center">
          <CardHeader className="space-y-4">
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
          <CardContent className="space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {paymentId && (
                  <p className="text-xs text-muted-foreground">
                    ID do pagamento: {paymentId}
                  </p>
                )}
                
                <div className="space-y-3">
                  <Button 
                    size="lg" 
                    className="w-full"
                    onClick={() => navigate("/app/player")}
                  >
                    <Play className="h-5 w-5 mr-2" />
                    Começar a Assistir
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => navigate("/conta")}
                  >
                    Ver Minha Conta
                    <ArrowRight className="h-4 w-4 ml-2" />
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
