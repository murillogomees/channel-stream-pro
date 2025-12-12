import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { 
  Key, 
  Shield, 
  Server, 
  RefreshCw, 
  Plus, 
  Trash2, 
  Copy, 
  CheckCircle2, 
  AlertTriangle,
  Clock,
  Terminal,
  Loader2,
  FileKey,
  History
} from 'lucide-react';
import { coolifyService, type CoolifySSHKey, type CoolifyServer } from '@/services/coolifyService';
import { supabase } from '@/integrations/supabase/client';

interface ApplyKeyFormData {
  host: string;
  user: string;
  environment: 'dev' | 'staging' | 'prod';
  keyId?: string;
  manualKey?: string;
}

interface AuditLogEntry {
  audit_id: string;
  action: string;
  host: string;
  user: string;
  status: string;
  created_at: string;
  details?: string;
}

export function SSHKeyManager() {
  const [loading, setLoading] = useState(true);
  const [sshKeys, setSSHKeys] = useState<CoolifySSHKey[]>([]);
  const [servers, setServers] = useState<CoolifyServer[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [formData, setFormData] = useState<ApplyKeyFormData>({
    host: '',
    user: 'root',
    environment: 'dev',
  });
  const [generatedCommands, setGeneratedCommands] = useState<{
    backup: string;
    apply: string;
    verify: string;
    rollback?: string;
  } | null>(null);
  const [processing, setProcessing] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [keysRes, serversRes] = await Promise.allSettled([
        coolifyService.listPrivateKeys(),
        coolifyService.listServers(),
      ]);

      if (keysRes.status === 'fulfilled' && keysRes.value.success) {
        setSSHKeys(keysRes.value.data || []);
      }

      if (serversRes.status === 'fulfilled' && serversRes.value.success) {
        setServers(serversRes.value.data || []);
      }

      // Fetch audit logs from the remote_command_audit table
      try {
        const { data: logs } = await supabase
          .from('remote_command_audit' as 'activity_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20);
        
        if (logs) {
          // Map database fields to our interface
          const mappedLogs: AuditLogEntry[] = (logs as unknown[]).map((log: Record<string, unknown>) => ({
            audit_id: String(log.audit_id || log.id || ''),
            action: String(log.action || ''),
            host: String(log.host || ''),
            user: String(log.user_remote || ''),
            status: String(log.status || 'pending'),
            created_at: String(log.created_at || new Date().toISOString()),
            details: log.details ? JSON.stringify(log.details) : undefined,
          }));
          setAuditLogs(mappedLogs);
        }
      } catch (err) {
        console.log('Audit table may not exist yet, using empty logs');
        setAuditLogs([]);
      }
    } catch (error) {
      console.error('Error fetching SSH data:', error);
      toast.error('Falha ao carregar dados SSH');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApplyKey = async () => {
    if (formData.environment === 'prod') {
      setConfirmDialogOpen(true);
      return;
    }
    await executeApplyKey();
  };

  const executeApplyKey = async () => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('remote-command', {
        body: {
          action: 'apply-ssh-key',
          host: formData.host,
          user: formData.user,
          environment: formData.environment,
          keyId: formData.keyId,
          publicKey: formData.manualKey,
        }
      });

      if (error) throw error;

      if (data.commands) {
        setGeneratedCommands(data.commands);
        toast.success(`Comandos gerados. Audit ID: ${data.audit_id}`);
      }

      // Refresh audit logs
      fetchData();
    } catch (error) {
      console.error('Error applying SSH key:', error);
      toast.error('Falha ao gerar comandos SSH');
    } finally {
      setProcessing(false);
      setConfirmDialogOpen(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado para a área de transferência`);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; color: string }> = {
      success: { variant: 'default', color: 'bg-green-500' },
      pending: { variant: 'outline', color: 'bg-yellow-500' },
      failed: { variant: 'destructive', color: 'bg-red-500' },
      rolled_back: { variant: 'secondary', color: 'bg-gray-500' },
    };
    const config = variants[status] || variants.pending;
    return <Badge variant={config.variant}>{status}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Key className="w-6 h-6 text-primary" />
          <div>
            <h3 className="text-lg font-semibold">Gerenciamento de Chaves SSH</h3>
            <p className="text-sm text-muted-foreground">
              Gerencie chaves SSH e aplique em servidores remotos
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* SSH Keys List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileKey className="w-4 h-4" />
              Chaves SSH no Coolify
            </CardTitle>
            <CardDescription>
              {sshKeys.length} chave(s) cadastrada(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {sshKeys.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhuma chave SSH encontrada
                </p>
              ) : (
                <div className="space-y-3">
                  {sshKeys.map((key) => (
                    <div 
                      key={key.uuid} 
                      className="p-3 rounded-lg border bg-muted/30 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{key.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {key.fingerprint?.slice(0, 16) || 'N/A'}
                        </Badge>
                      </div>
                      {key.description && (
                        <p className="text-xs text-muted-foreground">{key.description}</p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {new Date(key.created_at).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Apply Key Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Server className="w-4 h-4" />
              Aplicar Chave em Servidor
            </CardTitle>
            <CardDescription>
              Gere comandos para aplicar uma chave SSH em um servidor remoto
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="host">Host (IP/Hostname)</Label>
              <Input
                id="host"
                placeholder="192.168.1.100 ou server.example.com"
                value={formData.host}
                onChange={(e) => setFormData({ ...formData, host: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="user">Usuário Remoto</Label>
              <Input
                id="user"
                placeholder="root, ubuntu, deploy..."
                value={formData.user}
                onChange={(e) => setFormData({ ...formData, user: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="environment">Ambiente</Label>
              <Select
                value={formData.environment}
                onValueChange={(v) => setFormData({ ...formData, environment: v as 'dev' | 'staging' | 'prod' })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o ambiente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dev">Development</SelectItem>
                  <SelectItem value="staging">Staging</SelectItem>
                  <SelectItem value="prod">
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="w-3 h-3 text-yellow-500" />
                      Production (requer dupla confirmação)
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Fonte da Chave</Label>
              <Select
                value={formData.keyId || 'manual'}
                onValueChange={(v) => setFormData({ 
                  ...formData, 
                  keyId: v === 'manual' ? undefined : v,
                  manualKey: v === 'manual' ? formData.manualKey : undefined
                })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a fonte da chave" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Inserir manualmente</SelectItem>
                  {sshKeys.map((key) => (
                    <SelectItem key={key.uuid} value={key.uuid}>
                      {key.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!formData.keyId && (
              <div className="space-y-2">
                <Label htmlFor="manualKey">Chave Pública SSH</Label>
                <Textarea
                  id="manualKey"
                  placeholder="ssh-rsa AAAAB3... ou ssh-ed25519 AAAAC3..."
                  rows={3}
                  value={formData.manualKey || ''}
                  onChange={(e) => setFormData({ ...formData, manualKey: e.target.value })}
                />
              </div>
            )}

            <Button 
              className="w-full" 
              onClick={handleApplyKey}
              disabled={!formData.host || !formData.user || (!formData.keyId && !formData.manualKey) || processing}
            >
              {processing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Terminal className="w-4 h-4 mr-2" />
              )}
              Gerar Comandos
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Generated Commands */}
      {generatedCommands && (
        <Card className="border-primary/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              Comandos Gerados
            </CardTitle>
            <CardDescription>
              Execute estes comandos na ordem indicada
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Badge variant="outline">1</Badge> Backup
              </Label>
              <div className="flex gap-2">
                <code className="flex-1 p-3 bg-muted rounded text-xs overflow-x-auto">
                  {generatedCommands.backup}
                </code>
                <Button size="sm" variant="outline" onClick={() => copyToClipboard(generatedCommands.backup, 'Comando de backup')}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Badge variant="outline">2</Badge> Aplicar Chave
              </Label>
              <div className="flex gap-2">
                <code className="flex-1 p-3 bg-muted rounded text-xs overflow-x-auto">
                  {generatedCommands.apply}
                </code>
                <Button size="sm" variant="outline" onClick={() => copyToClipboard(generatedCommands.apply, 'Comando de aplicação')}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Badge variant="outline">3</Badge> Verificar Conexão
              </Label>
              <div className="flex gap-2">
                <code className="flex-1 p-3 bg-muted rounded text-xs overflow-x-auto">
                  {generatedCommands.verify}
                </code>
                <Button size="sm" variant="outline" onClick={() => copyToClipboard(generatedCommands.verify, 'Comando de verificação')}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Audit Log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="w-4 h-4" />
            Log de Auditoria
          </CardTitle>
          <CardDescription>
            Histórico de operações SSH
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px]">
            {auditLogs.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Nenhuma operação registrada
              </p>
            ) : (
              <div className="space-y-2">
                {auditLogs.map((log) => (
                  <div 
                    key={log.audit_id} 
                    className="flex items-center justify-between p-2 rounded bg-muted/30 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <code className="text-xs bg-background px-2 py-0.5 rounded">
                        {log.audit_id.slice(0, 8)}
                      </code>
                      <span>{log.action}</span>
                      <span className="text-muted-foreground">
                        {log.user}@{log.host}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(log.status)}
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleString('pt-BR')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Production Confirmation Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              Confirmação para Ambiente de Produção
            </AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a gerar comandos SSH para o ambiente de <strong>PRODUÇÃO</strong>. 
              Esta é uma operação sensível que pode afetar o acesso ao servidor.
              <br /><br />
              <code className="bg-muted p-2 rounded block mt-2">
                confirmo: aplicar chave SSH no host {formData.host} para o usuário {formData.user}
              </code>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={executeApplyKey} className="bg-yellow-600 hover:bg-yellow-700">
              {processing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Shield className="w-4 h-4 mr-2" />
              )}
              Confirmo a operação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
