import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, AdminLayout } from "@/components/admin";
import { Shield, AlertTriangle, Eye, Lock } from "lucide-react";

export default function AdminSegurancaPage() {
  return (
    <AdminLayout>
      <PageHeader
        title="Segurança"
        description="Gerencie configurações de segurança do sistema"
        backTo="/admin/dashboard"
      />

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="alerts" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Alertas
          </TabsTrigger>
          <TabsTrigger value="access" className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Acesso
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Status de Segurança
              </CardTitle>
              <CardDescription>
                Visão geral da segurança do sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Sistema de monitoramento de segurança ativo.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Alertas de Segurança</CardTitle>
              <CardDescription>
                Últimos alertas e eventos de segurança
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Nenhum alerta recente.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="access" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Controle de Acesso</CardTitle>
              <CardDescription>
                Gerencie permissões e acesso ao sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Configurações de acesso em desenvolvimento.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
