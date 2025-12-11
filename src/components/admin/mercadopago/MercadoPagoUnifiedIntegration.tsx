/**
 * MercadoPagoUnifiedIntegration - Configuração unificada Mercado Pago
 * Combina configuração de credenciais, variáveis de API, e ferramentas de teste
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  CreditCard, Key, Users, TestTube, Code, FileJson, 
  Copy, Check, AlertCircle, CheckCircle2, Play,
  RefreshCw, ExternalLink, Shield, Loader2, Database,
  Webhook, Settings, Receipt
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_FUNCTIONS_URL } from "@/config/supabase";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
}

const TEST_CARDS = [
  { brand: "Mastercard", number: "5031 4332 1540 6351", cvv: "123", expiry: "11/25", status: "approved", holder: "APRO" },
  { brand: "Visa", number: "4509 9535 6623 3704", cvv: "123", expiry: "11/25", status: "approved", holder: "APRO" },
  { brand: "Mastercard", number: "5031 7557 3453 0604", cvv: "123", expiry: "11/25", status: "pending", holder: "CONT" },
  { brand: "Visa", number: "4170 0688 1010 8020", cvv: "123", expiry: "11/25", status: "rejected", holder: "OTHE" },
  { brand: "Amex", number: "3753 651535 56885", cvv: "1234", expiry: "11/25", status: "approved", holder: "APRO" },
];

const PAYMENT_STATUSES = [
  { status: "approved", description: "Pagamento aprovado", color: "bg-green-500" },
  { status: "pending", description: "Aguardando pagamento (boleto/pix)", color: "bg-yellow-500" },
  { status: "in_process", description: "Em análise", color: "bg-blue-500" },
  { status: "rejected", description: "Pagamento rejeitado", color: "bg-red-500" },
  { status: "refunded", description: "Pagamento devolvido", color: "bg-purple-500" },
  { status: "cancelled", description: "Pagamento cancelado", color: "bg-gray-500" },
];

// Secrets necessários para o Mercado Pago
const REQUIRED_SECRETS = [
  { name: "MERCADO_PAGO_ACCESS_TOKEN", description: "Token de acesso de produção", required: true },
  { name: "MERCADO_PAGO_WEBHOOK_SECRET", description: "Chave para validar webhooks", required: false },
];

export function MercadoPagoUnifiedIntegration() {
  const [config, setConfig] = useState<ApiConfig>({
    sandboxAccessToken: "",
    productionAccessToken: "",
    publicKey: "",
    webhookSecret: "",
    useSandbox: false
  });
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [testUsers, setTestUsers] = useState<TestUser[]>([]);
  const [creatingUser, setCreatingUser] = useState(false);
  const [configuredViaSecrets, setConfiguredViaSecrets] = useState(false);
  const [secretsStatus, setSecretsStatus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadConfig();
    checkSecretsStatus();
  }, []);

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('mercado_pago_config')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      
      if (data) {
        const isViaSecrets = data.production_access_token === 'CONFIGURED_VIA_SECRETS';
        setConfiguredViaSecrets(isViaSecrets);
        
        setConfig({
          sandboxAccessToken: isViaSecrets ? "" : (data.sandbox_access_token || ""),
          productionAccessToken: isViaSecrets ? "" : (data.production_access_token || ""),
          publicKey: data.public_key || "",
          webhookSecret: isViaSecrets ? "" : (data.webhook_secret || ""),
          useSandbox: data.use_sandbox ?? false
        });
      }
    } catch (error) {
      console.error('Error loading config:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkSecretsStatus = async () => {
    // Verificar quais secrets estão configurados testando a conexão
    try {
      const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/mercado-pago-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkSecrets: true })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.secretsConfigured) {
          setSecretsStatus({
            'MERCADO_PAGO_ACCESS_TOKEN': true,
            'MERCADO_PAGO_WEBHOOK_SECRET': data.webhookSecretConfigured || false
          });
          setConfiguredViaSecrets(true);
        }
      }
    } catch (error) {
      console.log('Could not check secrets status');
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const payload = {
        id: '00000000-0000-0000-0000-000000000001',
        sandbox_access_token: config.sandboxAccessToken || null,
        production_access_token: config.productionAccessToken || 'CONFIGURED_VIA_SECRETS',
        public_key: config.publicKey || null,
        webhook_secret: config.webhookSecret || null,
        use_sandbox: config.useSandbox
      };

      const { error } = await supabase
        .from('mercado_pago_config')
        .upsert(payload, { onConflict: 'id' });
      
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
    toast.success("Copiado!");
    setTimeout(() => setCopiedField(null), 2000);
  };

  const createTestUser = async () => {
    if (!config.productionAccessToken && !configuredViaSecrets) {
      toast.error("Configure o Access Token de PRODUÇÃO primeiro");
      return;
    }

    setCreatingUser(true);
    try {
      const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/mercado-pago-test-users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create' })
      });
      
      const data = await response.json();
      
      if (data.success && data.user) {
        setTestUsers(prev => [...prev, {
          id: data.user.id,
          nickname: data.user.nickname,
          email: data.user.email,
          password: data.user.password,
          site_status: data.user.site_status || 'active'
        }]);
        toast.success("Usuário de teste criado com sucesso!");
      } else {
        toast.error(data.error || "Falha ao criar usuário de teste");
      }
    } catch (error) {
      console.error('Error creating test user:', error);
      toast.error("Erro ao criar usuário de teste");
    } finally {
      setCreatingUser(false);
    }
  };

  const testConnection = async () => {
    try {
      const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/mercado-pago-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          accessToken: configuredViaSecrets ? undefined : (config.useSandbox ? config.sandboxAccessToken : config.productionAccessToken)
        })
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="config" className="space-y-4">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 w-full">
          <TabsTrigger value="config" className="text-xs sm:text-sm">
            <Key className="h-4 w-4 mr-1 hidden sm:inline" />
            Credenciais
          </TabsTrigger>
          <TabsTrigger value="secrets" className="text-xs sm:text-sm">
            <Shield className="h-4 w-4 mr-1 hidden sm:inline" />
            Secrets
          </TabsTrigger>
          <TabsTrigger value="test-cards" className="text-xs sm:text-sm">
            <CreditCard className="h-4 w-4 mr-1 hidden sm:inline" />
            Cartões Teste
          </TabsTrigger>
          <TabsTrigger value="test-users" className="text-xs sm:text-sm">
            <Users className="h-4 w-4 mr-1 hidden sm:inline" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="flow" className="text-xs sm:text-sm">
            <Webhook className="h-4 w-4 mr-1 hidden sm:inline" />
            Fluxo
          </TabsTrigger>
          <TabsTrigger value="statuses" className="text-xs sm:text-sm">
            <FileJson className="h-4 w-4 mr-1 hidden sm:inline" />
            Status
          </TabsTrigger>
        </TabsList>

        {/* CREDENCIAIS */}
        <TabsContent value="config" className="space-y-4">
          {configuredViaSecrets && (
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-700">Credenciais Configuradas via Supabase Secrets</p>
                  <p className="text-sm text-green-600">
                    O Access Token está configurado com segurança nos Secrets do projeto (MERCADO_PAGO_ACCESS_TOKEN).
                  </p>
                </div>
              </div>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Chaves de API
              </CardTitle>
              <CardDescription>
                {configuredViaSecrets 
                  ? "Credenciais gerenciadas via Supabase Secrets" 
                  : "Configure as credenciais do Mercado Pago"
                }
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

              {!configuredViaSecrets && (
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
                    <Label>Webhook Secret</Label>
                    <Input
                      type="password"
                      placeholder="Chave secreta para validar webhooks"
                      value={config.webhookSecret}
                      onChange={(e) => setConfig(prev => ({ ...prev, webhookSecret: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              <Separator />

              <div className="flex flex-wrap gap-3">
                <Button onClick={testConnection} variant="outline" disabled={saving}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Testar Conexão
                </Button>
                {!configuredViaSecrets && (
                  <Button onClick={saveConfig} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Shield className="h-4 w-4 mr-2" />}
                    {saving ? "Salvando..." : "Salvar"}
                  </Button>
                )}
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

        {/* SECRETS STATUS */}
        <TabsContent value="secrets" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Status dos Secrets
              </CardTitle>
              <CardDescription>
                Secrets configurados no Supabase para o Mercado Pago
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {REQUIRED_SECRETS.map((secret) => (
                  <div key={secret.name} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`h-3 w-3 rounded-full ${configuredViaSecrets ? 'bg-green-500' : 'bg-yellow-500'}`} />
                      <div>
                        <p className="font-mono text-sm font-medium">{secret.name}</p>
                        <p className="text-xs text-muted-foreground">{secret.description}</p>
                      </div>
                    </div>
                    <Badge variant={configuredViaSecrets ? "default" : "secondary"}>
                      {configuredViaSecrets ? "Configurado" : "Pendente"}
                    </Badge>
                  </div>
                ))}
              </div>

              <Separator className="my-6" />

              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">Como configurar Secrets</h4>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Acesse o painel do Lovable Cloud</li>
                  <li>Vá em Secrets</li>
                  <li>Adicione MERCADO_PAGO_ACCESS_TOKEN com seu token de produção</li>
                  <li>Opcionalmente, adicione MERCADO_PAGO_WEBHOOK_SECRET</li>
                </ol>
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
                Use estes cartões para testar pagamentos no sandbox
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bandeira</TableHead>
                      <TableHead>Número</TableHead>
                      <TableHead>CVV</TableHead>
                      <TableHead>Validade</TableHead>
                      <TableHead>Titular</TableHead>
                      <TableHead>Resultado</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {TEST_CARDS.map((card, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{card.brand}</TableCell>
                        <TableCell className="font-mono text-sm">{card.number}</TableCell>
                        <TableCell>{card.cvv}</TableCell>
                        <TableCell>{card.expiry}</TableCell>
                        <TableCell>{card.holder}</TableCell>
                        <TableCell>
                          <Badge variant={
                            card.status === 'approved' ? 'default' :
                            card.status === 'pending' ? 'secondary' : 'destructive'
                          }>
                            {card.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(card.number.replace(/\s/g, ''), `card-${idx}`)}
                          >
                            {copiedField === `card-${idx}` ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
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
                Crie usuários para simular pagamentos no sandbox
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-blue-500/10 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-1 text-blue-500" />
                  <div className="text-sm text-blue-600">
                    <p><strong>Nota:</strong> A criação de usuários de teste usa a Edge Function que acessa o secret MERCADO_PAGO_ACCESS_TOKEN.</p>
                  </div>
                </div>
              </div>

              <Button onClick={createTestUser} disabled={creatingUser}>
                {creatingUser ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <Users className="h-4 w-4 mr-2" />
                    Criar Usuário de Teste
                  </>
                )}
              </Button>

              {testUsers.length > 0 && (
                <div className="space-y-3 mt-4">
                  <h4 className="font-medium">Usuários Criados:</h4>
                  {testUsers.map((user) => (
                    <div key={user.id} className="p-3 border rounded-lg">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div><strong>ID:</strong> {user.id}</div>
                        <div><strong>Email:</strong> {user.email}</div>
                        {user.password && (
                          <div className="col-span-2"><strong>Senha:</strong> {user.password}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* FLUXO DE PAGAMENTO */}
        <TabsContent value="flow" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Webhook className="h-5 w-5" />
                Fluxo de Pagamento
              </CardTitle>
              <CardDescription>
                Visão geral do processo de checkout e validação
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 border rounded-lg">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">1</div>
                  <div>
                    <h4 className="font-medium">Usuário seleciona plano</h4>
                    <p className="text-sm text-muted-foreground">Frontend carrega planos da tabela subscription_plans e exibe opções</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 border rounded-lg">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">2</div>
                  <div>
                    <h4 className="font-medium">Criação do checkout</h4>
                    <p className="text-sm text-muted-foreground">
                      Edge Function <code className="bg-muted px-1 rounded">mercado-pago-checkout</code> cria preferência de pagamento no MP
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 border rounded-lg">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">3</div>
                  <div>
                    <h4 className="font-medium">Pagamento processado</h4>
                    <p className="text-sm text-muted-foreground">
                      Mercado Pago processa e envia webhook para <code className="bg-muted px-1 rounded">mercado-pago-webhook</code>
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 border rounded-lg">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">4</div>
                  <div>
                    <h4 className="font-medium">Atualização do sistema</h4>
                    <p className="text-sm text-muted-foreground">
                      Webhook atualiza tabelas: payments, user_subscriptions, profiles (cliente_ativo, situacao, data_vencimento)
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 border rounded-lg bg-green-500/5">
                  <div className="flex-shrink-0 w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold">✓</div>
                  <div>
                    <h4 className="font-medium text-green-700">Acesso liberado</h4>
                    <p className="text-sm text-muted-foreground">
                      Usuário recebe acesso e notificação WhatsApp de confirmação
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">Edge Functions envolvidas:</h4>
                <ul className="text-sm space-y-1">
                  <li>• <code>mercado-pago-checkout</code> - Cria preferência de pagamento</li>
                  <li>• <code>mercado-pago-webhook</code> - Recebe notificações do MP</li>
                  <li>• <code>mercado-pago-test</code> - Testa conexão com API</li>
                  <li>• <code>send-whatsapp</code> - Envia notificações de confirmação</li>
                </ul>
              </div>
            </CardContent>
          </Card>
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
                Possíveis status retornados pelo Mercado Pago
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {PAYMENT_STATUSES.map((status) => (
                  <div key={status.status} className="flex items-center gap-3 p-3 border rounded-lg">
                    <div className={`h-3 w-3 rounded-full ${status.color}`} />
                    <div className="flex-1">
                      <p className="font-mono text-sm font-medium">{status.status}</p>
                      <p className="text-xs text-muted-foreground">{status.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default MercadoPagoUnifiedIntegration;
