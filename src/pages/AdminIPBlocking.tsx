/**
 * Admin IP Blocking Page - Simplified
 * Uses simplified IPBlock interface matching ip_blacklist table
 */

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Shield, Ban, CheckCircle2, Plus, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ipBlockingService, IPBlock } from "@/services/ipBlockingService";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function AdminIPBlocking() {
  const navigate = useNavigate();
  const [blockedIPs, setBlockedIPs] = useState<IPBlock[]>([]);
  const [stats, setStats] = useState({
    totalBlocked: 0,
    permanentBlocks: 0,
    temporaryBlocks: 0,
  });
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newBlock, setNewBlock] = useState({
    ip: '',
    reason: '',
    isPermanent: false,
    blockedUntil: '',
  });
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [ips, statistics] = await Promise.all([
      ipBlockingService.getBlockedIPs(),
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
      newBlock.isPermanent,
      newBlock.blockedUntil || undefined
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
        isPermanent: false,
        blockedUntil: '',
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
        description: `O IP ${ip} foi removido da lista de bloqueio`
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

  const isExpired = (blockedUntil?: string | null) => {
    if (!blockedUntil) return false;
    return new Date(blockedUntil) <= new Date();
  };

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
          <Button variant="outline" size="icon" onClick={() => navigate('/admin/dashboard')} className="flex-shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold flex items-center gap-2 flex-wrap">
              <Shield className="h-5 w-5 sm:h-8 sm:w-8 flex-shrink-0" />
              <span className="truncate">Bloqueio de IPs</span>
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
              Gerenciar lista de IPs bloqueados
            </p>
          </div>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto flex-shrink-0">
              <Plus className="h-4 w-4 mr-2" />
              Bloquear IP
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Bloquear Novo IP</DialogTitle>
              <DialogDescription>
                Adicione um IP à lista de bloqueio
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
                <Textarea
                  value={newBlock.reason}
                  onChange={(e) => setNewBlock({ ...newBlock, reason: e.target.value })}
                  placeholder="Múltiplas tentativas de login"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isPermanent"
                  checked={newBlock.isPermanent}
                  onChange={(e) => setNewBlock({ ...newBlock, isPermanent: e.target.checked })}
                />
                <Label htmlFor="isPermanent">Bloqueio permanente</Label>
              </div>
              {!newBlock.isPermanent && (
                <div>
                  <Label>Bloquear até</Label>
                  <Input
                    type="datetime-local"
                    value={newBlock.blockedUntil}
                    onChange={(e) => setNewBlock({ ...newBlock, blockedUntil: e.target.value })}
                  />
                </div>
              )}
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
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
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
            <CardTitle className="text-sm font-medium">Permanentes</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.permanentBlocks}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Temporários</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.temporaryBlocks}</div>
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
                      {block.is_permanent && (
                        <Badge variant="destructive">Permanente</Badge>
                      )}
                      {!block.is_permanent && isExpired(block.blocked_until) && (
                        <Badge variant="outline">Expirado</Badge>
                      )}
                    </div>
                    <p className="text-sm">{block.reason}</p>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>Criado: {block.created_at ? format(new Date(block.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : '-'}</span>
                      {block.blocked_until && (
                        <span>Expira: {format(new Date(block.blocked_until), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleUnblockIP(block.ip_address)}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Desbloquear
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
