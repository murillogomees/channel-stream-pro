/**
 * AdminUserPayments - Registro de pagamentos do Mercado Pago
 * Exibe histórico completo de transações realizadas via Mercado Pago
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, RefreshCw, CreditCard, DollarSign, Calendar, TrendingUp, Eye, ExternalLink, User, Tag, UserCheck, Clock, Percent } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MercadoPagoPayment {
  id: string;
  user_id: string;
  mercado_pago_payment_id: string | null;
  mercado_pago_preference_id: string | null;
  amount: number;
  currency: string;
  status: string;
  payment_method: string | null;
  payment_type: string | null;
  description: string | null;
  external_reference: string | null;
  payer_email: string | null;
  metadata: any;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  user_name?: string;
  user_email?: string;
  user_phone?: string;
  plan?: string;
  affiliate_name?: string;
  coupon_code?: string;
  discount_amount?: number;
}

export default function AdminUserPayments() {
  const [payments, setPayments] = useState<MercadoPagoPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [selectedPayment, setSelectedPayment] = useState<MercadoPagoPayment | null>(null);

  useEffect(() => {
    loadPayments();
  }, []);

  const loadPayments = async () => {
    setLoading(true);
    try {
      // Buscar pagamentos do Mercado Pago (com mercado_pago_payment_id preenchido)
      const { data: paymentsData, error } = await supabase
        .from('payments')
        .select('*')
        .not('mercado_pago_payment_id', 'is', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Enriquecer com dados do usuário
      const enrichedPayments: MercadoPagoPayment[] = [];
      
      for (const payment of paymentsData || []) {
        let userData = { nome: '', email: '', contact_phone: '', plano: '' };
        
        if (payment.user_id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('nome, email, contact_phone, plano')
            .eq('id', payment.user_id)
            .single();
          
          if (profile) {
            userData = profile;
          }
        }

        // Extrair informações de desconto/afiliado do metadata
        const metadata = (payment.metadata || {}) as Record<string, any>;
        const mpData = (metadata.mercado_pago_data || {}) as Record<string, any>;
        
        enrichedPayments.push({
          ...payment,
          user_name: userData.nome || payment.payer_email?.split('@')[0] || 'Desconhecido',
          user_email: userData.email || payment.payer_email || '',
          user_phone: userData.contact_phone || '',
          plan: userData.plano || extractPlanFromDescription(payment.description),
          affiliate_name: metadata.affiliate_name as string || null,
          coupon_code: metadata.coupon_code as string || null,
          discount_amount: (metadata.discount_amount as number) || (mpData.coupon_amount as number) || 0,
        });
      }

      setPayments(enrichedPayments);
    } catch (error) {
      console.error('Erro ao carregar pagamentos:', error);
    } finally {
      setLoading(false);
    }
  };

  const extractPlanFromDescription = (description: string | null): string => {
    if (!description) return 'Não especificado';
    if (description.toLowerCase().includes('mensal')) return 'Mensal';
    if (description.toLowerCase().includes('trimestral')) return 'Trimestral';
    if (description.toLowerCase().includes('semestral')) return 'Semestral';
    if (description.toLowerCase().includes('anual')) return 'Anual';
    return 'Não especificado';
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      'approved': { variant: 'default', label: 'Aprovado' },
      'pending': { variant: 'secondary', label: 'Pendente' },
      'rejected': { variant: 'destructive', label: 'Rejeitado' },
      'cancelled': { variant: 'destructive', label: 'Cancelado' },
      'refunded': { variant: 'outline', label: 'Reembolsado' },
      'in_process': { variant: 'secondary', label: 'Em Processamento' },
    };
    const statusConfig = config[status] || { variant: 'secondary' as const, label: status };
    return <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>;
  };

  const getPaymentMethodLabel = (method: string | null, type: string | null): string => {
    if (method === 'pix') return 'PIX';
    if (method === 'credit_card' || type === 'credit_card') return 'Cartão de Crédito';
    if (method === 'debit_card' || type === 'debit_card') return 'Cartão de Débito';
    if (method === 'bolbradesco' || type === 'ticket') return 'Boleto';
    if (type === 'bank_transfer') return 'Transferência';
    return method || type || 'Não especificado';
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const filteredPayments = payments.filter(payment => {
    const matchesSearch = 
      payment.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.mercado_pago_payment_id?.includes(searchTerm) ||
      payment.payer_email?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || payment.status === statusFilter;
    const matchesMethod = methodFilter === 'all' || payment.payment_method === methodFilter;

    return matchesSearch && matchesStatus && matchesMethod;
  });

  const approvedPayments = payments.filter(p => p.status === 'approved');
  const stats = {
    total: approvedPayments.reduce((sum, p) => sum + Number(p.amount), 0),
    count: payments.length,
    approved: approvedPayments.length,
    avgTicket: approvedPayments.length > 0 ? approvedPayments.reduce((sum, p) => sum + Number(p.amount), 0) / approvedPayments.length : 0,
    thisMonth: approvedPayments.filter(p => 
      p.paid_at && new Date(p.paid_at).getMonth() === new Date().getMonth()
    ).reduce((sum, p) => sum + Number(p.amount), 0),
    totalDiscount: payments.reduce((sum, p) => sum + (p.discount_amount || 0), 0),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Recebido</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.total)}</p>
                <p className="text-xs text-muted-foreground mt-1">{stats.approved} aprovados</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Este Mês</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.thisMonth)}</p>
              </div>
              <Calendar className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ticket Médio</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.avgTicket)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Pagamentos</p>
                <p className="text-2xl font-bold">{stats.count}</p>
                <p className="text-xs text-muted-foreground mt-1">via Mercado Pago</p>
              </div>
              <CreditCard className="h-8 w-8 text-orange-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Pagamentos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Pagamentos Mercado Pago
          </CardTitle>
          <CardDescription>
            Transações realizadas exclusivamente via Mercado Pago
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email ou ID do pagamento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="approved">Aprovado</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="rejected">Rejeitado</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
                <SelectItem value="refunded">Reembolsado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger className="w-full md:w-44">
                <SelectValue placeholder="Método" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Métodos</SelectItem>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
                <SelectItem value="debit_card">Cartão de Débito</SelectItem>
                <SelectItem value="bolbradesco">Boleto</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={loadPayments}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Data</TableHead>
                  <TableHead className="whitespace-nowrap">ID MP</TableHead>
                  <TableHead className="whitespace-nowrap">Cliente</TableHead>
                  <TableHead className="whitespace-nowrap">Plano</TableHead>
                  <TableHead className="whitespace-nowrap">Valor</TableHead>
                  <TableHead className="whitespace-nowrap">Método</TableHead>
                  <TableHead className="whitespace-nowrap">Cupom/Afiliado</TableHead>
                  <TableHead className="whitespace-nowrap">Status</TableHead>
                  <TableHead className="whitespace-nowrap">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      Nenhum pagamento do Mercado Pago encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        <div>
                          <p>{format(new Date(payment.created_at), "dd/MM/yyyy", { locale: ptBR })}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(payment.created_at), "HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {payment.mercado_pago_payment_id || '-'}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{payment.user_name}</p>
                          <p className="text-xs text-muted-foreground">{payment.user_email || payment.payer_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{payment.plan}</Badge>
                      </TableCell>
                      <TableCell className="font-semibold whitespace-nowrap">
                        <div>
                          <p>{formatCurrency(Number(payment.amount))}</p>
                          {payment.discount_amount > 0 && (
                            <p className="text-xs text-green-600">-{formatCurrency(payment.discount_amount)}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {getPaymentMethodLabel(payment.payment_method, payment.payment_type)}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="space-y-1">
                          {payment.coupon_code && (
                            <Badge variant="secondary" className="text-xs">
                              <Tag className="h-3 w-3 mr-1" />
                              {payment.coupon_code}
                            </Badge>
                          )}
                          {payment.affiliate_name && (
                            <Badge variant="outline" className="text-xs">
                              <UserCheck className="h-3 w-3 mr-1" />
                              {payment.affiliate_name}
                            </Badge>
                          )}
                          {!payment.coupon_code && !payment.affiliate_name && (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(payment.status)}</TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setSelectedPayment(payment)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Detalhes */}
      <Dialog open={!!selectedPayment} onOpenChange={() => setSelectedPayment(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Detalhes do Pagamento
            </DialogTitle>
            <DialogDescription>
              ID Mercado Pago: {selectedPayment?.mercado_pago_payment_id}
            </DialogDescription>
          </DialogHeader>
          
          {selectedPayment && (
            <ScrollArea className="max-h-[70vh] pr-4">
              <div className="space-y-6">
                {/* Informações Principais */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <User className="h-3 w-3" /> Cliente
                    </p>
                    <p className="font-medium">{selectedPayment.user_name}</p>
                    <p className="text-sm text-muted-foreground">{selectedPayment.user_email}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <DollarSign className="h-3 w-3" /> Valor
                    </p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(Number(selectedPayment.amount))}
                    </p>
                  </div>
                </div>

                {/* Status e Método */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Status</p>
                    {getStatusBadge(selectedPayment.status)}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Método de Pagamento</p>
                    <p className="font-medium">
                      {getPaymentMethodLabel(selectedPayment.payment_method, selectedPayment.payment_type)}
                    </p>
                  </div>
                </div>

                {/* Datas */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Criado em
                    </p>
                    <p className="font-medium">
                      {format(new Date(selectedPayment.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  {selectedPayment.paid_at && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Pago em
                      </p>
                      <p className="font-medium">
                        {format(new Date(selectedPayment.paid_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  )}
                </div>

                {/* Plano e Descrição */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Plano</p>
                    <Badge variant="outline">{selectedPayment.plan}</Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Descrição</p>
                    <p className="text-sm">{selectedPayment.description || '-'}</p>
                  </div>
                </div>

                {/* Desconto/Cupom/Afiliado */}
                {(selectedPayment.coupon_code || selectedPayment.affiliate_name || selectedPayment.discount_amount > 0) && (
                  <div className="p-4 rounded-lg bg-muted/50 border">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Percent className="h-4 w-4" />
                      Descontos e Afiliados
                    </h4>
                    <div className="grid grid-cols-3 gap-4">
                      {selectedPayment.coupon_code && (
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Cupom</p>
                          <Badge variant="secondary">{selectedPayment.coupon_code}</Badge>
                        </div>
                      )}
                      {selectedPayment.discount_amount > 0 && (
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Desconto</p>
                          <p className="font-medium text-green-600">
                            -{formatCurrency(selectedPayment.discount_amount)}
                          </p>
                        </div>
                      )}
                      {selectedPayment.affiliate_name && (
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Afiliado</p>
                          <p className="font-medium">{selectedPayment.affiliate_name}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* IDs e Referências */}
                <div className="p-4 rounded-lg bg-muted/50 border">
                  <h4 className="font-medium mb-3">Identificadores</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ID Interno:</span>
                      <span className="font-mono">{selectedPayment.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ID Mercado Pago:</span>
                      <span className="font-mono">{selectedPayment.mercado_pago_payment_id}</span>
                    </div>
                    {selectedPayment.mercado_pago_preference_id && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">ID Preferência:</span>
                        <span className="font-mono">{selectedPayment.mercado_pago_preference_id}</span>
                      </div>
                    )}
                    {selectedPayment.external_reference && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Referência Externa:</span>
                        <span className="font-mono text-xs">{selectedPayment.external_reference}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">User ID:</span>
                      <span className="font-mono text-xs">{selectedPayment.user_id}</span>
                    </div>
                  </div>
                </div>

                {/* Email do Pagador */}
                {selectedPayment.payer_email && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Email do Pagador (Mercado Pago)</p>
                    <p className="text-sm">{selectedPayment.payer_email}</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
