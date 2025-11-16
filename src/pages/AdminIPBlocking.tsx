import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Shield, Ban, CheckCircle2, AlertTriangle, Plus } from "lucide-react";
import { ipBlockingService, IPBlock } from "@/services/ipBlockingService";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function AdminIPBlocking() {
  const [blockedIPs, setBlockedIPs] = useState<IPBlock[]>([]);
  const [stats, setStats] = useState({
    totalBlocked: 0,
    autoBlocked: 0,
    manualBlocked: 0,
    activeBlocks: 0,
    expiredBlocks: 0
  });
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newBlock, setNewBlock] = useState({
    ip: '',
    reason: '',
    severity: 'medium' as 'low' | 'medium' | 'high',
    expiresInHours: '24',
    notes: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [ips, statistics] = await Promise.all([
      ipBlockingService.getBlockedIPs(true),
      ipBlockingService.getBlockingStats()
    ]);
    setBlockedIPs(ips);
    setStats(statistics);
    setLoading(false);
  };

  const handleBlockIP = async () => {
    if (!newBlock.ip || !newBlock.reason) {
      toast({
        title: "Erro",
        description: "Preencha o IP e o motivo",
        variant: "destructive"
      });
      return;
    }

    const success = await ipBlockingService.blockIP(
      newBlock.ip,
      newBlock.reason,
      newBlock.severity,
      parseInt(newBlock.expiresInHours),
      newBlock.notes
    );

    if (success) {
      toast({
        title: "IP bloqueado",
        description: `O IP ${newBlock.ip} foi bloqueado com sucesso`
      });
      setDialogOpen(false);
      setNewBlock({
        ip: '',
        reason: '',
        severity: 'medium',
        expiresInHours: '24',
        notes: ''
      });
      loadData();
    } else {
      toast({
        title: "Erro",
        description: "Falha ao bloquear IP",
        variant: "destructive"
      });
    }
  };

  const handleUnblockIP = async (ip: string) => {
    const success = await ipBlockingService.unblockIP(ip);

    if (success) {
      toast({
        title: "IP desbloqueado",
        description: `O IP ${ip} foi desbloqueado com sucesso`
      });
      loadData();
    } else {
      toast({
        title: "Erro",
        description: "Falha ao desbloquear IP",
        variant: "destructive"
      });
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  const isExpired = (expiresAt?: string) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) <= new Date();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Bloqueio de IPs
          </h1>
          <p className="text-muted-foreground">
            Gerenciar lista de IPs bloqueados e ameaças
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Bloquear IP
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Bloquear Novo IP</DialogTitle>
              <DialogDescription>
                Adicione um IP à lista de bloqueio manualmente
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Endereço IP</Label>
                <Input
                  value={newBlock.ip}
                  onChange={(e) => setNewBlock({ ...newBlock, ip: e.target.value })}
                  placeholder="192.168.1.1"
                />
              </div>
              <div>
                <Label>Motivo</Label>
                <Input
                  value={newBlock.reason}
                  onChange={(e) => setNewBlock({ ...newBlock, reason: e.target.value })}
                  placeholder="Múltiplas tentativas de login"
                />
              </div>
              <div>
                <Label>Severidade</Label>
                <Select value={newBlock.severity} onValueChange={(v: any) => setNewBlock({ ...newBlock, severity: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Expiração (horas)</Label>
                <Input
                  type="number"
                  value={newBlock.expiresInHours}
                  onChange={(e) => setNewBlock({ ...newBlock, expiresInHours: e.target.value })}
                  placeholder="24"
                />
              </div>
              <div>
                <Label>Notas (opcional)</Label>
                <Textarea
                  value={newBlock.notes}
                  onChange={(e) => setNewBlock({ ...newBlock, notes: e.target.value })}
                  placeholder="Informações adicionais"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleBlockIP}>
                  Bloquear IP
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bloqueados</CardTitle>
            <Ban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalBlocked}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Auto-Bloqueados</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.autoBlocked}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Manuais</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.manualBlocked}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ativos</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.activeBlocks}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expirados</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.expiredBlocks}</div>
          </CardContent>
        </Card>
      </div>

      {/* Blocked IPs List */}
      <Card>
        <CardHeader>
          <CardTitle>IPs Bloqueados</CardTitle>
          <CardDescription>Lista de todos os IPs bloqueados no sistema</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8">Carregando...</p>
          ) : blockedIPs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum IP bloqueado</p>
          ) : (
            <div className="space-y-3">
              {blockedIPs.map((block) => (
                <div key={block.id} className="flex items-start justify-between p-4 border rounded-lg">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold">{block.ip_address}</span>
                      <Badge variant={getSeverityColor(block.severity)}>
                        {block.severity}
                      </Badge>
                      {block.auto_blocked && (
                        <Badge variant="secondary">Auto-bloqueado</Badge>
                      )}
                      {isExpired(block.expires_at) && (
                        <Badge variant="outline">Expirado</Badge>
                      )}
                      {block.unblocked_at && (
                        <Badge variant="secondary">Desbloqueado</Badge>
                      )}
                    </div>
                    <p className="text-sm">{block.reason}</p>
                    {block.notes && (
                      <p className="text-sm text-muted-foreground">{block.notes}</p>
                    )}
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>Bloqueado: {format(new Date(block.blocked_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                      {block.expires_at && (
                        <span>Expira: {format(new Date(block.expires_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                      )}
                      {block.failed_attempts > 0 && (
                        <span>{block.failed_attempts} tentativas falhas</span>
                      )}
                    </div>
                  </div>
                  {!block.unblocked_at && !isExpired(block.expires_at) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUnblockIP(block.ip_address)}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Desbloquear
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
