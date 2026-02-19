/**
 * Checkout Pending Page
 * Displayed when payment is pending (e.g., boleto, PIX waiting)
 * Only accessible by authenticated users via checkout redirect
 */

import { useEffect } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Copy, CheckCircle, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

export default function CheckoutPending() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, loading: authLoading } = useAuth();

  const paymentId = searchParams.get("payment_id");
  const externalReference = searchParams.get("external_reference");
  const status = searchParams.get("status") || "pending";
  const collectionStatus = searchParams.get("collection_status");
  const paymentType = searchParams.get("payment_type");
  
  // Check if user came from checkout
  const fromCheckout = paymentId || location.state?.fromCheckout;

  // Redirect if not authenticated or didn't come from checkout
  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        navigate("/login", { replace: true });
        return;
      }
      if (!fromCheckout) {
        navigate("/profile", { replace: true });
        return;
      }
    }
  }, [isAuthenticated, authLoading, fromCheckout, navigate]);

  const copyPaymentId = () => {
    if (paymentId) {
      navigator.clipboard.writeText(paymentId);
      toast.success("ID copiado!");
    }
  };

  // Get display status code for internal team
  const getStatusCode = () => {
    const codes = [];
    if (status) codes.push(`status=${status}`);
    if (collectionStatus) codes.push(`collection=${collectionStatus}`);
    if (paymentType) codes.push(`type=${paymentType}`);
    return codes.length > 0 ? codes.join(' | ') : 'pending';
  };

  // Show loading while checking auth
  if (authLoading || (!isAuthenticated && !fromCheckout)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4">
      {/* Background Image with overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ 
          backgroundImage: 'url(/images/checkout-pending-bg.png)',
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
              className="mx-auto w-20 h-20 rounded-full bg-yellow-500/20 flex items-center justify-center"
            >
              <Clock className="h-10 w-10 text-yellow-500" />
            </motion.div>
            <CardTitle className="text-2xl">Pagamento Pendente</CardTitle>
            <CardDescription>
              Seu pagamento está sendo processado. Você receberá uma confirmação assim que for aprovado.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-8">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2 mb-6">
              <p className="text-sm text-muted-foreground">
                Status: <span className="text-yellow-500 font-medium">Aguardando confirmação</span>
              </p>
              <p className="text-xs text-muted-foreground/70 font-mono">
                [{getStatusCode()}]
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
            
            <div className="space-y-2 text-left bg-primary/5 rounded-lg p-4 mb-6">
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
            
            <div className="flex flex-col items-center">
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
                  onClick={() => navigate("/profile")}
                >
                  Ir ao Meu Perfil
                </Button>
              </motion.div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
