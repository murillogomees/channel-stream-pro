/**
 * Checkout Failure Page
 * Displayed after failed or rejected payment
 */

import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { XCircle, RefreshCw, HelpCircle, ArrowLeft } from "lucide-react";
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-destructive/5 flex items-center justify-center p-4">
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
              className="mx-auto w-20 h-20 rounded-full bg-destructive/20 flex items-center justify-center"
            >
              <XCircle className="h-10 w-10 text-destructive" />
            </motion.div>
            <CardTitle className="text-2xl">Pagamento não concluído</CardTitle>
            <CardDescription>{getErrorMessage()}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {paymentId && (
              <p className="text-xs text-muted-foreground">
                Referência: {paymentId}
              </p>
            )}
            
            <div className="space-y-3">
              <Button 
                size="lg" 
                className="w-full"
                onClick={() => navigate("/planos")}
              >
                <RefreshCw className="h-5 w-5 mr-2" />
                Tentar Novamente
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => window.open("https://wa.me/5511999999999?text=Preciso de ajuda com meu pagamento", "_blank")}
              >
                <HelpCircle className="h-4 w-4 mr-2" />
                Preciso de Ajuda
              </Button>
              
              <Button 
                variant="ghost" 
                className="w-full"
                onClick={() => navigate("/")}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar ao Início
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
