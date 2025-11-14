import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, User, Mail, Phone, Calendar, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ClienteData {
  id: string;
  nome: string;
  email: string | null;
  telefone: string;
  situacao: string | null;
  data_vencimento: string | null;
  plano: string | null;
}

export default function ClienteAccount() {
  const navigate = useNavigate();
  const { user, signOut, loading: authLoading } = useAuth();
  const [cliente, setCliente] = useState<ClienteData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && user) {
      fetchClienteData();
    }
  }, [user, authLoading]);

  const fetchClienteData = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching cliente:', error);
        toast.error('Erro ao carregar dados do cliente');
        return;
      }

      setCliente(data);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    toast.success('Logout realizado com sucesso');
    navigate('/');
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">
              Nenhum dado de cliente encontrado
            </p>
            <Button onClick={handleLogout} className="w-full mt-4">
              Voltar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getSituacaoBadge = (situacao: string | null) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      'Testando': 'secondary',
      'Ativo': 'default',
      'Devendo': 'destructive',
      'Inativo': 'outline',
    };
    return (
      <Badge variant={variants[situacao || ''] || 'outline'}>
        {situacao || 'Sem status'}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted p-4">
      <div className="max-w-4xl mx-auto space-y-6 py-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Minha Conta</h1>
          <Button onClick={handleLogout} variant="outline">
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Informações Pessoais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Nome:</span>
              <span>{cliente.nome}</span>
            </div>
            
            {cliente.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Email:</span>
                <span>{cliente.email}</span>
              </div>
            )}
            
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Telefone:</span>
              <span>{cliente.telefone}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status da Assinatura</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="font-medium">Situação:</span>
              {getSituacaoBadge(cliente.situacao)}
            </div>
            
            {cliente.plano && (
              <div className="flex items-center gap-2">
                <span className="font-medium">Plano:</span>
                <Badge variant="outline">{cliente.plano}</Badge>
              </div>
            )}
            
            {cliente.data_vencimento && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Vencimento:</span>
                <span>{new Date(cliente.data_vencimento).toLocaleDateString('pt-BR')}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Precisa de ajuda?</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Entre em contato conosco através do WhatsApp ou email
            </p>
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <a href="https://wa.me/5511999999999" target="_blank" rel="noopener noreferrer">
                  WhatsApp
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href="mailto:contato@exemplo.com">
                  Email
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
