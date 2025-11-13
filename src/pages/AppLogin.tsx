import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Tv, User } from 'lucide-react';
import { toast } from 'sonner';
import { useClientes } from '@/hooks/useClientes';
import { verifyPassword } from '@/lib/auth';
import adminsData from '@/data/admins.json';

export default function AppLogin() {
  const navigate = useNavigate();
  const { clientes } = useClientes();
  const [macAddress, setMacAddress] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Formatar MAC automaticamente
  const formatMacAddress = (value: string): string => {
    const cleaned = value.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
    const formatted = cleaned.match(/.{1,2}/g)?.join(':') || cleaned;
    return formatted.substring(0, 17);
  };

  const handleMacChange = (value: string) => {
    setMacAddress(formatMacAddress(value));
  };

  const handleMacLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (macAddress.length !== 17) {
      toast.error('MAC inválido', {
        description: 'O endereço MAC deve ter 17 caracteres (XX:XX:XX:XX:XX:XX)',
      });
      return;
    }

    setIsLoading(true);

    try {
      // Buscar cliente pelo MAC
      const cliente = clientes.find(c => 
        c.macSmartOne?.toUpperCase() === macAddress.toUpperCase()
      );

      if (!cliente) {
        toast.error('MAC não encontrado', {
          description: 'Este endereço MAC não está cadastrado no sistema.',
        });
        setIsLoading(false);
        return;
      }

      // Verificar se o cliente está ativo
      if (!cliente.clienteAtivo) {
        toast.error('Acesso bloqueado', {
          description: 'Seu acesso foi desativado. Entre em contato com o suporte.',
        });
        setIsLoading(false);
        return;
      }

      // Verificar se está em dia com pagamento
      const dataVencimento = new Date(cliente.dataVencimento);
      const hoje = new Date();
      
      if (dataVencimento < hoje) {
        toast.error('Pagamento em atraso', {
          description: 'Sua assinatura está vencida. Regularize seu pagamento para continuar.',
        });
        setIsLoading(false);
        return;
      }

      // Salvar sessão do cliente no localStorage
      localStorage.setItem('app_session', JSON.stringify({
        type: 'client',
        clienteId: cliente.id,
        nome: cliente.nome,
        mac: cliente.macSmartOne,
        m3uUrl: cliente.usuario, // URL da playlist M3U
        expiresAt: cliente.dataVencimento,
      }));

      toast.success('Login realizado!', {
        description: `Bem-vindo, ${cliente.nome}!`,
      });

      navigate('/app');
    } catch (error) {
      console.error('Erro no login:', error);
      toast.error('Erro no login', {
        description: 'Não foi possível fazer login. Tente novamente.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Verificar se é administrador
      const admin = adminsData.find(a => a.email === email);

      if (admin && admin.ativo) {
        // Verificar senha usando hash
        const senhaCorreta = await verifyPassword(password, admin.passwordHash);
        
        if (senhaCorreta) {
          // Salvar sessão de admin
          localStorage.setItem('app_session', JSON.stringify({
            type: 'admin',
            email: email,
            nome: admin.nome,
          }));

          toast.success('Login de administrador realizado!');
          navigate('/app');
        } else {
          toast.error('Credenciais inválidas', {
            description: 'Email ou senha incorretos.',
          });
        }
      } else {
        toast.error('Credenciais inválidas', {
          description: 'Email ou senha incorretos.',
        });
      }
    } catch (error) {
      console.error('Erro no login de admin:', error);
      toast.error('Erro no login', {
        description: 'Não foi possível fazer login. Tente novamente.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-6">
          <Tv className="w-16 h-16 mx-auto mb-4 text-primary" />
          <h1 className="text-3xl font-bold mb-2">IPTV LINK</h1>
          <p className="text-muted-foreground">
            Faça login para assistir TV ao vivo
          </p>
        </div>

        <Tabs defaultValue="client" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="client">Cliente</TabsTrigger>
            <TabsTrigger value="admin">Administrador</TabsTrigger>
          </TabsList>

          {/* Login por MAC (Cliente) */}
          <TabsContent value="client">
            <form onSubmit={handleMacLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mac">Endereço MAC</Label>
                <Input
                  id="mac"
                  placeholder="AA:BB:CC:DD:EE:FF"
                  value={macAddress}
                  onChange={(e) => handleMacChange(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Digite o endereço MAC do seu dispositivo
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  'Entrar'
                )}
              </Button>
            </form>
          </TabsContent>

          {/* Login por Email/Senha (Admin) */}
          <TabsContent value="admin">
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>
                    <User className="mr-2 h-4 w-4" />
                    Entrar como Admin
                  </>
                )}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <div className="mt-6 text-center">
          <Button
            variant="link"
            onClick={() => navigate('/')}
          >
            Voltar para o site
          </Button>
        </div>
      </Card>
    </div>
  );
}
