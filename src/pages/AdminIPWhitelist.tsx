import { useState, useEffect } from 'react';
import { Shield, Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { ipWhitelistService, IPWhitelist } from '@/services/ipWhitelistService';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function AdminIPWhitelist() {
  const [whitelistedIPs, setWhitelistedIPs] = useState<IPWhitelist[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState('');
  
  const [newIP, setNewIP] = useState('');
  const [newDescription, setNewDescription] = useState('');

  useEffect(() => {
    loadWhitelistedIPs();
  }, []);

  const loadWhitelistedIPs = async () => {
    setLoading(true);
    const ips = await ipWhitelistService.getWhitelistedIPs();
    setWhitelistedIPs(ips);
    setLoading(false);
  };

  const handleAddIP = async () => {
    if (!newIP.trim()) {
      toast.error('Por favor, insira um endereço IP');
      return;
    }

    // Validação básica de IP
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(newIP.trim())) {
      toast.error('Por favor, insira um endereço IP válido');
      return;
    }

    const success = await ipWhitelistService.addToWhitelist(
      newIP.trim(),
      newDescription.trim() || undefined
    );

    if (success) {
      toast.success('IP adicionado à whitelist com sucesso');
      setShowAddDialog(false);
      setNewIP('');
      setNewDescription('');
      loadWhitelistedIPs();
    } else {
      toast.error('Erro ao adicionar IP à whitelist');
    }
  };

  const handleRemoveIP = async (id: string, ip: string) => {
    if (!confirm(`Tem certeza que deseja remover ${ip} da whitelist?`)) {
      return;
    }

    const success = await ipWhitelistService.removeFromWhitelist(id);

    if (success) {
      toast.success('IP removido da whitelist');
      loadWhitelistedIPs();
    } else {
      toast.error('Erro ao remover IP da whitelist');
    }
  };

  const handleStartEdit = (ip: IPWhitelist) => {
    setEditingId(ip.id);
    setEditDescription(ip.description || '');
  };

  const handleSaveEdit = async (id: string) => {
    const success = await ipWhitelistService.updateWhitelistEntry(id, editDescription);

    if (success) {
      toast.success('Descrição atualizada');
      setEditingId(null);
      loadWhitelistedIPs();
    } else {
      toast.error('Erro ao atualizar descrição');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditDescription('');
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            Whitelist de IPs Confiáveis
          </h1>
          <p className="text-muted-foreground mt-2">
            IPs nesta lista nunca são bloqueados automaticamente, mesmo com múltiplas tentativas de login
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar IP
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>IPs Confiáveis</CardTitle>
          <CardDescription>
            Total de {whitelistedIPs.length} IP(s) na whitelist
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando...
            </div>
          ) : whitelistedIPs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum IP na whitelist
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Endereço IP</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Adicionado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {whitelistedIPs.map((ip) => (
                  <TableRow key={ip.id}>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono">
                        {ip.ip_address}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {editingId === ip.id ? (
                        <Input
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          placeholder="Descrição..."
                          className="max-w-md"
                        />
                      ) : (
                        <span className="text-muted-foreground">
                          {ip.description || 'Sem descrição'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(ip.created_at).toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right">
                      {editingId === ip.id ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleSaveEdit(ip.id)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleCancelEdit}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleStartEdit(ip)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemoveIP(ip.id, ip.ip_address)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar IP à Whitelist</DialogTitle>
            <DialogDescription>
              Este IP nunca será bloqueado automaticamente pelo sistema
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ip">Endereço IP</Label>
              <Input
                id="ip"
                placeholder="192.168.1.1"
                value={newIP}
                onChange={(e) => setNewIP(e.target.value)}
                className="font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Textarea
                id="description"
                placeholder="Ex: Escritório principal, IP do servidor, etc."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddIP}>
              Adicionar IP
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
