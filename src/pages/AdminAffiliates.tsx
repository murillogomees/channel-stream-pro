/**
 * AdminAffiliates - Gerenciamento de Afiliados
 * Criação, edição e visualização de afiliados e suas comissões
 */

import { useState } from "react";
import { useAffiliates, useAffiliateReferrals, useAffiliateWithdrawals, Affiliate } from "@/hooks/useAffiliates";
import { useCoupons } from "@/hooks/useCoupons";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Users, Plus, Edit, Trash2, DollarSign, TrendingUp,
  Wallet, CheckCircle, XCircle, Clock, Loader2, Search,
  Copy, ArrowDownToLine, AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function AdminAffiliates() {
  const { affiliates, loading: affiliatesLoading, createAffiliate, updateAffiliate, deleteAffiliate } = useAffiliates();
  const { referrals, loading: referralsLoading, confirmReferral, cancelReferral } = useAffiliateReferrals();
  const { withdrawals, loading: withdrawalsLoading, processWithdrawal } = useAffiliateWithdrawals();
  const { coupons, createCoupon } = useCoupons();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAffiliate, setEditingAffiliate] = useState<Affiliate | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    commission_type: "percentage" as 'percentage' | 'fixed',
    commission_value: 10,
    notes: "",
    status: "active" as 'active' | 'inactive' | 'suspended',
  });

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      commission_type: "percentage",
      commission_value: 10,
      notes: "",
      status: "active",
    });
    setEditingAffiliate(null);
  };

  const handleEdit = (affiliate: Affiliate) => {
    setEditingAffiliate(affiliate);
    setFormData({
      name: affiliate.name,
      email: affiliate.email || "",
      phone: affiliate.phone || "",
      commission_type: affiliate.commission_type,
      commission_value: affiliate.commission_value,
      notes: affiliate.notes || "",
      status: affiliate.status,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    setIsSubmitting(true);
    
    if (editingAffiliate) {
      const result = await updateAffiliate(editingAffiliate.id, formData);
      if (result.success) {
        toast.success("Afiliado atualizado!");
        setDialogOpen(false);
        resetForm();
      } else {
        toast.error("Erro ao atualizar afiliado");
      }
    } else {
      const result = await createAffiliate(formData);
      if (result.success) {
        toast.success("Afiliado criado!");
        setDialogOpen(false);
        resetForm();
      } else {
        toast.error("Erro ao criar afiliado");
      }
    }
    
    setIsSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este afiliado?")) return;
    
    const result = await deleteAffiliate(id);
    if (result.success) {
      toast.success("Afiliado excluído!");
    } else {
      toast.error("Erro ao excluir afiliado");
    }
  };

  const handleCreateCoupon = async (affiliate: Affiliate) => {
    const code = `${affiliate.name.split(' ')[0].toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    
    const result = await createCoupon({
      code,
      discount_type: affiliate.commission_type,
      discount_value: affiliate.commission_value,
      valid_from: new Date().toISOString(),
      valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      active: true,
    });

    if (result.success) {
      toast.success(`Cupom ${code} criado para ${affiliate.name}`);
    } else {
      toast.error("Erro ao criar cupom");
    }
  };

  const handleProcessWithdrawal = async (id: string, status: 'completed' | 'rejected', reason?: string) => {
    const result = await processWithdrawal(id, status, reason);
    if (result.success) {
      toast.success(status === 'completed' ? "Saque aprovado!" : "Saque rejeitado");
    } else {
      toast.error("Erro ao processar saque");
    }
  };

  const filteredAffiliates = affiliates.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      active: { label: 'Ativo', variant: 'default' },
      inactive: { label: 'Inativo', variant: 'secondary' },
      suspended: { label: 'Suspenso', variant: 'destructive' },
      pending: { label: 'Pendente', variant: 'secondary' },
      confirmed: { label: 'Confirmado', variant: 'default' },
      paid: { label: 'Pago', variant: 'default' },
      cancelled: { label: 'Cancelado', variant: 'destructive' },
      processing: { label: 'Processando', variant: 'secondary' },
      completed: { label: 'Concluído', variant: 'default' },
      rejected: { label: 'Rejeitado', variant: 'destructive' },
    };
    const config = configs[status] || { label: status, variant: 'outline' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  // Stats
  const totalAffiliates = affiliates.length;
  const activeAffiliates = affiliates.filter(a => a.status === 'active').length;
  const totalEarnings = affiliates.reduce((sum, a) => sum + a.total_earnings, 0);
  const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending').length;

  if (affiliatesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Programa de Afiliados</h1>
          <p className="text-muted-foreground">Gerencie afiliados e suas comissões</p>
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Afiliado
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total de Afiliados</p>
                <p className="text-2xl font-bold">{totalAffiliates}</p>
              </div>
              <Users className="h-8 w-8 text-primary/20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Afiliados Ativos</p>
                <p className="text-2xl font-bold text-green-500">{activeAffiliates}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500/20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total em Comissões</p>
                <p className="text-2xl font-bold text-blue-500">
                  R$ {totalEarnings.toFixed(2).replace('.', ',')}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-500/20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Saques Pendentes</p>
                <p className="text-2xl font-bold text-amber-500">{pendingWithdrawals}</p>
              </div>
              <Clock className="h-8 w-8 text-amber-500/20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="affiliates" className="space-y-4">
        <TabsList>
          <TabsTrigger value="affiliates">Afiliados</TabsTrigger>
          <TabsTrigger value="referrals">Indicações</TabsTrigger>
          <TabsTrigger value="withdrawals">
            Saques
            {pendingWithdrawals > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 justify-center">
                {pendingWithdrawals}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Affiliates Tab */}
        <TabsContent value="affiliates">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Lista de Afiliados</CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar afiliado..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Comissão</TableHead>
                    <TableHead>Indicações</TableHead>
                    <TableHead>Ganhos</TableHead>
                    <TableHead>Saldo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAffiliates.map((affiliate) => (
                    <TableRow key={affiliate.id}>
                      <TableCell className="font-medium">{affiliate.name}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>{affiliate.email || '-'}</p>
                          <p className="text-muted-foreground">{affiliate.phone || '-'}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {affiliate.commission_type === 'percentage' 
                          ? `${affiliate.commission_value}%`
                          : `R$ ${affiliate.commission_value.toFixed(2)}`
                        }
                      </TableCell>
                      <TableCell>{affiliate.total_referrals}</TableCell>
                      <TableCell className="text-green-500 font-medium">
                        R$ {affiliate.total_earnings.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-blue-500 font-medium">
                        R$ {affiliate.available_balance.toFixed(2)}
                      </TableCell>
                      <TableCell>{getStatusBadge(affiliate.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCreateCoupon(affiliate)}
                            title="Criar cupom"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(affiliate)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(affiliate.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredAffiliates.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Nenhum afiliado encontrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Referrals Tab */}
        <TabsContent value="referrals">
          <Card>
            <CardHeader>
              <CardTitle>Indicações</CardTitle>
              <CardDescription>Histórico de todas as indicações dos afiliados</CardDescription>
            </CardHeader>
            <CardContent>
              {referralsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Afiliado</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Comissão</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {referrals.map((ref) => (
                      <TableRow key={ref.id}>
                        <TableCell className="font-medium">
                          {ref.affiliate?.name || 'N/A'}
                        </TableCell>
                        <TableCell>{ref.plan_purchased || '-'}</TableCell>
                        <TableCell>
                          {ref.plan_value ? `R$ ${ref.plan_value.toFixed(2)}` : '-'}
                        </TableCell>
                        <TableCell className="text-green-500 font-medium">
                          R$ {ref.commission_earned.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {format(new Date(ref.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>{getStatusBadge(ref.status)}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            {ref.status === 'pending' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => confirmReferral(ref.id)}
                                  className="text-green-500 hover:text-green-600"
                                  title="Confirmar"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => cancelReferral(ref.id)}
                                  className="text-destructive hover:text-destructive"
                                  title="Cancelar"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {referrals.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Nenhuma indicação registrada
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Withdrawals Tab */}
        <TabsContent value="withdrawals">
          <Card>
            <CardHeader>
              <CardTitle>Solicitações de Saque</CardTitle>
              <CardDescription>Gerencie os saques solicitados pelos afiliados</CardDescription>
            </CardHeader>
            <CardContent>
              {withdrawalsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Afiliado</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Chave PIX</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {withdrawals.map((w) => (
                      <TableRow key={w.id}>
                        <TableCell className="font-medium">
                          {w.affiliate?.name || 'N/A'}
                        </TableCell>
                        <TableCell>
                          {w.withdrawal_type === 'pix' ? 'PIX' : 'Crédito'}
                        </TableCell>
                        <TableCell className="font-medium">
                          R$ {w.amount.toFixed(2)}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {w.pix_key || '-'}
                        </TableCell>
                        <TableCell>
                          {format(new Date(w.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell>{getStatusBadge(w.status)}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            {w.status === 'pending' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleProcessWithdrawal(w.id, 'completed')}
                                  className="text-green-500 hover:text-green-600"
                                  title="Aprovar"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    const reason = prompt("Motivo da rejeição:");
                                    if (reason) handleProcessWithdrawal(w.id, 'rejected', reason);
                                  }}
                                  className="text-destructive hover:text-destructive"
                                  title="Rejeitar"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {withdrawals.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Nenhuma solicitação de saque
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingAffiliate ? 'Editar Afiliado' : 'Novo Afiliado'}
            </DialogTitle>
            <DialogDescription>
              {editingAffiliate 
                ? 'Atualize os dados do afiliado'
                : 'Adicione um novo afiliado ao programa'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                placeholder="Nome completo"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="email@exemplo.com"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  placeholder="(00) 00000-0000"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Comissão</Label>
                <Select
                  value={formData.commission_type}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, commission_type: v as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Porcentagem (%)</SelectItem>
                    <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor da Comissão</Label>
                <Input
                  type="number"
                  placeholder={formData.commission_type === 'percentage' ? '10' : '50'}
                  value={formData.commission_value}
                  onChange={(e) => setFormData(prev => ({ ...prev, commission_value: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(v) => setFormData(prev => ({ ...prev, status: v as any }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                  <SelectItem value="suspended">Suspenso</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                placeholder="Observações sobre o afiliado..."
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingAffiliate ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
