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
  Tv,
  Shield,
  Settings,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ClienteData {
  id: string;
  nome: string;
  email: string | null;
  telefone: string;
  plano: string | null;
  situacao: string | null;
  data_vencimento: string | null;
  data_contratacao: string | null;
}

export default function AppProfile() {
  const navigate = useNavigate();
  const [cliente, setCliente] = useState<ClienteData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    loadClienteData();
  }, []);

  const loadClienteData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/app/login', { replace: true });
        return;
      }

      const { data: clienteData, error } = await supabase
        .from('clientes')
        .select('id, nome, email, telefone, plano, situacao, data_vencimento, data_contratacao')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (clienteData) {
        setCliente(clienteData);
      }
    } catch (error) {
      console.error('Error loading cliente:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await supabase.auth.signOut();
      toast.success('Logout realizado com sucesso');
      navigate('/app/login', { replace: true });
    } catch (error) {
      toast.error('Erro ao fazer logout');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const getSituacaoColor = (situacao: string | null) => {
    switch (situacao) {
      case 'ativo':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'pendente':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'cancelado':
      case 'inadimplente':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    try {
      return format(new Date(dateStr), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    } catch {
      return '-';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="flex items-center justify-between p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/app/player')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">Meu Perfil</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="p-4 space-y-4 pb-24">
        {/* Profile Header */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-8 h-8 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold">{cliente?.nome || 'Usuário'}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className={getSituacaoColor(cliente?.situacao || null)}>
                    {cliente?.situacao || 'Desconhecido'}
                  </Badge>
                  {cliente?.plano && (
                    <Badge variant="secondary">{cliente.plano}</Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account Info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Informações da Conta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 py-2">
              <Mail className="w-5 h-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm">{cliente?.email || '-'}</p>
              </div>
            </div>
            <Separator />
            <div className="flex items-center gap-3 py-2">
              <Phone className="w-5 h-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Telefone</p>
                <p className="text-sm">{cliente?.telefone || '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Subscription Info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Assinatura
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 py-2">
              <Tv className="w-5 h-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Plano Atual</p>
                <p className="text-sm font-medium">{cliente?.plano || 'Nenhum plano'}</p>
              </div>
            </div>
            <Separator />
            <div className="flex items-center gap-3 py-2">
              <Calendar className="w-5 h-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Data de Vencimento</p>
                <p className="text-sm">{formatDate(cliente?.data_vencimento || null)}</p>
              </div>
            </div>
            <Separator />
            <div className="flex items-center gap-3 py-2">
              <Calendar className="w-5 h-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Cliente desde</p>
                <p className="text-sm">{formatDate(cliente?.data_contratacao || null)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Ações Rápidas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <button
              onClick={() => navigate('/app/player')}
              className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Tv className="w-5 h-5 text-primary" />
                <span>Ir para Player</span>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
          </CardContent>
        </Card>

        {/* Logout Button */}
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

        {/* App Version */}
        <p className="text-center text-xs text-muted-foreground">
          IPTV Link v1.0.0
        </p>
      </div>
    </div>
  );
}
