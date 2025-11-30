/**
 * Checkout Pending Page
 * Displayed when payment is pending (e.g., boleto, PIX waiting)
 */

import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Copy, ArrowRight, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

export default function CheckoutPending() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const paymentId = searchParams.get("payment_id");
  const externalReference = searchParams.get("external_reference");

  const copyPaymentId = () => {
    if (paymentId) {
      navigator.clipboard.writeText(paymentId);
      toast.success("ID copiado!");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-yellow-500/5 flex items-center justify-center p-4">
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
              className="mx-auto w-20 h-20 rounded-full bg-yellow-500/20 flex items-center justify-center"
            >
              <Clock className="h-10 w-10 text-yellow-500" />
            </motion.div>
            <CardTitle className="text-2xl">Pagamento Pendente</CardTitle>
            <CardDescription>
              Seu pagamento está sendo processado. Você receberá uma confirmação assim que for aprovado.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p className="text-sm text-muted-foreground">
                Status: <span className="text-yellow-500 font-medium">Aguardando confirmação</span>
              </p>
              {paymentId && (
                <div className="flex items-center justify-center gap-2">
                  <p className="text-xs text-muted-foreground">
                    ID: {paymentId}
                  </p>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={copyPaymentId}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
            
            <div className="space-y-2 text-left bg-primary/5 rounded-lg p-4">
              <h4 className="font-medium text-sm">Próximos passos:</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span>Complete o pagamento no método escolhido</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span>Aguarde a confirmação (pode levar alguns minutos)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span>Sua assinatura será ativada automaticamente</span>
                </li>
              </ul>
            </div>
            
            <div className="space-y-3">
              <Button 
                size="lg" 
                className="w-full"
                onClick={() => navigate("/conta")}
              >
                Ver Status da Assinatura
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => navigate("/")}
              >
                Voltar ao Início
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
