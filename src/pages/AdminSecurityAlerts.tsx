import { useState } from "react";
import { Bell, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AdminSecurityAlerts() {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl overflow-x-hidden">
      <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
        <Button variant="outline" size="icon" onClick={() => navigate('/admin/dashboard')} className="flex-shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold flex items-center gap-2 flex-wrap">
            <Bell className="h-5 w-5 sm:h-8 sm:w-8 text-primary flex-shrink-0" />
            <span className="truncate">Alertas de Segurança</span>
          </h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sistema de Alertas</CardTitle>
          <CardDescription>
            Configure alertas de segurança para monitoramento do sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Sistema de alertas de segurança em desenvolvimento. 
            As tabelas necessárias serão criadas em uma próxima versão.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
