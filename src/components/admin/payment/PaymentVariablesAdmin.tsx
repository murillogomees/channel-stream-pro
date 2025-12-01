/**
 * PaymentVariablesAdmin - Visualização de todas as variáveis e APIs de pagamento
 * Mostra detalhadamente todas as variáveis usadas no fluxo de checkout
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Copy, ExternalLink, Code, Database, CreditCard, Webhook, User, Receipt, Settings } from "lucide-react";
import { toast } from "sonner";

interface Variable {
  name: string;
  type: string;
  description: string;
  source: "user" | "system" | "api" | "database";
  required: boolean;
  defaultValue?: string;
  example?: string;
}

interface ApiEndpoint {
  name: string;
  method: string;
  url: string;
  description: string;
  variables: Variable[];
  headers?: Record<string, string>;
}

const checkoutVariables: Variable[] = [
  { name: "plan_id", type: "uuid", description: "ID do plano selecionado", source: "user", required: true, example: "uuid-do-plano" },
  { name: "nome", type: "string", description: "Nome completo do cliente", source: "user", required: true, example: "João Silva" },
  { name: "email", type: "string", description: "Email do cliente (usado para login)", source: "user", required: true, example: "joao@email.com" },
  { name: "telefone", type: "string", description: "WhatsApp do cliente", source: "user", required: true, example: "(11) 99999-9999" },
  { name: "senha", type: "string", description: "Senha de acesso do cliente", source: "user", required: true, example: "******" },
  { name: "origem", type: "string", description: "Como conheceu o sistema", source: "user", required: false, example: "Instagram" },
  { name: "payment_method", type: "enum", description: "Método de pagamento selecionado", source: "user", required: false, defaultValue: "pix", example: "pix | credit_card | debit_card | boleto" },
  { name: "coupon_code", type: "string", description: "Código de cupom de desconto", source: "user", required: false, example: "DESCONTO10" },
  { name: "affiliate_id", type: "uuid", description: "ID do afiliado que indicou", source: "system", required: false, example: "uuid-do-afiliado" },
  { name: "success_url", type: "string", description: "URL de retorno após sucesso", source: "system", required: false, defaultValue: "/checkout/success" },
  { name: "failure_url", type: "string", description: "URL de retorno após falha", source: "system", required: false, defaultValue: "/checkout/failure" },
  { name: "pending_url", type: "string", description: "URL de retorno para pendente", source: "system", required: false, defaultValue: "/checkout/pending" },
];

const mercadoPagoPreferenceVariables: Variable[] = [
  { name: "items[].id", type: "string", description: "ID único do item (plan_id)", source: "database", required: true },
  { name: "items[].title", type: "string", description: "Título do produto", source: "database", required: true, example: "IPTV Link - Plano Mensal" },
  { name: "items[].description", type: "string", description: "Descrição do plano", source: "database", required: false },
  { name: "items[].quantity", type: "number", description: "Quantidade (sempre 1)", source: "system", required: true, defaultValue: "1" },
  { name: "items[].currency_id", type: "string", description: "Moeda", source: "system", required: true, defaultValue: "BRL" },
  { name: "items[].unit_price", type: "number", description: "Preço final com descontos aplicados", source: "system", required: true },
  { name: "payer.email", type: "string", description: "Email do pagador", source: "user", required: true },
  { name: "payer.name", type: "string", description: "Nome do pagador", source: "user", required: true },
  { name: "payer.phone.number", type: "string", description: "Telefone (apenas números)", source: "user", required: false },
  { name: "back_urls.success", type: "string", description: "URL de sucesso", source: "system", required: true },
  { name: "back_urls.failure", type: "string", description: "URL de falha", source: "system", required: true },
  { name: "back_urls.pending", type: "string", description: "URL de pendente", source: "system", required: true },
  { name: "auto_return", type: "string", description: "Retorno automático após aprovação", source: "system", required: false, defaultValue: "approved" },
  { name: "external_reference", type: "string", description: "Referência externa (user_id:plan_id:cliente_id)", source: "system", required: true },
  { name: "notification_url", type: "string", description: "URL do webhook", source: "system", required: true },
  { name: "statement_descriptor", type: "string", description: "Descrição na fatura do cartão", source: "system", required: false, defaultValue: "IPTVLINK" },
  { name: "expires", type: "boolean", description: "Se a preferência expira", source: "system", required: false, defaultValue: "true" },
  { name: "expiration_date_to", type: "string", description: "Data de expiração (24h)", source: "system", required: false },
  { name: "excluded_payment_types", type: "array", description: "Tipos de pagamento excluídos", source: "user", required: false },
];

const webhookVariables: Variable[] = [
  { name: "id", type: "string", description: "ID do evento webhook", source: "api", required: true },
  { name: "action", type: "string", description: "Ação do evento", source: "api", required: true, example: "payment.created" },
  { name: "type", type: "string", description: "Tipo do evento", source: "api", required: true, example: "payment" },
  { name: "data.id", type: "string", description: "ID do pagamento", source: "api", required: true },
  { name: "live_mode", type: "boolean", description: "Se é ambiente de produção", source: "api", required: true },
  { name: "date_created", type: "string", description: "Data de criação do evento", source: "api", required: true },
];

const paymentResponseVariables: Variable[] = [
  { name: "id", type: "number", description: "ID do pagamento no Mercado Pago", source: "api", required: true },
  { name: "status", type: "string", description: "Status do pagamento", source: "api", required: true, example: "approved | pending | rejected | cancelled" },
  { name: "status_detail", type: "string", description: "Detalhes do status", source: "api", required: true },
  { name: "transaction_amount", type: "number", description: "Valor da transação", source: "api", required: true },
  { name: "currency_id", type: "string", description: "Moeda", source: "api", required: true },
  { name: "payment_method_id", type: "string", description: "Método de pagamento usado", source: "api", required: true },
  { name: "payment_type_id", type: "string", description: "Tipo de pagamento", source: "api", required: true },
  { name: "external_reference", type: "string", description: "Referência externa", source: "api", required: true },
  { name: "payer.email", type: "string", description: "Email do pagador", source: "api", required: true },
  { name: "payer.id", type: "string", description: "ID do pagador no MP", source: "api", required: false },
  { name: "date_created", type: "string", description: "Data de criação", source: "api", required: true },
  { name: "date_approved", type: "string", description: "Data de aprovação", source: "api", required: false },
  { name: "money_release_date", type: "string", description: "Data de liberação do dinheiro", source: "api", required: false },
];

const apiEndpoints: ApiEndpoint[] = [
  {
    name: "checkout-with-registration",
    method: "POST",
    url: "/functions/v1/checkout-with-registration",
    description: "Cria usuário, cliente e inicia checkout em uma única requisição",
    variables: checkoutVariables,
    headers: {
      "Content-Type": "application/json",
    },
  },
  {
    name: "mercado-pago-checkout",
    method: "POST",
    url: "/functions/v1/mercado-pago-checkout",
    description: "Cria checkout para usuário já autenticado",
    variables: [
      { name: "plan_id", type: "uuid", description: "ID do plano", source: "user", required: true },
      { name: "success_url", type: "string", description: "URL de sucesso", source: "system", required: false },
      { name: "failure_url", type: "string", description: "URL de falha", source: "system", required: false },
      { name: "pending_url", type: "string", description: "URL de pendente", source: "system", required: false },
    ],
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer {JWT_TOKEN}",
    },
  },
  {
    name: "mercado-pago-webhook",
    method: "POST",
    url: "/functions/v1/mercado-pago-webhook",
    description: "Recebe notificações do Mercado Pago sobre pagamentos",
    variables: webhookVariables,
    headers: {
      "x-signature": "{HMAC_SIGNATURE}",
      "x-request-id": "{REQUEST_ID}",
    },
  },
];

const databaseTables = [
  {
    name: "subscription_plans",
    description: "Planos de assinatura disponíveis",
    fields: ["id", "name", "description", "price", "period_months", "features", "is_active"],
  },
  {
    name: "user_subscriptions",
    description: "Assinaturas ativas dos usuários",
    fields: ["user_id", "plan_id", "status", "current_period_start", "current_period_end", "cancel_at_period_end"],
  },
  {
    name: "payments",
    description: "Histórico de pagamentos",
    fields: ["user_id", "mercado_pago_payment_id", "mercado_pago_preference_id", "amount", "status", "payment_method", "paid_at"],
  },
  {
    name: "clientes",
    description: "Dados dos clientes",
    fields: ["user_id", "nome", "telefone", "email", "plano", "situacao", "data_vencimento", "valor_pago"],
  },
  {
    name: "discount_coupons",
    description: "Cupons de desconto",
    fields: ["code", "discount_type", "discount_value", "valid_from", "valid_until", "max_uses", "current_uses", "affiliate_id"],
  },
  {
    name: "mercado_pago_webhooks",
    description: "Log de webhooks recebidos",
    fields: ["event_id", "event_type", "action", "data_id", "raw_payload", "processed"],
  },
];

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
  toast.success("Copiado para a área de transferência");
};

const getSourceBadge = (source: Variable["source"]) => {
  const colors = {
    user: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    system: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    api: "bg-green-500/20 text-green-400 border-green-500/30",
    database: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  };
  const labels = {
    user: "Usuário",
    system: "Sistema",
    api: "API",
    database: "Banco",
  };
  return <Badge variant="outline" className={colors[source]}>{labels[source]}</Badge>;
};

export function PaymentVariablesAdmin() {
  const [showSecrets, setShowSecrets] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Variáveis de Pagamento</h2>
          <p className="text-muted-foreground">
            Todas as variáveis e APIs usadas no fluxo de checkout e pagamentos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="show-secrets" className="text-sm">Mostrar Secrets</Label>
          <Switch id="show-secrets" checked={showSecrets} onCheckedChange={setShowSecrets} />
        </div>
      </div>

      <Tabs defaultValue="checkout" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 h-auto">
          <TabsTrigger value="checkout" className="flex items-center gap-2 py-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Checkout</span>
          </TabsTrigger>
          <TabsTrigger value="mercadopago" className="flex items-center gap-2 py-2">
            <Receipt className="h-4 w-4" />
            <span className="hidden sm:inline">Mercado Pago</span>
          </TabsTrigger>
          <TabsTrigger value="webhook" className="flex items-center gap-2 py-2">
            <Webhook className="h-4 w-4" />
            <span className="hidden sm:inline">Webhooks</span>
          </TabsTrigger>
          <TabsTrigger value="database" className="flex items-center gap-2 py-2">
            <Database className="h-4 w-4" />
            <span className="hidden sm:inline">Database</span>
          </TabsTrigger>
          <TabsTrigger value="secrets" className="flex items-center gap-2 py-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Secrets</span>
          </TabsTrigger>
        </TabsList>

        {/* Checkout Variables */}
        <TabsContent value="checkout" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Variáveis do Checkout com Registro
              </CardTitle>
              <CardDescription>
                Variáveis enviadas na requisição de checkout que cria usuário e inicia pagamento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-4 p-3 bg-muted/50 rounded-lg">
                <Badge variant="secondary">POST</Badge>
                <code className="flex-1 text-sm">/functions/v1/checkout-with-registration</code>
                <Button size="sm" variant="ghost" onClick={() => copyToClipboard("/functions/v1/checkout-with-registration")}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Variável</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Fonte</TableHead>
                      <TableHead>Obrigatório</TableHead>
                      <TableHead>Descrição</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {checkoutVariables.map((v) => (
                      <TableRow key={v.name}>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">{v.name}</code>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">{v.type}</span>
                        </TableCell>
                        <TableCell>{getSourceBadge(v.source)}</TableCell>
                        <TableCell>
                          {v.required ? (
                            <Badge variant="destructive" className="text-xs">Sim</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Não</Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[300px]">
                          <p className="text-sm">{v.description}</p>
                          {v.defaultValue && (
                            <p className="text-xs text-muted-foreground mt-1">Default: {v.defaultValue}</p>
                          )}
                          {v.example && (
                            <p className="text-xs text-blue-400 mt-1">Ex: {v.example}</p>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Exemplo de Request Body</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <pre className="p-4 bg-muted/50 rounded-lg text-xs overflow-x-auto">
{`{
  "plan_id": "uuid-do-plano",
  "user_data": {
    "nome": "João Silva",
    "email": "joao@email.com",
    "telefone": "(11) 99999-9999",
    "senha": "senha123",
    "origem": "Instagram"
  },
  "payment_method": "pix",
  "coupon_code": "DESCONTO10",
  "success_url": "https://app.com/checkout/success",
  "failure_url": "https://app.com/checkout/failure",
  "pending_url": "https://app.com/checkout/pending"
}`}
                </pre>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(`{
  "plan_id": "uuid-do-plano",
  "user_data": {
    "nome": "João Silva",
    "email": "joao@email.com",
    "telefone": "(11) 99999-9999",
    "senha": "senha123",
    "origem": "Instagram"
  },
  "payment_method": "pix",
  "coupon_code": "DESCONTO10"
}`)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Mercado Pago Variables */}
        <TabsContent value="mercadopago" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Variáveis da Preference (Mercado Pago)
              </CardTitle>
              <CardDescription>
                Objeto enviado para API do Mercado Pago ao criar preferência de checkout
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-4 p-3 bg-muted/50 rounded-lg">
                <Badge className="bg-green-600">POST</Badge>
                <code className="flex-1 text-sm">https://api.mercadopago.com/checkout/preferences</code>
                <Button size="sm" variant="ghost" asChild>
                  <a href="https://www.mercadopago.com.br/developers/pt/reference/preferences/_checkout_preferences/post" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>

              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campo</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Fonte</TableHead>
                      <TableHead>Descrição</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mercadoPagoPreferenceVariables.map((v) => (
                      <TableRow key={v.name}>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">{v.name}</code>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{v.type}</TableCell>
                        <TableCell>{getSourceBadge(v.source)}</TableCell>
                        <TableCell className="max-w-[300px]">
                          <p className="text-sm">{v.description}</p>
                          {v.defaultValue && (
                            <p className="text-xs text-muted-foreground mt-1">Default: {v.defaultValue}</p>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resposta do Pagamento</CardTitle>
              <CardDescription>Campos retornados pela API do Mercado Pago após consulta de pagamento</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campo</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descrição</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentResponseVariables.map((v) => (
                      <TableRow key={v.name}>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">{v.name}</code>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{v.type}</TableCell>
                        <TableCell>
                          <p className="text-sm">{v.description}</p>
                          {v.example && <p className="text-xs text-blue-400 mt-1">{v.example}</p>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Webhook Variables */}
        <TabsContent value="webhook" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Webhook className="h-5 w-5" />
                Webhook de Notificação
              </CardTitle>
              <CardDescription>
                Dados recebidos do Mercado Pago quando um pagamento é processado
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-4 p-3 bg-muted/50 rounded-lg">
                <Badge className="bg-yellow-600">POST</Badge>
                <code className="flex-1 text-sm">/functions/v1/mercado-pago-webhook</code>
              </div>

              <div className="mb-6">
                <h4 className="font-semibold mb-2">Fluxo do Webhook</h4>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>Mercado Pago envia notificação para nosso webhook</li>
                  <li>Verificamos assinatura HMAC (se configurada)</li>
                  <li>Buscamos detalhes completos do pagamento na API</li>
                  <li>Atualizamos tabela <code className="bg-muted px-1 rounded">payments</code></li>
                  <li>Se aprovado: ativamos assinatura e atualizamos cliente</li>
                  <li>Logamos webhook em <code className="bg-muted px-1 rounded">mercado_pago_webhooks</code></li>
                </ol>
              </div>

              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="payload">
                  <AccordionTrigger>Payload do Webhook</AccordionTrigger>
                  <AccordionContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Campo</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Descrição</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {webhookVariables.map((v) => (
                          <TableRow key={v.name}>
                            <TableCell>
                              <code className="text-xs bg-muted px-2 py-1 rounded">{v.name}</code>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{v.type}</TableCell>
                            <TableCell>{v.description}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="status">
                  <AccordionTrigger>Mapeamento de Status</AccordionTrigger>
                  <AccordionContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Status MP</TableHead>
                          <TableHead>Status Sistema</TableHead>
                          <TableHead>Ação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell><Badge className="bg-green-600">approved</Badge></TableCell>
                          <TableCell>approved</TableCell>
                          <TableCell>Ativa assinatura, atualiza cliente para "Ativo"</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell><Badge className="bg-yellow-600">pending</Badge></TableCell>
                          <TableCell>pending</TableCell>
                          <TableCell>Aguarda confirmação</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell><Badge className="bg-blue-600">in_process</Badge></TableCell>
                          <TableCell>in_process</TableCell>
                          <TableCell>Em análise</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell><Badge variant="destructive">rejected</Badge></TableCell>
                          <TableCell>rejected</TableCell>
                          <TableCell>Pagamento rejeitado</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell><Badge variant="secondary">cancelled</Badge></TableCell>
                          <TableCell>cancelled</TableCell>
                          <TableCell>Pagamento cancelado</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell><Badge variant="outline">refunded</Badge></TableCell>
                          <TableCell>refunded</TableCell>
                          <TableCell>Pagamento estornado</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Database Tables */}
        <TabsContent value="database" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Tabelas Envolvidas no Pagamento
              </CardTitle>
              <CardDescription>
                Estrutura de dados usada no fluxo de checkout e assinaturas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full">
                {databaseTables.map((table) => (
                  <AccordionItem key={table.name} value={table.name}>
                    <AccordionTrigger>
                      <div className="flex items-center gap-2">
                        <code className="text-sm bg-muted px-2 py-1 rounded">{table.name}</code>
                        <span className="text-xs text-muted-foreground">- {table.description}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-lg">
                        {table.fields.map((field) => (
                          <Badge key={field} variant="outline" className="font-mono text-xs">
                            {field}
                          </Badge>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fluxo de Dados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-muted/30 rounded-lg font-mono text-xs space-y-2">
                <p>1. Checkout → <span className="text-blue-400">auth.users</span> (cria usuário)</p>
                <p>2. Checkout → <span className="text-blue-400">profiles</span> (dados do perfil)</p>
                <p>3. Checkout → <span className="text-blue-400">user_roles</span> (role: client)</p>
                <p>4. Checkout → <span className="text-blue-400">clientes</span> (dados completos)</p>
                <p>5. Checkout → <span className="text-blue-400">payments</span> (status: pending)</p>
                <p>6. Checkout → <span className="text-blue-400">user_subscriptions</span> (status: trial)</p>
                <p>7. Webhook → <span className="text-green-400">payments</span> (atualiza status)</p>
                <p>8. Webhook → <span className="text-green-400">user_subscriptions</span> (status: active)</p>
                <p>9. Webhook → <span className="text-green-400">clientes</span> (situacao: Ativo)</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Secrets */}
        <TabsContent value="secrets" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Variáveis de Ambiente (Secrets)
              </CardTitle>
              <CardDescription>
                Secrets necessários para o funcionamento das integrações
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <code className="font-semibold">MERCADO_PAGO_ACCESS_TOKEN</code>
                    <Badge>Obrigatório</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Token de acesso do Mercado Pago para criar preferências e consultar pagamentos
                  </p>
                  <Input 
                    type={showSecrets ? "text" : "password"} 
                    value="TEST-xxxx-xxxx-xxxx-xxxx" 
                    disabled 
                    className="font-mono text-xs"
                  />
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <code className="font-semibold">MERCADO_PAGO_WEBHOOK_SECRET</code>
                    <Badge variant="secondary">Opcional</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Secret para validar assinatura HMAC dos webhooks (recomendado em produção)
                  </p>
                  <Input 
                    type={showSecrets ? "text" : "password"} 
                    value="Não configurado" 
                    disabled 
                    className="font-mono text-xs"
                  />
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <code className="font-semibold">SUPABASE_URL</code>
                    <Badge>Sistema</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    URL do projeto Supabase (automático)
                  </p>
                  <Input 
                    type="text" 
                    value="https://sdvyxdghxqmntyoweqbd.supabase.co" 
                    disabled 
                    className="font-mono text-xs"
                  />
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <code className="font-semibold">SUPABASE_SERVICE_ROLE_KEY</code>
                    <Badge>Sistema</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Chave de serviço do Supabase (automático, nunca expor)
                  </p>
                  <Input 
                    type="password" 
                    value="********************" 
                    disabled 
                    className="font-mono text-xs"
                  />
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Gerenciar secrets no painel do Supabase
                </p>
                <Button variant="outline" size="sm" asChild>
                  <a 
                    href="https://supabase.com/dashboard/project/sdvyxdghxqmntyoweqbd/settings/functions" 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Abrir Secrets
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default PaymentVariablesAdmin;
