import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Save, TestTube, Zap, MessageCircle, Package, FileText, Settings, Shield, CheckCircle2, XCircle, Globe } from "lucide-react";
import * as sigmaService from "@/services/sigmaBlaze/sigmaBlazeService";
import type { SigmaBlazeConfig, SigmaFlag, PackageMapping, SigmaLog } from "@/services/sigmaBlaze/sigmaBlazeService";

export function SigmaBlazeIntegration() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; details?: any } | null>(null);
  const [config, setConfig] = useState<SigmaBlazeConfig | null>(null);
  const [flags, setFlags] = useState<SigmaFlag[]>([]);
  const [mappings, setMappings] = useState<PackageMapping[]>([]);
  const [logs, setLogs] = useState<SigmaLog[]>([]);
  const [logFilter, setLogFilter] = useState<{ action?: string; status?: string }>({});
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [proxyPassInput, setProxyPassInput] = useState("");

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [cfg, flgs, maps, lgs] = await Promise.all([
        sigmaService.getConfig().catch(() => null),
        sigmaService.getFlags().catch(() => []),
        sigmaService.getPackageMappings().catch(() => []),
        sigmaService.getLogs().catch(() => []),
      ]);
      setConfig(cfg);
      setFlags(flgs);
      setMappings(maps);
      setLogs(lgs);
    } catch (e) {
      console.error('[SigmaBlaze] Error loading:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveConfig() {
    if (!config) return;
    setSaving(true);
    const success = await sigmaService.saveConfig({
      ...config,
      raw_api_key: apiKeyInput || undefined,
      raw_password: passwordInput || undefined,
      raw_proxy_pass: proxyPassInput || undefined,
    });
    if (success) toast.success("Configuração salva!");
    else toast.error("Erro ao salvar configuração");
    setSaving(false);
    setApiKeyInput("");
    setPasswordInput("");
    setProxyPassInput("");
    loadAll();
  }

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await sigmaService.triggerAction('test-connection', {});
      setTestResult({
        success: result.success,
        message: result.message || (result.success ? 'Conexão bem-sucedida!' : 'Falha na conexão'),
        details: (result as any).details,
      });
      if (result.success) toast.success("Teste de conexão OK!");
      else toast.error(result.message || "Falha no teste");
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Erro desconhecido' });
      toast.error("Erro no teste de conexão");
    }
    setTesting(false);
  }

  async function handleToggleFlag(flagName: string, enabled: boolean) {
    const success = await sigmaService.toggleFlag(flagName, enabled);
    if (success) {
      setFlags(prev => prev.map(f => f.flag_name === flagName ? { ...f, enabled } : f));
      toast.success(`${flagName} ${enabled ? 'ativada' : 'desativada'}`);
    } else {
      toast.error("Erro ao alterar flag");
    }
  }

  async function handleSaveMapping(mapping: PackageMapping) {
    const success = await sigmaService.saveMapping(mapping);
    if (success) toast.success("Mapeamento salvo!");
    else toast.error("Erro ao salvar mapeamento");
    loadAll();
  }

  async function handleFilterLogs() {
    const lgs = await sigmaService.getLogs(logFilter);
    setLogs(lgs);
  }

  const flagLabels: Record<string, { label: string; icon: React.ReactNode }> = {
    'SIGMA_AUTO_CREATE_CLIENT': { label: 'Auto Create Client', icon: <Zap className="h-4 w-4" /> },
    'SIGMA_AUTO_DELETE_CLIENT': { label: 'Auto Delete Client', icon: <Zap className="h-4 w-4" /> },
    'SIGMA_AUTO_UPDATE_PACKAGE': { label: 'Auto Update Package', icon: <Package className="h-4 w-4" /> },
    'SIGMA_WHATSAPP_ACTIVATION': { label: 'WhatsApp Activation', icon: <MessageCircle className="h-4 w-4" /> },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Credenciais & URL */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Credenciais & URL da API
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>URL do Painel Sigma</Label>
              <Input
                value={config?.api_url || ""}
                onChange={e => setConfig(prev => prev ? { ...prev, api_url: e.target.value } : prev)}
                placeholder="https://blaze.officeb.site/api"
              />
              <p className="text-xs text-muted-foreground">URL base da API (com ou sem /api)</p>
            </div>
            <div className="space-y-2">
              <Label>Usuário / Email Sigma</Label>
              <Input
                value={config?.sigma_username || ""}
                onChange={e => setConfig(prev => prev ? { ...prev, sigma_username: e.target.value } : prev)}
                placeholder="seu_usuario@email.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Senha Sigma</Label>
              <Input
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
                placeholder={config?.sigma_password || "Inserir nova senha"}
                type="password"
              />
              <p className="text-xs text-muted-foreground">Deixe vazio para manter a senha atual</p>
            </div>
            <div className="space-y-2">
              <Label>API Key (opcional)</Label>
              <Input
                value={apiKeyInput}
                onChange={e => setApiKeyInput(e.target.value)}
                placeholder={config?.api_key || "Inserir API Key se necessário"}
                type="password"
              />
            </div>
          </div>

          <Separator />

          {/* Proxy */}
          <div>
            <h4 className="flex items-center gap-2 text-sm font-semibold mb-3">
              <Shield className="h-4 w-4" />
              Configuração do Proxy (bypass Cloudflare)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Host do Proxy</Label>
                <Input
                  value={config?.proxy_host || ""}
                  onChange={e => setConfig(prev => prev ? { ...prev, proxy_host: e.target.value } : prev)}
                  placeholder="181.215.48.26"
                />
              </div>
              <div className="space-y-2">
                <Label>Porta</Label>
                <Input
                  type="number"
                  value={config?.proxy_port || ""}
                  onChange={e => setConfig(prev => prev ? { ...prev, proxy_port: parseInt(e.target.value) || 0 } : prev)}
                  placeholder="36621"
                />
              </div>
              <div className="space-y-2">
                <Label>Usuário do Proxy</Label>
                <Input
                  value={config?.proxy_user || ""}
                  onChange={e => setConfig(prev => prev ? { ...prev, proxy_user: e.target.value } : prev)}
                  placeholder="proxy_user"
                />
              </div>
              <div className="space-y-2">
                <Label>Senha do Proxy</Label>
                <Input
                  value={proxyPassInput}
                  onChange={e => setProxyPassInput(e.target.value)}
                  placeholder={config?.proxy_pass || "Inserir senha do proxy"}
                  type="password"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Proxy residencial para contornar proteção Cloudflare. Deixe vazio para conexão direta.
            </p>
          </div>

          <Separator />

          {/* WhatsApp */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>WhatsApp Admin</Label>
              <Input
                value={config?.admin_whatsapp_number || ""}
                onChange={e => setConfig(prev => prev ? { ...prev, admin_whatsapp_number: e.target.value } : prev)}
                placeholder="5511999999999"
              />
            </div>
            <div className="space-y-2">
              <Label>Template WhatsApp</Label>
              <Input
                value={config?.whatsapp_message_template || ""}
                onChange={e => setConfig(prev => prev ? { ...prev, whatsapp_message_template: e.target.value } : prev)}
                placeholder="Olá, quero ativar meu acesso."
              />
            </div>
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleSaveConfig} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar Configuração
            </Button>
            <Button variant="outline" onClick={handleTestConnection} disabled={testing}>
              {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <TestTube className="h-4 w-4 mr-2" />}
              Testar Conexão
            </Button>
          </div>

          {/* Test Result */}
          {testResult && (
            <div className={`p-4 rounded-lg border ${testResult.success ? 'border-green-500/50 bg-green-500/10' : 'border-red-500/50 bg-red-500/10'}`}>
              <div className="flex items-center gap-2 mb-2">
                {testResult.success ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <span className="font-semibold text-sm">
                  {testResult.success ? 'Conexão OK' : 'Falha na Conexão'}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{testResult.message}</p>
              {testResult.details && (
                <details className="mt-2">
                  <summary className="text-xs cursor-pointer text-muted-foreground">Detalhes técnicos</summary>
                  <pre className="text-xs mt-1 p-2 bg-muted rounded overflow-auto max-h-[200px]">
                    {JSON.stringify(testResult.details, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Feature Flags */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Automações (Feature Flags)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {flags.map(flag => {
              const meta = flagLabels[flag.flag_name] || { label: flag.flag_name, icon: null };
              return (
                <div key={flag.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-3">
                    {meta.icon}
                    <div>
                      <p className="font-medium text-sm">{meta.label}</p>
                      <p className="text-xs text-muted-foreground">{flag.description}</p>
                    </div>
                  </div>
                  <Switch
                    checked={flag.enabled}
                    onCheckedChange={v => handleToggleFlag(flag.flag_name, v)}
                  />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Package Mapping */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Mapeamento de Pacotes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {mappings.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum mapeamento configurado.</p>
          ) : (
            <div className="space-y-3">
              {mappings.map(m => (
                <div key={m.id} className="flex flex-col md:flex-row gap-3 p-3 rounded-lg border bg-card">
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium">{m.internal_plan_name}</p>
                    <Input
                      inputSize="sm"
                      value={m.sigma_package_id}
                      onChange={e => setMappings(prev => prev.map(x => x.id === m.id ? { ...x, sigma_package_id: e.target.value } : x))}
                      placeholder="Sigma Package ID"
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Nome Sigma</p>
                    <Input
                      inputSize="sm"
                      value={m.sigma_package_name}
                      onChange={e => setMappings(prev => prev.map(x => x.id === m.id ? { ...x, sigma_package_name: e.target.value } : x))}
                      placeholder="Sigma Package Name"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <Switch
                      checked={m.is_active}
                      onCheckedChange={v => setMappings(prev => prev.map(x => x.id === m.id ? { ...x, is_active: v } : x))}
                    />
                    <Button size="sm" onClick={() => handleSaveMapping(m)}>
                      <Save className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Logs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Select value={logFilter.action || "all"} onValueChange={v => setLogFilter(prev => ({ ...prev, action: v === "all" ? undefined : v }))}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="CREATE_CLIENT">Create</SelectItem>
                <SelectItem value="DELETE_CLIENT">Delete</SelectItem>
                <SelectItem value="UPDATE_PACKAGE">Update Package</SelectItem>
                <SelectItem value="SYNC_CLIENT">Sync</SelectItem>
                <SelectItem value="test-connection">Test Connection</SelectItem>
              </SelectContent>
            </Select>
            <Select value={logFilter.status || "all"} onValueChange={v => setLogFilter(prev => ({ ...prev, status: v === "all" ? undefined : v }))}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="SUCCESS">Success</SelectItem>
                <SelectItem value="ERROR">Error</SelectItem>
                <SelectItem value="SKIPPED_BY_FEATURE_FLAG">Skipped</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleFilterLogs}>Filtrar</Button>
          </div>
          <ScrollArea className="h-[300px]">
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum log encontrado</p>
            ) : (
              <div className="space-y-2">
                {logs.map(log => (
                  <div key={log.id} className="flex items-center gap-3 p-2 rounded border text-sm">
                    <Badge variant={log.status === 'SUCCESS' ? 'default' : log.status === 'ERROR' ? 'destructive' : 'secondary'}>
                      {log.status}
                    </Badge>
                    <span className="font-mono text-xs">{log.action}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {new Date(log.created_at).toLocaleString('pt-BR')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
