import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings } from "lucide-react";

export default function AdminNotificationSettings() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Configurações de Notificações
        </CardTitle>
        <CardDescription>
          Configure as preferências de envio de notificações
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Configurações em desenvolvimento. Use a aba principal para enviar notificações.
        </p>
      </CardContent>
    </Card>
  );
}
