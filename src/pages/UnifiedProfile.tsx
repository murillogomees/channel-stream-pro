/**
 * UnifiedProfile - Página unificada de perfil do usuário
 * Mostra informações da conta, assinatura e histórico de pagamentos
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  User, 
  Mail, 
  Phone, 
  Calendar, 
  CreditCard,
  LogOut,
  Shield,
  Lock,
  Download,
  Receipt,
  Tv,
  Loader2,
  Save,
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import jsPDF from 'jspdf';

interface ClienteData {
  id: string;
  nome: string;
  email: string | null;
  telefone: string;
  plano: string | null;
  situacao: string | null;
  data_vencimento: string | null;
  data_contratacao: string | null;
  valor_pago: number | null;
}

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  payment_method: string | null;
  payment_type: string | null;
  description: string | null;
  payer_email: string | null;
  paid_at: string | null;
  created_at: string;
  mercado_pago_payment_id: string | null;
  metadata: any;
}

interface Subscription {
  id: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  plan: {
    name: string;
    price: number;
    period: string;
  } | null;
}

export default function UnifiedProfile() {
  const navigate = useNavigate();
  const { user, isAdmin, signOut } = useAuth();
  const { toast: shadcnToast } = useToast();
  
  const [cliente, setCliente] = useState<ClienteData | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  // Password change state
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }

    try {
      // Load cliente data
      const { data: clienteData } = await supabase
        .from('clientes')
        .select('id, nome, email, telefone, plano, situacao, data_vencimento, data_contratacao, valor_pago')
        .eq('user_id', user.id)
        .maybeSingle();

      if (clienteData) {
        setCliente(clienteData);
      }

      // Load payments
      const { data: paymentsData } = await supabase
        .from('payments')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (paymentsData) {
        setPayments(paymentsData as Payment[]);
      }

      // Load subscription
      const { data: subscriptionData } = await supabase
        .from('user_subscriptions')
        .select(`
          id,
          status,
          current_period_start,
          current_period_end,
          cancel_at_period_end,
          plan_id,
          subscription_plans (
            name,
            price,
            period
          )
        `)
        .eq('user_id', user.id)
        .maybeSingle();

      if (subscriptionData) {
        setSubscription({
          ...subscriptionData,
          plan: subscriptionData.subscription_plans as any
        });
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      toast.success('Logout realizado com sucesso');
      navigate('/login', { replace: true });
    } catch (error) {
      toast.error('Erro ao fazer logout');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!novaSenha || !confirmarSenha) {
      shadcnToast({
        title: "Erro de validação",
        description: "Preencha a nova senha e confirmação.",
        variant: "destructive",
      });
      return;
    }

    if (novaSenha !== confirmarSenha) {
      shadcnToast({
        title: "Erro de validação",
        description: "As senhas não coincidem.",
        variant: "destructive",
      });
      return;
    }

    if (novaSenha.length < 6) {
      shadcnToast({
        title: "Erro de validação",
        description: "A senha deve ter pelo menos 6 caracteres.",
        variant: "destructive",
      });
      return;
    }

    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: novaSenha });
      if (error) throw error;

      shadcnToast({
        title: "Senha atualizada",
        description: "Sua senha foi atualizada com sucesso.",
      });
      setNovaSenha("");
      setConfirmarSenha("");
    } catch (error: any) {
      shadcnToast({
        title: "Erro ao atualizar senha",
        description: error.message || "Ocorreu um erro ao atualizar a senha.",
        variant: "destructive",
      });
    } finally {
      setSavingPassword(false);
    }
  };

  const generatePaymentPDF = (payment: Payment) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(40, 40, 40);
    doc.text('Comprovante de Pagamento', 105, 25, { align: 'center' });
    
    // Logo placeholder
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text('IPTV Link', 20, 20);
    
    // Divider
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 35, 190, 35);
    
    // Payment details
    doc.setFontSize(11);
    doc.setTextColor(60, 60, 60);
    
    let y = 50;
    const lineHeight = 10;
    
    const addLine = (label: string, value: string) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, 20, y);
      doc.setFont('helvetica', 'normal');
      doc.text(value, 80, y);
      y += lineHeight;
    };
    
    addLine('ID da Transação:', payment.mercado_pago_payment_id || payment.id);
    addLine('Data:', formatDate(payment.paid_at || payment.created_at));
    addLine('Valor:', formatCurrency(payment.amount));
    addLine('Status:', getStatusLabel(payment.status));
    addLine('Método:', payment.payment_method || 'Não especificado');
    addLine('Tipo:', payment.payment_type || 'Não especificado');
    
    if (payment.description) {
      addLine('Descrição:', payment.description);
    }
    
    if (payment.payer_email) {
      addLine('Email do Pagador:', payment.payer_email);
    }
    
    // Footer
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 250, 190, 250);
    
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text('Este documento é um comprovante de pagamento gerado automaticamente.', 105, 260, { align: 'center' });
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 105, 267, { align: 'center' });
    
    // Download
    const fileName = `comprovante-${payment.mercado_pago_payment_id || payment.id}.pdf`;
    doc.save(fileName);
    
    toast.success('Comprovante baixado com sucesso!');
  };

  const getSituacaoColor = (situacao: string | null) => {
    switch (situacao?.toLowerCase()) {
      case 'ativo':
      case 'active':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'pendente':
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'cancelado':
      case 'canceled':
      case 'inadimplente':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved':
      case 'paid':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'pending':
      case 'in_process':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'rejected':
      case 'cancelled':
      case 'refunded':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      'approved': 'Aprovado',
      'paid': 'Pago',
      'pending': 'Pendente',
      'in_process': 'Em Processamento',
      'rejected': 'Rejeitado',
      'cancelled': 'Cancelado',
      'refunded': 'Reembolsado',
    };
    return statusMap[status.toLowerCase()] || status;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    try {
      return format(new Date(dateStr), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return '-';
    }
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    try {
      return format(new Date(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return '-';
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const backPath = isAdmin ? '/admin/dashboard' : '/app/player';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="flex items-center justify-between p-4 max-w-4xl mx-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(backPath)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">Meu Perfil</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="p-4 max-w-4xl mx-auto pb-24">
        {/* Profile Header */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-8 h-8 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold">{cliente?.nome || user?.nome || 'Usuário'}</h2>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                <div className="flex items-center gap-2 mt-2">
                  {cliente?.situacao && (
                    <Badge variant="outline" className={getSituacaoColor(cliente.situacao)}>
                      {cliente.situacao}
                    </Badge>
                  )}
                  {cliente?.plano && (
                    <Badge variant="secondary">{cliente.plano}</Badge>
                  )}
                  {isAdmin && (
                    <Badge variant="default">Admin</Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="subscription" className="space-y-4">
          <ScrollArea className="w-full whitespace-nowrap">
            <TabsList className="inline-flex h-auto min-w-full p-1 bg-muted">
              <TabsTrigger value="subscription" className="flex-shrink-0 px-3 py-2 text-sm">
                <CreditCard className="w-4 h-4 mr-2" />
                Assinatura
              </TabsTrigger>
              <TabsTrigger value="payments" className="flex-shrink-0 px-3 py-2 text-sm">
                <Receipt className="w-4 h-4 mr-2" />
                Pagamentos
              </TabsTrigger>
              <TabsTrigger value="account" className="flex-shrink-0 px-3 py-2 text-sm">
                <User className="w-4 h-4 mr-2" />
                Conta
              </TabsTrigger>
              <TabsTrigger value="security" className="flex-shrink-0 px-3 py-2 text-sm">
                <Shield className="w-4 h-4 mr-2" />
                Segurança
              </TabsTrigger>
            </TabsList>
            <ScrollBar orientation="horizontal" className="invisible" />
          </ScrollArea>

          {/* Subscription Tab */}
          <TabsContent value="subscription" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tv className="w-5 h-5" />
                  Detalhes da Assinatura
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Plano Atual</p>
                    <p className="font-medium">
                      {subscription?.plan?.name || cliente?.plano || 'Nenhum plano ativo'}
                    </p>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Valor</p>
                    <p className="font-medium">
                      {subscription?.plan?.price 
                        ? formatCurrency(subscription.plan.price)
                        : cliente?.valor_pago 
                          ? formatCurrency(cliente.valor_pago)
                          : '-'
                      }
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Data de Contratação</p>
                    <p className="font-medium">
                      {formatDate(subscription?.current_period_start || cliente?.data_contratacao)}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Próximo Vencimento</p>
                    <p className="font-medium">
                      {formatDate(subscription?.current_period_end || cliente?.data_vencimento)}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge variant="outline" className={getSituacaoColor(subscription?.status || cliente?.situacao)}>
                      {subscription?.status || cliente?.situacao || 'Desconhecido'}
                    </Badge>
                  </div>

                  {subscription?.cancel_at_period_end && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Cancelamento</p>
                      <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500">
                        Cancela no vencimento
                      </Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="w-5 h-5" />
                  Histórico de Pagamentos
                </CardTitle>
                <CardDescription>
                  Todos os pagamentos realizados via Mercado Pago
                </CardDescription>
              </CardHeader>
              <CardContent>
                {payments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum pagamento encontrado</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {payments.map((payment) => (
                      <div 
                        key={payment.id}
                        className="border rounded-lg p-4 space-y-3"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(payment.status)}
                            <span className="font-medium">{formatCurrency(payment.amount)}</span>
                          </div>
                          <Badge variant="outline" className={getSituacaoColor(payment.status)}>
                            {getStatusLabel(payment.status)}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <p className="text-muted-foreground text-xs">Data do Pagamento</p>
                            <p>{formatDateTime(payment.paid_at || payment.created_at)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">Forma de Pagamento</p>
                            <p>{payment.payment_method || '-'}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">Tipo</p>
                            <p>{payment.payment_type || '-'}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">ID Mercado Pago</p>
                            <p className="truncate text-xs">{payment.mercado_pago_payment_id || '-'}</p>
                          </div>
                        </div>

                        {payment.description && (
                          <p className="text-sm text-muted-foreground">{payment.description}</p>
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => generatePaymentPDF(payment)}
                          className="w-full sm:w-auto"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Baixar Comprovante
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Account Tab */}
          <TabsContent value="account" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Informações da Conta
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3 py-2">
                  <Mail className="w-5 h-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="text-sm">{user?.email || '-'}</p>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center gap-3 py-2">
                  <Phone className="w-5 h-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Telefone</p>
                    <p className="text-sm">{cliente?.telefone || user?.telefone || '-'}</p>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center gap-3 py-2">
                  <Calendar className="w-5 h-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Cliente desde</p>
                    <p className="text-sm">{formatDate(cliente?.data_contratacao || user?.created_at)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="w-5 h-5" />
                  Alterar Senha
                </CardTitle>
                <CardDescription>
                  Atualize sua senha de acesso
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="novaSenha">Nova Senha</Label>
                  <Input
                    id="novaSenha"
                    type="password"
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    placeholder="Digite a nova senha"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmarSenha">Confirmar Nova Senha</Label>
                  <Input
                    id="confirmarSenha"
                    type="password"
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    placeholder="Confirme a nova senha"
                  />
                </div>

                <Button 
                  onClick={handleUpdatePassword}
                  disabled={savingPassword}
                  className="w-full"
                >
                  {savingPassword ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Atualizar Senha
                </Button>
              </CardContent>
            </Card>

            {isAdmin && (
              <Card>
                <CardHeader>
                  <CardTitle>Segurança Avançada</CardTitle>
                  <CardDescription>
                    Configurações adicionais de segurança
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    onClick={() => navigate('/admin/seguranca')}
                    variant="outline"
                    className="w-full"
                  >
                    <Shield className="w-4 h-4 mr-2" />
                    Configurar 2FA e Segurança
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Logout Button */}
        <div className="mt-6">
          <Button
            variant="destructive"
            className="w-full"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saindo...
              </>
            ) : (
              <>
                <LogOut className="w-4 h-4 mr-2" />
                Sair da Conta
              </>
            )}
          </Button>
        </div>

        {/* App Version */}
        <p className="text-center text-xs text-muted-foreground mt-4">
          IPTV Link v1.0.0
        </p>
      </div>
    </div>
  );
}
