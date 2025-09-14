import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DollarSign, MousePointer, ShoppingCart, Copy, Eye, LogOut, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const AffiliateDashboard = () => {
  const [affiliate, setAffiliate] = useState<any>(null);
  const [stats, setStats] = useState({
    clicks: 0,
    sales: 0,
    commission: 0,
    paid: 0,
  });
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
    loadAffiliateData();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/affiliate/login');
      return;
    }

    const { data: affiliateData } = await supabase
      .from('affiliates')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!affiliateData) {
      navigate('/affiliate/login');
    }
  };

  const loadAffiliateData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Carregar dados do afiliado
      const { data: affiliateData, error: affiliateError } = await supabase
        .from('affiliates')
        .select('*')
        .eq('id', user.id)
        .single();

      if (affiliateError) throw affiliateError;
      setAffiliate(affiliateData);

      // Carregar estatísticas
      setStats({
        clicks: affiliateData.total_clicks,
        sales: affiliateData.total_sales,
        commission: affiliateData.total_commission,
        paid: affiliateData.total_paid,
      });

      // Carregar vendas recentes
      const { data: salesData, error: salesError } = await supabase
        .from('affiliate_sales')
        .select('*')
        .eq('affiliate_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (salesError) throw salesError;
      setRecentSales(salesData || []);

    } catch (error: any) {
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyAffiliateLink = () => {
    if (!affiliate) return;
    
    const link = `${window.location.origin}/?ref=${affiliate.affiliate_code}`;
    navigator.clipboard.writeText(link);
    
    toast({
      title: "Link copiado!",
      description: "Seu link de afiliado foi copiado para a área de transferência",
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/affiliate/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!affiliate) {
    navigate('/affiliate/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gradient-accent">Dashboard do Afiliado</h1>
            <p className="text-muted-foreground">Bem-vindo, {affiliate.name}!</p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>

        <div className="grid gap-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-gradient-card border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Cliques</CardTitle>
                <MousePointer className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">{stats.clicks}</div>
                <p className="text-xs text-muted-foreground">
                  Cliques no seu link
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Vendas</CardTitle>
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-accent">{stats.sales}</div>
                <p className="text-xs text-muted-foreground">
                  Conversões realizadas
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Comissão Total</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">
                  R$ {stats.commission.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Comissão acumulada
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Valor Pago</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-accent">
                  R$ {stats.paid.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Já recebido
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Affiliate Link */}
          <Card className="bg-gradient-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Copy className="h-5 w-5" />
                Seu Link de Afiliado
              </CardTitle>
              <CardDescription>
                Compartilhe este link para ganhar comissões em cada venda
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  value={`${window.location.origin}/?ref=${affiliate.affiliate_code}`}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button onClick={copyAffiliateLink} variant="outline">
                  <Copy className="h-4 w-4" />
                  Copiar
                </Button>
              </div>
              <div className="mt-4 p-4 bg-muted/30 rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">
                  <strong>Seu código:</strong> {affiliate.affiliate_code}
                </p>
                <p className="text-sm text-muted-foreground">
                  <strong>Taxa de comissão:</strong> {affiliate.commission_rate}%
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Recent Sales */}
          <Card className="bg-gradient-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Vendas Recentes
              </CardTitle>
              <CardDescription>
                Suas últimas conversões e comissões
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentSales.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma venda registrada ainda
                </div>
              ) : (
                <div className="space-y-4">
                  {recentSales.map((sale) => (
                    <div
                      key={sale.id}
                      className="flex items-center justify-between p-4 border border-border rounded-lg bg-card"
                    >
                      <div>
                        <p className="font-medium text-foreground">
                          Venda de R$ {sale.order_value.toFixed(2)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(sale.created_at).toLocaleDateString('pt-BR')} às{' '}
                          {new Date(sale.created_at).toLocaleTimeString('pt-BR')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-primary">
                          R$ {sale.commission_amount.toFixed(2)}
                        </p>
                        <Badge variant={sale.status === 'paid' ? 'default' : 'secondary'}>
                          {sale.status === 'paid' ? 'Pago' : 'Pendente'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AffiliateDashboard;