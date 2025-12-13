/**
 * UnifiedProfile - Página de perfil do usuário estilo landing page
 * Aba Informações: cards de dados pessoais, plano, senha e logout
 * Aba Pagamentos: histórico de pagamentos
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, 
  User, 
  Mail, 
  Phone, 
  Calendar, 
  CreditCard,
  LogOut,
  Lock,
  Download,
  Receipt,
  Loader2,
  Save,
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Sparkles,
  Eye,
  EyeOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import jsPDF from 'jspdf';
import { AppLayout } from '@/components/layouts/AppLayout';
import { PlanCards } from '@/components/profile/PlanCards';
import { CurrentPlanCard } from '@/components/profile/CurrentPlanCard';
import { usePaymentRealtime } from '@/hooks/usePaymentRealtime';

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
  currency: string | null;
  status: string | null;
  payment_method: string | null;
  description: string | null;
  paid_at: string | null;
  created_at: string | null;
  external_id: string | null;
  external_provider: string | null;
  metadata: any;
}

export default function UnifiedProfile() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAdmin, signOut, refreshUser } = useAuth();
  const { toast: shadcnToast } = useToast();
  
  const isAppRoute = location.pathname.startsWith('/app');
  
  const [cliente, setCliente] = useState<ClienteData | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  // WhatsApp edit state
  const [whatsapp, setWhatsapp] = useState("");
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);
  
  // Password change state
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  
  // Plan selection state
  const [selectedPlan, setSelectedPlan] = useState<string>("");
  
  // Check if user is in trial or has active subscription - use AuthContext data for real-time updates
  const isTrialUser = user?.isTrial || cliente?.situacao === 'Testando';
  const hasActiveSubscription = (user?.hasValidAccess && !user?.isTrial) || (cliente?.situacao === 'Ativo' && cliente?.plano);
  
  // Get plan and expiration from user context (real-time) or fall back to cliente state
  const currentPlano = user?.clienteData?.plano || cliente?.plano;
  const currentSituacao = user?.clienteData?.situacao || cliente?.situacao;
  const currentDataVencimento = user?.clienteData?.data_vencimento || cliente?.data_vencimento;
  const currentValorPago = user?.clienteData?.valor_pago || cliente?.valor_pago;

  const loadData = useCallback(async () => {
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }

    try {
      // Load profile data (tabela unificada - não usar clientes que está deprecated)
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, nome, email, contact_phone, plano, situacao, data_vencimento, data_contratacao, valor_pago')
        .eq('id', user.id)
        .maybeSingle();

      if (profileData) {
        setCliente({
          id: profileData.id,
          nome: profileData.nome || '',
          email: profileData.email,
          telefone: profileData.contact_phone || '',
          plano: profileData.plano,
          situacao: profileData.situacao,
          data_vencimento: profileData.data_vencimento,
          data_contratacao: profileData.data_contratacao,
          valor_pago: profileData.valor_pago,
        });
        setWhatsapp(formatPhone(profileData.contact_phone || ''));
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
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  }, [user, navigate]);

  // Ativa escuta de atualizações de pagamento em tempo real com callback para recarregar dados locais
  usePaymentRealtime({
    onPaymentApproved: loadData,
    onProfileUpdated: loadData,
  });

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setWhatsapp(formatted);
  };

  const handleSaveWhatsapp = async () => {
    if (!user?.id) return;
    
    const phoneNumbers = whatsapp.replace(/\D/g, '');
    if (phoneNumbers.length < 10) {
      toast.error('Telefone inválido');
      return;
    }

    setSavingWhatsapp(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ contact_phone: phoneNumbers })
        .eq('id', user.id);

      if (error) throw error;
      toast.success('WhatsApp atualizado com sucesso!');
    } catch (error: any) {
      toast.error('Erro ao atualizar WhatsApp');
      console.error(error);
    } finally {
      setSavingWhatsapp(false);
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
    
    doc.setFontSize(20);
    doc.setTextColor(40, 40, 40);
    doc.text('Comprovante de Pagamento', 105, 25, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text('IPTV Link', 20, 20);
    
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 35, 190, 35);
    
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
    
    addLine('ID da Transação:', payment.external_id || payment.id);
    addLine('Data:', formatDate(payment.paid_at || payment.created_at));
    addLine('Valor:', formatCurrency(payment.amount));
    addLine('Status:', getStatusLabel(payment.status || 'pending'));
    addLine('Método:', payment.payment_method || 'Não especificado');
    
    if (payment.description) {
      addLine('Descrição:', payment.description);
    }
    
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 250, 190, 250);
    
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text('Este documento é um comprovante de pagamento gerado automaticamente.', 105, 260, { align: 'center' });
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 105, 267, { align: 'center' });
    const fileName = `comprovante-${payment.external_id || payment.id}.pdf`;
    doc.save(fileName);
    
    toast.success('Comprovante baixado com sucesso!');
  };

  const getSituacaoColor = (situacao: string | null) => {
    switch (situacao?.toLowerCase()) {
      case 'ativo':
      case 'active':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'testando':
      case 'trial':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
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

  const getPlanLabel = (plano: string | null, situacao: string | null) => {
    if (situacao === 'Testando') return 'Em teste';
    if (!plano) return '-';
    return plano;
  };

  if (isLoading) {
    const loadingContent = (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
    return isAppRoute ? <AppLayout>{loadingContent}</AppLayout> : loadingContent;
  }

  const backPath = isAdmin ? '/admin/dashboard' : '/app/home';

  const content = (
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
        {/* Tabs */}
        <Tabs defaultValue="info" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 h-12">
            <TabsTrigger value="info" className="text-sm">
              <User className="w-4 h-4 mr-2" />
              Informações
            </TabsTrigger>
            <TabsTrigger value="payments" className="text-sm">
              <Receipt className="w-4 h-4 mr-2" />
              Pagamentos
            </TabsTrigger>
          </TabsList>

          {/* Tab Informações */}
          <TabsContent value="info" className="space-y-4">
            {/* Card 1: Informações Pessoais */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  Informações Pessoais
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Email - Read only */}
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email
                  </Label>
                  <p className="text-foreground font-medium bg-muted/50 p-3 rounded-lg">
                    {user?.email || '-'}
                  </p>
                </div>

                {/* WhatsApp - Editable */}
                <div className="space-y-2">
                  <Label htmlFor="whatsapp" className="text-sm text-muted-foreground flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    WhatsApp
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="whatsapp"
                      type="tel"
                      placeholder="(11) 99999-9999"
                      value={whatsapp}
                      onChange={handlePhoneChange}
                      maxLength={15}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleSaveWhatsapp}
                      disabled={savingWhatsapp}
                      size="icon"
                      variant="outline"
                    >
                      {savingWhatsapp ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Informações do Plano - Diferente para usuários ativos vs trial */}
            {hasActiveSubscription ? (
              <CurrentPlanCard
                plano={currentPlano || 'Mensal'}
                situacao={currentSituacao || 'Ativo'}
                dataVencimento={currentDataVencimento}
                dataUltimoPagamento={payments[0]?.paid_at || null}
                valorPago={currentValorPago}
                isRecorrente={payments.length > 1}
              />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-primary" />
                    Meu Plano
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Data de Cadastro/Renovação */}
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Data de Cadastro
                      </p>
                      <p className="font-medium text-foreground">
                        {formatDate(cliente?.data_contratacao)}
                      </p>
                    </div>

                    {/* Data de Vencimento */}
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Vencimento
                      </p>
                      <p className="font-medium text-foreground">
                        {formatDate(currentDataVencimento)}
                      </p>
                    </div>

                    {/* Modelo do Plano */}
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">
                        Plano
                      </p>
                      <Badge variant="outline" className={getSituacaoColor(currentSituacao)}>
                        {getPlanLabel(currentPlano, currentSituacao)}
                      </Badge>
                    </div>
                  </div>

                  {/* Plan selection for trial users */}
                  {isTrialUser && (
                    <div className="mt-6 pt-6 border-t border-border">
                      <div className="flex items-center gap-2 mb-4">
                        <Sparkles className="w-5 h-5 text-primary" />
                        <h3 className="font-semibold text-foreground">Escolha seu plano</h3>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        Seu período de teste está ativo. Escolha um plano para continuar aproveitando após o término.
                      </p>
                      
                      <PlanCards 
                        selectedPlan={selectedPlan} 
                        onSelectPlan={setSelectedPlan} 
                      />

                      {selectedPlan && (
                        <Button 
                          className="w-full h-12 text-base mt-4"
                          onClick={() => navigate(`/checkout?plan=${selectedPlan}`)}
                        >
                          <CreditCard className="w-5 h-5 mr-2" />
                          Assinar Plano {selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)}
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Card 3: Alterar Senha */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="w-5 h-5 text-primary" />
                  Alterar Senha
                </CardTitle>
                <CardDescription>
                  Atualize sua senha de acesso
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="novaSenha">Nova Senha</Label>
                  <div className="relative">
                    <Input
                      id="novaSenha"
                      type={showPassword ? "text" : "password"}
                      value={novaSenha}
                      onChange={(e) => setNovaSenha(e.target.value)}
                      placeholder="Digite a nova senha"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmarSenha">Confirmar Nova Senha</Label>
                  <div className="relative">
                    <Input
                      id="confirmarSenha"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmarSenha}
                      onChange={(e) => setConfirmarSenha(e.target.value)}
                      placeholder="Confirme a nova senha"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button 
                  onClick={handleUpdatePassword}
                  disabled={savingPassword || !novaSenha || !confirmarSenha}
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

            {/* Logout Button */}
            <Button
              variant="destructive"
              className="w-full h-12"
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
          </TabsContent>

          {/* Tab Pagamentos */}
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
                            <p className="text-muted-foreground text-xs">Provedor</p>
                            <p>{payment.external_provider || '-'}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">ID Externo</p>
                            <p className="truncate text-xs">{payment.external_id || '-'}</p>
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
        </Tabs>

        {/* App Version */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          IPTV Link v1.0.0
        </p>
      </div>
    </div>
  );

  return isAppRoute ? <AppLayout allowScroll>{content}</AppLayout> : content;
}
