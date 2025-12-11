import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, AlertTriangle } from "lucide-react";

export default function AdminSecurityEscalation() {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl">
      <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
        <Button variant="outline" size="icon" onClick={() => navigate('/admin/dashboard')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-lg sm:text-2xl font-bold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-primary" />
          Escalonamento de Alertas
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sistema de Escalonamento</CardTitle>
          <CardDescription>
            Configure regras de escalonamento para alertas de segurança
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Sistema de escalonamento em desenvolvimento.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
