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
import { toast } from "sonner";
import { Loader2, Save, TestTube, Zap, MessageCircle, Package, FileText, Settings } from "lucide-react";
import * as sigmaService from "@/services/sigmaBlaze/sigmaBlazeService";
import type { SigmaBlazeConfig, SigmaFlag, PackageMapping, SigmaLog } from "@/services/sigmaBlaze/sigmaBlazeService";

export function SigmaBlazeIntegration() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<SigmaBlazeConfig | null>(null);
  const [flags, setFlags] = useState<SigmaFlag[]>([]);
  const [mappings, setMappings] = useState<PackageMapping[]>([]);
  const [logs, setLogs] = useState<SigmaLog[]>([]);
  const [logFilter, setLogFilter] = useState<{ action?: string; status?: string }>({});
  const [apiKeyInput, setApiKeyInput] = useState("");

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    const [cfg, flgs, maps, lgs] = await Promise.all([
      sigmaService.getConfig(),
      sigmaService.getFlags(),
      sigmaService.getPackageMappings(),
      sigmaService.getLogs(),
    ]);
    setConfig(cfg);
    setFlags(flgs);
    setMappings(maps);
    setLogs(lgs);
    setLoading(false);
  }

  async function handleSaveConfig() {
    if (!config) return;
    setSaving(true);
    const success = await sigmaService.saveConfig({
      ...config,
      raw_api_key: apiKeyInput || undefined,
    });
    if (success) toast.success("Configuração salva!");
    else toast.error("Erro ao salvar configuração");
    setSaving(false);
    setApiKeyInput("");
    loadAll();
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
      {/* API Config */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuração da API
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>URL da API</Label>
              <Input
                value={config?.api_url || ""}
                onChange={e => setConfig(prev => prev ? { ...prev, api_url: e.target.value } : prev)}
                placeholder="https://api.sigmablaze.com"
              />
            </div>
            <div className="space-y-2">
              <Label>API Key</Label>
              <Input
                value={apiKeyInput}
                onChange={e => setApiKeyInput(e.target.value)}
                placeholder={config?.api_key || "Inserir nova API Key"}
                type="password"
              />
            </div>
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
          <div className="flex items-center gap-4">
            <Button onClick={handleSaveConfig} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar Configuração
            </Button>
            <Button variant="outline" onClick={() => toast.info("Teste de conexão em breve")}>
              <TestTube className="h-4 w-4 mr-2" />
              Testar Conexão
            </Button>
          </div>
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
            <p className="text-sm text-muted-foreground">Nenhum mapeamento configurado. Adicione planos na tabela subscription_package_mapping.</p>
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
