/**
 * MercadoPagoIntegration - Configuração completa da integração Mercado Pago
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  CreditCard, Key, Users, TestTube, Code, FileJson, 
  Copy, Check, AlertCircle, CheckCircle2, Play,
  RefreshCw, ExternalLink, Shield, Loader2
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ApiConfig {
  sandboxAccessToken: string;
  productionAccessToken: string;
  publicKey: string;
  webhookSecret: string;
  useSandbox: boolean;
}

interface TestUser {
  id: number;
  nickname: string;
  email: string;
  password?: string;
  site_status: string;
  description?: string;
}

const TEST_CARDS = [
  { brand: "Mastercard", number: "5031 4332 1540 6351", cvv: "123", expiry: "11/25", status: "approved", holder: "APRO" },
  { brand: "Visa", number: "4509 9535 6623 3704", cvv: "123", expiry: "11/25", status: "approved", holder: "APRO" },
  { brand: "Mastercard", number: "5031 7557 3453 0604", cvv: "123", expiry: "11/25", status: "pending", holder: "CONT" },
  { brand: "Visa", number: "4170 0688 1010 8020", cvv: "123", expiry: "11/25", status: "rejected", holder: "OTHE" },
  { brand: "Amex", number: "3753 651535 56885", cvv: "1234", expiry: "11/25", status: "approved", holder: "APRO" },
];

const API_EXAMPLES = {
  createPreference: {
    title: "Criar Preferência de Pagamento",
    method: "POST",
    endpoint: "https://api.mercadopago.com/checkout/preferences",
    body: `{
  "items": [
    {
      "id": "plan_mensal",
      "title": "IPTV Link - Plano Mensal",
      "description": "Assinatura mensal do IPTV Link",
      "quantity": 1,
      "currency_id": "BRL",
      "unit_price": 29.90
    }
  ],
  "payer": {
    "email": "cliente@email.com",
    "name": "Nome do Cliente"
  },
  "back_urls": {
    "success": "https://seusite.com/checkout/success",
    "failure": "https://seusite.com/checkout/failure",
    "pending": "https://seusite.com/checkout/pending"
  },
  "auto_return": "approved",
  "external_reference": "user_id:plan_id",
  "notification_url": "https://sua-api.com/webhook"
}`
  },
  getPayment: {
    title: "Consultar Pagamento",
    method: "GET",
    endpoint: "https://api.mercadopago.com/v1/payments/{payment_id}",
    body: null
  },
  createSubscription: {
    title: "Criar Assinatura Recorrente",
    method: "POST",
    endpoint: "https://api.mercadopago.com/preapproval",
    body: `{
  "reason": "IPTV Link - Assinatura Mensal",
  "auto_recurring": {
    "frequency": 1,
    "frequency_type": "months",
    "transaction_amount": 29.90,
    "currency_id": "BRL"
  },
  "back_url": "https://seusite.com/subscription/callback",
  "payer_email": "cliente@email.com",
  "external_reference": "user_id:plan_id"
}`
  }
};

const PAYMENT_STATUSES = [
  { status: "approved", description: "Pagamento aprovado", color: "bg-green-500" },
  { status: "pending", description: "Aguardando pagamento (boleto/pix)", color: "bg-yellow-500" },
  { status: "in_process", description: "Em análise", color: "bg-blue-500" },
  { status: "rejected", description: "Pagamento rejeitado", color: "bg-red-500" },
  { status: "refunded", description: "Pagamento devolvido", color: "bg-purple-500" },
  { status: "cancelled", description: "Pagamento cancelado", color: "bg-gray-500" },
  { status: "charged_back", description: "Chargeback (contestação)", color: "bg-orange-500" },
];

export function MercadoPagoIntegration() {
  const [config, setConfig] = useState<ApiConfig>({
    sandboxAccessToken: "",
    productionAccessToken: "",
    publicKey: "",
    webhookSecret: "",
    useSandbox: true
  });
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [testUsers, setTestUsers] = useState<TestUser[]>([]);
  const [creatingUser, setCreatingUser] = useState(false);

  // Load config on mount
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('mercado_pago_config')
        .select('*')
        .eq('id', '00000000-0000-0000-0000-000000000001')
        .maybeSingle();
      
      if (error) throw error;
      
      if (data) {
        setConfig({
          sandboxAccessToken: data.sandbox_access_token || "",
          productionAccessToken: data.production_access_token || "",
          publicKey: data.public_key || "",
          webhookSecret: data.webhook_secret || "",
          useSandbox: data.use_sandbox ?? true
        });
      }
    } catch (error) {
      console.error('Error loading config:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('mercado_pago_config')
        .update({
          sandbox_access_token: config.sandboxAccessToken || null,
          production_access_token: config.productionAccessToken || null,
          public_key: config.publicKey || null,
          webhook_secret: config.webhookSecret || null,
          use_sandbox: config.useSandbox
        })
        .eq('id', '00000000-0000-0000-0000-000000000001');
      
      if (error) throw error;
      
      toast.success("Configurações salvas com sucesso!");
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success("Copiado para área de transferência");
    setTimeout(() => setCopiedField(null), 2000);
  };

  const fetchTestUsers = async () => {
    // Mercado Pago não tem endpoint para LISTAR usuários de teste
    // Apenas para CRIAR novos usuários
    toast.info("A API do Mercado Pago não fornece endpoint para listar usuários. Use 'Criar Usuário de Teste' para criar um novo.");
  };

  const createTestUser = async () => {
    // Test user creation REQUIRES production token
    if (!config.productionAccessToken) {
      toast.error("Configure o Access Token de PRODUÇÃO primeiro");
      return;
    }

    setCreatingUser(true);
    try {
      const response = await fetch("https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/mercado-pago-test-users", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          accessToken: config.productionAccessToken,
          action: 'create'
        })
      });
      
      const data = await response.json();
      
      if (data.success && data.user) {
        // Add to local list
        setTestUsers(prev => [...prev, {
          id: data.user.id,
          nickname: data.user.nickname,
          email: data.user.email,
          password: data.user.password,
          site_status: data.user.site_status || 'active'
        }]);
        toast.success("Usuário de teste criado com sucesso! Guarde as credenciais.");
      } else {
        toast.error(data.error || "Falha ao criar usuário de teste");
        if (data.info?.reason) {
          console.log('Info:', data.info);
        }
      }
    } catch (error) {
      console.error('Error creating test user:', error);
      toast.error("Erro ao criar usuário de teste");
    } finally {
      setCreatingUser(false);
    }
  };

  const testConnection = async () => {
    const token = config.useSandbox ? config.sandboxAccessToken : config.productionAccessToken;
    if (!token) {
      toast.error("Insira o Access Token primeiro");
      return;
    }

    try {
      // Use edge function proxy to avoid CORS
      const response = await fetch("https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/mercado-pago-test", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: token })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setTestResult(`✅ Conexão OK! Conta: ${data.email} (ID: ${data.id})`);
        toast.success("Conexão com Mercado Pago estabelecida!");
      } else {
        setTestResult("❌ Falha na autenticação. Verifique o token.");
        toast.error("Falha na autenticação");
      }
    } catch (error) {
      setTestResult("❌ Erro de conexão");
      toast.error("Erro ao conectar com Mercado Pago");
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="config" className="space-y-4">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="config" className="text-xs sm:text-sm">
            <Key className="h-4 w-4 mr-1 hidden sm:inline" />
            Configuração
          </TabsTrigger>
          <TabsTrigger value="test-users" className="text-xs sm:text-sm">
            <Users className="h-4 w-4 mr-1 hidden sm:inline" />
            Usuários Teste
          </TabsTrigger>
          <TabsTrigger value="test-cards" className="text-xs sm:text-sm">
            <CreditCard className="h-4 w-4 mr-1 hidden sm:inline" />
            Cartões Teste
          </TabsTrigger>
          <TabsTrigger value="api-examples" className="text-xs sm:text-sm">
            <Code className="h-4 w-4 mr-1 hidden sm:inline" />
            API Examples
          </TabsTrigger>
          <TabsTrigger value="statuses" className="text-xs sm:text-sm">
            <FileJson className="h-4 w-4 mr-1 hidden sm:inline" />
            Status
          </TabsTrigger>
        </TabsList>

        {/* CONFIGURAÇÃO */}
        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Chaves de API
              </CardTitle>
              <CardDescription>
                Configure as credenciais do Mercado Pago para sandbox e produção
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <TestTube className="h-5 w-5 text-yellow-500" />
                  <div>
                    <p className="font-medium">Modo Sandbox</p>
                    <p className="text-sm text-muted-foreground">
                      {config.useSandbox ? "Usando ambiente de testes" : "Usando ambiente de produção"}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={config.useSandbox}
                  onCheckedChange={(checked) => setConfig(prev => ({ ...prev, useSandbox: checked }))}
                />
              </div>

              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label>Access Token (Sandbox)</Label>
                  <Input
                    type="password"
                    placeholder="TEST-xxxx-xxxx-xxxx"
                    value={config.sandboxAccessToken}
                    onChange={(e) => setConfig(prev => ({ ...prev, sandboxAccessToken: e.target.value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Access Token (Produção)</Label>
                  <Input
                    type="password"
                    placeholder="APP_USR-xxxx-xxxx-xxxx"
                    value={config.productionAccessToken}
                    onChange={(e) => setConfig(prev => ({ ...prev, productionAccessToken: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Public Key</Label>
                  <Input
                    placeholder="APP_USR-xxxx-xxxx-xxxx"
                    value={config.publicKey}
                    onChange={(e) => setConfig(prev => ({ ...prev, publicKey: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Webhook Secret (opcional)</Label>
                  <Input
                    type="password"
                    placeholder="Chave secreta para validar webhooks"
                    value={config.webhookSecret}
                    onChange={(e) => setConfig(prev => ({ ...prev, webhookSecret: e.target.value }))}
                  />
                </div>
              </div>

              <Separator />

              <div className="flex gap-3">
                <Button onClick={testConnection} variant="outline" disabled={saving}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Testar Conexão
                </Button>
                <Button onClick={saveConfig} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Shield className="h-4 w-4 mr-2" />
                  )}
                  {saving ? "Salvando..." : "Salvar Configuração"}
                </Button>
              </div>

              {testResult && (
                <div className={`p-3 rounded-lg ${testResult.includes("✅") ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"}`}>
                  {testResult}
                </div>
              )}

              <div className="p-4 bg-blue-500/10 rounded-lg">
                <div className="flex items-start gap-2">
                  <ExternalLink className="h-4 w-4 mt-1 text-blue-500" />
                  <div className="text-sm">
                    <p className="font-medium text-blue-600">Onde encontrar as credenciais?</p>
                    <a 
                      href="https://www.mercadopago.com.br/developers/panel/app" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      Painel de Desenvolvedores do Mercado Pago →
                    </a>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* USUÁRIOS DE TESTE */}
        <TabsContent value="test-users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Usuários de Teste
              </CardTitle>
              <CardDescription>
                Crie usuários de teste para simular pagamentos no ambiente sandbox
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-blue-500/10 rounded-lg mb-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-1 text-blue-500" />
                  <div className="text-sm text-blue-600">
                    <p><strong>Importante:</strong> A criação de usuários de teste requer o <strong>Access Token de PRODUÇÃO</strong> (APP_USR-...), não o de sandbox.</p>
                    <p className="mt-1">Os usuários criados podem ser usados para testar pagamentos no ambiente sandbox.</p>
                  </div>
                </div>
              </div>

              <Button 
                onClick={createTestUser} 
                disabled={creatingUser || !config.productionAccessToken} 
                className="w-full"
                variant={config.productionAccessToken ? "default" : "outline"}
              >
                {creatingUser ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Users className="h-4 w-4 mr-2" />
                )}
                {creatingUser ? "Criando..." : "Criar Novo Usuário de Teste"}
              </Button>

              {!config.productionAccessToken && (
                <p className="text-xs text-muted-foreground text-center">
                  Configure o Access Token de Produção na aba Configuração
                </p>
              )}

              {testUsers.length > 0 ? (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3">
                    {testUsers.map((user) => (
                      <div key={user.id} className="p-4 border rounded-lg space-y-3 bg-card">
                        <div className="flex items-center justify-between">
                          <Badge variant="default">
                            {user.nickname || `User ${user.id}`}
                          </Badge>
                          <Badge variant={user.site_status === "active" ? "secondary" : "outline"}>
                            {user.site_status}
                          </Badge>
                        </div>
                        
                        <div className="grid gap-3">
                          <div>
                            <Label className="text-xs">ID</Label>
                            <div className="flex items-center gap-2 mt-1">
                              <code className="text-sm bg-muted px-2 py-1 rounded flex-1">{user.id}</code>
                              <Button 
                                size="icon" 
                                variant="ghost"
                                onClick={() => copyToClipboard(String(user.id), `user-${user.id}-id`)}
                              >
                                {copiedField === `user-${user.id}-id` ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                              </Button>
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs">Email</Label>
                            <div className="flex items-center gap-2 mt-1">
                              <code className="text-sm bg-muted px-2 py-1 rounded flex-1 truncate">{user.email}</code>
                              <Button 
                                size="icon" 
                                variant="ghost"
                                onClick={() => copyToClipboard(user.email, `user-${user.id}-email`)}
                              >
                                {copiedField === `user-${user.id}-email` ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                              </Button>
                            </div>
                          </div>
                          {user.password && (
                            <div>
                              <Label className="text-xs">Senha</Label>
                              <div className="flex items-center gap-2 mt-1">
                                <code className="text-sm bg-muted px-2 py-1 rounded flex-1">{user.password}</code>
                                <Button 
                                  size="icon" 
                                  variant="ghost"
                                  onClick={() => copyToClipboard(user.password!, `user-${user.id}-password`)}
                                >
                                  {copiedField === `user-${user.id}-password` ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhum usuário de teste criado nesta sessão</p>
                  <p className="text-xs mt-1">Clique no botão acima para criar um novo</p>
                </div>
              )}

              <div className="p-4 bg-yellow-500/10 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-1 text-yellow-500" />
                  <p className="text-sm text-yellow-600">
                    <strong>Dica:</strong> Você também pode gerenciar usuários de teste no{" "}
                    <a 
                      href="https://www.mercadopago.com.br/developers/panel/test-users" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="underline hover:text-yellow-700"
                    >
                      Painel de Desenvolvedores
                    </a>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CARTÕES DE TESTE */}
        <TabsContent value="test-cards" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Cartões de Teste
              </CardTitle>
              <CardDescription>
                Use estes cartões para simular diferentes cenários de pagamento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {TEST_CARDS.map((card, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-5 w-5" />
                          <span className="font-medium">{card.brand}</span>
                        </div>
                        <Badge variant={
                          card.status === "approved" ? "default" : 
                          card.status === "pending" ? "secondary" : "destructive"
                        }>
                          {card.status === "approved" ? "✓ Aprovado" : 
                           card.status === "pending" ? "⏳ Pendente" : "✗ Rejeitado"}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <Label className="text-xs text-muted-foreground">Número</Label>
                          <div className="flex items-center gap-1">
                            <code className="bg-muted px-2 py-1 rounded text-xs">{card.number}</code>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-6 w-6"
                              onClick={() => copyToClipboard(card.number.replace(/\s/g, ""), `card-${index}`)}
                            >
                              {copiedField === `card-${index}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                            </Button>
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">CVV</Label>
                          <code className="bg-muted px-2 py-1 rounded text-xs block">{card.cvv}</code>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Validade</Label>
                          <code className="bg-muted px-2 py-1 rounded text-xs block">{card.expiry}</code>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Titular</Label>
                          <code className="bg-muted px-2 py-1 rounded text-xs block">{card.holder}</code>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="mt-4 p-4 bg-blue-500/10 rounded-lg">
                <p className="text-sm text-blue-600">
                  <strong>Dica:</strong> Use o nome do titular para definir o resultado do pagamento:
                  <br />• <code>APRO</code> = Aprovado | <code>CONT</code> = Pendente | <code>OTHE</code> = Rejeitado
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* EXEMPLOS DE API */}
        <TabsContent value="api-examples" className="space-y-4">
          {Object.entries(API_EXAMPLES).map(([key, example]) => (
            <Card key={key}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{example.title}</CardTitle>
                  <Badge variant="outline">{example.method}</Badge>
                </div>
                <code className="text-xs text-muted-foreground break-all">{example.endpoint}</code>
              </CardHeader>
              {example.body && (
                <CardContent>
                  <div className="relative">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(example.body!, `api-${key}`)}
                    >
                      {copiedField === `api-${key}` ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                    <Textarea
                      value={example.body}
                      readOnly
                      className="font-mono text-xs h-[200px] resize-none"
                    />
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </TabsContent>

        {/* STATUS DE PAGAMENTO */}
        <TabsContent value="statuses" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileJson className="h-5 w-5" />
                Status de Pagamento
              </CardTitle>
              <CardDescription>
                Possíveis retornos de status do Mercado Pago
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {PAYMENT_STATUSES.map((item) => (
                  <div key={item.status} className="flex items-center gap-3 p-3 border rounded-lg">
                    <div className={`w-3 h-3 rounded-full ${item.color}`} />
                    <code className="font-mono text-sm bg-muted px-2 py-1 rounded">{item.status}</code>
                    <span className="text-sm text-muted-foreground">{item.description}</span>
                  </div>
                ))}
              </div>

              <Separator className="my-4" />

              <div className="space-y-3">
                <h4 className="font-medium">Fluxo de Pagamento</h4>
                <div className="p-4 bg-muted rounded-lg text-sm space-y-2">
                  <p>1. <strong>Criar Preferência</strong> → Retorna <code>init_point</code></p>
                  <p>2. <strong>Redirecionar Usuário</strong> → Checkout do Mercado Pago</p>
                  <p>3. <strong>Webhook</strong> → Recebe notificação de pagamento</p>
                  <p>4. <strong>Consultar Pagamento</strong> → Confirmar status</p>
                  <p>5. <strong>Liberar Acesso</strong> → Ativar assinatura do usuário</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default MercadoPagoIntegration;
