/**
 * AffiliateDashboard - Página dedicada para afiliados
 * Visualização de estatísticas, indicações e saques
 */

import { useState } from "react";
import { useMyAffiliate } from "@/hooks/useAffiliates";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
  DollarSign, Users, TrendingUp, Copy, Check, 
  Wallet, ArrowDownToLine, CreditCard, Loader2,
  Clock, CheckCircle, XCircle, AlertCircle, Share2
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function AffiliateDashboard() {
  const { affiliate, referrals, withdrawals, loading, updatePixInfo, requestWithdrawal, refresh } = useMyAffiliate();
  const [copiedCode, setCopiedCode] = useState(false);
  const [withdrawDialog, setWithdrawDialog] = useState(false);
  const [pixDialog, setPixDialog] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawType, setWithdrawType] = useState<'pix' | 'credit'>('pix');
  const [pixKey, setPixKey] = useState("");
  const [pixKeyType, setPixKeyType] = useState<'cpf' | 'phone' | 'email' | 'random'>('cpf');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const copyAffiliateCode = () => {
    if (!affiliate) return;
    const code = `AFILIADO-${affiliate.id.slice(0, 8).toUpperCase()}`;
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    toast.success("Código copiado!");
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const shareLink = () => {
    if (!affiliate) return;
    const link = `${window.location.origin}/checkout?ref=${affiliate.id.slice(0, 8)}`;
    navigator.clipboard.writeText(link);
    toast.success("Link de indicação copiado!");
  };

  const handleWithdrawSubmit = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) {
      toast.error("Valor inválido");
      return;
    }
    
    if (withdrawType === 'pix' && !affiliate?.pix_key) {
      toast.error("Configure sua chave PIX primeiro");
      setWithdrawDialog(false);
      setPixDialog(true);
      return;
    }

    setIsSubmitting(true);
    const result = await requestWithdrawal(amount, withdrawType);
    setIsSubmitting(false);
    
    if (result.success) {
      toast.success(withdrawType === 'pix' ? "Saque solicitado com sucesso!" : "Crédito aplicado com sucesso!");
      setWithdrawDialog(false);
      setWithdrawAmount("");
    } else {
      toast.error(typeof result.error === 'string' ? result.error : "Erro ao solicitar saque");
    }
  };

  const handlePixSubmit = async () => {
    if (!pixKey.trim()) {
      toast.error("Informe a chave PIX");
      return;
    }

    setIsSubmitting(true);
    const result = await updatePixInfo(pixKey, pixKeyType);
    setIsSubmitting(false);
    
    if (result.success) {
      toast.success("Chave PIX atualizada!");
      setPixDialog(false);
    } else {
      toast.error("Erro ao atualizar chave PIX");
    }
  };

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
      pending: { label: 'Pendente', variant: 'secondary', icon: <Clock className="h-3 w-3" /> },
      confirmed: { label: 'Confirmado', variant: 'default', icon: <CheckCircle className="h-3 w-3" /> },
      paid: { label: 'Pago', variant: 'default', icon: <CheckCircle className="h-3 w-3" /> },
      cancelled: { label: 'Cancelado', variant: 'destructive', icon: <XCircle className="h-3 w-3" /> },
      processing: { label: 'Processando', variant: 'secondary', icon: <Loader2 className="h-3 w-3 animate-spin" /> },
      completed: { label: 'Concluído', variant: 'default', icon: <CheckCircle className="h-3 w-3" /> },
      rejected: { label: 'Rejeitado', variant: 'destructive', icon: <XCircle className="h-3 w-3" /> },
    };
    const config = configs[status] || { label: status, variant: 'outline' as const, icon: null };
    return (
      <Badge variant={config.variant} className="gap-1">
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/30 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!affiliate) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/30 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-6">
            <AlertCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Você não é um afiliado</h2>
            <p className="text-muted-foreground mb-4">
              O programa de afiliados é exclusivo para membros convidados. 
              Entre em contato conosco para saber como participar.
            </p>
            <Button onClick={() => window.location.href = '/'}>
              Voltar ao início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const affiliateCode = `AFILIADO-${affiliate.id.slice(0, 8).toUpperCase()}`;
  const shareUrl = `${window.location.origin}/checkout?ref=${affiliate.id.slice(0, 8)}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <motion.div 
          className="mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl font-bold">Painel do Afiliado</h1>
          <p className="text-muted-foreground">Bem-vindo(a), {affiliate.name}!</p>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total de Indicações</p>
                    <p className="text-3xl font-bold">{affiliate.total_referrals}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Ganho</p>
                    <p className="text-3xl font-bold text-green-500">
                      R$ {affiliate.total_earnings.toFixed(2).replace('.', ',')}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-green-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Saldo Disponível</p>
                    <p className="text-3xl font-bold text-blue-500">
                      R$ {affiliate.available_balance.toFixed(2).replace('.', ',')}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <Wallet className="h-6 w-6 text-blue-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Comissão</p>
                    <p className="text-3xl font-bold text-purple-500">
                      {affiliate.commission_type === 'percentage' 
                        ? `${affiliate.commission_value}%` 
                        : `R$ ${affiliate.commission_value.toFixed(2).replace('.', ',')}`
                      }
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-purple-500/10 flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-purple-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Share Section */}
        <motion.div 
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="h-5 w-5" />
                Compartilhe e Ganhe
              </CardTitle>
              <CardDescription>
                Use seu código ou link para indicar novos clientes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Seu Código de Indicação</Label>
                  <div className="flex gap-2">
                    <Input value={affiliateCode} readOnly className="font-mono" />
                    <Button variant="outline" size="icon" onClick={copyAffiliateCode}>
                      {copiedCode ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Link de Indicação</Label>
                  <div className="flex gap-2">
                    <Input value={shareUrl} readOnly className="text-xs" />
                    <Button variant="outline" size="icon" onClick={shareLink}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Actions */}
        <div className="flex flex-wrap gap-4 mb-8">
          <Button onClick={() => setWithdrawDialog(true)} disabled={affiliate.available_balance <= 0}>
            <ArrowDownToLine className="h-4 w-4 mr-2" />
            Solicitar Saque
          </Button>
          <Button variant="outline" onClick={() => setPixDialog(true)}>
            <CreditCard className="h-4 w-4 mr-2" />
            {affiliate.pix_key ? 'Alterar Chave PIX' : 'Configurar Chave PIX'}
          </Button>
        </div>

        {/* Tabs for Referrals and Withdrawals */}
        <Tabs defaultValue="referrals" className="space-y-4">
          <TabsList>
            <TabsTrigger value="referrals">Indicações ({referrals.length})</TabsTrigger>
            <TabsTrigger value="withdrawals">Saques ({withdrawals.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="referrals">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Indicações</CardTitle>
              </CardHeader>
              <CardContent>
                {referrals.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma indicação ainda</p>
                    <p className="text-sm">Compartilhe seu código para começar a ganhar!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {referrals.map((ref) => (
                      <div key={ref.id} className="flex items-center justify-between p-4 rounded-lg border bg-card">
                        <div>
                          <p className="font-medium">{ref.plan_purchased || 'Plano não especificado'}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(ref.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-500">
                            +R$ {ref.commission_earned.toFixed(2).replace('.', ',')}
                          </p>
                          {getStatusBadge(ref.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="withdrawals">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Saques</CardTitle>
              </CardHeader>
              <CardContent>
                {withdrawals.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum saque realizado</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {withdrawals.map((w) => (
                      <div key={w.id} className="flex items-center justify-between p-4 rounded-lg border bg-card">
                        <div>
                          <p className="font-medium">
                            {w.withdrawal_type === 'pix' ? 'Saque via PIX' : 'Crédito na assinatura'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(w.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                          </p>
                          {w.rejection_reason && (
                            <p className="text-sm text-destructive">{w.rejection_reason}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-bold">
                            R$ {w.amount.toFixed(2).replace('.', ',')}
                          </p>
                          {getStatusBadge(w.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Withdraw Dialog */}
        <Dialog open={withdrawDialog} onOpenChange={setWithdrawDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Solicitar Saque</DialogTitle>
              <DialogDescription>
                Saldo disponível: R$ {affiliate.available_balance.toFixed(2).replace('.', ',')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Tipo de saque</Label>
                <Select value={withdrawType} onValueChange={(v) => setWithdrawType(v as 'pix' | 'credit')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX (transferência)</SelectItem>
                    <SelectItem value="credit">Crédito na assinatura</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  placeholder="0,00"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  max={affiliate.available_balance}
                />
              </div>
              {withdrawType === 'pix' && !affiliate.pix_key && (
                <p className="text-sm text-amber-500">
                  Você precisa configurar sua chave PIX primeiro
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setWithdrawDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleWithdrawSubmit} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Solicitar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* PIX Dialog */}
        <Dialog open={pixDialog} onOpenChange={setPixDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Configurar Chave PIX</DialogTitle>
              <DialogDescription>
                Configure sua chave PIX para receber saques
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Tipo de chave</Label>
                <Select value={pixKeyType} onValueChange={(v) => setPixKeyType(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cpf">CPF</SelectItem>
                    <SelectItem value="phone">Telefone</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="random">Chave Aleatória</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Chave PIX</Label>
                <Input
                  placeholder={
                    pixKeyType === 'cpf' ? '000.000.000-00' :
                    pixKeyType === 'phone' ? '(00) 00000-0000' :
                    pixKeyType === 'email' ? 'email@exemplo.com' :
                    'Chave aleatória'
                  }
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPixDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handlePixSubmit} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
