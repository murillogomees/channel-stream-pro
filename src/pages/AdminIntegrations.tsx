import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/admin/PageHeader";
import AdminWhatsAppConfig from "./AdminWhatsAppConfig";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertCircle, ExternalLink, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function AdminIntegrations() {
  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <PageHeader
        title="Integrações Externas"
        description="Gerenciamento de integrações com serviços externos"
      />

      <Tabs defaultValue="whatsapp" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="whatsapp">WhatsApp BotBot</TabsTrigger>
          <TabsTrigger value="smartone">SmartOne IPTV</TabsTrigger>
        </TabsList>

        <TabsContent value="whatsapp" className="space-y-4">
          <AdminWhatsAppConfig />
        </TabsContent>

        <TabsContent value="smartone" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5 text-muted-foreground" />
                SmartOne IPTV - Integração Manual
              </CardTitle>
              <CardDescription>
                A integração com SmartOne IPTV é realizada manualmente através do painel administrativo do SmartOne.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Integração via API não disponível</AlertTitle>
                <AlertDescription>
                  Atualmente, o SmartOne IPTV não oferece uma API pública para integração automática. 
                  O cadastro de clientes deve ser feito manualmente no painel do SmartOne.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <h3 className="font-semibold">Como cadastrar clientes no SmartOne:</h3>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>Acesse o painel administrativo do SmartOne IPTV</li>
                  <li>Navegue até a seção de gerenciamento de playlists</li>
                  <li>Crie uma nova playlist ou edite uma existente</li>
                  <li>Insira o MAC Address do cliente (disponível no cadastro)</li>
                  <li>Configure a URL da playlist M3U</li>
                  <li>Salve as alterações</li>
                </ol>

                <div className="pt-4">
                  <Button variant="outline" asChild>
                    <a 
                      href="https://smartone-iptv.com/plugin/smart_one/client_main/index/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-2"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Abrir Painel SmartOne IPTV
                    </a>
                  </Button>
                </div>
              </div>

              <Alert variant="default" className="mt-6 bg-muted">
                <Info className="h-4 w-4" />
                <AlertTitle>Dica</AlertTitle>
                <AlertDescription>
                  Ao editar um cliente no sistema, você pode usar o botão "Copiar dados para SmartOne" 
                  que facilita a cópia do nome, MAC e URL M3U para o painel do SmartOne.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
